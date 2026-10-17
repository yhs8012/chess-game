import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createGame,
  isPromotionMove,
  legalMoves,
  sanHistory,
  statusOf,
  undo,
} from '../../src/engine/game'
import type { GameState, MoveInput, Square } from '../../src/engine/game'
import type { GameEvent } from '../../src/engine/events'
import { createEventBus } from '../../src/engine/events'

function play(state: GameState, ...sans: string[]): GameState {
  let s = state
  for (const san of sans) {
    const m = legalMoves(s).find((x) => x.san === san)
    if (!m) throw new Error(`illegal in test: ${san}`)
    const r = applyMove(s, { from: m.from, to: m.to, promotion: m.promotion })
    if (!r.ok) throw new Error(`failed: ${san}`)
    s = r.state
  }
  return s
}

function types(events: GameEvent[]) {
  return events.map((e) => e.type)
}

function mv(state: GameState, from: string, to: string, promotion?: MoveInput['promotion']) {
  return applyMove(state, { from: from as Square, to: to as Square, promotion })
}

describe('기본 이동과 불변 상태', () => {
  it('초기 배치에서 20개의 합법 수가 있다', () => {
    expect(legalMoves(createGame())).toHaveLength(20)
  })

  it('수를 두면 새 상태를 돌려주고 이전 상태는 바뀌지 않는다', () => {
    const s0 = createGame()
    const r = mv(s0, 'e2', 'e4')
    expect(r.ok).toBe(true)
    expect(s0.moves).toHaveLength(0)
    expect(r.state).not.toBe(s0)
    expect(r.state.moves).toHaveLength(1)
    expect(statusOf(s0).turn).toBe('w')
    expect(statusOf(r.state).turn).toBe('b')
  })

  it('일반 이동은 move 이벤트 하나만 낸다', () => {
    const r = mv(createGame(), 'g1', 'f3')
    expect(types(r.events)).toEqual(['move'])
  })

  it('잘못된 수는 invalid 이벤트를 내고 상태를 그대로 둔다', () => {
    const s0 = createGame()
    const r = mv(s0, 'e2', 'e5')
    expect(r.ok).toBe(false)
    expect(r.state).toBe(s0)
    expect(r.events).toEqual([{ type: 'invalid', from: 'e2', to: 'e5', piece: 'p' }])
  })

  it('자기 킹을 체크에 노출하는 수(자살수)는 둘 수 없다', () => {
    // 1.e4 e5 2.Qh5 f6?? 이후 흑이 f7 폰을... 대신 핀 상황을 직접 구성
    const s = createGame('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1')
    expect(mv(s, 'e2', 'd3').ok).toBe(false)
  })
})

