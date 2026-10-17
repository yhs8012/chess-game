// 기물 이동 곡선: 출발 → 도착 포물선, 나이트는 더 높이 점프
import { Vector3 } from 'three'
import type { PieceSymbol } from 'chess.js'

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** 포물선 높이: 이동 거리에 비례, 나이트는 더 높게 */
export function arcHeight(type: PieceSymbol, distance: number): number {
  if (distance < 1e-3) return 0
  const base = type === 'n' ? 0.95 : 0.28
  return base + Math.min(distance, 8) * 0.06
}

export function arcPosition(from: Vector3, to: Vector3, t: number, height: number, out = new Vector3()) {
  const e = easeInOut(t)
  out.lerpVectors(from, to, e)
  out.y += 4 * height * t * (1 - t)
  return out
}

/** 제자리 좌우 흔들림 (잘못된 수) */
export function shakeOffset(t: number): number {
  if (t >= 1) return 0
  return Math.sin(t * Math.PI * 6) * 0.07 * (1 - t)
}
