// chess.js 합법 수 기반 미니맥스 + 알파베타.
// 쉬움: 무작위 / 보통: 깊이 2 / 어려움: 깊이 3
import { Chess } from 'chess.js'
import type { Move, PieceSymbol, Square } from 'chess.js'

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface AiMove {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export const DEPTH: Record<Difficulty, number> = { easy: 0, normal: 2, hard: 3 }

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const MATE = 100_000

// 기물-칸 점수표 (백 기준, a8부터 h1 순서). Simplified Evaluation Function 참고.
// prettier-ignore
const PST: Record<PieceSymbol, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
}

/** 백 입장 점수 (+면 백 유리) */
export function evaluate(chess: Chess): number {
  let score = 0
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f]
      if (!cell) continue
      const idx = cell.color === 'w' ? r * 8 + f : (7 - r) * 8 + f
      const v = VALUE[cell.type] + PST[cell.type][idx]
      score += cell.color === 'w' ? v : -v
    }
  }
  return score
}

// 잡는 수 먼저 (MVV-LVA), 프로모션 우선
function ordered(moves: Move[]): Move[] {
  const key = (m: Move) =>
    (m.captured ? 10 * VALUE[m.captured] - VALUE[m.piece] + 10_000 : 0) + (m.promotion ? 8_000 : 0)
  return moves.sort((a, b) => key(b) - key(a))
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number, ply: number): number {
  const moves = chess.moves({ verbose: true })
  if (moves.length === 0) {
    return chess.inCheck() ? -MATE + ply : 0
  }
  if (depth === 0) {
    const sign = chess.turn() === 'w' ? 1 : -1
    return sign * evaluate(chess)
  }
  let best = -Infinity
  for (const m of ordered(moves)) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion })
    const score = -negamax(chess, depth - 1, -beta, -alpha, ply + 1)
    chess.undo()
    if (score > best) best = score
    if (score > alpha) alpha = score
    if (alpha >= beta) break
  }
  return best
}

function toAiMove(m: Move): AiMove {
  return { from: m.from, to: m.to, promotion: m.promotion }
}

export function chooseMove(
  fen: string,
  difficulty: Difficulty,
  random: () => number = Math.random,
): AiMove | null {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  if (moves.length === 0) return null
  const depth = DEPTH[difficulty]
  if (depth === 0) return toAiMove(moves[Math.floor(random() * moves.length)])

  // 루트에서는 동점 수 중 무작위로 골라 매번 같은 수만 두지 않게 한다
  let bestScore = -Infinity
  let best: Move[] = []
  let alpha = -Infinity
  for (const m of ordered(moves)) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion })
    // alpha - 1: 현재 최선과 같은 점수의 수도 정확히 평가해 동점 후보에 넣는다
    const score = -negamax(chess, depth - 1, -Infinity, -(alpha - 1), 1)
    chess.undo()
    if (score > bestScore) {
      bestScore = score
      best = [m]
    } else if (score === bestScore) {
      best.push(m)
    }
    if (score > alpha) alpha = score
  }
  return toAiMove(best[Math.floor(random() * best.length)])
}
