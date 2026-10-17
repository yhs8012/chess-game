// 선택 링·이동 가능 점·잡기 테두리·마지막 수·호버 테두리·기보 깜빡임
import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide } from 'three'
import type { MeshBasicMaterial } from 'three'
import type { Move, Square } from 'chess.js'
import { BOARD_TOP, squareToWorld } from './coords'
import { HIGHLIGHT } from './materials'
import { hoverStore } from '../hooks/useChessGame'
import { useStore } from '../hooks/store'

const Y = BOARD_TOP + 0.004
/** 4분할 링을 45° 돌려 정사각 테두리를 만든다 */
const squareRing = (half: number, width: number) =>
  [(half - width) * Math.SQRT2, half * Math.SQRT2, 4, 1, Math.PI / 4] as const

function at(sq: Square, dy = 0): [number, number, number] {
  const v = squareToWorld(sq, Y + dy)
  return [v.x, v.y, v.z]
}

function Tile({ square, color, opacity, dy = 0 }: { square: Square; color: string; opacity: number; dy?: number }) {
  return (
    <mesh position={at(square, dy)} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[0.97, 0.97]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function SquareOutline({ square, color, width = 0.06 }: { square: Square; color: string; width?: number }) {
  return (
    <mesh position={at(square, 0.002)} rotation-x={-Math.PI / 2}>
      <ringGeometry args={squareRing(0.48, width)} />
      <meshBasicMaterial color={color} toneMapped={false} side={DoubleSide} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  )
}

export function HoverOutline() {
  const hover = useStore(hoverStore)
  if (!hover) return null
  return <SquareOutline square={hover} color={HIGHLIGHT.gold} width={0.035} />
}

function Flash({ squares, nonce }: { squares: Square[]; nonce: number }) {
  const mats = useRef<MeshBasicMaterial[]>([])
  const start = useRef<number | null>(null)
  const last = useRef(nonce)
  useFrame(({ clock }) => {
    if (last.current !== nonce || start.current === null) {
      last.current = nonce
      start.current = clock.elapsedTime
    }
    const t = clock.elapsedTime - start.current
    const o = t > 1.6 ? 0 : 0.55 * (0.5 + 0.5 * Math.cos(t * Math.PI * 5))
    for (const m of mats.current) if (m) m.opacity = o
  })
  return (
    <>
      {squares.map((sq, i) => (
        <mesh key={sq} position={at(sq, 0.003)} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.97, 0.97]} />
          <meshBasicMaterial
            ref={(m) => {
              if (m) mats.current[i] = m
            }}
            color="#fff1b8"
            toneMapped={false}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  )
}

interface Props {
  selected: Square | null
  legal: Move[]
  lastMove: { from: Square; to: Square } | null
  flash: { from: Square; to: Square; nonce: number } | null
  /** Help 미리보기 중에는 연두 점을 PatternPreview가 그린다 */
  hideLegal?: boolean
}

export const Highlights = memo(function Highlights({ selected, legal, lastMove, flash, hideLegal }: Props) {
  const targets = useMemo(() => {
    const map = new Map<Square, boolean>()
    for (const m of legal) map.set(m.to, map.get(m.to) || !!m.captured)
    return [...map.entries()]
  }, [legal])

  return (
    <group>
      {lastMove && (
        <>
          <Tile square={lastMove.from} color={HIGHLIGHT.gold} opacity={0.28} />
          <Tile square={lastMove.to} color={HIGHLIGHT.gold} opacity={0.38} />
        </>
      )}

      {selected && (
        <mesh position={at(selected, 0.003)} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.36, 0.45, 48]} />
          <meshBasicMaterial color={[2.2, 1.6, 0.5]} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
        </mesh>
      )}

      {!hideLegal &&
        targets.map(([sq, capture]) =>
          capture ? (
            <mesh key={sq} position={at(sq, 0.003)} rotation-x={-Math.PI / 2}>
              <ringGeometry args={squareRing(0.47, 0.08)} />
              <meshBasicMaterial color={[1.9, 0.18, 0.3]} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
            </mesh>
          ) : (
            <mesh key={sq} position={at(sq, 0.003)} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.13, 32]} />
              <meshBasicMaterial color={HIGHLIGHT.legal} toneMapped={false} transparent opacity={0.92} depthWrite={false} />
            </mesh>
          ),
        )}

      {flash && <Flash squares={[flash.from, flash.to]} nonce={flash.nonce} />}
      <HoverOutline />
    </group>
  )
})
