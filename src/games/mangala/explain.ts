import type { ExplainInput, Explanation, Score, Side } from '../../core/types'
import { STORE, applyMove, decode, pitNumber, winner, type MoveResult, type Position } from './rules'

/**
 * Plain-Turkish explanations for Mangala mistakes, built from the engine's lines and the rules:
 * stones the opponent can take next (even / empty-pit rule), captures and extra turns the user
 * missed, end-of-game sweeps and forced results. Falls back to "Daha iyisi şuydu: …".
 */

export type MangalaErrorType =
  | 'allowed_capture'
  | 'allowed_extra_turn'
  | 'missed_capture'
  | 'missed_extra_turn'
  | 'endgame'
  | 'other'

interface Step {
  mover: Side
  index: number
  result: MoveResult
}

/** Smallest capture worth mentioning. */
const NOTABLE = 2

const other = (side: Side): Side => (side === 'w' ? 'b' : 'w')

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('tr-TR') + text.slice(1)
}

/** Plays a line of moves (pit indices as strings), stopping at an illegal move or the end of the game. */
export function simulate(position: Position, moves: string[], limit = 12): Step[] {
  const steps: Step[] = []
  let current = position
  for (const move of moves.slice(0, limit)) {
    const index = Number(move)
    const result = applyMove(current, index)
    if (!result) break
    steps.push({ mover: current.turn, index, result })
    current = result.position
    if (result.over) break
  }
  return steps
}

/** The run of consecutive moves by `side` starting at `from` (a turn, including extra turns). */
function turnOf(steps: Step[], side: Side, from = 0): Step[] {
  const run: Step[] = []
  for (let i = from; i < steps.length && steps[i].mover === side; i++) run.push(steps[i])
  return run
}

/**
 * Stones won from the other player by a capture. With the empty-pit rule the capturer's own
 * last stone goes to the store too, but it was theirs already, so it does not count.
 */
function netCapture(result: MoveResult): number {
  const capture = result.capture
  if (!capture) return 0
  return capture.kind === 'empty' ? capture.stones - 1 : capture.stones
}

/** Stones `side` takes from the other player during a turn (captures and an end-of-game sweep). */
function gains(turn: Step[], side: Side): number {
  return turn.reduce((sum, step) => {
    const sweep = step.result.sweep?.to === side ? step.result.sweep.stones : 0
    return sum + netCapture(step.result) + sweep
  }, 0)
}

function biggestCapture(turn: Step[]): Step | null {
  let best: Step | null = null
  for (const step of turn) {
    if (netCapture(step.result) > 0 && (!best || netCapture(step.result) > netCapture(best.result))) best = step
  }
  return best
}

function moveName(index: number): string {
  return `${pitNumber(index)}. kuyu`
}

/** "rakip 4. kuyusundan oynayıp senin 2. kuyundaki 6 taşı çift kuralıyla alabiliyor" */
function opponentCaptureText(step: Step): string {
  const capture = step.result.capture!
  const from = pitNumber(step.index)
  const target = pitNumber(capture.pit)
  return capture.kind === 'even'
    ? `rakip ${from}. kuyusundan oynayıp senin ${target}. kuyundaki ${capture.stones} taşı çift kuralıyla alabiliyor`
    : `rakip ${from}. kuyusundan oynayıp boş kuyu kuralıyla senin ${target}. kuyundaki ${capture.stones - 1} taşı alabiliyor`
}

/**
 * "6. kuyundan oynayıp rakibin 1. kuyusundaki 4 taşı çift kuralıyla alabilirdin", or with an
 * extra turn first: "önce 4. kuyundan oynayıp tekrar oynama hakkı kazanarak rakibin …".
 */
