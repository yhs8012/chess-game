import { describe, expect, it } from 'vitest'
import { applyMove, createGame, legalMoves } from '../../src/engine/game'
import type { GameState } from '../../src/engine/game'
import { trackPieces } from '../../src/engine/tracking'

function play(state: GameState, ...sans: string[]): GameState {
  let s = state
  for (const san of sans) {
    const m = legalMoves(s).find((x) => x.san === san)!
    const r = applyMove(s, { from: m.from, to: m.to, promotion: m.promotion })
    if (!r.ok) throw new Error(san)
    s = r.state
  }
  return s
}

const at = (s: GameState, sq: string) => trackPieces(s).pieces.find((p) => p.square === sq)

describe('기물 추적', () => {
  it('초기 32개, id는 시작 칸 기준', () => {
    const t = trackPieces(createGame())
    expect(t.pieces).toHaveLength(32)
    expect(at(createGame(), 'e1')?.id).toBe('wk-e1')
  })

  it('이동한 기물은 id를 유지한다', () => {
    const s = play(createGame(), 'Nf3')
    expect(at(s, 'f3')?.id).toBe('wn-g1')
  })

  it('잡힌 기물은 captured로 간다', () => {
    const s = play(createGame(), 'e4', 'd5', 'exd5')
    const t = trackPieces(s)
    expect(t.pieces).toHaveLength(31)
    expect(t.captured).toEqual([{ id: 'bp-d7', type: 'p', color: 'b', ply: 2 }])
    expect(at(s, 'd5')?.id).toBe('wp-e2')
  })

  it('앙파상: 옆 칸의 폰이 사라진다', () => {
    const s = play(createGame(), 'e4', 'a6', 'e5', 'd5', 'exd6')
    const t = trackPieces(s)
    expect(t.captured[0].id).toBe('bp-d7')
    expect(at(s, 'd5')).toBeUndefined()
    expect(at(s, 'd6')?.id).toBe('wp-e2')
  })

  it('캐슬링: 룩도 같이 움직인다', () => {
    const s = play(createGame(), 'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O')
    expect(at(s, 'g1')?.id).toBe('wk-e1')
    expect(at(s, 'f1')?.id).toBe('wr-h1')
    expect(at(s, 'h1')).toBeUndefined()
  })

  it('프로모션: id는 유지하고 종류만 바뀐다', () => {
    const s0 = createGame('8/P7/8/8/8/8/8/k6K w - - 0 1')
    const r = applyMove(s0, { from: 'a7', to: 'a8', promotion: 'q' })
    if (!r.ok) throw new Error()
    const p = at(r.state, 'a8')!
    expect(p.id).toBe('wp-a7')
    expect(p.type).toBe('q')
  })
})
