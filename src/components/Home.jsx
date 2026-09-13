import { COURSES } from '../data/courses.js'
import ExamGauge from './ExamGauge.jsx'
import DevoirsCard from './DevoirsCard.jsx'
import { useStore } from '../state/store.jsx'

export default function Home({ now, onGoCours, onGoTd }) {
  const { state, dispatch } = useStore()
  const nbChapitres = state.chapitres.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExamGauge
        nextExam={state.nextExam}
        devoirs={state.devoirs}
        now={now}
        onSetExam={(nextExam) => dispatch({ type: 'SET_NEXT_EXAM', nextExam })}
      />

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

      <DevoirsCard devoirs={state.devoirs} now={now} />
    </div>
  )
}
