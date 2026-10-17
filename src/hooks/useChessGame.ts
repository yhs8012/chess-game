// 게임 흐름: 선택·이동·프로모션·무르기·AI·종료 연출·시계
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import {
  applyMove,
  createGame,
  isPromotionMove,
  legalMoves,
  pieceAt,
  statusOf,
  turnOf,
  undo as undoState,
} from '../engine/game'
import type { GameState, MoveInput } from '../engine/game'
import { createEventBus } from '../engine/events'
import type { DrawReason, GameEvent } from '../engine/events'
import type { AiRequest, AiResponse } from '../engine/ai.worker'
import { lockDuration, T } from '../effects/timing'
import { createStore } from './store'
import { settingsStore } from './settings'

/** 엔진 이벤트 버스: 효과·사운드 모듈이 구독한다 */
export const gameBus = createEventBus<GameEvent>()

/** 마우스가 올라간 칸 (자주 바뀌므로 별도 스토어) */
export const hoverStore = createStore<Square | null>(null)

export type CameraPreset = 'white' | 'black' | 'top'
export type CameraRequest =
  | { kind: 'preset'; preset: CameraPreset; nonce: number }
  | { kind: 'focus'; square: Square; nonce: number }

export type EndStage = 'focus' | 'fall' | 'text' | 'victory' | 'result'

export type EndState =
  | { kind: 'checkmate'; winner: Color; loser: Color; kingSquare: Square; stage: EndStage }
  | { kind: 'draw'; reason: DrawReason; stage: EndStage }

export interface Clock {
  w: number
  b: number
  side: Color
  since: number | null
}

let nonce = 0
const next = () => ++nonce

/** 대국 하나에 고정되는 설정 (새 게임 때 설정에서 가져온다) */
export interface MatchConfig {
  mode: 'pvp' | 'ai'
  humanColor: Color
}

function matchConfig(): MatchConfig {
  const s = settingsStore.get()
  return { mode: s.mode, humanColor: s.humanColor }
}

function presetFor(config: MatchConfig): CameraPreset {
  return config.mode === 'ai' && config.humanColor === 'b' ? 'black' : 'white'
}

