// 사용자 설정 (localStorage에 저장)
import type { Color } from 'chess.js'
import type { Difficulty } from '../engine/ai'
import { createStore, loadJson, saveJson, useStore } from './store'

export type Mode = 'pvp' | 'ai'

export interface Settings {
  volume: number
  muted: boolean
  showLabels: boolean
  reduceEffects: boolean
  /** 같은 화면 대전에서 턴마다 시점 전환 */
  autoRotate: boolean
  /** 체크 때 "Check!" 음성 */
  checkVoice: boolean
  mode: Mode
  difficulty: Difficulty
  humanColor: Color
}

const KEY = 'chess3d.settings'

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  muted: false,
  showLabels: true,
  reduceEffects: false,
  autoRotate: false,
  checkVoice: true,
  mode: 'pvp',
  difficulty: 'normal',
  humanColor: 'w',
}

export const settingsStore = createStore<Settings>(loadJson(KEY, DEFAULT_SETTINGS))
settingsStore.subscribe(() => saveJson(KEY, settingsStore.get()))

export function useSettings() {
  return useStore(settingsStore)
}

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((s) => ({ ...s, ...patch }))
}
