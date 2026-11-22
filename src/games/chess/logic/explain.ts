import { Chess, type Color, type Move } from 'chess.js'
import type { Score } from '../engine/uci'
import type { ChessErrorType as ErrorType } from './errorTypes'
import { formatSan, joinTurkish, PIECE_VALUE, PIECE_WORDS } from './pieces'
import { staticExchange } from './hanging'
import { firstCaptureBy, forkTargets, lineMaterial, playUci, uciToSan } from './motifs'

export interface ExplainInput {
  fenBefore: string
  playedUci: string
  userColor: Color
  /** Engine's best line from the position before the move. Score from the user's point of view. */
  best: { pv: string[]; score: Score } | null
  /** Engine's best line for the opponent after the move. Score from the opponent's point of view. Null if the game ended. */
  reply: { pv: string[]; score: Score } | null
  /** Winning chances (0-100) for the user before (best play) and after the move. */
  winBefore: number
  winAfter: number
  /** The move ended the game in a draw (stalemate, repetition, ...). */
  endedInDraw?: boolean
}

export interface Explanation {
  text: string
  type: ErrorType
}

/** Material swing (in pawns) that counts as "winning/losing a piece" in explanations. */
const MATERIAL_SWING = 2

const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w')

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('tr-TR') + text.slice(1)
}

function boardOf(fen: string): Chess | null {
  try {
    return new Chess(fen)
  } catch {
    return null
  }
}

/** Builds a short, plain-Turkish explanation for a user's inaccurate move. */
export function explainMove(input: ExplainInput): Explanation {
  const { fenBefore, playedUci, userColor: user, best, reply } = input
  const opponent = opposite(user)
  const played = playUci(fenBefore, playedUci)
  const bestUci = best?.pv[0]
  const bestSan = bestUci ? formatSan(uciToSan(fenBefore, bestUci)) : null
  const better = bestSan ? ` Daha iyisi şuydu: ${bestSan}.` : ''
  if (!played) return { text: `Daha iyi bir hamle vardı.${better}`, type: 'other' }

  const fenAfter = played.fen
  const replyUci = reply?.pv[0]
  const replySan = replyUci ? formatSan(uciToSan(fenAfter, replyUci)) : null

  // 1. The move allows a forced mate.
  const userWasAlreadyMated = best?.score.kind === 'mate' && best.score.value < 0
  if (reply && replySan && reply.score.kind === 'mate' && reply.score.value > 0 && !userWasAlreadyMated) {
    const n = reply.score.value
    const text =
      n === 1
        ? `Bu hamleden sonra tek hamlede mat oluyorsun: rakip ${replySan} oynayabilir.`
        : `Bu hamleden sonra ${n} hamlede mat oluyorsun. Rakibin ilk hamlesi: ${replySan}.`
    return { text: text + better, type: 'allowed_mate' }
  }

  // 2. The user had a forced mate and let it slip.
  if (best && bestSan && best.score.kind === 'mate' && best.score.value > 0) {
    const stillMating = reply?.score.kind === 'mate' && reply.score.value < 0
    if (!stillMating && !played.move.san.includes('#')) {
      const n = best.score.value
      const text =
        n === 1 ? `Burada tek hamlede mat edebilirdin: ${bestSan}!` : `Burada ${n} hamlede mat edebilirdin. İlk hamle: ${bestSan}.`
      return { text, type: 'missed_mate' }
    }
  }

  // 3. Material: did the move lose material, or miss a chance to win some?
  const gainPlayed = lineMaterial(fenBefore, [playedUci, ...(reply?.pv ?? [])], user)
  const gainBest = best ? lineMaterial(fenBefore, best.pv, user) : gainPlayed
  const allowedLoss = gainPlayed <= -MATERIAL_SWING && gainBest - gainPlayed >= MATERIAL_SWING
  const missedGain = gainBest >= MATERIAL_SWING && gainBest - gainPlayed >= MATERIAL_SWING
  const missed = missedGain && best && bestSan ? describeMissed(fenBefore, best.pv, user, bestSan) : null

  if (allowedLoss && reply && replySan) {
    const allowed = describeAllowed(fenBefore, fenAfter, played.move, reply.pv, user, opponent, replySan)
    const extra = missed?.type === 'missed_capture' ? ` Ayrıca ${lowerFirst(missed.text)}` : better
    return { text: allowed.text + extra, type: allowed.type }
  }
  if (missed) return missed

  // 4. No clear material swing yet, but the opponent's best reply is a double attack.
  if (reply && replySan && replyUci) {
    const fork = playUci(fenAfter, replyUci)
    const targets = fork ? forkTargets(fork.fen, fork.move.to) : []
    if (fork && targets.length >= 2) {
      const attacker = PIECE_WORDS[fork.move.piece].theirs
      const victims = joinTurkish(targets.map((t) => PIECE_WORDS[t.type].yoursDat))
      return {
        text: `Bu hamleden sonra rakip ${replySan} ile çatal yapıyor: rakibin ${attacker} aynı anda ${victims} saldırıyor.${better}`,
        type: 'allowed_fork',
      }
    }
  }

  // 5. Nothing specific found: general explanation.
  let text: string
  if (input.endedInDraw && input.winBefore >= 65) {
    text = 'Bu hamle oyunu berabereye götürdü, oysa kazanma şansın yüksekti.'
  } else if (input.winBefore >= 60 && input.winAfter < 55) {
    text = 'Bu hamleyle elindeki avantajı kaybettin.'
  } else if (input.winBefore >= 40 && input.winAfter < 35) {
    text = 'Bu hamleden sonra pozisyonun zorlaştı.'
  } else {
    text = 'Bu hamle pozisyonunu zayıflattı.'
  }
  return { text: text + better, type: 'other' }
}

