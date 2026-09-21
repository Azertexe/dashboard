import { COURSES } from '../data/courses.js'
import ExamGauge from './ExamGauge.jsx'
import DevoirsCard from './DevoirsCard.jsx'
import MountainLogo from './MountainLogo.jsx'
import { useStore } from '../state/store.jsx'

export default function Home({ now, layoutMode, onGoCours, onGoTd, onGoPartiels, onGoDevoirs, onGoStats, onGoAgenda, onOpenExam }) {
  const { state, dispatch } = useStore()
  const nbChapitres = state.chapitres.length

  const toggleTheme = () => {
    dispatch({ type: 'SET_THEME', theme: state.theme === 'volcanique' ? 'glacier' : 'volcanique' })
  }

  return (
    <div className="home-shell">
      <ExamGauge
        exams={state.exams}
        devoirs={state.devoirs}
        now={now}
        layoutMode={layoutMode}
        onOpen={onGoPartiels}
        onOpenExam={onOpenExam}
      />

      <div className="home-hero" onClick={toggleTheme} title="Changer de thème">
        <MountainLogo />
        <div className="home-hero-title">L3 Physique</div>
      </div>

      <div className="nav-row home-nav-row">
        <div className="nav-btn glass-strong" onClick={onGoCours}>
          <div className="nav-btn-title">COURS</div>
          <div className="nav-btn-sub">
            {COURSES.length} MATIÈRES · {nbChapitres} CHAPITRE{nbChapitres > 1 ? 'S' : ''}
          </div>
        </div>
        <div className="nav-btn glass-strong" onClick={onGoTd}>
          <div className="nav-btn-title">TD</div>
          <div className="nav-btn-sub">FEUILLES &amp; MÉTHODES</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
        <div className="home-stats-link" onClick={onGoAgenda}>
          Agenda →
        </div>
        <div className="home-stats-link" onClick={onGoStats}>
          Vue d'ensemble →
        </div>
      </div>

      <DevoirsCard devoirs={state.devoirs} now={now} onOpen={onGoDevoirs} />
    </div>
  )
}
