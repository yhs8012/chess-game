// Khronos glTF-Sample-Assets "ABeautifulGame"(CC-BY 4.0)를 게임용 GLB로 변환한다.
//
//   node scripts/build-chess-model.mjs <ABeautifulGame.glb> [public/models/chess-set.glb]
//
// - 6종 기물마다 백 기물 하나만 남긴다 (폰 = 몸통 + 유리 머리)
// - 보드·재질·텍스처를 지운다 (재질은 코드에서 우드로 덮어씌운다)
// - 노드 이름을 pawn/rook/knight/bishop/queen/king으로 바꾼다
// - 나이트 머리가 +x를 보도록 돌린다 (Piece3D가 방향을 정한다)
// - 기물당 약 4,500 삼각형으로 줄이고 Draco로 압축한다
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { prune, simplifyPrimitive, transformMesh, weld, dedup } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'

const [src, out = 'public/models/chess-set.glb'] = process.argv.slice(2)
if (!src) {
  console.error('사용법: node scripts/build-chess-model.mjs <ABeautifulGame.glb> [출력 경로]')
  process.exit(1)
}

const PICK = {
  king: 'King_W',
  queen: 'Queen_W',
  rook: 'Castle_W1',
  bishop: 'Bishop_W1',
  knight: 'Knight_W1',
  pawn: 'Pawn_Body_W1',
}
const TARGET_TRIS = 4500
const KEEP_ATTRS = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0'])

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  })
const doc = await io.read(src)
const root = doc.getRoot()
await MeshoptSimplifier.ready

const byName = new Map(root.listNodes().map((n) => [n.getName(), n]))
const scene = root.listScenes()[0]
const keep = []
for (const [type, name] of Object.entries(PICK)) {
  const node = byName.get(name)
  if (!node) throw new Error(`노드 없음: ${name}`)
  node.setName(type).setTranslation([0, 0, 0])
  for (const child of node.listChildren()) child.setName(`${type}_part`)
  keep.push(node)
}
// 장면을 선택한 6개 노드만으로 다시 구성
for (const n of scene.listChildren()) scene.removeChild(n)
for (const n of keep) {
  n.getParentNode()?.removeChild(n)
  scene.addChild(n)
}
const keepSet = new Set(keep.flatMap((n) => [n, ...n.listChildren()]))
for (const n of root.listNodes()) if (!keepSet.has(n)) n.dispose()

// 재질·텍스처·불필요한 속성 제거
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    prim.setMaterial(null)
    for (const sem of prim.listSemantics()) if (!KEEP_ATTRS.has(sem)) prim.setAttribute(sem, null)
  }
}
for (const m of root.listMaterials()) m.dispose()
for (const t of root.listTextures()) t.dispose()
for (const ext of root.listExtensionsUsed()) {
  if (ext.extensionName !== 'KHR_draco_mesh_compression') ext.dispose()
}
await doc.transform(prune(), dedup(), weld())

// 나이트 머리 방향: 위쪽 40% 정점의 중심이 아래쪽 중심에서 어느 쪽으로 치우쳤는지
function headDirection(mesh) {
  const pos = mesh.listPrimitives()[0].getAttribute('POSITION')
  const v = [0, 0, 0]
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.getCount(); i++) {
    const y = pos.getElement(i, v)[1]
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const cut = minY + (maxY - minY) * 0.6
  let hx = 0, hz = 0, hn = 0, bx = 0, bz = 0, bn = 0
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v)
    if (v[1] > cut) { hx += v[0]; hz += v[2]; hn++ } else { bx += v[0]; bz += v[2]; bn++ }
  }
  return Math.atan2(hz / hn - bz / bn, hx / hn - bx / bn)
}
const knightMesh = byName.get(PICK.knight).getMesh()
const angle = headDirection(knightMesh)
// +x로 돌리기: y축 회전 θ에서 (cos a, sin a)→(1,0) 이 되도록 θ = a
const c = Math.cos(angle)
const s = Math.sin(angle)
transformMesh(knightMesh, [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1])
console.log(`나이트 머리 방향 ${((angle * 180) / Math.PI).toFixed(1)}° → +x로 회전`)

// 기물당 삼각형 수 줄이기 (폰은 몸통+머리 합계 기준)
const tris = (prim) => (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3
for (const node of keep) {
  const prims = [node, ...node.listChildren()].flatMap((n) => n.getMesh()?.listPrimitives() ?? [])
  const total = prims.reduce((sum, p) => sum + tris(p), 0)
  const ratio = Math.min(1, TARGET_TRIS / total)
  for (const p of prims) simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.01 })
  const after = prims.reduce((sum, p) => sum + tris(p), 0)
  console.log(`${node.getName().padEnd(7)} ${total} → ${after} 삼각형`)
}

doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
  method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
  encodeSpeed: 5,
  decodeSpeed: 5,
})
await doc.transform(prune())
await io.write(out, doc)
const { statSync } = await import('node:fs')
console.log(`저장: ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`)
