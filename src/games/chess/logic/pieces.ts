import type { PieceSymbol } from 'chess.js'

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

/** Turkish word forms for each piece, so sentences read naturally. */
interface PieceWords {
  /** "at" */
  base: string
  /** your piece, nominative: "atın" */
  yours: string
  /** your piece, accusative: "atını" */
  yoursAcc: string
  /** your piece, dative: "atına" */
  yoursDat: string
  /** your piece, genitive: "atının" */
  yoursGen: string
  /** a/the piece, accusative: "atı" */
  acc: string
  /** a/the piece, dative: "ata" */
  dat: string
  /** his/her piece (3rd person possessive): "atı" ("rakibin atı") */
  theirs: string
  /** with your piece: "atınla" */
  yoursWith: string
}

export const PIECE_WORDS: Record<PieceSymbol, PieceWords> = {
  p: { base: 'piyon', yours: 'piyonun', yoursAcc: 'piyonunu', yoursDat: 'piyonuna', yoursGen: 'piyonunun', acc: 'piyonu', dat: 'piyona', theirs: 'piyonu', yoursWith: 'piyonunla' },
  n: { base: 'at', yours: 'atın', yoursAcc: 'atını', yoursDat: 'atına', yoursGen: 'atının', acc: 'atı', dat: 'ata', theirs: 'atı', yoursWith: 'atınla' },
  b: { base: 'fil', yours: 'filin', yoursAcc: 'filini', yoursDat: 'filine', yoursGen: 'filinin', acc: 'fili', dat: 'file', theirs: 'fili', yoursWith: 'filinle' },
  r: { base: 'kale', yours: 'kalen', yoursAcc: 'kaleni', yoursDat: 'kalene', yoursGen: 'kalenin', acc: 'kaleyi', dat: 'kaleye', theirs: 'kalesi', yoursWith: 'kalenle' },
  q: { base: 'vezir', yours: 'vezirin', yoursAcc: 'vezirini', yoursDat: 'vezirine', yoursGen: 'vezirinin', acc: 'veziri', dat: 'vezire', theirs: 'veziri', yoursWith: 'vezirinle' },
  k: { base: 'şah', yours: 'şahın', yoursAcc: 'şahını', yoursDat: 'şahına', yoursGen: 'şahının', acc: 'şahı', dat: 'şaha', theirs: 'şahı', yoursWith: 'şahınla' },
}

/** ["a", "b", "c"] -> "a, b ve c" */
export function joinTurkish(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

const FIGURINES: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' }

/** "Nxe5" -> "♘xe5", "e8=Q" -> "e8=♕". Figurines are easier to read than letter abbreviations. */
export function formatSan(san: string): string {
  return san.replace(/^[KQRBN]/, (letter) => FIGURINES[letter]).replace(/=([QRBN])/, (_, letter: string) => `=${FIGURINES[letter]}`)
}
