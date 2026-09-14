import { useState } from 'react'

function normalizeUrl(url) {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** Carte "Polys & annexes" : plusieurs liens (PDF/HTML) par matière. */
export default function ResourcePolysCard({ polys, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  const add = () => {
    const normalized = normalizeUrl(url)
    if (!label.trim() || !normalized) return
    onAdd({ label: label.trim(), url: normalized })
    setLabel('')
    setUrl('')
    setAdding(false)
  }

  return (
    <div className="resource-card resource-card-polys">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div className="resource-title">Polys &amp; annexes</div>
        {!adding && (
          <button className="icon-btn" onClick={() => setAdding(true)} title="Ajouter un lien">
            +
          </button>
        )}
      </div>
      <div className="resource-sub">
        {polys.length} FICHIER{polys.length > 1 ? 'S' : ''}
      </div>

      {polys.length > 0 && (
        <div className="resource-poly-list">
          {polys.map((p) => (
            <div key={p.id} className="resource-poly-row">
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.label}
              </a>
              <button
                className="icon-btn"
                onClick={() => {
                  if (confirm(`Retirer "${p.label}" ?`)) onDelete(p.id)
                }}
                title="Retirer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="field-row">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom du fichier…"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            onKeyDown={(e) => e.key === 'Enter' && add()}
            style={{ marginTop: 6 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div className="pill pill-accent" onClick={add}>
              Ajouter
            </div>
            <div className="pill" onClick={() => setAdding(false)}>
              Annuler
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
