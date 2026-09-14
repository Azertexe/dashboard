import { useState } from 'react'

function normalizeUrl(url) {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** Carte ressource éditable (fiche de révision / méthode) : lien vers un
 * PDF/HTML hébergé dans le repo ou une URL externe, éditable en place. */
export default function ResourceLinkCard({ title, sub, value, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(value?.label || title)
  const [url, setUrl] = useState(value?.url || '')

  const startEdit = () => {
    setLabel(value?.label || title)
    setUrl(value?.url || '')
    setEditing(true)
  }
  const save = () => {
    const normalized = normalizeUrl(url)
    if (!normalized) return
    onSave({ url: normalized, label: label.trim() || title })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="resource-card resource-card-editing">
        <div className="field-row">
          <label>Titre</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={title} />
        </div>
        <div className="field-row">
          <label>Lien (URL ou fichier hébergé)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="pill pill-accent" onClick={save}>
            Enregistrer
          </div>
          <div className="pill" onClick={() => setEditing(false)}>
            Annuler
          </div>
        </div>
      </div>
    )
  }

  if (!value) {
    return (
      <div className="resource-card resource-card-empty" onClick={startEdit}>
        <div className="resource-title">{title}</div>
        <div className="resource-sub">{sub} · + Ajouter un lien</div>
      </div>
    )
  }

  return (
    <a className="resource-card" href={value.url} target="_blank" rel="noreferrer">
      <div className="resource-title">{value.label}</div>
      <div className="resource-sub">{sub}</div>
      <div className="resource-card-actions">
        <button
          className="icon-btn"
          onClick={(e) => {
            e.preventDefault()
            startEdit()
          }}
          title="Modifier"
        >
          ✎
        </button>
        <button
          className="icon-btn"
          onClick={(e) => {
            e.preventDefault()
            if (confirm(`Retirer le lien "${value.label}" ?`)) onDelete()
          }}
          title="Retirer"
        >
          ×
        </button>
      </div>
    </a>
  )
}
