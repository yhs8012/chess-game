// 엔진이 내보내는 이벤트 정의 + 아주 작은 이벤트 버스.
// React·Three.js를 import하지 않는다.
import type { Color, PieceSymbol, Square } from 'chess.js'

export type DrawReason =
  | 'stalemate'
  | 'threefold'
  | 'fiftyMoves'
  | 'insufficient'

export interface MoveInfo {
  from: Square
  to: Square
  san: string
  color: Color
  piece: PieceSymbol
}

export type GameEvent =
  | { type: 'select'; square: Square }
  | { type: 'move'; move: MoveInfo }
  | { type: 'capture'; move: MoveInfo; captured: PieceSymbol; capturedSquare: Square; enPassant: boolean }
  | { type: 'castle'; move: MoveInfo; side: 'k' | 'q'; rookFrom: Square; rookTo: Square }
  | { type: 'promotion'; move: MoveInfo; promotion: PieceSymbol }
  | { type: 'check'; color: Color; kingSquare: Square }
  | { type: 'checkmate'; loser: Color; winner: Color; kingSquare: Square }
  | { type: 'draw'; reason: DrawReason }
  | { type: 'invalid'; from: Square; to: Square }

export type GameEventType = GameEvent['type']

export type Listener<E> = (event: E) => void

export interface EventBus<E> {
  emit(event: E): void
  subscribe(listener: Listener<E>): () => void
}

export function createEventBus<E>(): EventBus<E> {
  const listeners = new Set<Listener<E>>()
  return {
    emit(event) {
      for (const l of [...listeners]) l(event)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
