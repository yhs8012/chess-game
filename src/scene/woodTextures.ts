// GPU로 나무 텍스처를 한 번 생성한다 (색·노멀·거칠기 3장).
// 물리 모델:
//  - 나이테: 춘재(밝고 넓음)와 추재(어둡고 좁음)가 번갈아, 판재를 켠 각도 때문에 생기는 무늬(cathedral)
//  - 섬유: 결 방향으로 길게 늘어진 고주파 줄무늬
//  - 도관(pore): 결 방향으로 길쭉한 작은 홈 → 노멀·거칠기에 반영
//  - 수종별 무늬: 메이플 곱슬결(curl), 마호가니 리본 무늬(ribbon)
// 모든 잡음은 주기적이라 텍스처를 반복해도 이음매가 없다.
import {
  Camera,
  LinearMipmapLinearFilter,
  LinearFilter,
  Mesh,
  NoColorSpace,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
  Color,
  GLSL3,
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
} from 'three'
import type { Texture, WebGLRenderer } from 'three'

export interface WoodMaps {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
}

interface WoodParams {
  early: string
  late: string
  pore: string
  /** v 방향 나이테 개수 (정수여야 이음매가 없다) */
  rings: number
  warp: number
  cathedral: number
  lateWidth: number
  lateContrast: number
  fiber: number
  pores: number
  curl: number
  ribbon: number
  variation: number
  roughness: number
  normalStrength: number
  seed: number
  size: number
}

export const WOOD_PARAMS = {
  // 밝은 칸: 메이플 — 크림·꿀색, 나이테가 은은하고 곱슬결이 살짝
  maple: { early: '#e6cc9c', late: '#cfa66e', pore: '#b38652', rings: 26, warp: 0.35, cathedral: 0.35, lateWidth: 0.2, lateContrast: 0.45, fiber: 0.3, pores: 0.1, curl: 0.05, ribbon: 0, variation: 0.08, roughness: 0.42, normalStrength: 0.8, seed: 1, size: 2048 },
  // 어두운 칸: 월넛 — 따뜻한 갈색, 진한 추재 줄과 굵은 도관
  walnut: { early: '#5c3820', late: '#2e1a0d', pore: '#1c0f07', rings: 32, warp: 0.45, cathedral: 0.4, lateWidth: 0.3, lateContrast: 0.7, fiber: 0.45, pores: 0.4, curl: 0, ribbon: 0, variation: 0.14, roughness: 0.38, normalStrength: 1.2, seed: 2, size: 2048 },
  // 프레임: 마호가니 — 붉은 갈색, 결을 따라 반짝이는 리본 무늬
  mahogany: { early: '#4d1d10', late: '#2c0d07', pore: '#180604', rings: 30, warp: 0.3, cathedral: 0.15, lateWidth: 0.25, lateContrast: 0.5, fiber: 0.4, pores: 0.35, curl: 0, ribbon: 0.28, variation: 0.1, roughness: 0.32, normalStrength: 1.0, seed: 3, size: 1024 },
  // 백 기물: 회양목 — 아주 고운 결의 아이보리
  boxwood: { early: '#f1dfb8', late: '#d9bd8a', pore: '#c9a874', rings: 16, warp: 0.35, cathedral: 0.3, lateWidth: 0.18, lateContrast: 0.35, fiber: 0.22, pores: 0.05, curl: 0, ribbon: 0, variation: 0.07, roughness: 0.4, normalStrength: 0.7, seed: 4, size: 1024 },
  // 흑 기물: 흑단 — 거의 검은색, 드문 갈색 줄
  ebony: { early: '#1b1310', late: '#0a0706', pore: '#050303', rings: 7, warp: 0.5, cathedral: 0.3, lateWidth: 0.35, lateContrast: 0.6, fiber: 0.4, pores: 0.2, curl: 0, ribbon: 0, variation: 0.25, roughness: 0.26, normalStrength: 0.9, seed: 5, size: 1024 },
  // 테이블: 짙은 오크 — 크게 휘는 무늬와 뚜렷한 도관
  table: { early: '#3a2414', late: '#1c0f07', pore: '#0e0703', rings: 20, warp: 0.5, cathedral: 0.6, lateWidth: 0.3, lateContrast: 0.75, fiber: 0.5, pores: 0.55, curl: 0, ribbon: 0, variation: 0.15, roughness: 0.55, normalStrength: 1.4, seed: 6, size: 1024 },
} satisfies Record<string, WoodParams>

export type WoodKind = keyof typeof WOOD_PARAMS

