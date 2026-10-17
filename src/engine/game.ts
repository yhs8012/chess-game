// chess.js를 감싸는 얇은 래퍼.
// - 규칙 판정은 전부 chess.js에 맡긴다.
// - 수를 둘 때마다 새 GameState를 돌려준다(불변).
// - chess.js가 돌려준 Move를 GameEvent 목록으로 바꾼다.
import { Chess, DEFAULT_POSITION } from 'chess.js'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import type { DrawReason, GameEvent, MoveInfo } from './events'

export type { Color, Move, PieceSymbol, Square }

export interface GameState {
  readonly startFen: string
  /** 지금까지 둔 수 (chess.js verbose Move) */
  readonly moves: readonly Move[]
  readonly fen: string
}

export interface MoveInput {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export type MoveResult =
  | { ok: true; state: GameState; move: Move; events: GameEvent[] }
  | { ok: false; state: GameState; events: GameEvent[] }

export interface GameStatus {
  turn: Color
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  drawReason: DrawReason | null
  isGameOver: boolean
  winner: Color | null
}

// 상태 → chess.js 인스턴스 캐시 (읽기 전용으로만 쓴다)
const cache = new WeakMap<GameState, Chess>()

function replay(state: GameState): Chess {
  const chess = new Chess(state.startFen)
  for (const m of state.moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion })
  }
  return chess
}

/** 상태에 해당하는 chess.js 인스턴스. 반환값을 변경하지 말 것. */
export function chessOf(state: GameState): Chess {
  let chess = cache.get(state)
  if (!chess) {
    chess = replay(state)
    cache.set(state, chess)
  }
  return chess
}

export function createGame(fen: string = DEFAULT_POSITION): GameState {
  const chess = new Chess(fen)
  const state: GameState = { startFen: chess.fen(), moves: [], fen: chess.fen() }
  cache.set(state, chess)
  return state
}

export function legalMoves(state: GameState, square?: Square): Move[] {
  const chess = chessOf(state)
  return square ? chess.moves({ square, verbose: true }) : chess.moves({ verbose: true })
}

export function pieceAt(state: GameState, square: Square) {
  return chessOf(state).get(square)
}

export function turnOf(state: GameState): Color {
  return chessOf(state).turn()
}

export function isPromotionMove(state: GameState, from: Square, to: Square): boolean {
  return legalMoves(state, from).some((m) => m.to === to && m.isPromotion())
}

export function drawReasonOf(chess: Chess): DrawReason | null {
  if (chess.isStalemate()) return 'stalemate'
  if (chess.isInsufficientMaterial()) return 'insufficient'
  if (chess.isThreefoldRepetition()) return 'threefold'
  if (chess.isDrawByFiftyMoves()) return 'fiftyMoves'
  return null
}

export function statusOf(state: GameState): GameStatus {
  const chess = chessOf(state)
  const turn = chess.turn()
  const isCheckmate = chess.isCheckmate()
  const drawReason = isCheckmate ? null : drawReasonOf(chess)
  return {
    turn,
    isCheck: chess.isCheck(),
    isCheckmate,
    isStalemate: drawReason === 'stalemate',
    isDraw: drawReason !== null,
    drawReason,
    isGameOver: isCheckmate || drawReason !== null,
    winner: isCheckmate ? opponent(turn) : null,
  }
}

export function opponent(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export function kingSquare(chess: Chess, color: Color): Square {
  return chess.findPiece({ type: 'k', color })[0]
}

function infoOf(move: Move): MoveInfo {
  return { from: move.from, to: move.to, san: move.san, color: move.color, piece: move.piece }
}

/** 캐슬링 시 룩의 출발·도착 칸 */
export function castleRookSquares(move: Move): { from: Square; to: Square } | null {
  const rank = move.color === 'w' ? '1' : '8'
  if (move.isKingsideCastle()) return { from: `h${rank}` as Square, to: `f${rank}` as Square }
  if (move.isQueensideCastle()) return { from: `a${rank}` as Square, to: `d${rank}` as Square }
  return null
}

/** chess.js의 isCapture()는 앙파상을 포함하지 않으므로 둘을 합친다 */
export function isCaptureMove(move: Move): boolean {
  return move.isCapture() || move.isEnPassant()
}

/** 앙파상으로 잡히는 폰이 실제로 있던 칸 */
export function capturedSquareOf(move: Move): Square {
  if (move.isEnPassant()) return `${move.to[0]}${move.from[1]}` as Square
  return move.to
}

/**
 * chess.js가 수를 둔 직후의 인스턴스와 그 Move로 이벤트를 만든다.
 * 순서: 이동류(move/capture/castle/promotion) → 결과(check/checkmate/draw)
 */
export function eventsFromMove(move: Move, after: Chess): GameEvent[] {
  const info = infoOf(move)
  const events: GameEvent[] = [{ type: 'move', move: info }]

  if (isCaptureMove(move) && move.captured) {
    events.push({
      type: 'capture',
      move: info,
      captured: move.captured,
      capturedSquare: capturedSquareOf(move),
      enPassant: move.isEnPassant(),
    })
  }
  const rook = castleRookSquares(move)
  if (rook) {
    events.push({
      type: 'castle',
      move: info,
      side: move.isKingsideCastle() ? 'k' : 'q',
      rookFrom: rook.from,
      rookTo: rook.to,
    })
  }
  if (move.isPromotion() && move.promotion) {
    events.push({ type: 'promotion', move: info, promotion: move.promotion })
  }

  const toMove = after.turn()
  if (after.isCheckmate()) {
    events.push({
      type: 'checkmate',
      loser: toMove,
      winner: opponent(toMove),
      kingSquare: kingSquare(after, toMove),
    })
  } else {
    if (after.isCheck()) {
      events.push({ type: 'check', color: toMove, kingSquare: kingSquare(after, toMove) })
    }
    const reason = drawReasonOf(after)
    if (reason) events.push({ type: 'draw', reason })
  }
  return events
}

export function applyMove(state: GameState, input: MoveInput): MoveResult {
  const chess = replay(state)
  let move: Move
  try {
    move = chess.move({ from: input.from, to: input.to, promotion: input.promotion })
  } catch {
    return { ok: false, state, events: [{ type: 'invalid', from: input.from, to: input.to }] }
  }
  const next: GameState = { startFen: state.startFen, moves: [...state.moves, move], fen: chess.fen() }
  cache.set(next, chess)
  return { ok: true, state: next, move, events: eventsFromMove(move, chess) }
}

/** 마지막 n수를 무른 새 상태 */
export function undo(state: GameState, plies = 1): GameState {
  const count = Math.max(0, state.moves.length - plies)
  const next = { startFen: state.startFen, moves: state.moves.slice(0, count), fen: '' }
  const chess = replay(next)
  const done: GameState = { ...next, fen: chess.fen() }
  cache.set(done, chess)
  return done
}

export function sanHistory(state: GameState): string[] {
  return state.moves.map((m) => m.san)
}
