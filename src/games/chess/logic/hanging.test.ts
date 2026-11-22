import { describe, expect, it } from 'vitest'
import { detectLeftHanging, findHangingPieces, leastLossAvailable, shouldWarn, staticExchange } from './hanging'

describe('staticExchange', () => {
  it('wins an undefended piece outright', () => {
    // White queen d1 can take the undefended black knight on d5.
    const fen = '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1'
    expect(staticExchange(fen, 'd5', 'w')).toBe(3)
  })

  it('is negative when a big piece would take a defended small one', () => {
    // Knight d5 defended by pawn e6: Qxd5 exd5 loses the queen for a knight.
    const fen = '4k3/8/4p3/3n4/8/8/8/3QK3 w - - 0 1'
    expect(staticExchange(fen, 'd5', 'w')).toBeLessThan(0)
  })

  it('wins material when a pawn attacks a defended knight', () => {
    // c4 pawn takes the knight on d5; e6 pawn recaptures: +3 -1 = +2.
    const fen = '4k3/8/4p3/3n4/2P5/8/8/4K3 w - - 0 1'
    expect(staticExchange(fen, 'd5', 'w')).toBe(2)
  })

  it('counts x-ray attackers behind the first one', () => {
    // Rooks doubled on the d-file against a knight defended once by a rook:
    // Rxd5 Rxd5 Rxd5 nets a knight (3).
    const fen = '3rk3/8/8/3n4/8/8/3R4/3RK3 w - - 0 1'
    expect(staticExchange(fen, 'd5', 'w')).toBe(3)
  })

  it('ignores a defender that is pinned to its king', () => {
    // The black knight e7 would defend d5, but it is pinned by the white rook on e1.
    const pinned = '4k3/4n3/8/3n4/8/8/8/3QR1K1 w - - 0 1'
    expect(staticExchange(pinned, 'd5', 'w')).toBe(3)
    // Without the pin the knight on d5 is defended and Qxd5 loses the queen.
    const free = '4k3/4n3/8/3n4/8/8/8/3Q2K1 w - - 0 1'
    expect(staticExchange(free, 'd5', 'w')).toBeLessThan(0)
  })

  it('returns 0 for empty squares and own pieces', () => {
    const fen = '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1'
    expect(staticExchange(fen, 'a4', 'w')).toBe(0)
    expect(staticExchange(fen, 'd1', 'w')).toBe(0)
  })
})

describe('findHangingPieces', () => {
  it('lists pieces the opponent can win, most valuable first', () => {
    // Black to move: the queen on e5 attacks the undefended rook a5 and knight h2.
    const fen = '4k3/8/8/R3q3/8/8/7N/1K6 b - - 0 1'
    const hanging = findHangingPieces(fen, 'w')
    expect(hanging.map((h) => h.square)).toEqual(['a5', 'h2'])
    expect(hanging[0]).toMatchObject({ type: 'r', loss: 5, defended: false })
  })

  it('ignores pieces that are attacked but safely defended', () => {
    // White knight d4 attacked by the black rook d8, defended by the pawn c3.
    const fen = '3rk3/8/8/8/3N4/2P5/8/4K3 b - - 0 1'
    expect(findHangingPieces(fen, 'w')).toEqual([])
  })

  it('does not count a capture that loses to a recapture from behind', () => {
    // Qxh5 would be answered by Rxh5 along the fifth rank, so the knight is safe.
    const fen = '4k3/8/8/R1q4N/8/8/8/4K3 b - - 0 1'
    expect(findHangingPieces(fen, 'w').map((h) => h.square)).toEqual(['a5'])
  })
})

