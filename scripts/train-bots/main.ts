// Trains the computer levels of a game by letting bots play each other (see README, "Botların eğitimi").
//   node scripts/train-bots/run.mjs <game> bench            how long the ladder's bots think
//   node scripts/train-bots/run.mjs <game> train [games]     measure the ladder, place the 8 levels on it
//   node scripts/train-bots/run.mjs <game> verify [games]    play neighbouring levels against each other
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { makeRng } from '../../src/games/go/fastboard'
import { ANCHORS } from './anchors'
import { eloFromScore, fitElo, type Game } from './elo'
import { GAMES, type Bot, type Players } from './games'
import { NodeStockfish } from './stockfish-node'

interface Job {
  id: number
  game: string
  a: number
  b: number
  botA: Bot
  botB: Bot
  aIsWhite: boolean
  /** Same for the two games of a pair, so both colours get the same random opening. */
  openingSeed: number
}

interface Done extends Game {
  id: number
  plies: number
  ms: number
}

interface WorkerSetup {
  root: string
  cacheDir: string
}

// ---------------------------------------------------------------- worker: plays the games it is sent

async function playGame(job: Job, players: Players): Promise<Done> {
  const game = GAMES[job.game]
  const started = Date.now()
  await game.newGame?.(players)
  const openingRandom = makeRng(job.openingSeed)
  const moveRandom = makeRng(job.openingSeed * 7919 + (job.aIsWhite ? 1 : 2))
  let state = game.start()
  let plies = 0
  for (let i = 0; i < game.openingPlies && !game.result(state); i++) {
    const legal = game.legal(state)
    if (legal.length === 0) break
    state = game.play(state, legal[Math.floor(openingRandom() * legal.length)])
    plies++
  }
  let winner = game.result(state)
  while (!winner) {
    if (plies >= game.maxPlies) {
      winner = game.adjudicate(state)
      break
    }
    const side = game.turn(state)
    const aMoves = (side === 'w') === job.aIsWhite
    const move = await game.choose(state, aMoves ? job.botA : job.botB, players, moveRandom)
    state = game.play(state, move)
    plies++
    winner = game.result(state)
  }
  const aSide = job.aIsWhite ? 'w' : 'b'
  const score = winner === 'draw' ? 0.5 : winner === aSide ? 1 : 0
  return { id: job.id, a: job.a, b: job.b, score, plies, ms: Date.now() - started }
}

if (!isMainThread) {
  const setup = workerData as WorkerSetup
  let players: Players | null = null
  parentPort!.on('message', async (job: Job | null) => {
    if (!job) {
      players?.engines?.w.close()
      players?.engines?.b.close()
      process.exit(0)
    }
    if (!players) {
      players =
        job.game === 'chess'
          ? { engines: { w: new NodeStockfish(setup.root, setup.cacheDir), b: new NodeStockfish(setup.root, setup.cacheDir) } }
          : {}
    }
    parentPort!.postMessage(await playGame(job, players))
  })
}

// ---------------------------------------------------------------- main: hands out games, adds up the results

function projectRoot(): string {
  let dir = process.cwd()
  while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir)
  return dir
}

function runJobs(jobs: Job[], threads: number, label: string): Promise<Done[]> {
  const root = projectRoot()
  const setup: WorkerSetup = { root, cacheDir: join(root, 'node_modules/.cache/train-bots') }
  const results: Done[] = []
  const queue = [...jobs]
  const started = Date.now()
  let lastReport = 0
  return new Promise((resolve, reject) => {
    let running = 0
    const report = (force = false) => {
      const now = Date.now()
      if (!force && now - lastReport < 20000) return
      lastReport = now
      const done = results.length
      const elapsed = (now - started) / 1000
      const eta = done > 0 ? Math.round((elapsed / done) * (jobs.length - done)) : 0
      console.log(`${label}: ${done}/${jobs.length} oyun, ${Math.round(elapsed)} sn geçti, yaklaşık ${eta} sn kaldı`)
    }
    for (let t = 0; t < Math.min(threads, jobs.length); t++) {
      const worker = new Worker(fileURLToPath(import.meta.url), { workerData: setup })
      running++
      const next = () => {
        const job = queue.shift()
        if (job) worker.postMessage(job)
        else worker.postMessage(null)
      }
      worker.on('message', (done: Done) => {
        results.push(done)
        report()
        next()
      })
      worker.on('error', reject)
      worker.on('exit', () => {
        running--
        if (running === 0) {
          report(true)
          resolve(results)
        }
      })
      next()
    }
  })
}

