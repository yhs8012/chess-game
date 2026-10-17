// 프로모션: 폰이 빛기둥에 감싸였다가 새 기물로 변신 (변신 시점은 Piece3D가 맞춘다)
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial, OctahedronGeometry, Vector3 } from 'three'
import type { Mesh } from 'three'
import { BOARD_TOP, squareToWorld } from '../scene/coords'
import { useGameEvents, useTimeouts } from '../hooks/useGameEvents'
import { ParticlePool } from './Particles'
import type { ParticlePoolHandle } from './Particles'
import { T } from './timing'

function verticalGradient(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 128, 0, 0)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 128)
  return new CanvasTexture(c)
}

export function PromotionPillar() {
  const pillar = useRef<Mesh>(null)
  const sparks = useRef<ParticlePoolHandle>(null)
  const start = useRef(-10)
  const pos = useRef(new Vector3())
  const later = useTimeouts()

  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        map: verticalGradient(),
        color: new Color(3, 2.4, 1.2),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  const sparkGeo = useMemo(() => new OctahedronGeometry(0.035, 0), [])
  const sparkMat = useMemo(() => new MeshBasicMaterial({ color: new Color(4, 3, 1.2), toneMapped: false }), [])

  useGameEvents((e) => {
    if (e.type !== 'promotion') return
    later(T.move, () => {
      squareToWorld(e.move.to, BOARD_TOP, pos.current)
      start.current = -1
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2
        const r = 0.2 + Math.random() * 0.25
        sparks.current?.spawn({
          pos: pos.current.clone().add(new Vector3(Math.cos(a) * r, Math.random() * 0.4, Math.sin(a) * r)),
          vel: new Vector3(-Math.sin(a) * 0.6, 1.4 + Math.random() * 1.6, Math.cos(a) * 0.6),
          maxLife: 0.8 + Math.random() * 0.5,
          gravity: 0,
          drag: 0.5,
        })
      }
    })
  })

  useFrame(({ clock }) => {
    const m = pillar.current
    if (!m) return
    const now = clock.elapsedTime
    if (start.current === -1) start.current = now
    const t = (now - start.current) / T.promotionPillar
    if (t < 0 || t > 1) {
      m.visible = false
      return
    }
    m.visible = true
    // 솟아오름 → 유지 → 사라짐
    const grow = Math.min(1, t / 0.25)
    const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
    mat.opacity = fade
    m.position.set(pos.current.x, BOARD_TOP + (2.2 * grow) / 2, pos.current.z)
    m.scale.set(1, Math.max(grow, 0.001), 1)
    m.rotation.y = now * 2
  })

  return (
    <>
      <mesh ref={pillar} material={mat} visible={false}>
        <cylinderGeometry args={[0.42, 0.46, 2.2, 32, 1, true]} />
      </mesh>
      <ParticlePool ref={sparks} geometry={sparkGeo} material={sparkMat} max={60} />
    </>
  )
}
