/** One finished game between bots a and b; score is a's (1 win, 0.5 draw, 0 loss). */
export interface Game {
  a: number
  b: number
  score: number
}

/**
 * Strength of every bot from all their games together (the Bradley-Terry model, solved by its
 * standard "minorise-maximise" iteration), in Elo points with bot 0 at 0. One virtual draw between
 * neighbours keeps a bot that won every game from running off to infinity.
 */
export function fitElo(n: number, games: Game[], iterations = 3000): number[] {
  const wins = new Array<number>(n).fill(0)
  const played = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const add = (a: number, b: number, score: number) => {
    wins[a] += score
    wins[b] += 1 - score
    played[a][b]++
    played[b][a]++
  }
  for (const game of games) add(game.a, game.b, game.score)
  for (let i = 0; i + 1 < n; i++) add(i, i + 1, 0.5)

  let gamma = new Array<number>(n).fill(1)
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = gamma.map((g, i) => {
      let denominator = 0
      for (let j = 0; j < n; j++) if (played[i][j]) denominator += played[i][j] / (g + gamma[j])
      return wins[i] / denominator
    })
    gamma = next.map((g) => g / next[0])
  }
  return gamma.map((g) => 400 * Math.log10(g))
}

/** Elo difference that gives the stronger side this share of the points. */
export function eloFromScore(score: number): number {
  const s = Math.min(0.995, Math.max(0.005, score))
  return -400 * Math.log10(1 / s - 1)
}
