// 보드 좌표 ↔ 3D 위치 변환. 이 파일이 유일한 진실이다.
// - 칸 크기 1, 보드 중심이 원점
// - 파일 a→h 는 x -3.5 → +3.5
// - 랭크 1→8 은 z +3.5 → -3.5 (백 시점 카메라는 +z 쪽에 있다)
import { Vector3 } from 'three'
import type { Color, Square } from 'chess.js'

export const SQUARE_SIZE = 1
export const BOARD_HALF = 4
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const
/** 칸 윗면 높이 */
export const BOARD_TOP = 0
/** 프레임 폭 (칸 바깥) */
export const FRAME_WIDTH = 0.9

export const ALL_SQUARES: Square[] = RANKS.flatMap((r) => FILES.map((f) => `${f}${r}` as Square))

export function fileIndex(square: Square): number {
  return square.charCodeAt(0) - 97
}

export function rankIndex(square: Square): number {
  return square.charCodeAt(1) - 49
}

export function squareFromIndex(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return `${FILES[file]}${RANKS[rank]}` as Square
}

export function isLightSquare(square: Square): boolean {
  return (fileIndex(square) + rankIndex(square)) % 2 === 1
}

export function fileToX(file: number): number {
  return (file - 3.5) * SQUARE_SIZE
}

export function rankToZ(rank: number): number {
  return (3.5 - rank) * SQUARE_SIZE
}

export function squareToWorld(square: Square, y = BOARD_TOP, out = new Vector3()): Vector3 {
  return out.set(fileToX(fileIndex(square)), y, rankToZ(rankIndex(square)))
}

export function worldToSquare(v: { x: number; z: number }): Square | null {
  const file = Math.floor(v.x / SQUARE_SIZE + 4)
  const rank = Math.floor(4 - v.z / SQUARE_SIZE)
  return squareFromIndex(file, rank)
}

/** 잡힌 말 트레이: 백이 잡은 흑 말은 백 오른쪽(+x), 흑이 잡은 백 말은 왼쪽(-x) */
export function trayPosition(capturedColor: Color, index: number, out = new Vector3()): Vector3 {
  const col = Math.floor(index / 8)
  const row = index % 8
  const side = capturedColor === 'b' ? 1 : -1
  const x = side * (BOARD_HALF + FRAME_WIDTH + 0.55 + col * 0.62)
  // 백이 잡은 말은 백 쪽(+z)부터, 흑이 잡은 말은 흑 쪽(-z)부터 쌓는다
  const z = side * (3.15 - row * 0.9)
  return out.set(x, TRAY_Y, z)
}

/** 트레이(테이블) 높이: 보드보다 살짝 낮다 */
export const TRAY_Y = BOARD_TOP - 0.12

/** 프레임 위 좌표 라벨 위치 */
export function fileLabelPosition(file: number, side: 'near' | 'far', out = new Vector3()): Vector3 {
  const z = (BOARD_HALF + FRAME_WIDTH / 2) * (side === 'near' ? 1 : -1)
  return out.set(fileToX(file), BOARD_TOP + 0.02, z)
}

export function rankLabelPosition(rank: number, side: 'left' | 'right', out = new Vector3()): Vector3 {
  const x = (BOARD_HALF + FRAME_WIDTH / 2) * (side === 'right' ? 1 : -1)
  return out.set(x, BOARD_TOP + 0.02, rankToZ(rank))
}
