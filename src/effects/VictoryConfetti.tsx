// 승리: 황금빛 컨페티 + 반짝임, 승리한 쪽 기물 발광 펄스
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { Color, DoubleSide, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three'
import { BOARD_TOP } from '../scene/coords'
import { materials } from '../scene/materials'
import { settingsStore } from '../hooks/settings'
import { ParticlePool } from './Particles'
import type { ParticlePoolHandle } from './Particles'

const COLORS = ['#ffd45a', '#ffbf3c', '#fff1b8', '#e8a530', '#f5e6c8', '#e0263f'].map((c) => new Color(c))

export function VictoryConfetti() {
  const pool = useRef<ParticlePoolHandle>(null)
  const { controls } = useThree() as unknown as { controls: { target: Vector3 } | null }
  const geo = useMemo(() => new PlaneGeometry(0.09, 0.05), [])
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ffffff',
        side: DoubleSide,
        metalness: 0.6,
        roughness: 0.3,
        emissive: new Color('#7a5200'),
        emissiveIntensity: 0.6,
      }),
    [],
  )

  useEffect(() => {
    const center = controls?.target?.clone() ?? new Vector3()
    const n = settingsStore.get().reduceEffects ? 120 : 330
    // 좌·우·가운데 세 번 터지는 폭죽
    const origins = [-2.2, 2.2, 0].map((dx) => new Vector3(center.x + dx, BOARD_TOP + 0.2, center.z))
    const ids: number[] = []
    origins.forEach((o, w) => {
      ids.push(
        window.setTimeout(() => {
          for (let i = 0; i < n / origins.length; i++) {
            const a = Math.random() * Math.PI * 2
            const out = 0.8 + Math.random() * 2.2
            pool.current?.spawn(
              {
                pos: o.clone(),
                vel: new Vector3(Math.cos(a) * out, 3.6 + Math.random() * 2.6, Math.sin(a) * out),
                maxLife: 3.2 + Math.random() * 1.4,
                gravity: 0.3,
                drag: 1.6,
                flutter: 1.2,
                shrink: false,
                scale: 0.6 + Math.random() * 0.6,
                floor: BOARD_TOP + 0.01,
              },
              COLORS[i % COLORS.length],
            )
          }
        }, w * 420),
      )
    })
    return () => ids.forEach(clearTimeout)
  }, [controls])

  return (
    <>
      <ParticlePool ref={pool} geometry={geo} material={mat} max={400} />
      <Sparkles count={70} scale={[9, 2.5, 9]} position={[0, BOARD_TOP + 1.3, 0]} size={5} speed={0.6} color="#ffd45a" />
    </>
  )
}

/** 승리한 쪽 기물 재질의 발광 세기를 펄스로 바꾼다 */
export function WinnerGlowPulse({ winner }: { winner: 'w' | 'b' | null }) {
  useFrame(({ clock }) => {
    const k = 0.55 + 0.35 * Math.sin(clock.elapsedTime * 3)
    materials.boxwood().emissiveIntensity = winner === 'w' ? k * 0.8 : 0
    materials.ebony().emissiveIntensity = winner === 'b' ? k * 1.6 : 0
  })
  return null
}