const vertex = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragment = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform int uMode; // 0 색, 1 노멀, 2 거칠기
uniform float uSize, uSeed;
uniform vec3 uEarly, uLate, uPore;
uniform float uRings, uWarp, uCathedral, uLateWidth, uLateContrast, uFiber, uPores, uCurl, uRibbon, uVariation, uRoughness, uNormalStrength;

const float TAU = 6.28318530718;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))) + uSeed * 17.13;
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// 주기 period를 갖는 그래디언트 잡음 (-1..1 근처)
float pnoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i00 = mod(i, period);
  vec2 i10 = mod(i + vec2(1.0, 0.0), period);
  vec2 i01 = mod(i + vec2(0.0, 1.0), period);
  vec2 i11 = mod(i + vec2(1.0, 1.0), period);
  float a = dot(hash2(i00), f);
  float b = dot(hash2(i10), f - vec2(1.0, 0.0));
  float c = dot(hash2(i01), f - vec2(0.0, 1.0));
  float d = dot(hash2(i11), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4;
}

float fbm(vec2 uv, vec2 freq) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) {
    s += a * pnoise(uv * freq, freq);
    freq *= 2.0;
    a *= 0.5;
  }
  return s;
}

struct Wood { vec3 color; float height; float rough; };

// 결은 u(가로) 방향으로 흐른다
Wood wood(vec2 uv) {
  // 나이테 좌표: 낮은 주파수 휨 + 판재 무늬(cathedral: u를 따라 주기적으로 솟는 아치)
  float warp = fbm(uv, vec2(2.0, 4.0)) * uWarp;
  float arch = (0.5 + 0.5 * cos(TAU * uv.x + fbm(uv + 3.1, vec2(1.0, 2.0)) * 2.0)) * uCathedral;
  float y = uv.y * uRings + warp * 1.6 + arch * 1.8;
  float ring = fract(y);
  // 추재: 나이테 끝쪽 좁은 띠, 경계는 한쪽(추재→춘재)이 날카롭다
  float late = smoothstep(1.0 - uLateWidth, 0.97, ring) * (1.0 - smoothstep(0.985, 1.0, ring));
  late += 0.25 * smoothstep(1.0 - uLateWidth * 1.8, 1.0 - uLateWidth, ring) * (1.0 - late);

  // 섬유: 결 방향으로 길쭉한 고주파 줄
  float fib = pnoise(uv * vec2(8.0, 520.0), vec2(8.0, 520.0)) * 0.6
            + pnoise(uv * vec2(16.0, 1100.0), vec2(16.0, 1100.0)) * 0.4;
  // 도관: 결 방향으로 길쭉한 작은 홈, 춘재에 더 많다(환공재)
  float pn = pnoise(uv * vec2(48.0, 640.0), vec2(48.0, 640.0));
  float pore = smoothstep(0.42, 0.75, pn) * uPores * (1.0 - 0.6 * late);

  // 큰 색 변화, 곱슬결, 리본
  float vary = fbm(uv + 7.7, vec2(2.0, 3.0));
  float curl = sin(TAU * (uv.x * 26.0 + fbm(uv + 1.3, vec2(3.0, 2.0)) * 2.5)) * uCurl;
  float ribbon = (0.5 + 0.5 * sin(TAU * (uv.y * 6.0 + fbm(uv + 5.0, vec2(1.0, 3.0)) * 0.8))) * uRibbon;

  vec3 col = mix(uEarly, uLate, clamp(late * uLateContrast + fib * uFiber * 0.25, 0.0, 1.0));
  col *= 1.0 + vary * uVariation + curl + (ribbon - uRibbon * 0.5) * 0.5;
  col = mix(col, uPore, clamp(pore, 0.0, 1.0));

  Wood w;
  w.color = max(col, 0.0);
  w.height = -late * 0.35 - pore * 1.1 + fib * uFiber * 0.12 + curl * 0.6;
  w.rough = uRoughness + pore * 0.3 - late * 0.05 + fib * 0.03 - ribbon * 0.12;
  return w;
}

