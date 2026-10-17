// 기물마다 고유 id를 붙여 수 기록을 따라간다.
// 3D 쪽은 이 결과로 "어느 말이 어디서 어디로 갔는지"를 알고 애니메이션한다.
import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square } from 'chess.js'
import { capturedSquareOf, castleRookSquares, isCaptureMove } from './game'
import type { GameState } from './game'

export interface TrackedPiece {
  id: string
  type: PieceSymbol
  color: Color
  square: Square
}

export interface CapturedPiece {
  id: string
  type: PieceSymbol
  color: Color
  /** 몇 번째 수(0부터)에 잡혔는지 */
  ply: number
}

export interface TrackedBoard {
  pieces: TrackedPiece[]
  captured: CapturedPiece[]
}

export function trackPieces(state: GameState): TrackedBoard {
  const start = new Chess(state.startFen)
  const bySquare = new Map<Square, TrackedPiece>()
  for (const row of start.board()) {
    for (const cell of row) {
      if (cell) {
        bySquare.set(cell.square, {
          id: `${cell.color}${cell.type}-${cell.square}`,
          type: cell.type,
          color: cell.color,
          square: cell.square,
        })
      }
    }
  }
  const captured: CapturedPiece[] = []

  const relocate = (from: Square, to: Square) => {
    const p = bySquare.get(from)
    if (!p) return
    bySquare.delete(from)
    bySquare.set(to, { ...p, square: to })
  }

  state.moves.forEach((move, ply) => {
    if (isCaptureMove(move)) {
      const sq = capturedSquareOf(move)
      const victim = bySquare.get(sq)
      if (victim) {
        captured.push({ id: victim.id, type: victim.type, color: victim.color, ply })
        bySquare.delete(sq)
      }
    }
    relocate(move.from, move.to)
    const rook = castleRookSquares(move)
    if (rook) relocate(rook.from, rook.to)
    if (move.isPromotion() && move.promotion) {
      const p = bySquare.get(move.to)!
      bySquare.set(move.to, { ...p, type: move.promotion })
    }
  })

  return { pieces: [...bySquare.values()], captured }
}
