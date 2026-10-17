// 체크메이트·무승부 3D 텍스트 ("CHECKMATE!" / "DRAW")
// 카메라 줌인과 킹 쓰러짐은 CameraRig·Piece3D가 EndState 단계에 맞춰 처리한다.
import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Center, Text3D } from '@react-three/drei'
import { Color, MathUtils, MeshStandardMaterial, PerspectiveCamera, Vector3 } from 'three'
import type { Group } from 'three'
import type { Square } from 'chess.js'
import fontUrl from 'three/examples/fonts/droid/droid_serif_bold.typeface.json?url'
import { BOARD_TOP, squareToWorld } from '../scene/coords'
import { easeOutCubic } from './MoveAnimation'

/**
 * 화면 폭의 일정 비율을 차지하도록 크기를 맞춘 3D 글자.
 * 카메라 거리·화면 비율이 달라도 잘리지 않는다.
 */
function EndText({ text, position, color, widthRatio }: { text: string; position: [number, number, number]; color: Color; widthRatio: number }) {
  const group = useRef<Group>(null)
  const start = useRef<number | null>(null)
  const textWidth = useRef(1)
  const world = useMemo(() => new Vector3(), [])
  const mat = useMemo(
    () => new MeshStandardMaterial({ color: '#a8761c', metalness: 0.85, roughness: 0.28, emissive: color, emissiveIntensity: 1.4 }),
    [color],
  )

  useFrame(({ clock, camera, size }) => {
    const g = group.current
    if (!g) return
    if (start.current === null) start.current = clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - start.current) / 0.7)
    const e = easeOutCubic(t)
    g.position.set(position[0], position[1] + (1 - e) * -0.4, position[2])

    // 글자 위치에서 보이는 화면 폭 → 목표 배율
    g.getWorldPosition(world)
    const dist = world.distanceTo(camera.position)
    const fov = (camera as PerspectiveCamera).fov ?? 40
    const visibleW = 2 * dist * Math.tan(MathUtils.degToRad(fov / 2)) * (size.width / size.height)
    const fit = (visibleW * widthRatio) / textWidth.current
    // 살짝 튀어나오며 커짐
    const pop = e + Math.sin(t * Math.PI) * 0.12
    g.scale.setScalar(Math.max(0.001, pop * fit))
    mat.emissiveIntensity = 1.1 + 0.45 * Math.sin(clock.elapsedTime * 3)
  })

  return (
    <group ref={group} position={position} scale={0.001}>
      <Billboard>
        <Center onCentered={({ width }) => (textWidth.current = Math.max(width, 0.01))}>
          <Text3D
            font={fontUrl}
            size={1}
            height={0.25}
            bevelEnabled
            bevelSize={0.025}
            bevelThickness={0.04}
            bevelSegments={3}
            curveSegments={6}
            letterSpacing={0.04}
            material={mat}
          >
            {text}
          </Text3D>
        </Center>
      </Billboard>
    </group>
  )
}

export function CheckmateText({ kingSquare }: { kingSquare: Square }) {
  const k = squareToWorld(kingSquare, BOARD_TOP)
  // 줌인한 카메라 시야 안, 쓰러진 킹 위쪽
  const pos: [number, number, number] = [k.x, BOARD_TOP + 1.6, k.z]
  const color = useMemo(() => new Color(1.5, 0.85, 0.15), [])
  return (
    <Suspense fallback={null}>
      <EndText text="CHECKMATE!" position={pos} color={color} widthRatio={0.62} />
    </Suspense>
  )
}

export function DrawText() {
  const color = useMemo(() => new Color(0.55, 0.65, 0.9), [])
  return (
    <Suspense fallback={null}>
      <EndText text="DRAW" position={[0, BOARD_TOP + 2.0, 0]} color={color} widthRatio={0.32} />
    </Suspense>
  )
}
