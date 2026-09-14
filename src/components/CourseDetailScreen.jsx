import { useState } from 'react'
import { courseName, courseAccentStyle } from '../data/courses.js'
import { ChapitreRowFull } from './ChapitreRow.jsx'
import { useStore } from '../state/store.jsx'

export default function CourseDetailScreen({ courseId, chapitres, side, now, onBack, onGoHome }) {
  const { dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [nom, setNom] = useState('')
  const sideLabel = side === 'td' ? 'TD' : 'Cours'

  const ch = chapitres
    .filter((c) => c.courseId === courseId)
    .sort((a, b) => b.createdAt - a.createdAt)

  const addChapitre = () => {
    if (!nom.trim()) return
    dispatch({ type: 'ADD_CHAPITRE', courseId, nom: nom.trim() })
    setNom('')
    setAdding(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...courseAccentStyle(courseId) }}>
      <div className="crumb-row">
        <div className="pill" onClick={onBack}>
          ← {sideLabel}
        </div>
        <div className="screen-title" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <span className="course-dot" />
          {courseName(courseId)}
        </div>
        <div className="pill" onClick={onGoHome}>
          Accueil
        </div>
      </div>

      <div className="glass course-accent-card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="label-mono">Chapitres · du plus récent au plus ancien</div>
          {!adding && (
            <div className="pill pill-course-accent" onClick={() => setAdding(true)}>
              + Chapitre
            </div>
          )}
        </div>

        {adding && (
          <div className="devoir-form">
            <input
              name="nom"
              placeholder="Nom du chapitre…"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addChapitre()}
              autoFocus
            />
            <div className="pill pill-course-accent" onClick={addChapitre}>
              Ajouter
            </div>
            <div className="pill" onClick={() => setAdding(false)}>
              Annuler
            </div>
          </div>
        )}

        {ch.length === 0 && !adding && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun chapitre pour l'instant.</div>
        )}
        {ch.length > 0 && (
          <div className="chapitre-list">
            {ch.map((c) => (
              <ChapitreRowFull key={c.id} chapitre={c} side={side} now={now} />
            ))}
          </div>
        )}
      </div>

      <div className="resource-row">
        <div className="resource-card">
          <div className="resource-title">Fiche de révision</div>
          <div className="resource-sub">CÔTÉ COURS · HTML</div>
        </div>
        <div className="resource-card">
          <div className="resource-title">Fiche méthode</div>
          <div className="resource-sub">CÔTÉ TD · HTML</div>
        </div>
        <div className="resource-card">
          <div className="resource-title">Polys &amp; annexes</div>
          <div className="resource-sub">PDF</div>
        </div>
      </div>
    </div>
  )
}