describe('이벤트 변환', () => {
  it('잡기 → capture 이벤트 (잡힌 기물·칸 포함)', () => {
    const s = play(createGame(), 'e4', 'd5')
    const r = mv(s, 'e4', 'd5')
    expect(types(r.events)).toEqual(['move', 'capture'])
    const cap = r.events[1]
    expect(cap).toMatchObject({ type: 'capture', captured: 'p', capturedSquare: 'd5', enPassant: false })
  })

  it('앙파상 → capture 이벤트, 잡힌 칸은 도착 칸이 아니라 옆 칸', () => {
    const s = play(createGame(), 'e4', 'a6', 'e5', 'd5')
    const r = mv(s, 'e5', 'd6')
    expect(r.ok).toBe(true)
    expect(r.events[1]).toMatchObject({ type: 'capture', enPassant: true, capturedSquare: 'd5' })
  })

  it('킹 쪽 캐슬링 → castle 이벤트 (룩 h1→f1)', () => {
    const s = play(createGame(), 'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5')
    const r = mv(s, 'e1', 'g1')
    expect(types(r.events)).toEqual(['move', 'castle'])
    expect(r.events[1]).toMatchObject({ side: 'k', rookFrom: 'h1', rookTo: 'f1' })
  })

  it('퀸 쪽 캐슬링 → castle 이벤트 (룩 a8→d8)', () => {
    const s = createGame('r3k3/8/8/8/8/8/8/4K3 b q - 0 1')
    const r = mv(s, 'e8', 'c8')
    expect(r.events[1]).toMatchObject({ type: 'castle', side: 'q', rookFrom: 'a8', rookTo: 'd8' })
  })

  it('프로모션 → promotion 이벤트, 프로모션 수 판별', () => {
    const s = createGame('8/P7/8/8/8/8/p7/k6K w - - 0 1')
    expect(isPromotionMove(s, 'a7', 'a8')).toBe(true)
    expect(isPromotionMove(s, 'h1', 'h2')).toBe(false)
    const r = mv(s, 'a7', 'a8', 'n')
    expect(types(r.events)).toEqual(['move', 'promotion'])
    expect(r.events[1]).toMatchObject({ promotion: 'n' })
  })

  it('잡으면서 프로모션 → capture와 promotion 둘 다', () => {
    const s = createGame('1r6/P7/8/8/8/8/8/k6K w - - 0 1')
    const r = mv(s, 'a7', 'b8', 'q')
    expect(types(r.events)).toEqual(['move', 'capture', 'promotion'])
  })

  it('체크 → check 이벤트 (체크당한 쪽과 킹 칸)', () => {
    const s = play(createGame(), 'e4', 'f5')
    const r = mv(s, 'd1', 'h5')
    expect(types(r.events)).toEqual(['move', 'check'])
    expect(r.events[1]).toEqual({ type: 'check', color: 'b', kingSquare: 'e8' })
  })

  it("체크메이트(바보의 메이트) → checkmate 이벤트, check는 따로 내지 않는다", () => {
    const s = play(createGame(), 'f3', 'e5', 'g4')
    const r = mv(s, 'd8', 'h4')
    expect(types(r.events)).toEqual(['move', 'checkmate'])
    expect(r.events[1]).toEqual({ type: 'checkmate', loser: 'w', winner: 'b', kingSquare: 'e1' })
    const st = statusOf(r.state)
    expect(st.isCheckmate).toBe(true)
    expect(st.isGameOver).toBe(true)
    expect(st.winner).toBe('b')
  })

  it('스테일메이트 → draw(stalemate)', () => {
    const s = createGame('7k/8/6Q1/8/8/8/8/K7 w - - 0 1')
    const r = mv(s, 'g6', 'f7')
    expect(r.events.at(-1)).toEqual({ type: 'draw', reason: 'stalemate' })
    expect(statusOf(r.state).isStalemate).toBe(true)
  })

  it('기물 부족 → draw(insufficient)', () => {
    const s = createGame('8/8/8/8/8/8/1q6/K6k w - - 0 1')
    const r = mv(s, 'a1', 'b2')
    expect(r.events.at(-1)).toEqual({ type: 'draw', reason: 'insufficient' })
  })

  it('3회 동형반복 → draw(threefold)', () => {
    const s = play(createGame(), 'Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1')
    const r = mv(s, 'f6', 'g8')
    expect(r.events.at(-1)).toEqual({ type: 'draw', reason: 'threefold' })
  })

  it('50수 규칙 → draw(fiftyMoves)', () => {
    const s = createGame('8/8/8/8/8/5k2/8/R3K3 w - - 99 80')
    const r = mv(s, 'a1', 'a2')
    expect(r.events.at(-1)).toEqual({ type: 'draw', reason: 'fiftyMoves' })
  })
})

describe('무르기와 기보', () => {
  it('undo는 이전 상태와 같은 FEN을 만든다', () => {
    const s1 = play(createGame(), 'e4')
    const s2 = play(s1, 'e5')
    const back = undo(s2)
    expect(back.fen).toBe(s1.fen)
    expect(undo(s2, 2).fen).toBe(createGame().fen)
    expect(undo(createGame()).moves).toHaveLength(0)
  })

  it('SAN 기보', () => {
    const s = play(createGame(), 'e4', 'e5', 'Nf3')
    expect(sanHistory(s)).toEqual(['e4', 'e5', 'Nf3'])
  })
})

describe('이벤트 버스', () => {
  it('구독·해제', () => {
    const bus = createEventBus<GameEvent>()
    const got: string[] = []
    const off = bus.subscribe((e) => got.push(e.type))
    bus.emit({ type: 'select', square: 'e2' })
    off()
    bus.emit({ type: 'select', square: 'e2' })
    expect(got).toEqual(['select'])
  })
})
