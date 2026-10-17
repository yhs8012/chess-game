// Canvas, 조명, 카메라, 후처리, 그리고 보드·기물·효과 배치
import { memo, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import type { AmbientLight, DirectionalLight, Group, HemisphereLight } from 'three'
import type { Square } from 'chess.js'
import { trackPieces } from '../engine/tracking'
import { castleRookSquares, chessOf, kingSquare } from '../engine/game'
import type { ChessGame } from '../hooks/useChessGame'
import { hoverStore } from '../hooks/useChessGame'
import { useSettings } from '../hooks/settings'
import { Board3D } from './Board3D'
import { CoordinateLabels } from './CoordinateLabels'
import { Highlights } from './Highlights'
import { PatternPreview } from './PatternPreview'
import { CameraRig } from './CameraRig'
import { Piece3D } from './Piece3D'
import type { PieceTarget } from './Piece3D'
import { PieceGeometryProvider } from './pieces/PieceGeometries'
import { CaptureShatter, LandingDust } from '../effects/CaptureShatter'
import { PromotionPillar } from '../effects/PromotionPillar'
import { CheckGlow } from '../effects/CheckGlow'
import { CheckmateText, DrawText } from '../effects/CheckmateSequence'
import { VictoryConfetti, WinnerGlowPulse } from '../effects/VictoryConfetti'
import { shakeAmount, worldShake } from '../effects/shake'
import { T } from '../effects/timing'
import { DEBUG, DebugBridge } from './DebugBridge'
import { generateWoodMaps } from './woodTextures'

/** 약 3000K 따뜻한 키 라이트 */
const KEY_COLOR = '#ffb46b'

function Lights({ dim }: { dim: boolean }) {
  const key = useRef<DirectionalLight>(null)
  const amb = useRef<AmbientLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const level = useRef(1)
  useFrame((_, dt) => {
    level.current += ((dim ? 0.38 : 1) - level.current) * Math.min(1, dt * 1.2)
    if (key.current) key.current.intensity = 3.2 * level.current
    if (amb.current) amb.current.intensity = 0.25 * level.current
    if (hemi.current) hemi.current.intensity = 0.45 * level.current
  })
  return (
    <>
      <ambientLight ref={amb} color="#ffdcb0" />
      <hemisphereLight ref={hemi} color="#ffe2bd" groundColor="#2b160b" />
      <directionalLight
        ref={key}
        color={KEY_COLOR}
        position={[5.5, 11, 6.5]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      {/* 차가운 보조광 (반대편) */}
      <directionalLight color="#9fb4ff" intensity={0.35} position={[-7, 6, -5]} />
    </>
  )
}

/** 실내(서재) 환경광: 외부 HDR 파일 없이 Lightformer로 구성 */
function StudyEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#1a100a']} />
      <Lightformer form="rect" intensity={2.2} color="#ffcf9a" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffb070" position={[6, 2, 4]} rotation-y={-Math.PI / 3} scale={[4, 3, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#a8b8ff" position={[-6, 2, -4]} rotation-y={Math.PI / 3} scale={[4, 3, 1]} />
      <Lightformer form="ring" intensity={1.5} color="#ffe1b0" position={[0, 3, 7]} scale={2} />
    </Environment>
  )
}

/** 첫 렌더 전에 나무 텍스처를 GPU로 한 번 생성한다 (재질이 만들어지기 전에) */
function WoodGate({ children }: { children: React.ReactNode }) {
  const gl = useThree((s) => s.gl)
  useState(() => generateWoodMaps(gl))
  return <>{children}</>
}

function ShakeGroup({ children }: { children: React.ReactNode }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (worldShake.pending) {
      worldShake.start = clock.elapsedTime
      worldShake.strength = worldShake.pending
      worldShake.pending = 0
    }
    const a = shakeAmount(clock.elapsedTime)
    if (g.current) g.current.position.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a * 0.5, (Math.random() - 0.5) * a)
  })
  return <group ref={g}>{children}</group>
}

interface PiecesProps {
  g: ChessGame
}

