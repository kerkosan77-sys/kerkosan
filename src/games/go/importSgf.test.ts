import { describe, expect, it } from 'vitest'
import { guessUserSide, readSgfForImport, resultFromRe, sgfGameRecord } from './importSgf'

const GAME = '(;GM[1]FF[4]SZ[9]KM[6.5]DT[2026-11-02]PB[ayse]PW[Sen]RE[W+R];B[ee];W[gc];B[cg];W[ge])'

describe('importing SGF games', () => {
  it('reads names, result, date and moves', () => {
    const data = readSgfForImport(`  ${GAME}\n`)
    expect(data.record).toBe(GAME)
    expect(data.names).toEqual({ w: 'ayse', b: 'Sen' })
    expect(data.result).toBe('0-1')
    expect(data.moveCount).toBe(4)
    expect(new Date(data.playedAt!).getDate()).toBe(2)
  })

  it('names the players by colour when the file does not', () => {
    expect(readSgfForImport('(;GM[1]SZ[9];B[ee])').names).toEqual({ w: 'Siyah', b: 'Beyaz' })
  })

  it('explains what cannot be imported', () => {
    expect(() => readSgfForImport('   ')).toThrow(/SGF dosyası seç/)
    expect(() => readSgfForImport('1. e4 e5')).toThrow(/SGF oyunu gibi görünmüyor/)
    expect(() => readSgfForImport('(;GM[1]SZ[19];B[pd];W[dp])')).toThrow(/19×19.*sadece 9×9/)
    expect(() => readSgfForImport('(;GM[1]SZ[9])')).toThrow(/hiç hamle yok/)
    expect(() => readSgfForImport('(;GM[1]SZ[9];B[ee];W[ee])')).toThrow(/Geçersiz Go hamlesi: 2\. hamle/)
  })

  it('turns SGF results into game results', () => {
    expect(resultFromRe('B+3.5')).toBe('1-0')
    expect(resultFromRe('w+r')).toBe('0-1')
    expect(resultFromRe('0')).toBe('1/2-1/2')
    expect(resultFromRe('Void')).toBe('*')
    expect(resultFromRe(undefined)).toBe('*')
  })

  it('finds the user by name and builds the record', () => {
    const data = readSgfForImport(GAME)
    expect(guessUserSide(data.names, ['Sen'])).toBe('b')
    expect(guessUserSide(data.names, ['Ali'])).toBeNull()
    expect(guessUserSide({ w: 'Sen', b: 'sen' }, ['Sen'])).toBeNull()
    const record = sgfGameRecord(data, 'b', 1000)
    expect(record).toMatchObject({ gameType: 'go', source: 'sgf', userSide: 'b', result: '0-1', createdAt: 1000, record: GAME })
    expect(record.id).toBeTruthy()
  })
})
