// 기물 하나: 위치 애니메이션(포물선), 들림, 흔들림, 잡힘→트레이, 프로모션 변신, 쓰러짐
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Vector3 } from 'three'
import type { Color, PieceSymbol, Square } from 'chess.js'
import { BOARD_TOP, squareToWorld, trayPosition } from './coords'
import { pieceMaterial } from './materials'
import { usePieceGeometries } from './pieces/PieceGeometries'
import { arcHeight, arcPosition, easeOutCubic, shakeOffset } from '../effects/MoveAnimation'
import { T } from '../effects/timing'

export type PieceTarget = { kind: 'board'; square: Square } | { kind: 'tray'; index: number }

export interface Piece3DProps {
  id: string
  type: PieceSymbol
  color: Color
  target: PieceTarget
  /** 방금 둔 수에 의한 변화인가 (무르기·새 게임이면 false → 변신·파괴 연출 생략) */
  animated: boolean
  delay: number
  lifted: boolean
  shakeNonce: number
  fallen: boolean
  interactive: boolean
  onSelect?: (sq: Square) => void
  onHover?: (sq: Square | null) => void
}

const TRAY_SCALE = 0.6
const LIFT = 0.2

function targetPosition(target: PieceTarget, color: Color, out = new Vector3()) {
  return target.kind === 'board' ? squareToWorld(target.square, BOARD_TOP, out) : trayPosition(color, target.index, out)
}

/**
 * 기물이 보는 방향. 나이트는 옆모습이 보이도록 보드 가운데 쪽을 향한다
 * (처음 b파일 나이트는 +x, g파일 나이트는 -x). id는 'wn-b1'처럼 시작 칸을 담고 있다.
 */
function facing(id: string, type: PieceSymbol, color: Color): number {
  if (type !== 'n') return color === 'b' ? Math.PI : 0
  const startFile = id.split('-')[1]?.[0] ?? 'b'
  return startFile < 'e' ? 0 : Math.PI
}

type Anim =
  | { mode: 'idle' }
  | { mode: 'arc'; from: Vector3; to: Vector3; start: number; duration: number; height: number }
  | { mode: 'capture'; to: Vector3; vanishAt: number; appearAt: number }

export const Piece3D = memo(function Piece3D(props: Piece3DProps) {
  const { id, type, color, target, animated, delay, lifted, shakeNonce, fallen, interactive, onSelect, onHover } = props
  const geometries = usePieceGeometries()
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const anim = useRef<Anim>({ mode: 'idle' })
  const pendingStart = useRef<{ target: PieceTarget; delay: number; captured: boolean } | null>(null)
  const scale = useRef(target.kind === 'tray' ? TRAY_SCALE : 1)
  const visible = useRef(1)
  const lift = useRef(0)
  const fall = useRef(0)
  const shakeStart = useRef(-10)
  const [shownType, setShownType] = useState(type)

  // 처음 위치
  useLayoutEffect(() => {
    if (outer.current) targetPosition(target, color, outer.current.position)
  }, [])

  // 목표가 바뀌면 다음 프레임에서 애니메이션 시작 (시계 시간을 useFrame에서 읽기 위해)
  const targetKey = target.kind === 'board' ? target.square : `tray-${target.index}`
  const prevTarget = useRef(target)
  useEffect(() => {
    const prev = prevTarget.current
    prevTarget.current = target
    const captured = animated && prev.kind === 'board' && target.kind === 'tray'
    pendingStart.current = { target, delay, captured }
  }, [targetKey])

  // 프로모션: 빛기둥 중간에 모양을 바꾼다
  useEffect(() => {
    if (type === shownType) return
    if (!animated) {
      setShownType(type)
      return
    }
    const t = window.setTimeout(() => setShownType(type), (T.move + T.promotionPillar * 0.5) * 1000)
    return () => clearTimeout(t)
  }, [type, shownType, animated])

  useEffect(() => {
    if (shakeNonce > 0) shakeStart.current = -1 // 다음 프레임에서 시작 시각 기록
  }, [shakeNonce])

  useFrame(({ clock }, dt) => {
    const g = outer.current
    const i = inner.current
    if (!g || !i) return
    const now = clock.elapsedTime

    const p = pendingStart.current
    if (p) {
      pendingStart.current = null
      const to = targetPosition(p.target, color)
      if (p.captured) {
        anim.current = { mode: 'capture', to, vanishAt: now + T.move, appearAt: now + T.move + T.trayAppear }
      } else {
        const from = g.position.clone()
        const dist = Math.hypot(to.x - from.x, to.z - from.z)
        anim.current = {
          mode: 'arc',
          from,
          to,
          start: now + p.delay,
          duration: T.move,
          height: arcHeight(type, dist),
        }
      }
    }

    const a = anim.current
    let targetScale = target.kind === 'tray' ? TRAY_SCALE : 1
    if (a.mode === 'arc') {
      const t = (now - a.start) / a.duration
      if (t >= 1) {
        g.position.copy(a.to)
        anim.current = { mode: 'idle' }
      } else if (t > 0) {
        arcPosition(a.from, a.to, t, a.height, g.position)
      }
    } else if (a.mode === 'capture') {
      if (now < a.vanishAt) {
        visible.current = 1
      } else if (now < a.appearAt) {
        visible.current = 0
      } else {
        g.position.copy(a.to)
        visible.current = Math.min(1, (now - a.appearAt) / 0.25)
        if (visible.current >= 1) anim.current = { mode: 'idle' }
      }
      if (now < a.appearAt) targetScale = 1
    }
    if (a.mode !== 'capture') visible.current = 1

    // 크기: 트레이로 가면 작아진다
    scale.current += (targetScale - scale.current) * Math.min(1, dt * 10)
    const s = scale.current * easeOutCubic(visible.current)
    g.scale.setScalar(Math.max(s, 0.0001))
    g.visible = visible.current > 0.001

    // 선택 시 떠오름
    lift.current += ((lifted ? LIFT : 0) - lift.current) * Math.min(1, dt * 14)

    // 흔들림
    if (shakeStart.current === -1) shakeStart.current = now
    const shake = shakeOffset((now - shakeStart.current) / T.shake)

    // 쓰러짐 (체크메이트)
    const fallTarget = fallen ? 1 : 0
    fall.current += (fallTarget - fall.current) * Math.min(1, dt * (fallen ? 1.6 : 6))
    const angle = easeOutCubic(fall.current) * (Math.PI / 2 - 0.12)
    i.rotation.z = -angle
    i.position.set(shake, lift.current + Math.sin(angle) * 0.3, 0)
  })

  const square = target.kind === 'board' ? target.square : null

  return (
    <group ref={outer}>
      <group ref={inner}>
        <mesh
          geometry={geometries[shownType]}
          material={pieceMaterial(color)}
          rotation-y={facing(id, shownType, color)}
          castShadow
          receiveShadow
          onClick={
            interactive && square
              ? (e) => {
                  e.stopPropagation()
                  onSelect?.(square)
                }
              : undefined
          }
          onPointerOver={
            square
              ? (e) => {
                  e.stopPropagation()
                  onHover?.(square)
                  if (interactive) document.body.style.cursor = 'pointer'
                }
              : undefined
          }
          onPointerOut={
            square
              ? () => {
                  document.body.style.cursor = ''
                }
              : undefined
          }
        />
      </group>
    </group>
  )
})
