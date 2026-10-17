// InstancedMesh 기반 파티클 풀 (파편·먼지·컨페티 공용)
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DynamicDrawUsage, Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import type { BufferGeometry, Material } from 'three'

export interface Particle {
  pos: Vector3
  vel: Vector3
  rot: Euler
  spin: Vector3
  scale: number
  life: number
  maxLife: number
  /** 중력 배율 (먼지는 거의 0, 컨페티는 작게) */
  gravity: number
  /** 공기 저항 */
  drag: number
  /** 끝으로 갈수록 작아짐 */
  shrink: boolean
  /** 바닥(y) 아래로 안 떨어짐 */
  floor: number | null
  /** 컨페티처럼 좌우로 흔들림 */
  flutter: number
}

export interface ParticlePoolHandle {
  spawn(p: Partial<Particle> & { pos: Vector3; vel: Vector3 }, color?: Color): void
}

interface Props {
  geometry: BufferGeometry
  material: Material
  max: number
}

const m4 = new Matrix4()
const q = new Quaternion()
const s = new Vector3()
const hidden = new Matrix4().makeScale(0, 0, 0)

export const ParticlePool = forwardRef<ParticlePoolHandle, Props>(function ParticlePool({ geometry, material, max }, ref) {
  const mesh = useRef<InstancedMesh>(null)
  const particles = useRef<(Particle | null)[]>(Array(max).fill(null))
  const cursor = useRef(0)

  useImperativeHandle(ref, () => ({
    spawn(init, color) {
      const i = cursor.current
      cursor.current = (cursor.current + 1) % max
      particles.current[i] = {
        rot: new Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        scale: 1,
        life: 0,
        maxLife: 1,
        gravity: 1,
        drag: 0.5,
        shrink: true,
        floor: null,
        flutter: 0,
        ...init,
        pos: init.pos.clone(),
        vel: init.vel.clone(),
      }
      if (color && mesh.current) {
        mesh.current.setColorAt(i, color)
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
      }
    },
  }))

  const init = useMemo(() => {
    return (m: InstancedMesh | null) => {
      if (!m) return
      mesh.current = m
      m.instanceMatrix.setUsage(DynamicDrawUsage)
      // instanceColor를 처음부터 만들어 두어 셰이더가 중간에 바뀌지 않게 한다
      const white = new Color(1, 1, 1)
      for (let i = 0; i < max; i++) {
        m.setMatrixAt(i, hidden)
        m.setColorAt(i, white)
      }
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  }, [max])

  useFrame((_, rawDt) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(rawDt, 1 / 30)
    let any = false
    const list = particles.current
    for (let i = 0; i < max; i++) {
      const p = list[i]
      if (!p) continue
      any = true
      p.life += dt
      if (p.life >= p.maxLife) {
        list[i] = null
        m.setMatrixAt(i, hidden)
        continue
      }
      p.vel.y -= 9.8 * p.gravity * dt
      p.vel.multiplyScalar(1 - p.drag * dt)
      p.pos.addScaledVector(p.vel, dt)
      if (p.flutter) p.pos.x += Math.sin(p.life * 7 + i) * p.flutter * dt
      if (p.floor !== null && p.pos.y < p.floor) {
        p.pos.y = p.floor
        p.vel.y *= -0.3
        p.vel.x *= 0.6
        p.vel.z *= 0.6
        p.spin.multiplyScalar(0.6)
      }
      p.rot.x += p.spin.x * dt
      p.rot.y += p.spin.y * dt
      p.rot.z += p.spin.z * dt
      const k = p.shrink ? 1 - Math.pow(p.life / p.maxLife, 2) : 1
      q.setFromEuler(p.rot)
      s.setScalar(p.scale * k)
      m4.compose(p.pos, q, s)
      m.setMatrixAt(i, m4)
    }
    if (any) m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={init} args={[geometry, material, max]} frustumCulled={false} castShadow={false} />
})
