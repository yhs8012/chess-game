// 프레임 위 황동 좌표 라벨: 파일 a~h(앞·뒤), 랭크 1~8(좌·우)
// Billboard로 항상 카메라를 바라봐 어느 각도에서도 읽힌다.
import { memo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import fontUrl from '@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff?url'
import { FILES, RANKS, fileLabelPosition, rankLabelPosition } from './coords'
import { materials } from './materials'

const LABEL_Y = 0.09

function Label({ text, position }: { text: string; position: [number, number, number] }) {
  return (
    <Billboard position={position}>
      <Text
        font={fontUrl}
        fontSize={0.32}
        anchorX="center"
        anchorY="middle"
        material={materials.brass()}
        outlineWidth={0.012}
        outlineColor="#3a2408"
      >
        {text}
      </Text>
    </Billboard>
  )
}

export const CoordinateLabels = memo(function CoordinateLabels() {
  const labels: { key: string; text: string; position: [number, number, number] }[] = []
  FILES.forEach((f, i) => {
    for (const side of ['near', 'far'] as const) {
      const p = fileLabelPosition(i, side)
      labels.push({ key: `${f}-${side}`, text: f, position: [p.x, p.y + LABEL_Y, p.z] })
    }
  })
  RANKS.forEach((r, i) => {
    for (const side of ['left', 'right'] as const) {
      const p = rankLabelPosition(i, side)
      labels.push({ key: `${r}-${side}`, text: r, position: [p.x, p.y + LABEL_Y, p.z] })
    }
  })
  return (
    <group>
      {labels.map((l) => (
        <Label key={l.key} text={l.text} position={l.position} />
      ))}
    </group>
  )
})
