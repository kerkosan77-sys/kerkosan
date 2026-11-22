import { useEffect, useRef, useState } from 'react'
import { searchAfterBest } from '../core/analysis/analyzeGame'
import { evaluateMove, winForSide } from '../core/analysis/evaluateMove'
import type { MoveAnalysis } from '../core/analysis/types'
import type { EngineLine, GameModule, MoveRecord, Side } from '../core/types'

/** Recent moves the coach keeps evaluated (enough for the user's move and the computer's replies). */
const RECENT = 6

export interface LiveCoach {
  /** The user's winning chances in the current position, or null until the engine has looked. */
  win: number | null
  /** Evaluations of recent moves, by ply (only those already worked out). */
  moves: Map<number, MoveAnalysis>
}

interface Options {
  game: GameModule
  enabled: boolean
  /** Changes when a new game starts, so nothing carries over. */
  gameKey: number
  history: MoveRecord[]
  position: string
  turn: Side
  userSide: Side
}

/**
 * The learning-mode coach's engine work during a game: every position is searched once (with the
 * "coach" engine, so it never slows the computer's moves) and recent moves are classified the
 * same way as in the analysis, without ever naming the move the user should play now.
 */
export function useLiveCoach({ game, enabled, gameKey, history, position, turn, userSide }: Options): LiveCoach {
  const linesRef = useRef(new Map<string, EngineLine[]>())
  const afterBestRef = useRef(new Map<string, number | null>())
  const [coach, setCoach] = useState<LiveCoach>({ win: null, moves: new Map() })

  // A new game starts with nothing known.
  useEffect(() => {
    linesRef.current = new Map()
    afterBestRef.current = new Map()
    setCoach({ win: null, moves: new Map() })
  }, [gameKey, game])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const engine = game.engine('coach')
    const depth = Math.max(4, game.analysisDepth - 2)
    const n = history.length
    const recent = history.slice(Math.max(0, n - RECENT))
    const lines = linesRef.current
    const afterBest = afterBestRef.current

    const recompute = () => {
      if (!alive) return
      const moves = new Map<number, MoveAnalysis>()
      for (let i = Math.max(0, n - RECENT); i < n; i++) {
        const move = history[i]
        const before = lines.get(move.before)
        if (!before) continue
        const ended = game.playAt(move.before, move.code)?.ended ?? null
        const after = lines.get(move.after)
        if (!ended && !after) continue
        const key = `${move.before}|${move.code}`
        if (game.compareAfterBest && !afterBest.has(key)) continue
        moves.set(
          i,
          evaluateMove({
            game,
            ply: i,
            move,
            userSide,
            lines: before,
            afterBestWin: afterBest.get(key) ?? null,
            ended,
            replyLines: after ?? null,
            sideAfter: i + 1 < n ? history[i + 1].side : turn,
            nextCode: history[i + 1]?.code ?? null,
            live: true,
          }),
        )
      }
      const current = lines.get(position)
      setCoach((previous) => ({
        win: current ? winForSide(game, current, turn, userSide) : previous.win,
        moves,
      }))
    }

    ;(async () => {
      recompute()
      // The current position first (for the bar), then anything recent still missing.
      const targets = [position, ...recent.map((m) => m.before), ...recent.map((m) => m.after)]
      for (const target of new Set(targets)) {
        if (!alive) return
        if (lines.has(target)) continue
        try {
          const found = await engine.analyze(target, { depth, multiPV: 2 })
          lines.set(target, found)
        } catch {
          return
        }
        recompute()
      }
      if (game.compareAfterBest) {
        for (const move of recent) {
          const key = `${move.before}|${move.code}`
          const before = lines.get(move.before)
          if (!alive || afterBest.has(key) || !before) continue
          try {
            afterBest.set(key, await searchAfterBest(game, engine, move.before, move.code, move.side, before, depth))
          } catch {
            return
          }
          recompute()
        }
      }
    })()
    return () => {
      alive = false
    }
    // history is read through its length and the position: both change with every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, game, gameKey, history.length, position, turn, userSide])

  return coach
}
