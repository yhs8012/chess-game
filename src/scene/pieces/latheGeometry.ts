// GLTF 모델이 없을 때 쓰는 스턴턴풍 임시 기물 (Lathe 회전체 + 나이트 머리 압출)
import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  Vector2,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PieceSymbol } from 'chess.js'

/** 킹 높이(십자가 끝). 모든 기물·GLTF 모델 스케일의 기준 */
export const KING_HEIGHT = 1.22

type P = [number, number]

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 10): P[] {
  const out: P[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return out
}

/** 공통 받침: 아래 테두리 + 둥근 몰딩 */
function base(r: number): P[] {
  return [
    [0, 0],
    [r, 0],
    [r + 0.012, 0.018],
    [r + 0.01, 0.045],
    [r - 0.01, 0.06],
    ...arc(r * 0.86, 0.085, 0.03, -Math.PI / 2, Math.PI / 2, 6),
    [r * 0.78, 0.12],
    [r * 0.8, 0.135],
    [r * 0.7, 0.15],
  ]
}

function lathe(points: P[], segments = 40): BufferGeometry {
  return new LatheGeometry(
    points.map(([x, y]) => new Vector2(Math.max(0, x), y)),
    segments,
  ).toNonIndexed()
}

function sphere(r: number, y: number): BufferGeometry {
  return new SphereGeometry(r, 24, 16).translate(0, y, 0).toNonIndexed()
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): BufferGeometry {
  return new BoxGeometry(w, h, d).rotateY(rotY).translate(x, y, z).toNonIndexed()
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false)!
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

function pawn(): BufferGeometry {
  return merge([
    lathe([
      ...base(0.26),
      [0.15, 0.18],
      [0.115, 0.26],
      [0.09, 0.34],
      [0.08, 0.38],
      [0.15, 0.4],
      [0.155, 0.42],
      [0.13, 0.435],
      [0.075, 0.445],
      ...arc(0, 0.54, 0.115, -Math.PI / 2 + 0.55, Math.PI / 2, 12),
    ]),
  ])
}

function rook(): BufferGeometry {
  const parts = [
    lathe([
      ...base(0.29),
      [0.19, 0.18],
      [0.165, 0.3],
      [0.155, 0.48],
      [0.16, 0.52],
      [0.21, 0.55],
      [0.215, 0.58],
      [0.2, 0.6],
      [0.205, 0.7],
      [0.205, 0.72],
      [0.15, 0.72],
      [0.15, 0.68],
      [0, 0.68],
    ]),
  ]
  // 성벽 톱니 6개
  const n = 6
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    parts.push(box(0.1, 0.08, 0.06, Math.cos(a) * 0.178, 0.755, Math.sin(a) * 0.178, -a + Math.PI / 2))
  }
  return merge(parts)
}

function knight(): BufferGeometry {
  const body = lathe([...base(0.29), [0.2, 0.18], [0.19, 0.24], [0.21, 0.27], [0.2, 0.29], [0, 0.29]])
  // 말 머리 실루엣 (x+ 가 주둥이 방향)
  const s = new Shape()
  const pts: P[] = [
    [-0.17, 0.27],
    [0.15, 0.27],
    [0.17, 0.36],
    [0.12, 0.46],
    [0.2, 0.53],
    [0.29, 0.6],
    [0.31, 0.66],
    [0.28, 0.71],
    [0.16, 0.76],
    [0.1, 0.83],
    [0.07, 0.92],
    [0.02, 0.86],
    [-0.04, 0.84],
    [-0.12, 0.8],
    [-0.18, 0.7],
    [-0.21, 0.57],
    [-0.21, 0.42],
  ]
  s.moveTo(pts[0][0], pts[0][1])
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y)
  s.closePath()
  const head = new ExtrudeGeometry(s, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 4,
  })
    .translate(0, 0, -0.07)
  head.computeVertexNormals()
  // 눈
  const eyes = [sphere(0.022, 0).translate(0.13, 0.71, 0.1), sphere(0.022, 0).translate(0.13, 0.71, -0.1)]
  // 기본으로 +x 쪽을 본다. 방향은 Piece3D가 정한다
  return merge([body, head, ...eyes])
}

function bishop(): BufferGeometry {
  return merge([
    lathe([
      ...base(0.28),
      [0.17, 0.18],
      [0.125, 0.3],
      [0.095, 0.46],
      [0.09, 0.53],
      [0.16, 0.55],
      [0.165, 0.575],
      [0.1, 0.59],
      [0.14, 0.6],
      [0.14, 0.615],
      [0.08, 0.63],
      ...arc(0, 0.73, 0.125, -Math.PI / 2 + 0.6, Math.PI / 2 - 0.25, 12),
      [0.03, 0.86],
      [0, 0.86],
    ]),
    sphere(0.045, 0.9),
  ])
}

function queen(): BufferGeometry {
  const parts = [
    lathe([
      ...base(0.31),
      [0.19, 0.18],
      [0.14, 0.32],
      [0.105, 0.5],
      [0.1, 0.62],
      [0.18, 0.645],
      [0.185, 0.67],
      [0.11, 0.69],
      [0.15, 0.7],
      [0.15, 0.715],
      [0.1, 0.73],
      [0.14, 0.82],
      [0.2, 0.93],
      [0.19, 0.95],
      [0.12, 0.94],
      [0.09, 0.98],
      [0, 1.0],
    ]),
    sphere(0.055, 1.04),
  ]
  // 왕관 구슬 8개
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    parts.push(sphere(0.032, 0.955).translate(Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19))
  }
  return merge(parts)
}

function king(): BufferGeometry {
  return merge([
    lathe([
      ...base(0.32),
      [0.2, 0.18],
      [0.145, 0.34],
      [0.11, 0.54],
      [0.105, 0.66],
      [0.19, 0.685],
      [0.195, 0.71],
      [0.115, 0.73],
      [0.155, 0.74],
      [0.155, 0.755],
      [0.105, 0.77],
      [0.13, 0.86],
      [0.175, 0.95],
      [0.17, 0.97],
      ...arc(0, 0.97, 0.12, 0, Math.PI / 2, 8),
    ]),
    box(0.05, 0.2, 0.05, 0, 1.12, 0),
    box(0.15, 0.05, 0.05, 0, 1.15, 0),
  ])
}

let cached: Record<PieceSymbol, BufferGeometry> | null = null

export function latheGeometries(): Record<PieceSymbol, BufferGeometry> {
  cached ??= { p: pawn(), r: rook(), n: knight(), b: bishop(), q: queen(), k: king() }
  return cached
}
