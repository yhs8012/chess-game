// 카메라: OrbitControls + 시점 프리셋(백/흑/위) + 체크메이트 줌인
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Spherical, Vector3 } from 'three'
import type { CameraPreset, CameraRequest } from '../hooks/useChessGame'
import { BOARD_TOP, squareToWorld } from './coords'
import { easeInOut } from '../effects/MoveAnimation'

/** 보드 아래로 못 내려가게: 수평에서 약 13° 위까지만 */
const MAX_POLAR = Math.PI / 2 - 0.23
const TRANSITION = 1.0

export function presetSpherical(preset: CameraPreset, aspect: number): Spherical {
  // 세로 화면에서는 보드가 잘리지 않게 더 멀리
  const r = aspect < 0.8 ? 20 : aspect < 1.2 ? 16 : 13.6
  switch (preset) {
    case 'white':
      return new Spherical(r, 0.72, 0)
    case 'black':
      return new Spherical(r, 0.72, Math.PI)
    case 'top':
      return new Spherical(r * 1.12, 0.0001, 0)
  }
}

/**
 * 프리셋의 바라보는 점: 보드 중심보다 카메라 쪽으로 조금 당겨
 * 보드가 화면 위쪽으로 올라가고 하단 툴바에 가리지 않게 한다.
 */
export function presetTarget(theta: number, preset: CameraPreset): Vector3 {
  const pull = preset === 'top' ? 0.55 : 0.75
  return new Vector3(Math.sin(theta) * pull, BOARD_TOP, Math.cos(theta) * pull)
}

interface Tween {
  from: Spherical
  to: Spherical
  fromTarget: Vector3
  toTarget: Vector3
  start: number
}

export function CameraRig({ request, locked }: { request: CameraRequest; locked: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  const tween = useRef<Tween | null>(null)
  const pending = useRef<CameraRequest | null>(request)
  /** 마지막으로 고른 백/흑 시점 (Top-down의 위아래 방향을 정한다) */
  const side = useRef(0)

  useEffect(() => {
    pending.current = request
  }, [request])

  useFrame(({ clock }) => {
    const c = controls.current
    if (!c) return
    const now = clock.elapsedTime
    const req = pending.current
    if (req) {
      pending.current = null
      const offset = camera.position.clone().sub(c.target)
      const from = new Spherical().setFromVector3(offset)
      let to: Spherical
      let toTarget: Vector3
      if (req.kind === 'preset') {
        to = presetSpherical(req.preset, size.width / size.height)
        if (req.preset === 'top') to.theta = side.current
        else side.current = to.theta
        toTarget = presetTarget(to.theta, req.preset)
      } else {
        // 패배한 킹 쪽으로 줌인: 현재 방향을 유지하며 가까이, 약간 낮게
        toTarget = squareToWorld(req.square, BOARD_TOP + 0.55)
        to = new Spherical(4.6, 0.95, from.theta)
      }
      // 반대편으로 갈 때 짧은 쪽으로 돌기
      let dTheta = to.theta - from.theta
      dTheta = ((dTheta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
      to.theta = from.theta + dTheta
      tween.current = { from, to, fromTarget: c.target.clone(), toTarget, start: now }
    }

    const tw = tween.current
    if (tw) {
      const t = Math.min(1, (now - tw.start) / TRANSITION)
      const e = easeInOut(t)
      const s = new Spherical(
        tw.from.radius + (tw.to.radius - tw.from.radius) * e,
        tw.from.phi + (tw.to.phi - tw.from.phi) * e,
        tw.from.theta + (tw.to.theta - tw.from.theta) * e,
      )
      c.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
      camera.position.setFromSpherical(s).add(c.target)
      camera.lookAt(c.target)
      if (t >= 1) tween.current = null
    }
    c.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0}
      maxPolarAngle={MAX_POLAR}
      minDistance={4}
      maxDistance={26}
      enablePan={false}
      enabled={!locked}
    />
  )
}
