// 엔진 이벤트 구독 훅 (효과 컴포넌트용)
import { useEffect, useRef } from 'react'
import type { GameEvent } from '../engine/events'
import { gameBus } from './useChessGame'

export function useGameEvents(handler: (e: GameEvent) => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => gameBus.subscribe((e) => ref.current(e)), [])
}

/** 컴포넌트가 사라지면 함께 취소되는 setTimeout */
export function useTimeouts() {
  const ids = useRef<number[]>([])
  useEffect(() => () => ids.current.forEach(clearTimeout), [])
  return (sec: number, fn: () => void) => {
    ids.current.push(window.setTimeout(fn, sec * 1000))
  }
}
