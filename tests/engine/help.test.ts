import { describe, expect, it } from 'vitest'
import { applyMove, createGame, legalMoves } from '../../src/engine/game'
import type { GameState } from '../../src/engine/game'
import { blockReason, patternPreview, patternSquares } from '../../src/ui/help/blockReason'
import { helpContext } from '../../src/ui/help/helpContext'

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

describe('이동 패턴', () => {
  it('나이트 b1: 빈 보드 기준 3칸', () => {
    expect(patternSquares('n', 'w', 'b1').sort()).toEqual(['a3', 'c3', 'd2'])
  })
  it('룩 a1: 14칸', () => {
    expect(patternSquares('r', 'w', 'a1')).toHaveLength(14)
  })
  it('폰 e2: 앞 1·2칸 + 대각선 2칸', () => {
    expect(patternSquares('p', 'w', 'e2').sort()).toEqual(['d3', 'e3', 'e4', 'f3'])
  })
  it('흑 폰 e7은 아래로', () => {
    expect(patternSquares('p', 'b', 'e7').sort()).toEqual(['d6', 'e5', 'e6', 'f6'])
  })
})

describe('막힌 이유', () => {
  const s0 = createGame()
  it('합법 수는 null', () => {
    expect(blockReason(s0, 'g1', 'f3')).toBeNull()
  })
  it('자기 편 말이 있어요', () => {
    expect(blockReason(s0, 'g1', 'e2')).toBe('ownPiece')
  })
  it('중간 경로가 막혀 있어요', () => {
    // 룩 a1 → a5 : a2 폰이 막고 있다 (a2는 ownPiece가 먼저)
    expect(blockReason(s0, 'a1', 'a5')).toBe('pathBlocked')
    expect(blockReason(s0, 'a1', 'a2')).toBe('ownPiece')
  })
  it('폰 대각선에 잡을 말이 없으면 폰 전용 문구', () => {
    expect(blockReason(s0, 'e2', 'd3')).toBe('pawnNeedsCapture')
  })
  it('핀 걸린 말 → 이 수를 두면 내 킹이 체크당해요', () => {
    const s = createGame('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1')
    expect(blockReason(s, 'e2', 'd3')).toBe('selfCheck')
  })
  it('체크 중 → 지금은 체크부터 해결해야 해요', () => {
    const s = play(createGame(), 'e4', 'f5', 'Qh5+')
    // 흑은 체크 상태. a7 폰 전진은 체크를 풀지 못한다
    expect(blockReason(s, 'a7', 'a6')).toBe('mustResolveCheck')
  })
  it('미리보기: 패턴·합법·막힘이 서로 맞는다', () => {
    const p = patternPreview(s0, 'b1')!
    expect(p.legal.sort()).toEqual(['a3', 'c3'])
    expect([...p.blocked.entries()]).toEqual([['d2', 'ownPiece']])
  })
})

describe('문맥형 도움말', () => {
  it('초기: 체크 아님, 특수 상황 없음', () => {
    const c = helpContext(createGame(), null)
    expect(c).toMatchObject({ inCheck: false, promotionSoon: false, enPassant: false, castling: { k: false, q: false } })
  })
  it('체크·선택된 말', () => {
    const s = play(createGame(), 'e4', 'f5', 'Qh5+')
    const c = helpContext(s, 'g7')
    expect(c.inCheck).toBe(true)
    expect(c.selected).toEqual({ square: 'g7', type: 'p', color: 'b' })
  })
  it('캐슬링 가능', () => {
    const s = play(createGame(), 'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5')
    expect(helpContext(s, null).castling).toEqual({ k: true, q: false })
  })
  it('앙파상 가능', () => {
    const s = play(createGame(), 'e4', 'a6', 'e5', 'd5')
    expect(helpContext(s, null).enPassant).toBe(true)
  })
  it('프로모션 직전', () => {
    expect(helpContext(createGame('8/P7/8/8/8/8/p7/k6K w - - 0 1'), null).promotionSoon).toBe(true)
  })
})
