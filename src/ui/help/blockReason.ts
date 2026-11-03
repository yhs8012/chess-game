// "왜 못 가는지" 판별.
// 패턴(빈 보드 기준 이동 모양)은 도움말 표시용 기하 계산이고,
// 실제로 갈 수 있는지는 chess.js 합법 수가 판단한다.
import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square } from 'chess.js'
import { chessOf, legalMoves } from '../../engine/game'
import type { GameState } from '../../engine/game'
import { BLOCK_REASON, PIECES } from './rulesText.ko'
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
  // 캐슬링(킹이 가로로 두 칸)은 패턴 밖이지만 따로 안내한다
  const [f0, r0] = idx(from)
  const [f1, r1] = idx(to)
  if (piece.type === 'k' && r0 === r1 && Math.abs(f1 - f0) === 2) return 'castleOnly'
  if (!patternSquares(piece.type, piece.color, from).includes(to)) return 'notPattern'
  if (piece.type !== 'n' && between(from, to).some((s) => chess.get(s))) return 'pathBlocked'

  if (piece.type === 'p') {
    const diagonal = from[0] !== to[0]
    if (diagonal && !target) return 'pawnNeedsCapture'
    if (!diagonal && target) return 'pawnBlockedAhead'
  }
  if (chess.isCheck()) return 'mustResolveCheck'
  if (piece.type === 'k') return target ? 'kingProtected' : 'kingAttacked'
  if (pinnerOf(state, from)) return 'pinned'
  return 'selfCheck'
}

/**
 * from의 말이 핀에 걸려 있으면 핀을 건 상대 말의 칸. 아니면 null.
 * (그 말을 보드에서 치웠을 때 내 킹이 새로 공격받는지로 판단 — 규칙 판정은 chess.js가 한다)
 */
export function pinnerOf(state: GameState, from: Square): Square | null {
  const chess = chessOf(state)
  const piece = chess.get(from)
  if (!piece || piece.type === 'k') return null
  const opp: Color = piece.color === 'w' ? 'b' : 'w'
  const king = chess.findPiece({ type: 'k', color: piece.color })[0]
  if (!king || chess.isAttacked(king, opp)) return null
  const probe = new Chess(chess.fen())
  probe.remove(from)
  const attackers = probe.attackers(king, opp).filter((sq) => {
    const t = probe.get(sq)?.type
    return t === 'r' || t === 'b' || t === 'q'
  })
  return attackers[0] ?? null
}

const NAME: Record<PieceSymbol, string> = { k: '킹', q: '퀸', r: '룩', b: '비숍', n: '나이트', p: '폰' }

/** 받침 유무에 따라 조사를 고른다 (킹은, 비숍은, 나이트는 / 룩이, 퀸이, 나이트가) */
function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return withoutFinal
  return code % 28 === 0 ? withoutFinal : withFinal
}

/** 잘못된 수를 두려 했을 때 보여 줄 한 줄 설명 (칸·기물 이름 포함) */
export function explainBlock(state: GameState, from: Square, to: Square): string | null {
  const reason = blockReason(state, from, to)
  if (!reason) return null
  const chess = chessOf(state)
  const piece = chess.get(from)!
  const name = NAME[piece.type]
  const who = `${from} ${name}`
  switch (reason) {
    case 'pinned': {
      const pinner = pinnerOf(state, from)!
      const pn = NAME[chess.get(pinner)!.type]
      return `${who}${josa(name, '은', '는')} 핀에 걸려 있어요. 움직이면 ${pinner} ${pn}${josa(pn, '이', '가')} 내 킹을 공격해요.`
    }
    case 'kingProtected': {
      const tn = NAME[chess.get(to)!.type]
      return `${to} ${tn}${josa(tn, '은', '는')} 상대가 지키고 있어서 킹이 잡을 수 없어요.`
    }
    case 'kingAttacked':
      return `${to} 칸은 상대에게 공격받는 칸이라 킹이 갈 수 없어요.`
    case 'mustResolveCheck':
      return `지금은 체크예요. ${who}의 이 수로는 체크가 풀리지 않아요.`
    case 'notPattern':
      return `${name}${josa(name, '은', '는')} ${to} 쪽으로 움직일 수 없어요. ${PIECES[piece.type].text}`
    default:
      return `${who}: ${BLOCK_REASON[reason]}`
  }
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