const Pieces = memo(function Pieces({ g }: PiecesProps) {
  const { game, selected, shake, end, lastAction, canInput, onSquareClick } = g
  const tracked = useMemo(() => trackPieces(game), [game])
  const lastMove = game.moves.at(-1)
  const animated = lastAction === 'move'

  // 캐슬링이면 룩은 킹보다 늦게 출발
  const rookDelayId = useMemo(() => {
    if (!animated || !lastMove) return null
    const rook = castleRookSquares(lastMove)
    if (!rook) return null
    return tracked.pieces.find((p) => p.square === rook.to)?.id ?? null
  }, [animated, lastMove, tracked])

  const shakeId = shake ? tracked.pieces.find((p) => p.square === shake.square)?.id : undefined
  const loserKing = end?.kind === 'checkmate' ? tracked.pieces.find((p) => p.type === 'k' && p.color === end.loser)?.id : undefined
  const fallen = end?.kind === 'checkmate' && end.stage !== 'focus'

  const onHover = useCallback((sq: Square | null) => hoverStore.set(sq), [])

  const trayIndex = new Map<string, number>()
  const perColor = { w: 0, b: 0 }
  for (const c of tracked.captured) trayIndex.set(c.id, perColor[c.color]++)

  const all = [
    ...tracked.pieces.map((p) => ({ ...p, target: { kind: 'board', square: p.square } as PieceTarget })),
    ...tracked.captured.map((c) => ({ ...c, target: { kind: 'tray', index: trayIndex.get(c.id)! } as PieceTarget })),
  ]

  return (
    <group>
      {all.map((p) => (
        <Piece3D
          key={p.id}
          id={p.id}
          type={p.type}
          color={p.color}
          target={p.target}
          animated={animated}
          delay={p.id === rookDelayId ? T.castleRookDelay : 0}
          lifted={p.target.kind === 'board' && p.target.square === selected}
          shakeNonce={p.id === shakeId ? shake!.nonce : 0}
          fallen={fallen && p.id === loserKing}
          interactive={canInput}
          onSelect={onSquareClick}
          onHover={onHover}
        />
      ))}
    </group>
  )
})

export function ChessScene({ g, onLoading }: { g: ChessGame; onLoading: (v: boolean) => void }) {
  const settings = useSettings()
  const { game, selected, legalFromSelected, flash, end, helpOpen, status, camera } = g
  const lastMove = game.moves.at(-1)
  const lastMoveSquares = useMemo(() => (lastMove ? { from: lastMove.from, to: lastMove.to } : null), [lastMove])
  const onHover = useCallback((sq: Square | null) => hoverStore.set(sq), [])
  const checkSquare = useMemo(() => {
    if (!status.isCheck) return null
    return kingSquare(chessOf(game), status.turn)
  }, [game, status])
  const showPattern = helpOpen && selected
  // 프레임이 떨어지면 해상도를 낮추고, 여유가 있으면 올린다
  const maxDpr = Math.min(2, window.devicePixelRatio || 1)
  const [dpr, setDpr] = useState(maxDpr)

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ fov: 40, near: 0.1, far: 200, position: [0, 9.4, 9.4] }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
      onPointerMissed={() => hoverStore.set(null)}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(maxDpr)}
        onFallback={() => setDpr(1)}
      />
      <color attach="background" args={['#120b07']} />
      <fog attach="fog" args={['#120b07', 22, 48]} />
      <Lights dim={end?.kind === 'draw' && end.stage !== 'focus'} />
      <StudyEnvironment />
      <CameraRig request={camera} locked={end?.kind === 'checkmate' && end.stage !== 'result'} />
      {DEBUG && <DebugBridge g={g} />}

      <WoodGate>
      <ShakeGroup>
        <Board3D onHover={onHover} onClick={g.onSquareClick} />
        {settings.showLabels && (
          <Suspense fallback={null}>
            <CoordinateLabels />
          </Suspense>
        )}
        <Highlights
          selected={selected}
          legal={legalFromSelected}
          lastMove={lastMoveSquares}
          flash={flash}
          hideLegal={!!showPattern}
        />
        {showPattern && <PatternPreview game={game} from={selected} />}
        <PieceGeometryProvider onLoading={onLoading}>
          <Pieces g={g} />
        </PieceGeometryProvider>
        {checkSquare && <CheckGlow square={checkSquare} />}
        <CaptureShatter />
        <LandingDust />
        <PromotionPillar />
        {end?.kind === 'checkmate' && ['text', 'victory', 'result'].includes(end.stage) && (
          <CheckmateText kingSquare={end.kingSquare} />
        )}
        {end?.kind === 'checkmate' && ['victory', 'result'].includes(end.stage) && <VictoryConfetti />}
        {end?.kind === 'draw' && end.stage !== 'focus' && <DrawText />}
        <WinnerGlowPulse winner={end?.kind === 'checkmate' && ['victory', 'result'].includes(end.stage) ? end.winner : null} />
      </ShakeGroup>
      </WoodGate>

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} />
        <Vignette offset={0.25} darkness={0.75} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  )
}
