// 도움말 문구 (CLAUDE.md 4-A-5 그대로)
import type { PieceSymbol } from 'chess.js'

export const PIECE_ORDER: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p']

export const PIECES: Record<PieceSymbol, { name: string; symbol: string; text: string }> = {
  k: { name: '킹', symbol: '♔', text: '모든 방향으로 한 칸. 상대에게 공격받는 칸으로는 갈 수 없어요.' },
  q: { name: '퀸', symbol: '♕', text: '가로·세로·대각선으로 원하는 만큼. 가장 강한 말이에요.' },
  r: { name: '룩', symbol: '♖', text: '가로·세로로 원하는 만큼. 다른 말을 넘을 수 없어요.' },
  b: { name: '비숍', symbol: '♗', text: '대각선으로 원하는 만큼. 처음 놓인 칸 색깔에서만 움직여요.' },
  n: { name: '나이트', symbol: '♘', text: 'L자(두 칸 + 옆으로 한 칸)로 이동. 유일하게 다른 말을 뛰어넘을 수 있어요.' },
  p: {
    name: '폰',
    symbol: '♙',
    text: '앞으로 한 칸(처음엔 두 칸까지). 잡을 때만 대각선 앞으로 한 칸. 뒤로는 못 가요.',
  },
}

export const SPECIAL = {
  castling: {
    title: '캐슬링',
    text: '킹이 룩 쪽으로 두 칸 이동하고, 룩이 킹을 넘어 반대편에 붙어요. 킹과 룩이 한 번도 움직이지 않았고, 사이에 말이 없으며, 킹이 체크 중이거나 지나가는 칸이 공격받지 않을 때만 가능해요.',
  },
  enPassant: {
    title: '앙파상',
    text: '상대 폰이 처음에 두 칸 전진해 내 폰 바로 옆에 섰다면, 바로 다음 수에 한해 대각선으로 이동하며 그 폰을 잡을 수 있어요.',
  },
  promotion: {
    title: '프로모션',
    text: '폰이 끝 줄에 도착하면 퀸·룩·비숍·나이트 중 하나로 바뀌어요.',
  },
} as const

export const OUTCOMES = [
  { title: '체크', text: '킹이 공격받는 상태. 반드시 다음 수에 벗어나야 해요.' },
  { title: '체크메이트', text: '체크를 벗어날 방법이 없으면 패배예요.' },
  { title: '스테일메이트', text: '체크는 아닌데 둘 수 있는 수가 하나도 없으면 무승부예요.' },
  { title: '기타 무승부', text: '같은 배치 3회 반복, 50수 동안 폰 이동·잡기 없음, 메이트할 말이 부족한 경우.' },
] as const

export const CHECK_ALERT = '지금 체크예요! 킹을 피하거나, 공격을 막거나, 공격한 말을 잡아야 해요'

export const BLOCK_REASON = {
  ownPiece: '자기 편 말이 있어요',
  pathBlocked: '중간 경로가 막혀 있어요',
  selfCheck: '이 수를 두면 내 킹이 체크당해요',
  mustResolveCheck: '지금은 체크부터 해결해야 해요',
  // 폰 전용 (명세 4종으로 설명되지 않는 경우)
  pawnNeedsCapture: '폰은 잡을 상대 말이 있을 때만 대각선으로 가요',
  pawnBlockedAhead: '폰은 앞에 있는 말을 잡을 수 없어요',
  castleOnly: '캐슬링 조건이 맞지 않아요',
} as const

export type BlockReason = keyof typeof BLOCK_REASON

export const HOW_TO = {
  castling: '킹을 선택한 뒤, 룩 쪽으로 두 칸 떨어진 칸(g 또는 c 파일)을 누르세요.',
  enPassant: '옆의 상대 폰 뒤쪽 대각선 칸을 누르면 잡을 수 있어요.',
  promotion: '폰을 끝 줄로 옮기면 바꿀 기물을 고르는 창이 열려요.',
} as const

export const DRAW_REASON_TEXT = {
  stalemate: '스테일메이트',
  threefold: '같은 배치 3회 반복',
  fiftyMoves: '50수 규칙',
  insufficient: '메이트할 말 부족',
} as const
