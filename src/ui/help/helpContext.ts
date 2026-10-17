// 현재 상황 → 도움말 패널에 먼저 보여줄 것 결정 (chess.js 결과로만 판단)
import type { Color, PieceSymbol, Square } from 'chess.js'
import { chessOf, legalMoves } from '../../engine/game'
import type { GameState } from '../../engine/game'

export interface HelpContext {
  turn: Color
  inCheck: boolean
  selected: { square: Square; type: PieceSymbol; color: Color } | null
  /** 지금 둘 수 있는 수 중 프로모션이 있다 (폰이 7랭크) */
  promotionSoon: boolean
  castling: { k: boolean; q: boolean }
  enPassant: boolean
}

export function helpContext(state: GameState, selected: Square | null): HelpContext {
  const chess = chessOf(state)
  const moves = legalMoves(state)
  const piece = selected ? chess.get(selected) : undefined
  return {
    turn: chess.turn(),
    inCheck: chess.isCheck(),
    selected: piece && selected ? { square: selected, type: piece.type, color: piece.color } : null,
    promotionSoon: moves.some((m) => m.isPromotion()),
    castling: { k: moves.some((m) => m.isKingsideCastle()), q: moves.some((m) => m.isQueensideCastle()) },
    enPassant: moves.some((m) => m.isEnPassant()),
  }
}
