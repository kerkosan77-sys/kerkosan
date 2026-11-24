/**
 * The explanation shown when a puzzle is over: what was wrong with the move played in the game, what
 * the right move does, and how much winning chance it kept. The analysis text of the game's move
 * ends with "Daha iyisi … idi."; that sentence is taken out (the right move gets its own part) and,
 * when it says what the right move was for ("… ile taşlarını kaçırmaktı"), that purpose is kept.
 */

export interface SolutionText {
  /** Why the move played in the game was bad. */
  mistake: string
  /** What the right move does. */
  right: string
}

const BETTER = /\s*Daha iyisi[^.]*\./g
const PURPOSE = /Daha iyisi \S+ ile ([^.]+?)(mak|mek)tı\./

export function explainSolution(explanation: string, rightFacts: string | null): SolutionText {
  const mistake = explanation.replace(BETTER, '').trim() || 'Bu hamle durumunu kötüleştirdi.'
  const purpose = PURPOSE.exec(explanation)
  const parts = [rightFacts?.trim() || null, purpose ? `Amacı: ${purpose[1]}${purpose[2]}.` : null].filter(Boolean)
  return { mistake, right: parts.join(' ') || 'Oyundaki tehlikeyi önlüyor ve durumunu koruyor.' }
}

/** "Doğru hamleyle kazanma şansın %62 kalıyordu; oyundaki hamlenle %18'e düştü." (null without numbers) */
export function winChangeText(winBefore: number | undefined, winAfter: number | undefined): string | null {
  if (winBefore === undefined || winAfter === undefined) return null
  const a = Math.round(winBefore)
  const b = Math.round(winAfter)
  if (a - b < 3) return null
  return `Doğru hamleyle kazanma şansın %${a} kalıyordu; oyundaki hamlenle %${b}'${suffix(b)} düştü.`
}

/** Turkish dative ending after a percentage read aloud ("%18'e", "%40'a", "%6'ya"). */
function suffix(n: number): string {
  const ones = n % 10
  const tens = Math.floor(n / 10) % 10
  if (n === 0) return 'a'
  if (ones === 0) return ['a', 'a', 'ye', 'a', 'a', 'ye', 'a', 'e', 'e', 'a'][tens]
  return ['', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a'][ones]
}
