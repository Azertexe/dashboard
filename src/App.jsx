import { useEffect, useState } from 'react'
import { useStore } from './state/store.jsx'
import { useNow } from './hooks/useNow.js'
import Header from './components/Header.jsx'
import Home from './components/Home.jsx'
import CourseListScreen from './components/CourseListScreen.jsx'
import CourseDetailScreen from './components/CourseDetailScreen.jsx'
import PartielsScreen from './components/PartielsScreen.jsx'
import DevoirsScreen from './components/DevoirsScreen.jsx'
import StatsScreen from './components/StatsScreen.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import LayoutPicker from './components/LayoutPicker.jsx'
import { checkAndNotify } from './logic/notifications.js'
import { lastExportAt } from './logic/exportData.js'

const EXPORT_REMINDER_MS = 14 * 24 * 60 * 60 * 1000
const NOTIFY_CHECK_MS = 10 * 60 * 1000

const LAYOUT_KEY = 'l3-physique-layout'

export default function App() {
  const { state } = useStore()
  const now = useNow()

  // 'home' | 'liste' | 'detail'
  const [screen, setScreen] = useState('home')
  const [side, setSide] = useState('cours') // 'cours' | 'td'
  const [courseId, setCourseId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem(LAYOUT_KEY) || 'mac')
  const [pickerOpen, setPickerOpen] = useState(true)

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])

  useEffect(() => {
    document.documentElement.dataset.layout = layoutMode
  }, [layoutMode])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  // Rappel d'export périodique tant qu'il n'y a pas de sync cloud.
  useEffect(() => {
    if (state.chapitres.length === 0) return
    const last = lastExportAt()
    if (last && Date.now() - last < EXPORT_REMINDER_MS) return
    const id = setTimeout(
      () => setToast('Pensez à exporter une sauvegarde (Réglages → Export)'),
      1500,
    )
    return () => clearTimeout(id)
    // Un seul rappel par ouverture d'app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Notifications navigateur pour les badges en retard (si activées).
  useEffect(() => {
    checkAndNotify(state.chapitres, now)
    const id = setInterval(() => checkAndNotify(state.chapitres, Date.now()), NOTIFY_CHECK_MS)
    return () => clearInterval(id)
  }, [state.chapitres, now])

  const pickLayout = (mode) => {
    setLayoutMode(mode)
    localStorage.setItem(LAYOUT_KEY, mode)
    setPickerOpen(false)
  }

  const goHome = () => {
    setScreen('home')
    setCourseId(null)
  }
  const goListe = (s) => {
    setSide(s)
    setCourseId(null)
    setScreen('liste')
  }
  const openCourse = (id) => {
    setCourseId(id)
    setScreen('detail')
  }
  const backToListe = () => {
    setCourseId(null)
    setScreen('liste')
  }
  const goPartiels = () => setScreen('partiels')
  const goDevoirs = () => setScreen('devoirs')
  const goStats = () => setScreen('stats')
  const openCourseFromStats = (id) => {
    setSide('cours')
    setCourseId(id)
    setScreen('detail')
  }

  return (
    <div className="app-shell">
      <div className={`app-content${pickerOpen ? ' blurred' : ''}`}>
        <div className="app-card">
          {screen !== 'home' && <Header onOpenSettings={() => setSettingsOpen(true)} />}
          {screen === 'home' && (
            <button
              className="icon-btn settings-fab"
              onClick={() => setSettingsOpen(true)}
              title="Réglages"
            >
              ⚙
            </button>
          )}

          <div key={screen} className="screen-anim">
            {screen === 'home' && (
              <Home
                now={now}
                onGoCours={() => goListe('cours')}
                onGoTd={() => goListe('td')}
                onGoPartiels={goPartiels}
                onGoDevoirs={goDevoirs}
                onGoStats={goStats}
              />
            )}

            {screen === 'liste' && (
              <CourseListScreen
                chapitres={state.chapitres}
                side={side}
                now={now}
                onGoHome={goHome}
                onOpenCourse={openCourse}
              />
            )}

            {screen === 'detail' && courseId && (
              <CourseDetailScreen
                courseId={courseId}
                chapitres={state.chapitres}
                side={side}
                now={now}
                onBack={backToListe}
                onGoHome={goHome}
              />
            )}

            {screen === 'partiels' && <PartielsScreen now={now} onGoHome={goHome} />}

            {screen === 'devoirs' && <DevoirsScreen now={now} onGoHome={goHome} />}

            {screen === 'stats' && (
              <StatsScreen now={now} onGoHome={goHome} onOpenCourse={openCourseFromStats} />
            )}
          </div>
        </div>

        <div className="bottom-tabs glass-strong">
          <div className={`bottom-tab${screen === 'home' ? ' active' : ''}`} onClick={goHome}>
            Accueil
          </div>
          <div className="bottom-tab" onClick={() => goListe('cours')}>
            Ressources
          </div>
          <div className="bottom-tab" onClick={() => setSettingsOpen(true)}>
            Réglages
          </div>
        </div>
      </div>

      {pickerOpen && <LayoutPicker current={layoutMode} onPick={pickLayout} />}

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          layoutMode={layoutMode}
          onChangeLayout={() => {
            setSettingsOpen(false)
            setPickerOpen(true)
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
