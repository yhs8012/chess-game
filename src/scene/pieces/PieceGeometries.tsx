// 기물 형상 공급자.
// public/models/chess-set.glb 가 있으면 GLTF 기물을, 없거나 실패하면 Lathe 임시 기물을 쓴다.
// GLB는 6종 기물이 이름으로 구분되는 노드(pawn/rook/knight/bishop/queen/king)를 가져야 한다.
import { Component, createContext, Suspense, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { BufferGeometry, Matrix4, Mesh, Vector3 } from 'three'
import type { Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PieceSymbol } from 'chess.js'
import { KING_HEIGHT, latheGeometries } from './latheGeometry'

export const MODEL_URL = `${import.meta.env.BASE_URL}models/chess-set.glb`

type Geometries = Record<PieceSymbol, BufferGeometry>

const GeometryContext = createContext<Geometries | null>(null)

export function usePieceGeometries(): Geometries {
  return useContext(GeometryContext) ?? latheGeometries()
}

const NAMES: Record<PieceSymbol, string[]> = {
  p: ['pawn'],
  r: ['rook', 'castle', 'tower'],
  n: ['knight', 'horse'],
  b: ['bishop'],
  q: ['queen'],
  k: ['king'],
}

/** GLB 파일이 실제로 있는지 확인 (개발 서버는 없는 파일에 index.html을 돌려주므로 매직 바이트 검사) */
async function probeModel(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-3' } })
    if (!res.ok) return false
    const buf = new Uint8Array(await res.arrayBuffer())
    return String.fromCharCode(...buf.slice(0, 4)) === 'glTF'
  } catch {
    return false
  }
}

function geometryOf(node: Object3D): BufferGeometry | null {
  const parts: BufferGeometry[] = []
  node.updateWorldMatrix(true, true)
  const inv = new Matrix4().copy(node.matrixWorld).invert()
  node.traverse((o) => {
    if ((o as Mesh).isMesh) {
      const m = o as Mesh
      const g = m.geometry.clone()
      g.applyMatrix4(new Matrix4().multiplyMatrices(inv, m.matrixWorld))
      for (const key of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key)
      }
      parts.push(g.index ? g.toNonIndexed() : g)
    }
  })
  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0] : mergeGeometries(parts, false)
}

/** 노드 이름으로 6종 기물을 찾아 바닥 중심 정렬 + 킹 높이 기준 스케일 통일 */
export function extractPieces(scene: Object3D): Geometries | null {
  const found: Partial<Geometries> = {}
  scene.traverse((o) => {
    const name = o.name.toLowerCase()
    for (const [type, keys] of Object.entries(NAMES) as [PieceSymbol, string[]][]) {
      if (!found[type] && keys.some((k) => name.includes(k))) {
        const g = geometryOf(o)
        if (g) found[type] = g
      }
    }
  })
  const types = Object.keys(NAMES) as PieceSymbol[]
  if (!types.every((t) => found[t])) return null

  // 킹의 y 높이를 KING_HEIGHT에 맞추는 배율을 모든 기물에 똑같이 적용한다
  found.k!.computeBoundingBox()
  const kingBox = found.k!.boundingBox!
  const scale = KING_HEIGHT / (kingBox.max.y - kingBox.min.y)
  for (const t of types) {
    const g = found[t]!
    g.computeBoundingBox()
    const c = g.boundingBox!.getCenter(new Vector3())
    g.translate(-c.x, -g.boundingBox!.min.y, -c.z)
    g.scale(scale, scale, scale)
    g.computeVertexNormals()
    g.computeBoundingBox()
    g.computeBoundingSphere()
  }
  return found as Geometries
}

function GltfGeometries({ url, children }: { url: string; children: ReactNode }) {
  const { scene } = useGLTF(url)
  const geos = useMemo(() => extractPieces(scene), [scene])
  if (!geos) console.warn('[chess3d] GLB에서 6종 기물 노드를 찾지 못해 임시 기물을 씁니다.')
  return <GeometryContext.Provider value={geos}>{children}</GeometryContext.Provider>
}

class Fallback extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('[chess3d] GLB 로딩 실패, 임시 기물로 대체합니다.', err)
    this.props.onError()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * 기물 형상을 하위 트리에 공급한다.
 * GLB 확인 중·로딩 중에는 onLoading(true)로 로딩 화면을 띄운다.
 */
export function PieceGeometryProvider({
  children,
  onLoading,
}: {
  children: ReactNode
  onLoading?: (loading: boolean) => void
}) {
  const [hasModel, setHasModel] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    onLoading?.(true)
    probeModel(MODEL_URL).then((ok) => {
      if (!alive) return
      setHasModel(ok)
      if (!ok) onLoading?.(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const lathe = <GeometryContext.Provider value={null}>{children}</GeometryContext.Provider>
  if (hasModel === null) return null
  if (!hasModel) return lathe
  return (
    <Fallback fallback={lathe} onError={() => onLoading?.(false)}>
      <Suspense fallback={null}>
        <Loaded onLoaded={() => onLoading?.(false)}>
          <GltfGeometries url={MODEL_URL}>{children}</GltfGeometries>
        </Loaded>
      </Suspense>
    </Fallback>
  )
}

function Loaded({ children, onLoaded }: { children: ReactNode; onLoaded: () => void }) {
  useEffect(onLoaded, [onLoaded])
  return <>{children}</>
}