/** Two games per opening (each bot plays both colours), `games` in all per pair. */
function pairJobs(game: string, pairs: [number, number][], bots: Bot[], games: number): Job[] {
  const jobs: Job[] = []
  let id = 0
  pairs.forEach(([a, b], p) => {
    for (let g = 0; g < games / 2; g++) {
      const openingSeed = 1000 * (p + 1) + g + 1
      for (const aIsWhite of [true, false]) jobs.push({ id: id++, game, a, b, botA: bots[a], botB: bots[b], aIsWhite, openingSeed })
    }
  })
  // The slow games (strong bots) first, so no thread is left with a long game at the end.
  return jobs.sort((x, y) => y.a + y.b - (x.a + x.b))
}

/** Settings between two bots of the ladder: depth, random games and carelessness blended. */
function blend(a: Bot, b: Bot, t: number): Bot {
  if (t <= 0.001) return a
  if (t >= 0.999) return b
  const none = { multiPV: 1, temperature: 0, randomMoveChance: 0 }
  const ha = a.humanize ?? none
  const hb = b.humanize ?? none
  const lerp = (x: number, y: number) => x + (y - x) * t
  const bot: Bot = { depth: 0 }
  const depth = lerp(a.depth, b.depth)
  bot.depth = Math.floor(depth + 1e-9)
  const deeper = Math.round((depth - bot.depth) * 100) / 100
  if (deeper > 0) bot.deeper = deeper
  if (a.playouts && b.playouts) bot.playouts = Math.round(Math.exp(lerp(Math.log(a.playouts), Math.log(b.playouts))) / 10) * 10
  const temperature = Math.round(lerp(ha.temperature, hb.temperature))
  const randomMoveChance = Math.round(lerp(ha.randomMoveChance, hb.randomMoveChance) * 1000) / 1000
  if (temperature >= 1 || randomMoveChance > 0) {
    bot.humanize = { multiPV: Math.max(ha.multiPV, hb.multiPV), temperature: Math.max(1, temperature), randomMoveChance }
  }
  const maxMs = b.maxMs ?? a.maxMs
  if (maxMs) bot.maxMs = maxMs
  return bot
}

/** Level k's place on the ladder: steps between levels grow by 15% each, from level 1 to level 8. */
const STEP_GROWTH = 1.15
function levelTargets(low: number, high: number): number[] {
  const steps = Array.from({ length: 7 }, (_, j) => STEP_GROWTH ** j)
  const total = steps.reduce((sum, s) => sum + s, 0)
  const targets = [low]
  for (const step of steps) targets.push(targets[targets.length - 1] + ((high - low) * step) / total)
  return targets
}

function placeOnLadder(elo: number[], target: number): number {
  for (let i = 0; i + 1 < elo.length; i++) {
    if (target <= elo[i + 1]) return i + (target - elo[i]) / (elo[i + 1] - elo[i] || 1)
  }
  return elo.length - 1
}

function resultsPath(game: string): string {
  return join(projectRoot(), 'scripts/train-bots/results', `${game}.json`)
}

function readResults(game: string): Record<string, unknown> {
  const path = resultsPath(game)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
}

function writeResults(game: string, data: Record<string, unknown>) {
  mkdirSync(dirname(resultsPath(game)), { recursive: true })
  writeFileSync(resultsPath(game), `${JSON.stringify(data, null, 2)}\n`)
}

