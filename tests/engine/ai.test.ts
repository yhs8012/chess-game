import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { chooseMove, evaluate } from '../../src/engine/ai'

const isLegal = (fen: string, m: { from: string; to: string }) =>
  new Chess(fen).moves({ verbose: true }).some((x) => x.from === m.from && x.to === m.to)

describe('AI', () => {
  const start = new Chess().fen()

  it('초기 배치 평가는 0 (대칭)', () => {
    expect(evaluate(new Chess())).toBe(0)
  })

  it.each(['easy', 'normal', 'hard'] as const)('%s 난이도는 합법 수를 고른다', (d) => {
    const m = chooseMove(start, d)!
    expect(isLegal(start, m)).toBe(true)
  })

  it('둘 수가 없으면 null', () => {
    expect(chooseMove('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'normal')).toBeNull()
  })

  it('보통 난이도는 공짜 퀸을 잡는다', () => {
    const fen = '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1'
    expect(chooseMove(fen, 'normal')).toMatchObject({ from: 'e4', to: 'd5' })
  })

  it('보통 난이도는 한 수 메이트를 찾는다', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
    expect(chooseMove(fen, 'normal')).toMatchObject({ from: 'a1', to: 'a8' })
  })

  it('어려움(깊이 3)은 초기 배치에서 제한 시간 안에 답한다', () => {
    const t = performance.now()
    chooseMove(start, 'hard')
    expect(performance.now() - t).toBeLessThan(8000)
  })
})