export function useChessGame() {
  const [config, setConfig] = useState<MatchConfig>(matchConfig)
  const [game, setGame] = useState<GameState>(() => createGame())
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [flash, setFlash] = useState<{ from: Square; to: Square; nonce: number } | null>(null)
  const [shake, setShake] = useState<{ square: Square; nonce: number } | null>(null)
  const [end, setEnd] = useState<EndState | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [camera, setCamera] = useState<CameraRequest>(() => ({
    kind: 'preset',
    preset: presetFor(matchConfig()),
    nonce: next(),
  }))
  /** 직전 수가 '방금 둔 수'인지(무르기·새 게임이 아닌지) — 캐슬링 룩 지연 등에 쓴다 */
  const [lastAction, setLastAction] = useState<'move' | 'undo' | 'reset'>('reset')
  const [startedAt, setStartedAt] = useState(() => Date.now())

  const busyUntil = useRef(0)
  const timers = useRef<number[]>([])
  const aiRequest = useRef(0)
  const clock = useRef<Clock>({ w: 0, b: 0, side: 'w', since: performance.now() })
  const gameRef = useRef(game)
  gameRef.current = game

  const status = useMemo(() => statusOf(game), [game])
  const turn = status.turn
  const isAiTurn = config.mode === 'ai' && turn !== config.humanColor
  const legalFromSelected = useMemo(() => (selected ? legalMoves(game, selected) : []), [game, selected])

  // ── 시계 ──────────────────────────────────────────────
  const pauseClock = useCallback(() => {
    const c = clock.current
    if (c.since !== null) {
      c[c.side] += performance.now() - c.since
      c.since = null
    }
  }, [])
  const resumeClock = useCallback(() => {
    if (clock.current.since === null) clock.current.since = performance.now()
  }, [])
  const switchClock = useCallback((side: Color) => {
    const c = clock.current
    const running = c.since !== null
    if (running) c[c.side] += performance.now() - c.since!
    c.side = side
    c.since = running ? performance.now() : null
  }, [])
  const readClock = useCallback((): { w: number; b: number } => {
    const c = clock.current
    const live = c.since !== null ? performance.now() - c.since : 0
    return { w: c.w + (c.side === 'w' ? live : 0), b: c.b + (c.side === 'b' ? live : 0) }
  }, [])

  useEffect(() => {
    if (helpOpen || end) pauseClock()
    else resumeClock()
  }, [helpOpen, end, pauseClock, resumeClock])

  // ── 타이머 ────────────────────────────────────────────
  const later = useCallback((sec: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, sec * 1000))
  }, [])
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])
  useEffect(() => clearTimers, [clearTimers])

  const isBusy = () => performance.now() < busyUntil.current

  // ── 종료 연출 ─────────────────────────────────────────
  const startEnd = useCallback(
    (events: GameEvent[]) => {
      const mate = events.find((e) => e.type === 'checkmate')
      const draw = events.find((e) => e.type === 'draw')
      if (mate && mate.type === 'checkmate') {
        const base = { kind: 'checkmate' as const, winner: mate.winner, loser: mate.loser, kingSquare: mate.kingSquare }
        const land = T.move
        later(land + T.mateFocus, () => {
          setEnd({ ...base, stage: 'focus' })
          setCamera({ kind: 'focus', square: mate.kingSquare, nonce: next() })
        })
        later(land + T.mateFall, () => setEnd({ ...base, stage: 'fall' }))
        later(land + T.mateText, () => setEnd({ ...base, stage: 'text' }))
        later(land + T.mateVictory, () => setEnd({ ...base, stage: 'victory' }))
        later(land + T.mateResult, () => setEnd({ ...base, stage: 'result' }))
        busyUntil.current = performance.now() + (land + T.mateResult) * 1000
      } else if (draw && draw.type === 'draw') {
        const base = { kind: 'draw' as const, reason: draw.reason }
        setEnd({ ...base, stage: 'focus' })
        later(T.move + T.drawText, () => setEnd({ ...base, stage: 'text' }))
        later(T.move + T.drawResult, () => setEnd({ ...base, stage: 'result' }))
      }
    },
    [later],
  )

  // ── 수 두기 ───────────────────────────────────────────
  const doMove = useCallback(
    (input: MoveInput) => {
      const current = gameRef.current
      const r = applyMove(current, input)
      if (!r.ok) {
        for (const e of r.events) gameBus.emit(e)
        setShake({ square: input.from, nonce: next() })
        busyUntil.current = performance.now() + lockDuration(r.events) * 1000
        return false
      }
      setGame(r.state)
      setLastAction('move')
      setSelected(null)
      setPendingPromotion(null)
      busyUntil.current = performance.now() + lockDuration(r.events) * 1000
      switchClock(turnOf(r.state))
      for (const e of r.events) gameBus.emit(e)

      const over = r.events.some((e) => e.type === 'checkmate' || e.type === 'draw')
      if (over) {
        startEnd(r.events)
      } else {
        if (config.mode === 'pvp' && settingsStore.get().autoRotate) {
          const side = turnOf(r.state)
          later(lockDuration(r.events) + 0.1, () =>
            setCamera({ kind: 'preset', preset: side === 'w' ? 'white' : 'black', nonce: next() }),
          )
        }
      }
      return true
    },
    [config, later, startEnd, switchClock],
  )

  // ── 클릭 입력 ─────────────────────────────────────────
  const canInput = !end && !aiThinking && !isAiTurn && !pendingPromotion

  const onSquareClick = useCallback(
    (square: Square) => {
      if (!canInput || isBusy()) return
      const current = gameRef.current
      const piece = pieceAt(current, square)
      const side = turnOf(current)

      if (selected) {
        if (square === selected) {
          setSelected(null)
          return
        }
        const target = legalMoves(current, selected).find((m) => m.to === square)
        if (target) {
          if (isPromotionMove(current, selected, square)) {
            setPendingPromotion({ from: selected, to: square })
          } else {
            doMove({ from: selected, to: square })
          }
          return
        }
        if (piece && piece.color === side) {
          setSelected(square)
          gameBus.emit({ type: 'select', square })
          return
        }
        doMove({ from: selected, to: square })
        return
      }
      if (piece && piece.color === side) {
        setSelected(square)
        gameBus.emit({ type: 'select', square })
      }
    },
    [canInput, selected, doMove],
  )

  const choosePromotion = useCallback(
    (piece: PieceSymbol | null) => {
      if (!pendingPromotion) return
      if (piece) doMove({ ...pendingPromotion, promotion: piece })
      else setPendingPromotion(null)
    },
    [pendingPromotion, doMove],
  )

  // ── AI ────────────────────────────────────────────────
  const worker = useRef<Worker | null>(null)
  useEffect(() => {
    const w = new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    return () => w.terminate()
  }, [])

  useEffect(() => {
    if (!isAiTurn || end || helpOpen || status.isGameOver) return
    const id = ++aiRequest.current
    const wait = Math.max(0, busyUntil.current - performance.now()) + 350
    const timer = window.setTimeout(() => {
      const w = worker.current
      if (!w || id !== aiRequest.current) return
      setAiThinking(true)
      const startedThinking = performance.now()
      w.onmessage = (e: MessageEvent<AiResponse>) => {
        if (e.data.id !== aiRequest.current) return
        // 너무 빨리 두면 어색하니 최소 0.4초는 생각하는 척
        const delay = Math.max(0, 400 - (performance.now() - startedThinking))
        window.setTimeout(() => {
          if (e.data.id !== aiRequest.current) return
          setAiThinking(false)
          if (e.data.move) doMove(e.data.move)
        }, delay)
      }
      const req: AiRequest = { id, fen: gameRef.current.fen, difficulty: settingsStore.get().difficulty }
      w.postMessage(req)
    }, wait)
    return () => {
      clearTimeout(timer)
      // 이 요청은 더 이상 유효하지 않다 (무르기·새 게임·Help 열림 등)
      if (aiRequest.current === id) aiRequest.current++
      setAiThinking(false)
    }
  }, [isAiTurn, end, helpOpen, status.isGameOver, game, doMove])

  // ── 무르기 / 새 게임 ──────────────────────────────────
  const undo = useCallback(() => {
    const current = gameRef.current
    if (current.moves.length === 0) return
    clearTimers()
    aiRequest.current++
    let plies = 1
    if (config.mode === 'ai') {
      const after1 = undoState(current, 1)
      if (turnOf(after1) !== config.humanColor && current.moves.length >= 2) plies = 2
    }
    const back = undoState(current, plies)
    setGame(back)
    setLastAction('undo')
    setSelected(null)
    setPendingPromotion(null)
    setEnd(null)
    setAiThinking(false)
    switchClock(turnOf(back))
    busyUntil.current = performance.now() + (T.move + 0.05) * 1000
  }, [config, clearTimers, switchClock])

  const newGame = useCallback(() => {
    clearTimers()
    aiRequest.current++
    setGame(createGame())
    setLastAction('reset')
    setSelected(null)
    setPendingPromotion(null)
    setEnd(null)
    setAiThinking(false)
    setStartedAt(Date.now())
    clock.current = { w: 0, b: 0, side: 'w', since: performance.now() }
    const nextConfig = matchConfig()
    setConfig(nextConfig)
    setCamera({ kind: 'preset', preset: presetFor(nextConfig), nonce: next() })
    busyUntil.current = performance.now() + (T.move + 0.1) * 1000
  }, [clearTimers])

  const setCameraPreset = useCallback((preset: CameraPreset) => {
    setCamera({ kind: 'preset', preset, nonce: next() })
  }, [])

  const flashMove = useCallback((index: number) => {
    const m = gameRef.current.moves[index]
    if (m) setFlash({ from: m.from, to: m.to, nonce: next() })
  }, [])

  return {
    config,
    game,
    status,
    turn,
    selected,
    legalFromSelected,
    pendingPromotion,
    flash,
    shake,
    end,
    helpOpen,
    setHelpOpen,
    aiThinking,
    isAiTurn,
    camera,
    lastAction,
    startedAt,
    canInput,
    onSquareClick,
    choosePromotion,
    undo,
    newGame,
    setCameraPreset,
    flashMove,
    readClock,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
