import { useEffect, useState } from 'react'
import { useStore } from './state/store.jsx'
import { useNow } from './hooks/useNow.js'
import Header from './components/Header.jsx'
import Home from './components/Home.jsx'
import CourseListScreen from './components/CourseListScreen.jsx'
import CourseDetailScreen from './components/CourseDetailScreen.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'

export default function App() {
  const { state } = useStore()
  const now = useNow()

  // 'home' | 'liste' | 'detail'
  const [screen, setScreen] = useState('home')
  const [side, setSide] = useState('cours') // 'cours' | 'td'
  const [courseId, setCourseId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

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

  return (
    <div className="app-shell">
      <div className="app-card">
        <Header
          onOpenSettings={() => setSettingsOpen(true)}
          onStubTheme={() => setToast('Thème "Détente" — en construction')}
        />

        {screen === 'home' && (
          <Home now={now} onGoCours={() => goListe('cours')} onGoTd={() => goListe('td')} />
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

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
