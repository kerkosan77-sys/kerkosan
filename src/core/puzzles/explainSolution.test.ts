import { describe, expect, it } from 'vitest'
import { explainSolution, winChangeText } from './explainSolution'

describe('puzzle solution text', () => {
  it('splits the mistake from the "Daha iyisi" advice', () => {
    expect(explainSolution('Bu hamleyle atın korumasız kalıyor. Rakip onu alabilir. Daha iyisi şuydu: ♘f3.', 'Atı geri çekiyor.')).toEqual({
      mistake: 'Bu hamleyle atın korumasız kalıyor. Rakip onu alabilir.',
      right: 'Atı geri çekiyor.',
    })
  })

  it('keeps what the right move was for', () => {
    const text = explainSolution('Taşların atariye düştü. Daha iyisi D4 ile taşlarını kaçırmaktı.', null)
    expect(text.mistake).toBe('Taşların atariye düştü.')
    expect(text.right).toBe('Amacı: taşlarını kaçırmak.')
  })

  it('always has something to say', () => {
    expect(explainSolution('', null)).toEqual({
      mistake: 'Bu hamle durumunu kötüleştirdi.',
      right: 'Oyundaki tehlikeyi önlüyor ve durumunu koruyor.',
    })
  })

  it('says how much winning chance the right move kept', () => {
    expect(winChangeText(62, 18)).toBe("Doğru hamleyle kazanma şansın %62 kalıyordu; oyundaki hamlenle %18'e düştü.")
    expect(winChangeText(70, 40)).toBe("Doğru hamleyle kazanma şansın %70 kalıyordu; oyundaki hamlenle %40'a düştü.")
    expect(winChangeText(55, 6)).toBe("Doğru hamleyle kazanma şansın %55 kalıyordu; oyundaki hamlenle %6'ya düştü.")
    expect(winChangeText(50, 49)).toBeNull()
    expect(winChangeText(undefined, 10)).toBeNull()
  })
})
