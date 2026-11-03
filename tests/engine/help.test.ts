import { describe, expect, it } from 'vitest'
import { applyMove, createGame, legalMoves } from '../../src/engine/game'
import type { GameState } from '../../src/engine/game'
import { blockReason, explainBlock, patternPreview, patternSquares, pinnerOf } from '../../src/ui/help/blockReason'
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
  it('핀 걸린 말 → pinned', () => {
    const s = createGame('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1')
    expect(blockReason(s, 'e2', 'd3')).toBe('pinned')
    expect(pinnerOf(s, 'e2')).toBe('e7')
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

describe('상대 말을 잡을 수 없는 경우', () => {
  // 사용자 제보 배치: 백 Kd3·Bd4, 흑 Rd8이 d파일에 일렬 → d4 비숍은 핀
  const reported = createGame('2Nr2k1/pp6/4Nb2/7p/3B4/1P1K4/P1P4P/8 w - - 0 1')

  it('핀 걸린 비숍은 상대 비숍(f6)을 잡을 수 없다 — chess.js 판정', () => {
    expect(legalMoves(reported, 'd4')).toHaveLength(0)
    expect(blockReason(reported, 'd4', 'f6')).toBe('pinned')
  })

  it('안내 문장은 핀을 건 말과 칸을 알려 준다', () => {
    expect(explainBlock(reported, 'd4', 'f6')).toBe(
      'd4 비숍은 핀에 걸려 있어요. 움직이면 d8 룩이 내 킹을 공격해요.',
    )
  })

  it('핀이어도 같은 선 위의 공격자를 잡는 것은 된다', () => {
    // 백 Kd1·Rd2, 흑 Rd4: d2 룩은 핀이지만 d파일을 따라 d4 룩을 잡을 수 있다
    const s = createGame('4k3/8/8/8/3r4/8/3R4/3K4 w - - 0 1')
    expect(pinnerOf(s, 'd2')).toBe('d4')
    expect(blockReason(s, 'd2', 'd4')).toBeNull()
    expect(blockReason(s, 'd2', 'e2')).toBe('pinned')
  })

  it('킹은 지켜지는 말을 잡을 수 없다', () => {
    const s = createGame('4r1k1/8/8/8/8/8/4p3/4K3 w - - 0 1')
    expect(blockReason(s, 'e1', 'e2')).toBe('kingProtected')
    expect(explainBlock(s, 'e1', 'e2')).toBe('e2 폰은 상대가 지키고 있어서 킹이 잡을 수 없어요.')
  })

  it('킹은 공격받는 칸으로 못 간다', () => {
    const s = createGame('3r2k1/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(blockReason(s, 'e1', 'd1')).toBe('kingAttacked')
  })

  it('움직이는 모양이 아니면 notPattern (킹 안전 문구로 잘못 안내하지 않음)', () => {
    expect(blockReason(createGame(), 'c1', 'c3')).toBe('notPattern')
    expect(explainBlock(createGame(), 'c1', 'c3')).toContain('비숍은 c3 쪽으로 움직일 수 없어요')
  })

  it('킹 두 칸 가로는 캐슬링 안내', () => {
    expect(blockReason(createGame(), 'e1', 'g1')).toBe('ownPiece')
    expect(blockReason(createGame('4k3/8/8/8/8/8/8/4K2R w - - 0 1'), 'e1', 'c1')).toBe('castleOnly')
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
