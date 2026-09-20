import { useState } from 'react'
import { BadgeWithUndo } from './Badge.jsx'
import { useStore } from '../state/store.jsx'
import { ETATS } from '../data/etats.js'

/** Ligne compacte : nom + 1 badge (celui du contexte Cours/TD courant). Utilisée
 * dans la vue "Cours"/"TD" groupée par matière. */
export function ChapitreRowCompact({ chapitre, side, now }) {
  return (
    <div className="chapitre-row">
      <div className="chapitre-name">{chapitre.nom}</div>
      <BadgeWithUndo chapitre={chapitre} side={side} small now={now} chapitreId={chapitre.id} />
    </div>
  )
}

/** Ligne plate dans le détail d'un cours : nom + 1 badge (contexte courant) +
 * accès au sommaire (parties/sous-parties, toujours disponible — indépendant
 * du badge, cf. onOpenParties) + crayon. Le crayon ouvre un panneau d'édition
 * (métadonnées, badge/activation UNIQUEMENT pour le côté courant — Cours et
 * TD ne se croisent jamais sur le même écran). */
export function ChapitreRowFull({ chapitre, side, now, onOpenParties }) {
  const { dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const parties = chapitre.parties ?? []
  const [draft, setDraft] = useState(() => ({
    nom: chapitre.nom,
    description: chapitre.description,
    commentaires: chapitre.commentaires,
    etat: chapitre.etat,
  }))

  const onActivate = (s) => dispatch({ type: 'ACTIVATE_CHAPITRE', id: chapitre.id, side: s })
  const onDelete = () => {
    if (confirm(`Supprimer "${chapitre.nom}" ? Cette action est définitive.`)) {
      dispatch({ type: 'DELETE_CHAPITRE', id: chapitre.id })
    }
  }
  const startEdit = () => {
    setDraft({
      nom: chapitre.nom,
      description: chapitre.description,
      commentaires: chapitre.commentaires,
      etat: chapitre.etat,
    })
    setEditing(true)
  }
  const saveEdit = () => {
    dispatch({ type: 'EDIT_CHAPITRE', id: chapitre.id, patch: draft })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="chapitre-editor glass-tight">
        <div className="field-row">
          <label>Nom</label>
          <input
            value={draft.nom}
            onChange={(e) => setDraft((d) => ({ ...d, nom: e.target.value }))}
          />
        </div>
        <div className="field-row">
          <label>Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </div>
        <div className="field-row">
          <label>État</label>
          <select
            value={draft.etat}
            onChange={(e) => setDraft((d) => ({ ...d, etat: e.target.value }))}
          >
            {ETATS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label>Commentaires</label>
          <textarea
            value={draft.commentaires}
            onChange={(e) => setDraft((d) => ({ ...d, commentaires: e.target.value }))}
          />
        </div>
        <div className="field-row">
          <label>Suivi des révisions</label>
          {(chapitre[side === 'td' ? 'badgeTD' : 'badgeCours'])?.statut !== 'actif' ? (
            <div className="pill pill-accent" onClick={() => onActivate(side)}>
              Activer {side === 'td' ? 'TD' : 'Cours'}
            </div>
          ) : (
            <BadgeWithUndo chapitre={chapitre} side={side} now={now} chapitreId={chapitre.id} />
          )}
        </div>
        <div className="field-row">
          <label>Sommaire</label>
          <div className="pill" onClick={() => onOpenParties(chapitre.id)}>
            {parties.length > 0 ? `${parties.length} partie${parties.length > 1 ? 's' : ''}` : 'Voir/ajouter'} →
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="pill pill-accent" onClick={saveEdit}>
            Enregistrer
          </div>
          <div className="pill" onClick={() => setEditing(false)}>
            Annuler
          </div>
          <div style={{ flex: 1 }} />
          <div className="pill" onClick={onDelete}>
            Supprimer
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chapitre-list-row">
      <div className="chapitre-name">{chapitre.nom}</div>
      {(side === 'td' ? chapitre.badgeTD : chapitre.badgeCours)?.statut !== 'actif' ? (
        <div className="pill pill-accent" onClick={() => onActivate(side)}>
          Activer
        </div>
      ) : (
        <BadgeWithUndo chapitre={chapitre} side={side} now={now} chapitreId={chapitre.id} />
      )}
      <div className="pill" onClick={() => onOpenParties(chapitre.id)} title="Sommaire (indépendant du badge)">
        {parties.length > 0 ? `${parties.length} partie${parties.length > 1 ? 's' : ''}` : 'Sommaire'} →
      </div>
      <button className="icon-btn" onClick={startEdit} title="Modifier">
        ✎
      </button>
    </div>
  )
}
