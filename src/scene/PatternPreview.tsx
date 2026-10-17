// Help용 이동 패턴 미리보기
// - 파란 반투명 타일: 빈 보드 기준 패턴
// - 연두 점: 지금 실제로 둘 수 있는 칸
// - 갈 수 없는 파란 칸에 마우스를 올리면 이유 툴팁
import { memo, useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { Square } from 'chess.js'
import type { GameState } from '../engine/game'
import { BOARD_TOP, squareToWorld } from './coords'
import { HIGHLIGHT } from './materials'
import { patternPreview } from '../ui/help/blockReason'
import { BLOCK_REASON } from '../ui/help/rulesText.ko'
import { hoverStore } from '../hooks/useChessGame'
import { useStore } from '../hooks/store'

const Y = BOARD_TOP + 0.006

export const PatternPreview = memo(function PatternPreview({ game, from }: { game: GameState; from: Square }) {
  const preview = useMemo(() => patternPreview(game, from), [game, from])
  const hover = useStore(hoverStore)
  if (!preview) return null
  const reason = hover ? preview.blocked.get(hover) : undefined

  return (
    <group>
      {preview.pattern.map((sq) => {
        const v = squareToWorld(sq, Y)
        return (
          <mesh key={sq} position={v} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial color={HIGHLIGHT.pattern} transparent opacity={0.42} depthWrite={false} />
          </mesh>
        )
      })}
      {preview.legal.map((sq) => {
        const v = squareToWorld(sq, Y + 0.002)
        return (
          <mesh key={sq} position={v} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.14, 32]} />
            <meshBasicMaterial color={HIGHLIGHT.legal} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
          </mesh>
        )
      })}
      {hover && reason && (
        <Html position={squareToWorld(hover, Y + 0.25)} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className="block-tooltip">
            <span className="block-tooltip__sq">{hover}</span>
            {BLOCK_REASON[reason]}
          </div>
        </Html>
      )}
    </group>
  )
})
