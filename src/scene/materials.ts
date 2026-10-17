// 클래식 우드 재질 정의.
// 나뭇결은 woodTextures.ts가 GPU로 생성한 색·노멀·거칠기 맵을 쓰고,
// 실패하면 이 파일의 캔버스 나뭇결로 대체한다 (외부 파일·라이선스 불필요).
import {
  CanvasTexture,
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { Vector2 } from 'three'
import type { Texture } from 'three'
import { woodMaps } from './woodTextures'
import type { WoodKind } from './woodTextures'

interface WoodSpec {
  base: string
  grain: string
  /** 나뭇결 줄 수 */
  lines: number
  /** 결이 휘는 정도 */
  waviness: number
  seed: number
}

// 재현 가능한 의사 난수
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function drawWood(spec: WoodSpec, size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = rng(spec.seed)
  ctx.fillStyle = spec.base
  ctx.fillRect(0, 0, size, size)

  const grain = new Color(spec.grain)
  const base = new Color(spec.base)
  // 넓은 색 띠 (조재·만재)
  for (let i = 0; i < spec.lines; i++) {
    const x0 = rand() * size
    const width = 1 + rand() * 5
    const alpha = 0.08 + rand() * 0.22
    const phase = rand() * Math.PI * 2
    const freq = 0.5 + rand() * 1.5
    const c = base.clone().lerp(grain, 0.5 + rand() * 0.5)
    ctx.strokeStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${alpha})`
    ctx.lineWidth = width
    ctx.beginPath()
    for (let y = -8; y <= size + 8; y += 8) {
      const x =
        x0 +
        Math.sin((y / size) * Math.PI * 2 * freq + phase) * spec.waviness +
        Math.sin((y / size) * Math.PI * 9 + phase * 2) * spec.waviness * 0.15
      if (y === -8) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // 미세한 공극 (pore)
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

const textureCache = new Map<string, Texture>()

function woodTexture(name: string, spec: WoodSpec): Texture {
  let tex = textureCache.get(name)
  if (!tex) {
    tex = new CanvasTexture(drawWood(spec))
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.anisotropy = 8
    textureCache.set(name, tex)
  }
  return tex
}

export const WOOD = {
  maple: { base: '#e3c28f', grain: '#b98b55', lines: 70, waviness: 14, seed: 11 },
  walnut: { base: '#6a4127', grain: '#3a2112', lines: 80, waviness: 18, seed: 23 },
  mahogany: { base: '#4b1c10', grain: '#240b05', lines: 90, waviness: 10, seed: 37 },
  boxwood: { base: '#efdcb4', grain: '#c9a978', lines: 40, waviness: 8, seed: 41 },
  ebony: { base: '#1d1611', grain: '#060403', lines: 50, waviness: 6, seed: 53 },
  table: { base: '#2b1a10', grain: '#120904', lines: 120, waviness: 30, seed: 67 },
} satisfies Record<WoodKind, WoodSpec>


function material<T>(make: () => T): () => T {
  let m: T | null = null
  return () => (m ??= make())
}

type Surface = { map: Texture; normalMap?: Texture; roughnessMap?: Texture }

/**
 * 나무 표면: GPU로 생성한 색·노멀·거칠기 맵 (woodTextures.ts).
 * 생성에 실패했으면 캔버스 나뭇결 하나로 대체한다.
 * GPU 텍스처는 렌더 타깃이라 복제하지 않고, 수종마다 하나의 재질에서만 쓴다.
 */
function surface(kind: WoodKind, repeat = 1): Surface {
  const gpu = woodMaps()?.[kind]
  const s: Surface = gpu
    ? { ...gpu }
    : { map: woodTexture(kind, WOOD[kind]) }
  for (const t of Object.values(s)) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repeat, repeat)
  }
  return s
}

/** 텍스처가 있으면 roughness는 배율(1), 없으면 수종 기본값 */
function rough(s: Surface, fallback: number) {
  return s.roughnessMap ? 1 : fallback
}

const NORMAL = (k: number) => new Vector2(k, k)

/**
 * 칸 재질 (밝은 칸·어두운 칸 각 하나).
 * 칸마다 결이 다르게 보이도록 텍스처를 복제하지 않고 칸 지오메트리의 UV 창을 다르게 준다 (Board3D).
 */
export const tileMaterials = material(() => {
  const light = surface('maple')
  const dark = surface('walnut')
  return {
    light: new MeshPhysicalMaterial({
      ...light,
      normalScale: NORMAL(0.55),
      roughness: rough(light, 0.5),
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
    }),
    dark: new MeshPhysicalMaterial({
      ...dark,
      normalScale: NORMAL(0.7),
      roughness: rough(dark, 0.45),
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
    }),
  }
})

export const materials = {
  ebonyInlay: material(
    () => new MeshStandardMaterial({ color: '#0b0806', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }),
  ),
  mahogany: material(() => {
    const s = surface('mahogany', 2)
    // 반광택 바니시: 클리어코트 아래로 리본 무늬가 비친다
    return new MeshPhysicalMaterial({ ...s, normalScale: NORMAL(0.6), roughness: rough(s, 0.38), clearcoat: 0.8, clearcoatRoughness: 0.18 })
  }),
  brass: material(() => new MeshStandardMaterial({ color: '#d4a93a', metalness: 1, roughness: 0.32 })),
  table: material(() => {
    const s = surface('table', 6)
    return new MeshPhysicalMaterial({ ...s, normalScale: NORMAL(0.8), roughness: rough(s, 0.7), clearcoat: 0.15, clearcoatRoughness: 0.5 })
  }),
  // 승리한 쪽이 빛날 때는 재질을 바꾸지 않고 emissiveIntensity만 올린다
  // (재질 교체는 셰이더 재컴파일로 순간 끊김을 만든다)
  boxwood: material(() => {
    const s = surface('boxwood')
    return new MeshPhysicalMaterial({
      ...s,
      normalScale: NORMAL(0.35),
      roughness: rough(s, 0.42),
      clearcoat: 0.45,
      clearcoatRoughness: 0.3,
      emissive: new Color('#ffbf3c'),
      emissiveIntensity: 0,
    })
  }),
  ebony: material(() => {
    const s = surface('ebony')
    return new MeshPhysicalMaterial({
      ...s,
      normalScale: NORMAL(0.4),
      roughness: rough(s, 0.28),
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      emissive: new Color('#ffb02e'),
      emissiveIntensity: 0,
    })
  }),
  /** 잡기 파편용 (흰·검은 나무) */
  shardLight: material(() => new MeshStandardMaterial({ color: '#e6cf9f', roughness: 0.6 })),
  shardDark: material(() => new MeshStandardMaterial({ color: '#2a1d14', roughness: 0.5 })),
}

export function pieceMaterial(color: 'w' | 'b') {
  return color === 'w' ? materials.boxwood() : materials.ebony()
}

/** 하이라이트 색: 연두(이동 가능)·황금(선택·마지막 수)·진홍(잡기·체크) + 파랑(Help 패턴) */
export const HIGHLIGHT = {
  legal: '#a6e05a',
  gold: '#f2c14e',
  crimson: '#e0263f',
  pattern: '#4f8fe8',
} as const
