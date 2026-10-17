import { Suspense, useEffect, useState } from 'react'
import { ChessScene } from './scene/ChessScene'
import { useChessGame, gameBus } from './hooks/useChessGame'
import { useGameEvents } from './hooks/useGameEvents'
import { useSettings } from './hooks/settings'
import { bindSounds, cancelScheduledSounds, initAudio } from './audio/soundManager'
import { HoverCoordinate, Toolbar, TurnPanel } from './ui/HUD'
import { MoveHistory } from './ui/MoveHistory'
import { PromotionDialog } from './ui/PromotionDialog'
import { ResultPanel } from './ui/ResultPanel'
import { NewGameDialog } from './ui/NewGameDialog'
import { loadFlag, saveFlag } from './hooks/store'
import { Settings } from './ui/Settings'
import { HelpButton } from './ui/help/HelpButton'
import { HelpPanel } from './ui/help/HelpPanel'

/** 체크 순간 화면 테두리가 붉게 깜빡임 */
function CheckFlash() {
  const { reduceEffects } = useSettings()
  const [n, setN] = useState(0)
  useGameEvents((e) => {
    if (e.type === 'check' || e.type === 'checkmate') window.setTimeout(() => setN((x) => x + 1), 400)
  })
  if (n === 0 || reduceEffects) return null
  return <div key={n} className="check-flash" aria-hidden />
}

function Loading({ show }: { show: boolean }) {
  return (
    <div className={`loading ${show ? '' : 'loading--done'}`} aria-hidden={!show}>
      <div className="loading__inner">
        <span className="loading__piece">♞</span>
        <p>보드를 준비하는 중…</p>
      </div>
    </div>
  )
}

export default function App() {
  const g = useChessGame()
  const [loading, setLoading] = useState(true)
  // 처음 실행이면 대국 상대를 고르는 창부터 보여 준다
  const [firstRun] = useState(() => !loadFlag('chess3d.started'))
  const [newGameOpen, setNewGameOpen] = useState(firstRun)
  const openNewGame = () => setNewGameOpen(true)

  useEffect(() => {
    initAudio()
    return bindSounds(gameBus)
  }, [])

  // 무르기·새 게임이면 예약된 소리를 취소
  const moveCount = g.game.moves.length
  useEffect(() => {
    if (g.lastAction !== 'move') cancelScheduledSounds()
  }, [g.lastAction, moveCount])

  const promotionColor = g.pendingPromotion ? g.turn : null

  return (
    <div className={`app ${g.helpOpen ? 'app--help' : ''}`}>
      <div className="scene">
        <Suspense fallback={null}>
          <ChessScene g={g} onLoading={setLoading} />
        </Suspense>
      </div>

      <div className="hud">
        <div className="hud__left">
          <TurnPanel g={g} onNewGame={openNewGame} />
          <MoveHistory g={g} />
        </div>
        <Settings g={g} />
        <HoverCoordinate />
        <Toolbar g={g} onNewGame={openNewGame} />
        <HelpButton open={g.helpOpen} setOpen={g.setHelpOpen} />
      </div>

      <HelpPanel g={g} />
      <CheckFlash />
      {promotionColor && <PromotionDialog color={promotionColor} onChoose={g.choosePromotion} />}
      <ResultPanel g={g} onNewGame={openNewGame} />
      {newGameOpen && !loading && (
        <NewGameDialog
          first={firstRun && !loadFlag('chess3d.started')}
          onClose={() => {
            saveFlag('chess3d.started')
            setNewGameOpen(false)
          }}
          onStart={() => {
            saveFlag('chess3d.started')
            setNewGameOpen(false)
            g.newGame()
          }}
        />
      )}
      <Loading show={loading} />
    </div>
  )
}