void main() {
  vec2 uv = vUv;
  if (uMode == 0) {
    // 선형 → sRGB 인코딩 (8비트에 저장해도 어두운 나무에 띠가 생기지 않도록)
    vec3 c = clamp(wood(uv).color, 0.0, 1.0);
    vec3 srgb = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    outColor = vec4(srgb, 1.0);
  } else if (uMode == 1) {
    float e = 1.0 / uSize;
    float hx = wood(uv + vec2(e, 0.0)).height - wood(uv - vec2(e, 0.0)).height;
    float hy = wood(uv + vec2(0.0, e)).height - wood(uv - vec2(0.0, e)).height;
    vec3 n = normalize(vec3(-hx * uNormalStrength, -hy * uNormalStrength, 1.0));
    outColor = vec4(n * 0.5 + 0.5, 1.0);
  } else {
    outColor = vec4(vec3(clamp(wood(uv).rough, 0.04, 1.0)), 1.0);
  }
}
`

function linear(hex: string): Vector3 {
  const c = new Color(hex) // three는 hex를 sRGB로 읽고 선형으로 변환해 저장한다
  return new Vector3(c.r, c.g, c.b)
}

function makeTarget(size: number) {
  return new WebGLRenderTarget(size, size, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    colorSpace: NoColorSpace,
    anisotropy: 8,
  })
}

let cache: Record<WoodKind, WoodMaps> | null = null

/** 모든 나무 텍스처를 생성한다. 실패하면 null (캔버스 텍스처로 대체) */
export function generateWoodMaps(gl: WebGLRenderer): Record<WoodKind, WoodMaps> | null {
  if (cache) return cache
  try {
    const names = ['uMode', 'uSize', 'uSeed', 'uEarly', 'uLate', 'uPore', 'uRings', 'uWarp', 'uCathedral', 'uLateWidth', 'uLateContrast', 'uFiber', 'uPores', 'uCurl', 'uRibbon', 'uVariation', 'uRoughness', 'uNormalStrength']
    const uniforms = Object.fromEntries(names.map((n) => [n, { value: 0 as unknown }]))
    const material = new RawShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, glslVersion: GLSL3, uniforms })
    const quad = new Mesh(new PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    const scene = new Scene()
    scene.add(quad)
    const camera = new Camera()
    const prevTarget = gl.getRenderTarget()
    const prevAutoClear = gl.autoClear
    const out = {} as Record<WoodKind, WoodMaps>

    for (const [kind, p] of Object.entries(WOOD_PARAMS) as [WoodKind, WoodParams][]) {
      // 균일 변수 객체는 한 번만 만들고 값만 바꾼다 (객체를 갈아 끼우면 컴파일된 프로그램이 옛 값을 쓴다)
      const u = material.uniforms
      u.uMode.value = 0
      u.uSize.value = p.size
      u.uSeed.value = p.seed
      u.uEarly.value = linear(p.early)
      u.uLate.value = linear(p.late)
      u.uPore.value = linear(p.pore)
      u.uRings.value = p.rings
      u.uWarp.value = p.warp
      u.uCathedral.value = p.cathedral
      u.uLateWidth.value = p.lateWidth
      u.uLateContrast.value = p.lateContrast
      u.uFiber.value = p.fiber
      u.uPores.value = p.pores
      u.uCurl.value = p.curl
      u.uRibbon.value = p.ribbon
      u.uVariation.value = p.variation
      u.uRoughness.value = p.roughness
      u.uNormalStrength.value = p.normalStrength
      const maps = [0, 1, 2].map((mode) => {
        const rt = makeTarget(mode === 0 ? p.size : Math.min(p.size, 1024))
        material.uniforms.uMode.value = mode
        material.uniforms.uSize.value = rt.width
        gl.setRenderTarget(rt)
        gl.render(scene, camera)
        if (mode !== 0) return rt.texture
        // 색: 셰이더가 sRGB로 인코딩한 8비트 값을 읽어 sRGB 텍스처로 올린다.
        // (렌더 타깃의 색 공간 처리에 기대지 않아 두 번 변환될 일이 없다)
        const data = new Uint8Array(rt.width * rt.height * 4)
        gl.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, data)
        rt.dispose()
        const tex = new DataTexture(data, rt.width, rt.height, RGBAFormat, UnsignedByteType)
        tex.colorSpace = SRGBColorSpace
        tex.wrapS = tex.wrapT = RepeatWrapping
        tex.minFilter = LinearMipmapLinearFilter
        tex.magFilter = LinearFilter
        tex.generateMipmaps = true
        tex.anisotropy = 8
        tex.needsUpdate = true
        return tex
      })
      out[kind] = { map: maps[0], normalMap: maps[1], roughnessMap: maps[2] }
    }

    gl.setRenderTarget(prevTarget)
    gl.autoClear = prevAutoClear
    material.dispose()
    quad.geometry.dispose()
    cache = out
    return out
  } catch (e) {
    console.warn('[chess3d] GPU 나무 텍스처 생성 실패, 캔버스 텍스처로 대체합니다.', e)
    return null
  }
}

export function woodMaps(): Record<WoodKind, WoodMaps> | null {
  return cache
}
