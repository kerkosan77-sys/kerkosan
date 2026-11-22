import { classifyMove, isErrorClass } from '../classify'
import type { EngineLine, GameModule, MoverResult, MoveRecord, Side } from '../types'
import { goodMoveText, liveOpponentErrorText, opponentErrorText, type BestReply } from './moveText'
import type { CandidateMove, MoveAnalysis } from './types'

/** A candidate counts as "as good as the best move" within this many winning-chance points. */
export const ALTERNATIVE_MARGIN = 3

export interface EvaluateMoveInput {
  game: GameModule
  ply: number
  move: MoveRecord
  userSide: Side
  /** Engine lines in the position before the move (the mover to play). */
  lines: EngineLine[]
  /** Games with compareAfterBest: the mover's winning chances after the best move, when searched. */
  afterBestWin?: number | null
  /** How the game ended right after the move, for the mover (null if it goes on). */
  ended?: MoverResult | null
  /** Engine lines in the position after the move, and who is to play there. */
  replyLines?: EngineLine[] | null
  sideAfter: Side
  /** The move actually played next, if any. */
  nextCode?: string | null
  /** During a game: never name the move the user should play now. */
  live?: boolean
}

/**
 * Classifies one move by how much winning chance it gave away and writes its short explanation.
 * Shared by the full game analysis and the live coach.
 */
export function evaluateMove(input: EvaluateMoveInput): MoveAnalysis {
  const { game, move, userSide, lines } = input
  const mover = move.side
  const analysis: MoveAnalysis = {
    ply: input.ply,
    label: move.label,
    code: move.code,
    side: mover,
    before: move.before,
    after: move.after,
    isUserMove: mover === userSide,
  }
  const best = lines[0]
  if (!best || !best.pv[0]) return analysis

  // The mover is to play before the move, so these numbers are from the mover's point of view.
  const rootWin = game.winPercent(best.score)
  const winBest = input.afterBestWin ?? rootWin
  let winAfter = winBest
  let reply: EngineLine | null = null
  const ended = input.ended ?? null
  if (ended === 'win') {
    winAfter = 100
  } else if (ended === 'loss') {
    winAfter = 0
  } else if (ended === 'draw') {
    winAfter = 50
  } else {
    const replyLine = input.replyLines?.[0]
    if (replyLine) {
      reply = replyLine
      const win = game.winPercent(replyLine.score)
      winAfter = input.sideAfter === mover ? win : 100 - win
    }
  }

  // Prefer numbers from the same search when the played move was one of the candidates.
  let drop: number
  const isTopMove = best.pv[0] === move.code
  const sameSearch = lines.find((line) => line.pv[0] === move.code)
  if (isTopMove) {
    drop = 0
  } else if (sameSearch && !ended) {
    winAfter = game.winPercent(sameSearch.score)
    drop = Math.max(0, winBest - winAfter)
  } else {
    drop = Math.max(0, winBest - winAfter)
  }

  const facts = game.describeMove?.(move.before, move.code) ?? null
  const second = lines[1]
  const classification = classifyMove({
    drop,
    isTopMove,
    winBest,
    winAfter,
    secondGap: second ? rootWin - game.winPercent(second.score) : null,
    forced: facts?.forced,
    sacrifice: facts?.sacrifice,
    obvious: facts?.obvious,
  })

  const forUser = (win: number) => (mover === userSide ? win : 100 - win)
  analysis.winBefore = round1(forUser(winBest))
  analysis.winAfter = round1(forUser(winAfter))
  analysis.drop = round1(drop)
  analysis.bestMove = best.pv[0]
  analysis.bestLabel = game.moveLabel(move.before, best.pv[0])
  analysis.classification = classification
  const betterLabel = isTopMove ? null : analysis.bestLabel

  if (analysis.isUserMove && isErrorClass(classification)) {
    const explanation = game.explain({
      before: move.before,
      move: move.code,
      userSide,
      best: { pv: best.pv, score: best.score },
      reply,
      winBefore: winBest,
      winAfter,
      endedInDraw: ended === 'draw',
    })
    analysis.explanation = explanation.text
    analysis.errorType = explanation.type
  } else if (isErrorClass(classification)) {
    // The opponent's error: what the user could do about it.
    const replyMove = reply?.pv[0]
    const userReplies = Boolean(replyMove) && input.sideAfter === userSide
    if (input.live) {
      analysis.explanation = liveOpponentErrorText(classification, userReplies)
    } else {
      let bestReply: BestReply | null = null
      if (replyMove && userReplies) {
        analysis.replyMove = replyMove
        bestReply = {
          label: game.moveLabel(move.after, replyMove),
          facts: game.describeMove?.(move.after, replyMove)?.text ?? null,
          found: input.nextCode === replyMove,
        }
      }
      analysis.explanation = opponentErrorText(classification, bestReply, betterLabel)
    }
  } else {
    analysis.explanation = goodMoveText(classification, facts?.text ?? null, betterLabel)
  }

  if (analysis.isUserMove && (classification === 'mistake' || classification === 'blunder')) {
    analysis.candidates = lines
      .filter((line) => line.pv[0])
      .map(
        (line): CandidateMove => ({
          move: line.pv[0],
          label: game.moveLabel(move.before, line.pv[0]),
          win: round1(game.winPercent(line.score)),
        }),
      )
      .filter((candidate) => rootWin - candidate.win <= ALTERNATIVE_MARGIN && candidate.move !== move.code)
  }
  return analysis
}

/** Winning chances (0-100) for `side` from lines searched with `toMove` to play. */
export function winForSide(game: Pick<GameModule, 'winPercent'>, lines: EngineLine[], toMove: Side, side: Side): number | null {
  const best = lines[0]
  if (!best) return null
  const win = game.winPercent(best.score)
  return toMove === side ? win : 100 - win
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
