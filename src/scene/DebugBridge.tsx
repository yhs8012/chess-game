// ?debug 주소에서만: 자동 테스트가 칸의 화면 좌표와 게임 상태를 읽을 수 있게 노출한다
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { Square } from 'chess.js'
import { BOARD_TOP, squareToWorld } from './coords'
import type { ChessGame } from '../hooks/useChessGame'

export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')

declare global {
  interface Window {
    __chess?: { g: ChessGame; screenOf: (sq: Square, y?: number) => { x: number; y: number } }
  }
}

export function DebugBridge({ g }: { g: ChessGame }) {
  const { camera, gl } = useThree()
  useEffect(() => {
    window.__chess = {
      g,
      screenOf(sq, y = BOARD_TOP + 0.01) {
        const v = squareToWorld(sq, y).project(camera)
        const r = gl.domElement.getBoundingClientRect()
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
      },
    }
  })
  return null
}
