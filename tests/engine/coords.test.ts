import { describe, expect, it } from 'vitest'
import { ALL_SQUARES, isLightSquare, squareToWorld, worldToSquare } from '../../src/scene/coords'

describe('좌표 변환', () => {
  it('a1은 백 시점 왼쪽 아래, h8은 오른쪽 위', () => {
    const a1 = squareToWorld('a1')
    expect([a1.x, a1.z]).toEqual([-3.5, 3.5])
    const h8 = squareToWorld('h8')
    expect([h8.x, h8.z]).toEqual([3.5, -3.5])
  })

  it('64칸 모두 왕복 변환이 같다', () => {
    for (const sq of ALL_SQUARES) {
      expect(worldToSquare(squareToWorld(sq))).toBe(sq)
    }
  })

  it('칸 경계 안쪽 아무 점이나 같은 칸', () => {
    expect(worldToSquare({ x: 0.01, z: 0.01 })).toBe('e4')
    expect(worldToSquare({ x: 0.99, z: -0.99 })).toBe('e5')
    expect(worldToSquare({ x: 1.01, z: -0.99 })).toBe('f5')
  })

  it('보드 밖은 null', () => {
    expect(worldToSquare({ x: 4.2, z: 0 })).toBeNull()
    expect(worldToSquare({ x: 0, z: -4.01 })).toBeNull()
  })

  it('a1은 어두운 칸, h1은 밝은 칸', () => {
    expect(isLightSquare('a1')).toBe(false)
    expect(isLightSquare('h1')).toBe(true)
  })
})
