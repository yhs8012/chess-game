// 잡기: 나무 파편 + 짧은 플래시 + 미세한 흔들림 / 착지: 먼지
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, IcosahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'
import type { Mesh, PointLight } from 'three'
import type { Square } from 'chess.js'
import { BOARD_TOP, squareToWorld } from '../scene/coords'
import { useGameEvents, useTimeouts } from '../hooks/useGameEvents'
import { settingsStore } from '../hooks/settings'
import { ParticlePool } from './Particles'
import type { ParticlePoolHandle } from './Particles'
import { requestShake } from './shake'
import { T } from './timing'

const LIGHT_WOOD = [new Color('#efdcb4'), new Color('#d9bf8c'), new Color('#c9a978')]
const DARK_WOOD = [new Color('#2a1d14'), new Color('#1a120c'), new Color('#3b2a1d')]

export function CaptureShatter() {
  const shards = useRef<ParticlePoolHandle>(null)
  const flashLight = useRef<PointLight>(null)
  const flashMesh = useRef<Mesh>(null)
  const flashStart = useRef(-10)
  const flashPos = useRef(new Vector3())
  const later = useTimeouts()

  const geo = useMemo(() => new BoxGeometry(0.07, 0.035, 0.12), [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), [])
  const flashMat = useMemo(
    () => new MeshBasicMaterial({ color: new Color(6, 4.5, 2.5), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    [],
  )

  const burst = (square: Square, capturedColor: 'w' | 'b') => {
    const reduce = settingsStore.get().reduceEffects
    const center = squareToWorld(square, BOARD_TOP + 0.35)
    const palette = capturedColor === 'w' ? LIGHT_WOOD : DARK_WOOD
    const n = reduce ? 14 : 38
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const up = 2 + Math.random() * 3.2
      const out = 1 + Math.random() * 2.4
      shards.current?.spawn(
        {
          pos: center.clone().add(new Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.5 - 0.2, (Math.random() - 0.5) * 0.3)),
          vel: new Vector3(Math.cos(a) * out, up, Math.sin(a) * out),
          scale: 0.6 + Math.random() * 0.9,
          maxLife: 1.1 + Math.random() * 0.6,
          gravity: 1,
          drag: 0.6,
          floor: BOARD_TOP + 0.02,
        },
        palette[i % palette.length],
      )
    }
    if (!reduce) {
      flashPos.current.copy(center)
      flashStart.current = -1
      requestShake(1)
    }
  }

  useGameEvents((e) => {
    if (e.type === 'capture') {
      const capturedColor = e.move.color === 'w' ? 'b' : 'w'
      later(T.move, () => burst(e.capturedSquare, capturedColor))
    }
  })

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (flashStart.current === -1) flashStart.current = now
    const t = now - flashStart.current
    const k = t < 0.25 ? 1 - t / 0.25 : 0
    if (flashLight.current) {
      flashLight.current.intensity = k * 30
      flashLight.current.position.copy(flashPos.current)
    }
    if (flashMesh.current) {
      flashMat.opacity = k * 0.9
      flashMesh.current.position.copy(flashPos.current)
      flashMesh.current.scale.setScalar(0.3 + (1 - k) * 0.9)
      flashMesh.current.visible = k > 0
    }
  })

  return (
    <>
      <ParticlePool ref={shards} geometry={geo} material={mat} max={120} />
      <pointLight ref={flashLight} color="#ffd9a0" intensity={0} distance={5} decay={2} />
      <mesh ref={flashMesh} material={flashMat} visible={false}>
        <sphereGeometry args={[0.35, 16, 12]} />
      </mesh>
    </>
  )
}

/** 착지 먼지: 모든 이동 도착 칸 + 캐슬링 룩 도착 칸 */
export function LandingDust() {
  const dust = useRef<ParticlePoolHandle>(null)
  const later = useTimeouts()
  const geo = useMemo(() => new IcosahedronGeometry(0.05, 0), [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#b39573', roughness: 1, transparent: true, opacity: 0.55 }), [])

  const puff = (square: Square) => {
    const n = settingsStore.get().reduceEffects ? 5 : 12
    const c = squareToWorld(square, BOARD_TOP + 0.03)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
      const sp = 0.8 + Math.random() * 0.7
      dust.current?.spawn({
        pos: c.clone().add(new Vector3(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22)),
        vel: new Vector3(Math.cos(a) * sp, 0.25 + Math.random() * 0.35, Math.sin(a) * sp),
        scale: 0.6 + Math.random() * 0.8,
        maxLife: 0.55 + Math.random() * 0.3,
        gravity: 0.05,
        drag: 4,
        spin: new Vector3(1, 1, 1),
      })
    }
  }

  useGameEvents((e) => {
    if (e.type === 'move') later(T.move, () => puff(e.move.to))
    if (e.type === 'castle') later(T.castleRookDelay + T.move, () => puff(e.rookTo))
  })

  return <ParticlePool ref={dust} geometry={geo} material={mat} max={80} />
}