function describeAllowed(
  fenBefore: string,
  fenAfter: string,
  move: Move,
  replyPv: string[],
  user: Color,
  opponent: Color,
  replySan: string,
): Explanation {
  const after = boardOf(fenAfter)
  const before = boardOf(fenBefore)

  // A piece left en prise that the opponent eventually takes.
  const capture = firstCaptureBy(fenAfter, replyPv, opponent)
  if (capture && after && before && capture.move.captured) {
    const square = capture.move.to
    const victim = after.get(square)
    const loss = staticExchange(fenAfter, square, opponent)
    if (victim && victim.color === user && victim.type === capture.move.captured && loss > 0) {
      const words = PIECE_WORDS[victim.type]
      const defended = after.attackers(square, user).length > 0
      const captureSan = formatSan(capture.move.san)
      let text: string
      if (square === move.to) {
        text = defended
          ? `Bu hamleyle ${words.yoursAcc} ${square} karesine koydun ama orada yeterince korunmuyor. Rakip ${captureSan} ile alıp kazançlı çıkıyor.`
          : `Bu hamleyle ${words.yoursAcc} korumasız bıraktın, rakip onu bedavaya alabilir (${captureSan}).`
      } else if (before.attackers(square, user).includes(move.from)) {
        text = `Bu hamleyle ${square} karesindeki ${words.yoursGen} korumasını kaldırdın. Rakip onu ${captureSan} ile alabilir.`
      } else if (staticExchange(fenBefore, square, opponent) >= loss) {
        text = `Rakip ${square} karesindeki ${words.yoursDat} saldırıyordu, bunu gözden kaçırdın. Rakip onu ${captureSan} ile alabilir.`
      } else if (defended) {
        text = `Bu hamleden sonra ${square} karesindeki ${words.yours} yeterince korunmuyor. Rakip ${captureSan} ile alıp kazançlı çıkıyor.`
      } else {
        text = `Bu hamleden sonra ${square} karesindeki ${words.yours} korumasız kaldı, rakip onu bedavaya alabilir (${captureSan}).`
      }
      // Taking the piece may also hit something bigger (e.g. Qxg2 then the rook on h1).
      const followUp = forkTargets(capture.fenAfter, square).filter(
        (t) => t.type === 'k' || PIECE_VALUE[t.type] > PIECE_VALUE[victim.type],
      )
      if (followUp.length > 0) {
        const attacker = PIECE_WORDS[capture.move.piece].theirs
        text += ` Üstelik rakibin ${attacker} bu alışla ${joinTurkish(followUp.map((t) => PIECE_WORDS[t.type].yoursDat))} saldırıyor.`
      }
      return { text, type: 'hung_piece' }
    }
  }

  // A fork: the reply attacks two or more of the user's pieces at once.
  const first = replyPv[0] ? playUci(fenAfter, replyPv[0]) : null
  if (first) {
    const targets = forkTargets(first.fen, first.move.to)
    if (targets.length >= 2) {
      const attacker = PIECE_WORDS[first.move.piece].theirs
      const victims = joinTurkish(targets.map((t) => PIECE_WORDS[t.type].yoursDat))
      return {
        text: `Rakibin çatal tehdidini kaçırdın: ${replySan} ile rakibin ${attacker} aynı anda ${victims} saldırıyor.`,
        type: 'allowed_fork',
      }
    }
  }

  return { text: `Bu hamleden sonra rakip ${replySan} ile taş kazanıyor.`, type: 'allowed_tactic' }
}

function describeMissed(fenBefore: string, bestPv: string[], user: Color, bestSan: string): Explanation | null {
  const first = bestPv[0] ? playUci(fenBefore, bestPv[0]) : null
  if (!first) return null

  if (first.move.captured && staticExchange(fenBefore, first.move.to, user) > 0) {
    return {
      text: `Rakibin bıraktığı ${PIECE_WORDS[first.move.captured].acc} alabilirdin: ${bestSan}.`,
      type: 'missed_capture',
    }
  }

  const targets = forkTargets(first.fen, first.move.to)
  if (targets.length >= 2) {
    const victims = joinTurkish(targets.map((t) => PIECE_WORDS[t.type].dat))
    return {
      text: `Burada ${bestSan} ile çatal yapabilirdin: ${PIECE_WORDS[first.move.piece].yours} aynı anda ${victims} saldırırdı.`,
      type: 'missed_tactic',
    }
  }

  return { text: `Burada ${bestSan} ile taş kazanabilirdin.`, type: 'missed_tactic' }
}
