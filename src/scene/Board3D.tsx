// 칸(메이플·월넛) + 흑단 상감선 + 마호가니 프레임 + 테이블
import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { Square } from 'chess.js'
import { ALL_SQUARES, BOARD_HALF, BOARD_TOP, FRAME_WIDTH, isLightSquare, squareToWorld, worldToSquare } from './coords'
import { materials, tileMaterial } from './materials'

const TILE = 0.975
const TILE_H = 0.06
/** 상감선이 칸보다 살짝 낮다(음각) */
const INLAY_Y = BOARD_TOP - 0.022
const FRAME_H = 0.42
const FRAME_SIZE = (BOARD_HALF + FRAME_WIDTH) * 2

interface Props {
  onHover: (sq: Square | null) => void
  onClick: (sq: Square) => void
}

export const Board3D = memo(function Board3D({ onHover, onClick }: Props) {
  const tiles = useMemo(
    () =>
      ALL_SQUARES.map((sq, i) => ({
        sq,
        pos: squareToWorld(sq, BOARD_TOP - TILE_H / 2),
        mat: tileMaterial(isLightSquare(sq), i),
      })),
    [],
  )

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => worldToSquare(e.point)

  return (
    <group>
      {tiles.map(({ sq, pos, mat }) => (
        <mesh key={sq} position={pos} material={mat} receiveShadow>
          <boxGeometry args={[TILE, TILE_H, TILE]} />
        </mesh>
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
