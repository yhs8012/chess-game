// "왜 못 가는지" 판별.
// 패턴(빈 보드 기준 이동 모양)은 도움말 표시용 기하 계산이고,
// 실제로 갈 수 있는지는 chess.js 합법 수가 판단한다.
import type { Color, PieceSymbol, Square } from 'chess.js'
import { chessOf, legalMoves } from '../../engine/game'
import type { GameState } from '../../engine/game'
import type { BlockReason } from './rulesText.ko'

function idx(sq: Square): [number, number] {
  return [sq.charCodeAt(0) - 97, sq.charCodeAt(1) - 49]
}

function sq(f: number, r: number): Square | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null
  return `${String.fromCharCode(97 + f)}${r + 1}` as Square
}

const ORTHO: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const DIAG: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
const KNIGHT: [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]

/** 빈 보드에서 이 기물이 원래 움직일 수 있는 칸 */
export function patternSquares(type: PieceSymbol, color: Color, from: Square): Square[] {
  const [f, r] = idx(from)
  const out: Square[] = []
  const add = (s: Square | null) => s && out.push(s)
  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) for (let k = 1; k < 8; k++) add(sq(f + df * k, r + dr * k))
  }
  switch (type) {
    case 'r':
      slide(ORTHO)
      break
    case 'b':
      slide(DIAG)
      break
    case 'q':
      slide([...ORTHO, ...DIAG])
      break
    case 'n':
      for (const [df, dr] of KNIGHT) add(sq(f + df, r + dr))
      break
    case 'k':
      for (const [df, dr] of [...ORTHO, ...DIAG]) add(sq(f + df, r + dr))
      break
    case 'p': {
      const dir = color === 'w' ? 1 : -1
      const startRank = color === 'w' ? 1 : 6
      add(sq(f, r + dir))
      if (r === startRank) add(sq(f, r + 2 * dir))
      add(sq(f - 1, r + dir))
      add(sq(f + 1, r + dir))
      break
    }
  }
  return out
}

/** from → to 사이 칸 (직선·대각선일 때만) */
function between(from: Square, to: Square): Square[] {
  const [f0, r0] = idx(from)
  const [f1, r1] = idx(to)
  const df = Math.sign(f1 - f0)
  const dr = Math.sign(r1 - r0)
  const steps = Math.max(Math.abs(f1 - f0), Math.abs(r1 - r0))
  const straight = f0 === f1 || r0 === r1 || Math.abs(f1 - f0) === Math.abs(r1 - r0)
  if (!straight) return []
  const out: Square[] = []
  for (let k = 1; k < steps; k++) out.push(sq(f0 + df * k, r0 + dr * k)!)
  return out
}

/**
 * 선택한 기물이 to로 갈 수 없는 이유. 갈 수 있으면 null.
 * 판별 순서: 자기 말 점유 → 경로 차단 → (폰 전용 규칙) → 킹 안전(체크 중이면 체크 문구)
 */
export function blockReason(state: GameState, from: Square, to: Square): BlockReason | null {
  const chess = chessOf(state)
  if (legalMoves(state, from).some((m) => m.to === to)) return null
  const piece = chess.get(from)
  if (!piece) return null
  const target = chess.get(to)

  if (target && target.color === piece.color) return 'ownPiece'
  if (piece.type !== 'n' && between(from, to).some((s) => chess.get(s))) return 'pathBlocked'

  if (piece.type === 'p') {
    const diagonal = from[0] !== to[0]
    if (diagonal && !target) return 'pawnNeedsCapture'
    if (!diagonal && target) return 'pawnBlockedAhead'
  }
  return chess.isCheck() ? 'mustResolveCheck' : 'selfCheck'
}

export interface PatternPreview {
  pattern: Square[]
  legal: Square[]
  blocked: Map<Square, BlockReason>
}

export function patternPreview(state: GameState, from: Square): PatternPreview | null {
  const piece = chessOf(state).get(from)
  if (!piece) return null
  const pattern = patternSquares(piece.type, piece.color, from)
  const legal = [...new Set(legalMoves(state, from).map((m) => m.to))]
  const blocked = new Map<Square, BlockReason>()
  for (const s of pattern) {
    const reason = blockReason(state, from, s)
    if (reason) blocked.set(s, reason)
  }
  return { pattern, legal, blocked }
}