function userCaptureText(first: Step, step: Step): string {
  const capture = step.result.capture!
  const start =
    step === first
      ? `${pitNumber(first.index)}. kuyundan oynayıp`
      : `önce ${pitNumber(first.index)}. kuyundan oynayıp tekrar oynama hakkı kazanarak`
  return capture.kind === 'even'
    ? `${start} rakibin ${pitNumber(capture.pit)}. kuyusundaki ${capture.stones} taşı çift kuralıyla alabilirdin`
    : `${start} boş kuyu kuralıyla rakibin ${pitNumber(capture.pit)}. kuyusundaki ${capture.stones - 1} taşı alabilirdin`
}

/** Winning chances lost for good: a forced loss from the user's point of view, given who is to move. */
function isForcedLoss(score: Score, toMove: Side, user: Side): boolean {
  if (score.kind !== 'mate') return false
  return toMove === user ? score.value < 0 : score.value > 0
}

export function explainMangalaMove(input: ExplainInput): Explanation & { type: MangalaErrorType } {
  const user = input.userSide
  const opponent = other(user)
  let before: Position
  try {
    before = decode(input.before)
  } catch {
    return { text: 'Daha iyi bir hamle vardı.', type: 'other' }
  }
  const played = applyMove(before, Number(input.move))
  const bestIndex = input.best?.pv[0] !== undefined ? Number(input.best.pv[0]) : null
  const bestResult = bestIndex !== null ? applyMove(before, bestIndex) : null
  const bestName = bestIndex !== null ? moveName(bestIndex) : null
  const better = bestName ? ` Daha iyisi şuydu: ${bestName}.` : ''
  if (!played) return { text: `Daha iyi bir hamle vardı.${better}`, type: 'other' }

  // The move ended the game.
  if (played.over) {
    const won = winner(played.position.pits)
    const mine = played.position.pits[STORE[user]]
    const theirs = played.position.pits[STORE[opponent]]
    if (won === opponent) {
      return {
        text: `Bu hamle oyunu bitirdi ama hazinende ${mine}, rakibinde ${theirs} taş vardı: oyunu kaybettin.${better}`,
        type: 'endgame',
      }
    }
    if (won === 'draw' && input.winBefore >= 65) {
      return { text: `Bu hamle oyunu berabere bitirdi, oysa kazanma şansın yüksekti.${better}`, type: 'endgame' }
    }
  }

  // Lines: what follows the played move, and the engine's best line.
  const playedSteps = [{ mover: user, index: Number(input.move), result: played }, ...simulate(played.position, input.reply?.pv ?? [])]
  const myTurn = turnOf(playedSteps, user)
  const theirTurn = turnOf(playedSteps, opponent, myTurn.length)
  const bestSteps = input.best ? simulate(before, input.best.pv) : []
  const myBestTurn = turnOf(bestSteps, user)
  const theirTurnAfterBest = turnOf(bestSteps, opponent, myBestTurn.length)

  const lost = gains(theirTurn, opponent)
  const lostAfterBest = gains(theirTurnAfterBest, opponent)
  const taken = gains(myTurn, user)
  const takenBest = gains(myBestTurn, user)

  // Concrete reason for the opponent's gain right after the move.
  let concrete: string | null = null
  const sweepStep = theirTurn.find((s) => s.result.sweep?.to === opponent && s.result.sweep.stones > 0)
  const theirCapture = biggestCapture(theirTurn)
  if (sweepStep) {
    concrete = `Bu hamleden sonra rakip kuyularını boşaltıp oyunu bitirebiliyor ve senin kuyularındaki ${sweepStep.result.sweep!.stones} taşı alıyor.`
  } else if (theirCapture && netCapture(theirCapture.result) >= NOTABLE && lost - lostAfterBest >= NOTABLE) {
    concrete = `Bu hamleden sonra ${opponentCaptureText(theirCapture)}.`
  }

  // "You got an extra turn / took stones, but …" — the move looked good on the surface.
  const extraTurnPrefix = (text: string) => {
    if (played.extraTurn) return `Tekrar oynama hakkı kazandın ama ${lowerFirst(text)}`
    if (played.capture) return `${netCapture(played)} taş aldın ama ${lowerFirst(text)}`
    return text
  }

  // 1. Forced results.
  const afterTurn = played.position.turn
  const alreadyLost = input.best ? isForcedLoss(input.best.score, user, user) : false
  if (input.reply && !alreadyLost && isForcedLoss(input.reply.score, afterTurn, user)) {
    const text = concrete
      ? `${concrete} Bundan sonra rakip oyunu zorla kazanıyor.`
      : 'Bu hamleden sonra rakip oyunu zorla kazanabiliyor.'
    return { text: extraTurnPrefix(text) + better, type: 'endgame' }
  }
  if (input.best?.score.kind === 'mate' && input.best.score.value > 0 && bestName) {
    // A forced loss for the opponent = the user is still winning by force after the move.
    const stillWinning = input.reply ? isForcedLoss(input.reply.score, afterTurn, opponent) : false
    if (!stillWinning && !(played.over && winner(played.position.pits) === user)) {
      const sweep = myBestTurn.find((s) => s.result.sweep?.to === user && s.result.sweep.stones > 0)
      const text = sweep
        ? `Burada ${bestName} ile kuyularını boşaltıp oyunu bitirebilirdin; rakibin kuyularındaki ${sweep.result.sweep!.stones} taş senin olurdu.`
        : `Burada ${bestName} ile oyunu zorla kazanabilirdin.`
      return { text, type: 'endgame' }
    }
  }

  // 2. The opponent gains stones right after the move.
  if (concrete) {
    const myBestCapture = biggestCapture(myBestTurn)
    const extra =
      myBestCapture && takenBest - taken >= NOTABLE
        ? ` Ayrıca burada ${userCaptureText(myBestTurn[0], myBestCapture)}.`
        : better
    return { text: extraTurnPrefix(concrete) + extra, type: sweepStep ? 'endgame' : 'allowed_capture' }
  }

  // 3. A capture the user missed.
  const myBestCapture = biggestCapture(myBestTurn)
  if (myBestCapture && netCapture(myBestCapture.result) >= NOTABLE && takenBest - taken >= NOTABLE) {
    return { text: `Burada ${userCaptureText(myBestTurn[0], myBestCapture)}.`, type: 'missed_capture' }
  }

  // 4. An extra turn the user missed.
  if (bestResult?.extraTurn && !played.extraTurn && bestIndex !== null) {
    return {
      text: `Burada ${pitNumber(bestIndex)}. kuyundan oynasaydın son taş hazinene düşer ve tekrar oynardın.`,
      type: 'missed_extra_turn',
    }
  }

  // 5. The opponent gets to move several times in a row.
  const theirExtra = theirTurn.find((s) => s.result.extraTurn)
  if (theirExtra && theirTurn.length > Math.max(1, theirTurnAfterBest.length)) {
    return {
      text:
        extraTurnPrefix(
          `Bu hamleden sonra rakip ${pitNumber(theirExtra.index)}. kuyusundan oynayıp son taşını hazinesine düşürerek art arda oynayabiliyor.`,
        ) + better,
      type: 'allowed_extra_turn',
    }
  }

  // 6. Nothing specific found.
  if (played.extraTurn) {
    return {
      text: `Tekrar oynama hakkı kazanmak her zaman en iyisi değildir: bu sefer birkaç hamle sonra taş kaybettiriyor.${better}`,
      type: 'other',
    }
  }
  let text: string
  if (input.winBefore >= 60 && input.winAfter < 55) text = 'Bu hamleyle elindeki avantajı kaybettin.'
  else if (input.winBefore >= 40 && input.winAfter < 35) text = 'Bu hamleden sonra durumun zorlaştı.'
  else text = 'Bu hamle birkaç hamle sonra taş kaybına yol açıyor.'
  return { text: text + better, type: 'other' }
}
