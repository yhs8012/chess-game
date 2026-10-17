// 클래식 우드 재질 정의.
// 나뭇결 텍스처는 캔버스로 직접 그린다(외부 파일·라이선스 불필요).
// public/textures/ 에 CC0 PBR 텍스처를 넣으면 이 절차적 텍스처를 대체할 수 있다.
import {
  CanvasTexture,
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import type { Texture } from 'three'

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
} satisfies Record<string, WoodSpec>

export type WoodName = keyof typeof WOOD

function material<T extends MeshStandardMaterial>(make: () => T): () => T {
  let m: T | null = null
  return () => (m ??= make())
}

/** 칸 하나마다 결의 위치·방향이 조금씩 다르게 보이도록 텍스처를 복제한다 */
export function tileTexture(light: boolean, index: number): Texture {
  const src = woodTexture(light ? 'maple' : 'walnut', light ? WOOD.maple : WOOD.walnut)
  const t = src.clone()
  const r = rng(index * 97 + (light ? 1 : 2))
  t.repeat.set(0.35, 0.35)
  t.offset.set(r(), r())
  // 이웃 칸과 결 방향을 엇갈리게
  t.rotation = index % 2 === 0 ? 0 : Math.PI / 2
  t.center.set(0.5, 0.5)
  t.needsUpdate = true
  return t
}

export function tileMaterial(light: boolean, index: number) {
  return new MeshPhysicalMaterial({
    map: tileTexture(light, index),
    roughness: light ? 0.5 : 0.45,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
  })
}

export const materials = {
  ebonyInlay: material(
    () => new MeshStandardMaterial({ color: '#0b0806', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }),
  ),
  mahogany: material(() => {
    const map = woodTexture('mahogany', WOOD.mahogany).clone()
    map.repeat.set(2, 2)
    map.needsUpdate = true
    return new MeshPhysicalMaterial({ map, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25 })
  }),
  brass: material(() => new MeshStandardMaterial({ color: '#d4a93a', metalness: 1, roughness: 0.32 })),
  table: material(() => {
    const map = woodTexture('table', WOOD.table).clone()
    map.repeat.set(6, 6)
    map.needsUpdate = true
    return new MeshStandardMaterial({ map, roughness: 0.7 })
  }),
  // 승리한 쪽이 빛날 때는 재질을 바꾸지 않고 emissiveIntensity만 올린다
  // (재질 교체는 셰이더 재컴파일로 순간 끊김을 만든다)
  boxwood: material(
    () =>
      new MeshPhysicalMaterial({
        map: woodTexture('boxwood', WOOD.boxwood),
        roughness: 0.42,
        clearcoat: 0.45,
        clearcoatRoughness: 0.35,
        emissive: new Color('#ffbf3c'),
        emissiveIntensity: 0,
      }),
  ),
  ebony: material(
    () =>
      new MeshPhysicalMaterial({
        map: woodTexture('ebony', WOOD.ebony),
        roughness: 0.28,
        clearcoat: 0.9,
        clearcoatRoughness: 0.15,
        emissive: new Color('#ffb02e'),
        emissiveIntensity: 0,
      }),
  ),
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
