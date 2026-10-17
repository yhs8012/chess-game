// 칸(메이플·월넛) + 흑단 상감선 + 마호가니 프레임 + 테이블
import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Square } from 'chess.js'
import { ALL_SQUARES, BOARD_HALF, BOARD_TOP, FRAME_WIDTH, isLightSquare, squareToWorld, worldToSquare } from './coords'
import { BoxGeometry } from 'three'
import { materials, tileMaterials } from './materials'

const TILE = 0.975
const TILE_H = 0.06
/** 상감선이 칸보다 살짝 낮다(음각) */
const INLAY_Y = BOARD_TOP - 0.022
const FRAME_H = 0.42
const FRAME_SIZE = (BOARD_HALF + FRAME_WIDTH) * 2

// 재현 가능한 의사 난수
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * 칸 하나의 지오메트리. 실제 보드처럼 칸마다 다른 나무 조각을 쓴 것처럼 보이도록
 * 나무 텍스처의 서로 다른 부분(UV 창)을 쓰고, 이웃 칸과 결 방향을 90° 엇갈린다.
 */
function tileGeometry(index: number): BoxGeometry {
  const g = new BoxGeometry(TILE, TILE_H, TILE)
  const r = rng(index * 97 + 13)
  const win = 0.3
  const ox = r() * (1 - win)
  const oy = r() * (1 - win)
  const turn = r() > 0.5
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i)
    let v = uv.getY(i)
    if (turn) [u, v] = [v, 1 - u]
    uv.setXY(i, ox + u * win, oy + v * win)
  }
  uv.needsUpdate = true
  return g
}

interface Props {
  onHover: (sq: Square | null) => void
  onClick: (sq: Square) => void
}

export const Board3D = memo(function Board3D({ onHover, onClick }: Props) {
  const tiles = useMemo(() => {
    const mats = tileMaterials()
    return ALL_SQUARES.map((sq, i) => ({
      sq,
      pos: squareToWorld(sq, BOARD_TOP - TILE_H / 2),
      mat: isLightSquare(sq) ? mats.light : mats.dark,
      geo: tileGeometry(i),
    }))
  }, [])

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => worldToSquare(e.point)

  return (
    <group>
      {tiles.map(({ sq, pos, mat, geo }) => (
        <mesh key={sq} position={pos} material={mat} geometry={geo} receiveShadow />
      ))}

      {/* 흑단 상감 바닥: 칸 사이 틈으로 보인다 */}
      <mesh position={[0, INLAY_Y, 0]} rotation-x={-Math.PI / 2} material={materials.ebonyInlay()} receiveShadow>
        <planeGeometry args={[8.06, 8.06]} />
      </mesh>

      {/* 프레임 (짙은 마호가니, 둥근 베벨) */}
      <RoundedBox
        args={[FRAME_SIZE, FRAME_H, FRAME_SIZE]}
        radius={0.12}
        smoothness={4}
        position={[0, INLAY_Y - 0.001 - FRAME_H / 2, 0]}
        material={materials.mahogany()}
        receiveShadow
        castShadow
      />
      {/* 프레임 안쪽 황동 테두리선 */}
      <mesh position={[0, INLAY_Y + 0.001, 0]} rotation-x={-Math.PI / 2} material={materials.brass()}>
        {/* 4분할 링을 45° 돌리면 정사각 테두리: 꼭짓점 반지름 = 반변 × √2 */}
        <ringGeometry args={[(BOARD_HALF + 0.08) * Math.SQRT2, (BOARD_HALF + 0.13) * Math.SQRT2, 4, 1, Math.PI / 4]} />
      </mesh>

      {/* 테이블 */}
      <mesh position={[0, INLAY_Y - FRAME_H - 0.002, 0]} rotation-x={-Math.PI / 2} material={materials.table()} receiveShadow>
        <planeGeometry args={[60, 60]} />
      </mesh>

      {/* 입력용 투명 판: 맞은 점을 worldToSquare로 칸으로 바꾼다 */}
      <mesh
        position={[0, BOARD_TOP + 0.001, 0]}
        rotation-x={-Math.PI / 2}
        onPointerMove={(e) => {
          e.stopPropagation()
          onHover(pick(e))
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          const sq = pick(e)
          if (sq) onClick(sq)
        }}
      >
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
})