const TRAINED_FILE: Record<string, { path: string; name: string; type: string; typeImport: string }> = {
  chess: {
    path: 'src/games/chess/engine/bots.trained.ts',
    name: 'CHESS_BOTS',
    type: 'BotStyle[]',
    typeImport: "import type { BotStyle } from '../../../core/humanize'",
  },
  mangala: { path: 'src/games/mangala/bots.trained.ts', name: 'TRAINED_BOTS', type: 'BotStyle[]', typeImport: "import type { BotStyle } from '../../core/humanize'" },
  dama: {
    path: 'src/games/dama/bots.trained.ts',
    name: 'TRAINED_BOTS',
    type: '(BotStyle & { maxMs?: number })[]',
    typeImport: "import type { BotStyle } from '../../core/humanize'",
  },
  reversi: {
    path: 'src/games/reversi/bots.trained.ts',
    name: 'TRAINED_BOTS',
    type: '(BotStyle & { maxMs?: number })[]',
    typeImport: "import type { BotStyle } from '../../core/humanize'",
  },
  go: {
    path: 'src/games/go/bots.trained.ts',
    name: 'TRAINED_BOTS',
    type: '{ playouts: number; humanize?: Humanize }[]',
    typeImport: "import type { Humanize } from '../../core/humanize'",
  },
}

function writeTrainedFile(game: string, levels: Bot[], levelElo: number[], gamesPlayed: number) {
  const file = TRAINED_FILE[game]
  const rows = levels.map((bot, k) => {
    const shown = game === 'go' ? { playouts: bot.playouts, ...(bot.humanize ? { humanize: bot.humanize } : {}) } : bot
    return `  ${JSON.stringify(shown).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')}, // ${k + 1}. düzey: +${Math.round(levelElo[k] - levelElo[0])} Elo`
  })
  const text = [
    '// Made by scripts/train-bots (do not edit by hand): the bots of the eight levels, weakest first.',
    `// Trained on ${new Date().toISOString().slice(0, 10)} from ${gamesPlayed} games between the bots of the training ladder;`,
    '// the comments give each level\'s strength measured against level 1.',
    file.typeImport,
    '',
    `export const ${file.name}: ${file.type} = [`,
    ...rows,
    ']',
    '',
  ].join('\n')
  writeFileSync(join(projectRoot(), file.path), text)
}

/** Go's strong bots think for seconds per move: fewer checking games and a single refine round. */
const SLOW: Record<string, { games: number; refines: number }> = { go: { games: 20, refines: 1 } }

