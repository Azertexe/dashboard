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
import AgendaScreen from './components/AgendaScreen.jsx'
import SommaireScreen from './components/SommaireScreen.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import ExamDetailModal from './components/ExamDetailModal.jsx'
import LayoutPicker from './components/LayoutPicker.jsx'
import BackgroundSlideshow from './components/BackgroundSlideshow.jsx'
import { checkAndNotify } from './logic/notifications.js'
import { lastExportAt } from './logic/exportData.js'

const EXPORT_REMINDER_MS = 14 * 24 * 60 * 60 * 1000
const NOTIFY_CHECK_MS = 10 * 60 * 1000

const LAYOUT_KEY = 'l3-physique-layout'

export default function App() {
  const { state, dispatch } = useStore()
  const now = useNow()

  // 'home' | 'liste' | 'detail'
  const [screen, setScreen] = useState('home')
  // Sens de la transition visuelle entre écrans : 'forward' glisse depuis la
  // droite (on va plus loin), 'back' depuis la gauche (retour) — cf. global.css.
  const [navDir, setNavDir] = useState('forward')
  const [side, setSide] = useState('cours') // 'cours' | 'td'
  const [courseId, setCourseId] = useState(null)
  const [partiesChapitreId, setPartiesChapitreId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openExamId, setOpenExamId] = useState(null)
  const [toast, setToast] = useState(null)

  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem(LAYOUT_KEY) || 'mac')
  // Le picker ne s'affiche qu'une fois, au tout premier lancement (pas de
  // choix enregistré) — avant, il réapparaissait à chaque rechargement même
  // après un choix déjà fait, faute de vérifier localStorage ici aussi.
  const [pickerOpen, setPickerOpen] = useState(() => !localStorage.getItem(LAYOUT_KEY))

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

  // Rappel d'export périodique tant qu'il n'y a pas de sync cloud. Dépend de
  // `hasChapitres` (booléen, pas du tableau entier) plutôt que de tourner une
  // seule fois au montage : sur un appareil qui démarre avant la fin du
  // premier chargement Firebase, `state.chapitres` est encore vide à ce
  // moment-là et un effet à [] ne se redéclencherait jamais une fois les
  // données arrivées — le rappel resterait silencieusement sauté pour toute
  // la session. Ce booléen ne bascule qu'une fois (vide → non-vide), donc ça
  // garde bien "un seul rappel par ouverture d'app".
  const hasChapitres = state.chapitres.length > 0
  useEffect(() => {
    if (!hasChapitres) return
    const last = lastExportAt()
    if (last && Date.now() - last < EXPORT_REMINDER_MS) return
    const id = setTimeout(
      () => setToast('Pensez à exporter une sauvegarde (Réglages → Export)'),
      1500,
    )
    return () => clearTimeout(id)
  }, [hasChapitres])

  // Vide la corbeille des devoirs cochés la veille (ou avant) — à chaque
  // tick de `now` (cf. useNow.js, ~60s), pas seulement au montage, pour que
  // la purge se déclenche dans la minute qui suit le changement de jour
  // civil même si l'app est restée ouverte depuis la veille. Référence
  // d'état inchangée si rien à purger (cf. reducer.js) : la quasi-totalité
  // de ces ticks ne provoquent donc ni re-render ni sync inutile.
  useEffect(() => {
    dispatch({ type: 'PURGE_TRASHED_DEVOIRS', now })
  }, [now, dispatch])

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
    setNavDir('back')
    setScreen('home')
    setCourseId(null)
  }
  const goListe = (s) => {
    setNavDir('forward')
    setSide(s)
    setCourseId(null)
    setScreen('liste')
  }
  const openCourse = (id) => {
    setNavDir('forward')
    setCourseId(id)
    setScreen('detail')
  }
  const backToListe = () => {
    setNavDir('back')
    setCourseId(null)
    setScreen('liste')
  }
  const goPartiels = () => {
    setNavDir('forward')
    setScreen('partiels')
  }
  const goDevoirs = () => {
    setNavDir('forward')
    setScreen('devoirs')
  }
  const goStats = () => {
    setNavDir('forward')
    setScreen('stats')
  }
  const goAgenda = () => {
    setNavDir('forward')
    setScreen('agenda')
  }
  const openCourseFromStats = (id) => {
    setNavDir('forward')
    setSide('cours')
    setCourseId(id)
    setScreen('detail')
  }
  const openCourseFromAgenda = (id, s) => {
    setNavDir('forward')
    setSide(s)
    setCourseId(id)
    setScreen('detail')
  }
  const openParties = (chapitreId, s) => {
    setNavDir('forward')
    if (s) setSide(s)
    const chapitre = state.chapitres.find((c) => c.id === chapitreId)
    if (chapitre) setCourseId(chapitre.courseId)
    setPartiesChapitreId(chapitreId)
    setScreen('parties')
  }
  const backFromParties = () => {
    setNavDir('back')
    setPartiesChapitreId(null)
    setScreen('detail')
  }

  return (
    <div className="app-shell">
      <BackgroundSlideshow key={`${state.theme}-${layoutMode}`} theme={state.theme} layoutMode={layoutMode} />
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

          <div key={screen} className={`screen-anim screen-anim-${navDir}`}>
            {screen === 'home' && (
              <Home
                now={now}
                layoutMode={layoutMode}
                onGoCours={() => goListe('cours')}
                onGoTd={() => goListe('td')}
                onGoPartiels={goPartiels}
                onGoDevoirs={goDevoirs}
                onGoStats={goStats}
                onGoAgenda={goAgenda}
                onOpenExam={setOpenExamId}
                onOpenCourse={openCourseFromAgenda}
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
                onOpenParties={openParties}
              />
            )}

            {screen === 'parties' &&
              (() => {
                const partiesChapitre = state.chapitres.find((c) => c.id === partiesChapitreId)
                return (
                  partiesChapitre && (
                    <SommaireScreen
                      chapitre={partiesChapitre}
                      side={side}
                      onBack={backFromParties}
                      onGoHome={goHome}
                    />
                  )
                )
              })()}

            {screen === 'partiels' && (
              <PartielsScreen now={now} onGoHome={goHome} onOpenExam={setOpenExamId} />
            )}

            {screen === 'devoirs' && <DevoirsScreen now={now} onGoHome={goHome} />}

            {screen === 'stats' && (
              <StatsScreen now={now} onGoHome={goHome} onOpenCourse={openCourseFromStats} />
            )}

            {screen === 'agenda' && (
              <AgendaScreen now={now} onGoHome={goHome} onOpenCourse={openCourseFromAgenda} />
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
          now={now}
          onChangeLayout={() => {
            setSettingsOpen(false)
            setPickerOpen(true)
          }}
        />
      )}
      {openExamId &&
        (() => {
          const exam = state.exams.find((e) => e.id === openExamId)
          return exam && <ExamDetailModal exam={exam} now={now} onClose={() => setOpenExamId(null)} />
        })()}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
