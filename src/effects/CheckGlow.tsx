// 체크당한 킹 아래 붉은 펄스 글로우 (Bloom에 걸리도록 HDR 색 사용)
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, MeshBasicMaterial } from 'three'
import type { PointLight } from 'three'
import type { Square } from 'chess.js'
import { BOARD_TOP, squareToWorld } from '../scene/coords'

function radialGradient(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

export function CheckGlow({ square }: { square: Square }) {
  const light = useRef<PointLight>(null)
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        map: radialGradient(),
        color: new Color(3.2, 0.25, 0.35),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const pos = squareToWorld(square, BOARD_TOP + 0.008)

  useFrame(({ clock }) => {
    const k = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 5)
    mat.opacity = 0.5 + 0.5 * k
    if (light.current) light.current.intensity = 2 + 4 * k
  })

  return (
    <group position={pos}>
      <mesh rotation-x={-Math.PI / 2} material={mat}>
        <planeGeometry args={[1.7, 1.7]} />
      </mesh>
      <pointLight ref={light} position={[0, 0.5, 0]} color="#ff2a3c" distance={2.6} decay={2} />
    </group>
  )
}