async function main() {
  const [game, step = 'bench', gamesArg] = process.argv.slice(2)
  if (!GAMES[game] || !ANCHORS[game]) {
    console.log(`Oyun: ${Object.keys(GAMES).join(', ')}`)
    process.exit(1)
  }
  const ladder = ANCHORS[game]
  const threads = Number(process.env.TRAIN_THREADS) || Math.max(1, cpus().length - (game === 'chess' ? 8 : 1))

  if (step === 'bench') {
    const jobs = pairJobs(game, ladder.map((_, i) => [i, i] as [number, number]), ladder, 2)
    const done = await runJobs(jobs, threads, 'deneme')
    for (let i = 0; i < ladder.length; i++) {
      const mine = done.filter((d) => d.a === i)
      const plies = mine.reduce((s, d) => s + d.plies, 0)
      const ms = mine.reduce((s, d) => s + d.ms, 0)
      console.log(`bot ${i}: ${Math.round(ms / Math.max(1, plies))} ms/hamle, ${Math.round(plies / mine.length)} hamle/oyun`)
    }
    return
  }

  if (step === 'train') {
    const games = Number(gamesArg ?? 40)
    const pairs: [number, number][] = []
    for (let i = 0; i < ladder.length; i++) for (const d of [1, 2]) if (i + d < ladder.length) pairs.push([i, i + d])
    const done = await runJobs(pairJobs(game, pairs, ladder, games), threads, 'eğitim')
    const raw = fitElo(ladder.length, done)
    // Small upsets between close bots are noise: the ladder only goes up.
    const elo = raw.map((value, i) => value)
    for (let i = 1; i < elo.length; i++) elo[i] = Math.max(elo[i], elo[i - 1] + 5)
    const targets = levelTargets(elo[0], elo[elo.length - 1])
    const places = targets.map((target) => placeOnLadder(elo, target))
    const levels = places.map((x) => levelAt(ladder, x))
    console.log('Basamak botlarının gücü (Elo, 1. bota göre):', elo.map((e) => Math.round(e)).join(', '))
    levels.forEach((bot, k) => console.log(`${k + 1}. düzey (basamak ${places[k].toFixed(2)}, +${Math.round(targets[k] - targets[0])}):`, JSON.stringify(bot)))
    writeResults(game, {
      ...readResults(game),
      trained: new Date().toISOString(),
      ladder,
      ladderElo: raw.map((e) => Math.round(e)),
      gamesPerPair: games,
      gamesPlayed: done.length,
      places,
      levels,
      levelElo: targets.map((t) => Math.round(t - targets[0])),
      pairs: summarise(done),
      best: undefined,
    })
    writeTrainedFile(game, levels, targets, done.length)
    return
  }

  if (step === 'refine') {
    const rounds = (readResults(game) as { refineRounds?: number }).refineRounds ?? 0
    if (SLOW[game] && rounds >= SLOW[game].refines) {
      console.log('Bu oyun için ayar turları tamam.')
      return
    }
    // The ladder's strengths come from all games together; neighbouring levels playing each other can
    // still differ from the plan. Each round moves the interior levels along the ladder toward the
    // planned steps (growing by 15% each) and lets the levels play each other again. A round is kept
    // only if its steps are closer to the plan; otherwise the next round takes a smaller stride.
    const games = Math.min(Number(gamesArg ?? 40), SLOW[game]?.games ?? Infinity)
    const stored = readResults(game) as {
      places?: number[]
      verify?: VerifyRow[]
      gamesPlayed?: number
      best?: { places: number[]; verify: VerifyRow[]; error: number; stride: number }
    }
    if (!stored.places || !stored.verify) throw new Error('Önce "train" ve "verify" çalıştır.')
    const best = stored.best ?? { places: stored.places, verify: stored.verify, error: shapeError(stepsOf(stored.verify)), stride: 0.5 }
    const places = best.places
    const steps = stepsOf(best.verify)
    const chain = [0]
    for (const s of steps) chain.push(chain[chain.length - 1] + s)
    const wanted = levelTargets(0, chain[7])
    const moved = [...places]
    for (let k = 1; k < 7; k++) {
      const slope = (chain[k + 1] - chain[k - 1]) / Math.max(0.05, places[k + 1] - places[k - 1])
      const x = places[k] + (best.stride * (wanted[k] - chain[k])) / Math.max(1, slope)
      moved[k] = Math.min(places[k + 1] - 0.02, Math.max(places[k - 1] + 0.02, x))
    }
    for (let k = 1; k < 7; k++) moved[k] = Math.max(moved[k], moved[k - 1] + 0.02)
    const levels = moved.map((x) => levelAt(ladder, x))
    levels.forEach((bot, k) => console.log(`${k + 1}. düzey (basamak ${places[k].toFixed(2)} → ${moved[k].toFixed(2)}):`, JSON.stringify(bot)))
    const pairs: [number, number][] = Array.from({ length: 7 }, (_, k) => [k + 1, k] as [number, number])
    const done = await runJobs(pairJobs(game, pairs, levels, games), threads, 'sınama')
    const table = verifyTable(done)
    const error = shapeError(stepsOf(table))
    const better = error < best.error
    console.log(`Plana uzaklık: ${best.error.toFixed(3)} → ${error.toFixed(3)} (${better ? 'yeni ayarlar alındı' : 'eski ayarlar kaldı'})`)
    const gamesPlayed = (stored.gamesPlayed ?? 0) + done.length
    if (better) {
      const levelElo = [0]
      for (const s of stepsOf(table)) levelElo.push(levelElo[levelElo.length - 1] + s)
      writeResults(game, {
        ...readResults(game),
        refined: new Date().toISOString(),
        gamesPlayed,
        places: moved,
        levels,
        levelElo,
        verifyGamesPerPair: games,
        verify: table,
        best: { places: moved, verify: table, error, stride: Math.min(0.8, best.stride * 1.25) },
        refineRounds: rounds + 1,
      })
      writeTrainedFile(game, levels, levelElo, gamesPlayed)
    } else {
      writeResults(game, { ...readResults(game), gamesPlayed, best: { ...best, stride: best.stride / 2 }, refineRounds: rounds + 1 })
    }
    return
  }

  if (step === 'verify') {
    const games = Math.min(Number(gamesArg ?? 40), SLOW[game]?.games ?? Infinity)
    const stored = readResults(game) as { levels?: Bot[] }
    if (!stored.levels) throw new Error('Önce "train" çalıştır.')
    const pairs: [number, number][] = Array.from({ length: 7 }, (_, k) => [k + 1, k] as [number, number])
    const done = await runJobs(pairJobs(game, pairs, stored.levels, games), threads, 'sınama')
    const table = verifyTable(done)
    const before = readResults(game) as { gamesPlayed?: number }
    // A fresh check: the refine rounds start from these levels.
    writeResults(game, { ...before, gamesPlayed: (before.gamesPlayed ?? 0) + done.length, verified: new Date().toISOString(), verifyGamesPerPair: games, verify: table, best: undefined, refineRounds: 0 })
    return
  }
}

