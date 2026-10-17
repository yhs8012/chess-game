// AI 계산 전용 Web Worker (3D 렌더링 끊김 방지)
import { chooseMove } from './ai'
import type { AiMove, Difficulty } from './ai'

export interface AiRequest {
  id: number
  fen: string
  difficulty: Difficulty
}

export interface AiResponse {
  id: number
  move: AiMove | null
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, fen, difficulty } = e.data
  const move = chooseMove(fen, difficulty)
  const res: AiResponse = { id, move }
  self.postMessage(res)
}
