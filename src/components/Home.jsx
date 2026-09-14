import { COURSES } from '../data/courses.js'
import ExamGauge from './ExamGauge.jsx'
import DevoirsCard from './DevoirsCard.jsx'
import { useStore } from '../state/store.jsx'

export default function Home({ now, onGoCours, onGoTd, onGoPartiels, onGoDevoirs }) {
  const { state } = useStore()
  const nbChapitres = state.chapitres.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExamGauge exams={state.exams} devoirs={state.devoirs} now={now} onOpen={onGoPartiels} />

      <div className="nav-row">
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

      <DevoirsCard devoirs={state.devoirs} now={now} onOpen={onGoDevoirs} />
    </div>
  )
}
