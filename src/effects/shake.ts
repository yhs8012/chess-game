// 미세한 화면 흔들림: 씬 전체를 담은 그룹을 흔든다 (카메라 컨트롤과 충돌하지 않음)
export const worldShake = { start: -100, strength: 0, pending: 0 }

export function requestShake(strength = 1) {
  worldShake.pending = strength
}

export function shakeAmount(now: number): number {
  const t = now - worldShake.start
  if (t > 0.35) return 0
  return worldShake.strength * 0.06 * (1 - t / 0.35)
}