interface VerifyRow {
  a: number
  b: number
  score: number
  elo: number
}

/** Neighbouring levels against each other: the stronger one's share of the points, as Elo. */
function verifyTable(done: Done[]): VerifyRow[] {
  const table = summarise(done).map((row) => ({ ...row, elo: Math.round(eloFromScore(row.score)) }))
  for (const row of table) console.log(`${row.a + 1}. düzey - ${row.b + 1}. düzey: %${Math.round(row.score * 100)} puan (${row.elo} Elo)`)
  return table
}

/** The seven steps between neighbouring levels, in Elo (a level that lost to the one below counts as a tiny step). */
function stepsOf(table: VerifyRow[]): number[] {
  return Array.from({ length: 7 }, (_, k) => Math.max(10, table.find((row) => row.a === k + 1 && row.b === k)?.elo ?? 10))
}

/** How far the steps are from the plan (each 15% bigger than the last), as a sum of squared log ratios. */
function shapeError(steps: number[]): number {
  const total = steps.reduce((sum, s) => sum + s, 0)
  const targets = levelTargets(0, total)
  return steps.reduce((sum, s, k) => sum + Math.log(s / (targets[k + 1] - targets[k])) ** 2, 0)
}

/** The bot at place x of the ladder (blended between the two bots around it). */
function levelAt(ladder: Bot[], x: number): Bot {
  const i = Math.floor(x)
  return blend(ladder[i], ladder[Math.min(ladder.length - 1, i + 1)], x - i)
}

function summarise(done: Done[]) {
  const byPair = new Map<string, { a: number; b: number; games: number; points: number; wins: number; draws: number; losses: number; plies: number }>()
  for (const d of done) {
    const key = `${d.a}-${d.b}`
    const row = byPair.get(key) ?? { a: d.a, b: d.b, games: 0, points: 0, wins: 0, draws: 0, losses: 0, plies: 0 }
    row.games++
    row.points += d.score
    row.plies += d.plies
    if (d.score === 1) row.wins++
    else if (d.score === 0) row.losses++
    else row.draws++
    byPair.set(key, row)
  }
  return [...byPair.values()]
    .sort((x, y) => x.a - y.a || x.b - y.b)
    .map(({ points, plies, ...row }) => ({ ...row, score: Math.round((points / row.games) * 1000) / 1000, plies: Math.round(plies / row.games) }))
}

if (isMainThread) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