describe('detectLeftHanging', () => {
  it('spots a piece moved to a square where it can be taken for less than it is worth', () => {
    // 1.e4 e5 2.Nf3 d6 3.Nxe5?? dxe5: knight for a pawn.
    const fen = 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'
    const result = detectLeftHanging(fen, { from: 'f3', to: 'e5' })
    expect(result).toMatchObject({ isMovedPiece: true, netLoss: 2 })
    expect(result!.piece.type).toBe('n')
  })

  it('spots a piece moved to an undefended attacked square', () => {
    // The black queen on d7 watches b5: Bd3-b5?? gives the bishop away, Bd3-e4 is safe.
    const fen = '4k3/3q4/8/8/8/3B4/8/4K3 w - - 0 1'
    expect(detectLeftHanging(fen, { from: 'd3', to: 'b5' })).toMatchObject({ isMovedPiece: true, netLoss: 3 })
    expect(detectLeftHanging(fen, { from: 'd3', to: 'e4' })).toBeNull()
  })

  it('warns when a move removes the only defender of another piece', () => {
    // The white knight c3 defends the bishop on d5, which the black queen attacks.
    // Moving the knight away (Nb5) leaves the bishop en prise.
    const fen = '3qk3/8/8/3B4/8/2N5/8/4K3 w - - 0 1'
    const result = detectLeftHanging(fen, { from: 'c3', to: 'b5' })
    expect(result).toMatchObject({ isMovedPiece: false, removedDefender: true })
    expect(result!.piece.square).toBe('d5')
  })

  it('notices a threat that was already there and is ignored', () => {
    // The black rook attacks the undefended knight on a4; white ignores it with Kf1.
    const fen = 'r3k3/8/8/8/N7/8/8/4K3 w - - 0 1'
    const result = detectLeftHanging(fen, { from: 'e1', to: 'f1' })
    expect(result).toMatchObject({ wasHangingBefore: true, isMovedPiece: false, netLoss: 3 })
  })

  it('does not warn about a fair trade', () => {
    // Bg5xf6 e7xf6: bishop for knight.
    const fen = 'rnbqkb1r/pppppp1p/5np1/6B1/3P4/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3'
    expect(detectLeftHanging(fen, { from: 'g5', to: 'f6' })).toBeNull()
  })

  it('does not warn about a pawn (only losses of 2+ count by default)', () => {
    // b2-b3 puts the pawn where the bishop c4 cannot take it, nothing else hangs.
    const fen = '4k3/8/8/8/2b5/8/1P6/4K3 w - - 0 1'
    expect(detectLeftHanging(fen, { from: 'b2', to: 'b3' })).toBeNull()
  })

  it('does not warn when the move gives checkmate', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
    expect(detectLeftHanging(fen, { from: 'a1', to: 'a8' })).toBeNull()
  })

  it('returns null for illegal moves', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
    expect(detectLeftHanging(fen, { from: 'e1', to: 'e3' })).toBeNull()
  })
})

describe('shouldWarn (coach mode)', () => {
  it('warns when a safer move exists', () => {
    // Nb5 drops the bishop on d5, but e.g. Ke2 keeps it defended.
    const fen = '3qk3/8/8/3B4/8/2N5/8/4K3 w - - 0 1'
    expect(leastLossAvailable(fen)).toBe(0)
    expect(shouldWarn(fen, { from: 'c3', to: 'b5' })).toMatchObject({ removedDefender: true })
  })

  it('does not warn about a safe move', () => {
    const fen = '3qk3/8/8/3B4/8/2N5/8/4K3 w - - 0 1'
    expect(shouldWarn(fen, { from: 'e1', to: 'e2' })).toBeNull()
  })

  it('stays quiet about a trapped piece that cannot be saved', () => {
    // The knight on a8 is attacked by the rook; both of its escape squares are covered.
    const fen = 'Nr1k4/p7/8/8/8/8/8/6K1 w - - 0 1'
    expect(detectLeftHanging(fen, { from: 'g1', to: 'f1' })).not.toBeNull()
    expect(leastLossAvailable(fen)).toBe(3)
    expect(shouldWarn(fen, { from: 'g1', to: 'f1' })).toBeNull()
  })

  it('still warns when a move loses more than necessary', () => {
    // The knight on a8 is lost anyway (3), but Qd7+?? also gives away the queen.
    const fen = 'Nr1k4/p7/8/8/8/8/8/3Q2K1 w - - 0 1'
    expect(shouldWarn(fen, { from: 'd1', to: 'd7' })).toMatchObject({ isMovedPiece: true })
  })
})
