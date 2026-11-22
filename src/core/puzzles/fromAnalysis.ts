import type { GameRecord, PuzzleRecord } from '../../db/types'
import type { GamePhase } from '../types'

/** Turns the user's mistakes and blunders from an analysed game into puzzles (new puzzles are due right away). */
/** `phaseOf` tags each puzzle as opening, middlegame or endgame (the game module knows how). */
export function buildPuzzles(game: GameRecord, now = Date.now(), phaseOf?: (position: string, ply: number) => GamePhase): PuzzleRecord[] {
  if (!game.analysis) return []
  const moves = game.analysis.moves
  const puzzles: PuzzleRecord[] = []
  for (const move of moves) {
    if (!move.isUserMove || !move.bestMove || !move.bestLabel) continue
    if (move.classification !== 'mistake' && move.classification !== 'blunder') continue
    const candidates = move.candidates?.length
      ? move.candidates
      : [{ move: move.bestMove, label: move.bestLabel, win: move.winBefore ?? 50 }]
    const puzzle: PuzzleRecord = {
      id: `${game.id}:${move.ply}`,
      gameType: game.gameType,
      gameId: game.id,
      ply: move.ply,
      position: move.before,
      userSide: game.userSide,
      playedMove: move.code,
      playedLabel: move.label,
      bestMove: move.bestMove,
      bestLabel: move.bestLabel,
      candidates,
      explanation: move.explanation ?? '',
      errorType: move.errorType ?? 'other',
      classification: move.classification,
      ...(phaseOf ? { phase: phaseOf(move.before, move.ply) } : {}),
      createdAt: now,
      box: 1,
      dueAt: now,
    }
    const previous = moves[move.ply - 1]
    if (previous) puzzle.prevMove = previous.code
    puzzles.push(puzzle)
  }
  return puzzles
}
