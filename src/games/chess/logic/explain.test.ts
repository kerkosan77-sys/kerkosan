import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { explainMove, type ExplainInput } from './explain'
import type { Score } from '../engine/uci'

const cp = (value: number): Score => ({ kind: 'cp', value })
const mate = (value: number): Score => ({ kind: 'mate', value })

function explain(partial: Omit<ExplainInput, 'winBefore' | 'winAfter'> & Partial<Pick<ExplainInput, 'winBefore' | 'winAfter'>>) {
  return explainMove({ winBefore: 50, winAfter: 20, ...partial })
}

describe('explainMove', () => {
  it('explains a piece moved to an undefended square', () => {
    // 1.e4 e5 2.Nf3 d6 3.Nxe5?? dxe5
    const result = explain({
      fenBefore: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
      playedUci: 'f3e5',
      userColor: 'w',
      best: { pv: ['d2d4'], score: cp(40) },
      reply: { pv: ['d6e5'], score: cp(200) },
    })
    expect(result.type).toBe('hung_piece')
    expect(result.text).toContain('atını korumasız bıraktın')
    expect(result.text).toContain('dxe5')
    expect(result.text).toContain('Daha iyisi şuydu: d4')
  })

  it('explains removing the only defender of a piece', () => {
    const result = explain({
      fenBefore: '3qk3/8/8/3B4/8/2N5/8/4K3 w - - 0 1',
      playedUci: 'c3b5',
      userColor: 'w',
      best: { pv: ['d5b3'], score: cp(0) },
      reply: { pv: ['d8d5'], score: cp(300) },
    })
    expect(result.type).toBe('hung_piece')
    expect(result.text).toContain('d5 karesindeki filinin korumasını kaldırdın')
    expect(result.text).toContain('♕xd5')
  })

  it('explains ignoring an existing threat', () => {
    const result = explain({
      fenBefore: 'r3k3/8/8/8/N7/8/8/4K3 w - - 0 1',
      playedUci: 'e1f1',
      userColor: 'w',
      best: { pv: ['a4c5'], score: cp(0) },
      reply: { pv: ['a8a4'], score: cp(300) },
    })
    expect(result.type).toBe('hung_piece')
    expect(result.text).toContain('Rakip a4 karesindeki atına saldırıyordu')
  })

  it('explains walking into mate in one', () => {
    // 1.f3 e5 2.g4?? Qh4#
    const result = explain({
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
      playedUci: 'g2g4',
      userColor: 'w',
      best: { pv: ['e2e4'], score: cp(-30) },
      reply: { pv: ['d8h4'], score: mate(1) },
      winAfter: 0,
    })
    expect(result.type).toBe('allowed_mate')
    expect(result.text).toContain('tek hamlede mat oluyorsun')
    expect(result.text).toContain('♕h4#')
  })

  it('explains walking into a longer forced mate', () => {
    const result = explain({
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
      playedUci: 'g2g4',
      userColor: 'w',
      best: { pv: ['e2e4'], score: cp(-30) },
      reply: { pv: ['d8h4'], score: mate(2) },
    })
    expect(result.text).toContain('Bu hamleden sonra 2 hamlede mat oluyorsun')
  })

  it('explains a missed mate in one', () => {
    const result = explain({
      fenBefore: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
      playedUci: 'h2h3',
      userColor: 'w',
      best: { pv: ['a1a8'], score: mate(1) },
      reply: { pv: ['g8f8'], score: cp(-500) },
      winBefore: 100,
      winAfter: 90,
    })
    expect(result.type).toBe('missed_mate')
    expect(result.text).toBe('Burada tek hamlede mat edebilirdin: ♖a8#!')
  })

  it('explains a missed free piece', () => {
    const result = explain({
      fenBefore: '4k3/8/8/4n3/8/5N2/8/4K3 w - - 0 1',
      playedUci: 'e1e2',
      userColor: 'w',
      best: { pv: ['f3e5'], score: cp(300) },
      reply: { pv: ['e5c4'], score: cp(0) },
    })
    expect(result.type).toBe('missed_capture')
    expect(result.text).toBe('Rakibin bıraktığı atı alabilirdin: ♘xe5.')
  })

  it('explains allowing a knight fork', () => {
    const result = explain({
      fenBefore: '4k3/8/8/8/3n4/8/7P/R3K3 w - - 0 1',
      playedUci: 'h2h3',
      userColor: 'w',
      best: { pv: ['e1d2'], score: cp(0) },
      reply: { pv: ['d4c2', 'e1d2', 'c2a1'], score: cp(500) },
    })
    expect(result.type).toBe('allowed_fork')
    expect(result.text).toContain('Rakibin çatal tehdidini kaçırdın')
    expect(result.text).toContain('rakibin atı aynı anda şahına ve kalene saldırıyor')
  })

  it('explains a missed fork', () => {
    const result = explain({
      fenBefore: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
      playedUci: 'e1e2',
      userColor: 'w',
      best: { pv: ['b5c7', 'e8d7', 'c7a8'], score: cp(500) },
      reply: { pv: ['a8a5'], score: cp(0) },
    })
    expect(result.type).toBe('missed_tactic')
    expect(result.text).toContain('♘c7+ ile çatal yapabilirdin')
    expect(result.text).toContain('aynı anda şaha ve kaleye saldırırdı')
  })

  describe('the Blackburne trap (1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4)', () => {
    const fenAfter = (...moves: string[]) => {
      const chess = new Chess()
      for (const move of moves) chess.move(move)
      return chess.fen()
    }
    const opening = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4']

    it('4.Nxe5? allows a queen fork of the knight and the g2 pawn', () => {
      const result = explain({
        fenBefore: fenAfter(...opening),
        playedUci: 'f3e5',
        userColor: 'w',
        // Nxd4 exd4 is just a trade, so the best line wins no material.
        best: { pv: ['f3d4', 'e5d4', 'e1g1'], score: cp(40) },
        reply: { pv: ['d8g5', 'e5f7', 'g5g2'], score: cp(80) },
        winBefore: 61,
        winAfter: 47,
      })
      expect(result.type).toBe('allowed_fork')
      expect(result.text).toBe(
        'Bu hamleden sonra rakip ♕g5 ile çatal yapıyor: rakibin veziri aynı anda atına ve piyonuna saldırıyor. Daha iyisi şuydu: ♘xd4.',
      )
    })

    it('5.Nxf7?? ignores the attack on g2, and taking it also hits the rook', () => {
      const result = explain({
        fenBefore: fenAfter(...opening, 'Nxe5', 'Qg5'),
        playedUci: 'e5f7',
        userColor: 'w',
        best: { pv: ['c4f7', 'e8d8', 'e5g4'], score: cp(-40) },
        reply: { pv: ['g5g2', 'd1f3', 'g2h1'], score: cp(400) },
        winBefore: 44,
        winAfter: 11,
      })
      expect(result.type).toBe('hung_piece')
      expect(result.text).toContain('Rakip g2 karesindeki piyonuna saldırıyordu')
      expect(result.text).toContain('Üstelik rakibin veziri bu alışla kalene saldırıyor.')
    })
  })

  it('falls back to a general explanation with the better move', () => {
    const result = explain({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      playedUci: 'g2g4',
      userColor: 'w',
      best: { pv: ['e2e4'], score: cp(30) },
      reply: { pv: ['d7d5'], score: cp(60) },
      winBefore: 53,
      winAfter: 45,
    })
    expect(result.type).toBe('other')
    expect(result.text).toBe('Bu hamle pozisyonunu zayıflattı. Daha iyisi şuydu: e4.')
  })

  it('works from black\'s side too', () => {
    // Black knight goes to e4 where the white knight on f2... simpler: black queen takes a defended pawn.
    // 1.e4 e5 2.Nf3 Qh4?? 3.Nxh4
    const result = explain({
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
      playedUci: 'd8h4',
      userColor: 'b',
      best: { pv: ['b8c6'], score: cp(-30) },
      reply: { pv: ['f3h4'], score: cp(900) },
    })
    expect(result.type).toBe('hung_piece')
    expect(result.text).toContain('vezirini korumasız bıraktın')
  })
})
