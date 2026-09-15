import { useState } from 'react'
import { courseName, courseAccentStyle } from '../data/courses.js'
import { ChapitreRowFull } from './ChapitreRow.jsx'
import ResourceLinkCard from './ResourceLinkCard.jsx'
import ResourcePolysCard from './ResourcePolysCard.jsx'
import { useStore } from '../state/store.jsx'

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export default function CourseDetailScreen({ courseId, chapitres, side, now, onBack, onGoHome, onOpenParties }) {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [nom, setNom] = useState('')
  const [search, setSearch] = useState('')
  const sideLabel = side === 'td' ? 'TD' : 'Cours'

  const ch = chapitres
    .filter((c) => c.courseId === courseId && c.side === side)
    .sort((a, b) => b.createdAt - a.createdAt)
  const filtered = search.trim()
    ? ch.filter((c) => normalize(c.nom).includes(normalize(search)))
    : ch

  const addChapitre = () => {
    if (!nom.trim()) return
    dispatch({ type: 'ADD_CHAPITRE', courseId, side, nom: nom.trim() })
    setNom('')
    setAdding(false)
  }

  const resources = state.resources[courseId] || { revision: null, methode: null, polys: [] }

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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
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

        {ch.length > 3 && (
          <input
            className="chapitre-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un chapitre…"
          />
        )}

        {ch.length === 0 && !adding && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun chapitre pour l'instant.</div>
        )}
        {ch.length > 0 && filtered.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dimmer)' }}>Aucun chapitre ne correspond.</div>
        )}
        {filtered.length > 0 && (
          <div className="chapitre-list">
            {filtered.map((c) => (
              <ChapitreRowFull key={c.id} chapitre={c} side={side} now={now} onOpenParties={onOpenParties} />
            ))}
          </div>
        )}
      </div>

      <div className="resource-row">
        <ResourceLinkCard
          title="Fiche de révision"
          sub="CÔTÉ COURS"
          value={resources.revision}
          onSave={({ url, label }) => dispatch({ type: 'SET_RESOURCE_LINK', courseId, kind: 'revision', url, label })}
          onDelete={() => dispatch({ type: 'DELETE_RESOURCE_LINK', courseId, kind: 'revision' })}
        />
        <ResourceLinkCard
          title="Fiche méthode"
          sub="CÔTÉ TD"
          value={resources.methode}
          onSave={({ url, label }) => dispatch({ type: 'SET_RESOURCE_LINK', courseId, kind: 'methode', url, label })}
          onDelete={() => dispatch({ type: 'DELETE_RESOURCE_LINK', courseId, kind: 'methode' })}
        />
        <ResourcePolysCard
          polys={resources.polys}
          onAdd={({ url, label }) => dispatch({ type: 'ADD_POLY', courseId, url, label })}
          onDelete={(polyId) => dispatch({ type: 'DELETE_POLY', courseId, polyId })}
        />
      </div>
    </div>
  )
}
