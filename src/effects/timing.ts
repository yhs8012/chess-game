// 연출·사운드가 같이 쓰는 시간표 (초)
import type { GameEvent } from '../engine/events'

export const T = {
  /** 출발→도착 포물선 이동 */
  move: 0.4,
  /** 캐슬링 때 룩이 킹보다 늦게 출발 */
  castleRookDelay: 0.32,
  /** 프로모션 빛기둥 길이, 중간에 기물이 바뀐다 */
  promotionPillar: 0.9,
  /** 잘못된 수 흔들림 */
  shake: 0.35,
  /** 잡힌 말이 부서진 뒤 트레이에 나타나기까지 */
  trayAppear: 0.35,

  // 체크메이트 시퀀스 (착지 시점 기준)
  mateFocus: 0.0,
  mateFall: 0.5,
  mateVoice: 0.6,
  mateText: 1.0,
  mateVictory: 2.4,
  mateResult: 3.8,

  // 무승부
  drawText: 0.4,
  drawResult: 2.2,
} as const

/** 이벤트 묶음이 끝날 때까지 입력을 잠글 시간 */
export function lockDuration(events: GameEvent[]): number {
  let t = 0
  for (const e of events) {
    if (e.type === 'move') t = Math.max(t, T.move + 0.05)
    if (e.type === 'castle') t = Math.max(t, T.castleRookDelay + T.move + 0.05)
    if (e.type === 'promotion') t = Math.max(t, T.move + T.promotionPillar)
    if (e.type === 'invalid') t = Math.max(t, T.shake)
  }
  return t
}
