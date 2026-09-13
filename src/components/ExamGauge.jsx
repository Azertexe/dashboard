import { useState } from 'react'

const HORIZON_DAYS = 30 // fenêtre de visualisation de la jauge (pas de sens fonctionnel fort)

function daysBetween(now, iso) {
  const target = new Date(iso + 'T00:00:00')
  return Math.ceil((target.getTime() - now) / 86_400_000)
}

export default function ExamGauge({ nextExam, devoirs, now, onSetExam }) {
  const [hover, setHover] = useState(null)
  const [editing, setEditing] = useState(!nextExam)
  const [draft, setDraft] = useState({ matiere: nextExam?.matiere ?? '', date: nextExam?.date ?? '' })

  if (editing) {
    return (
      <div className="glass exam-card">
        <div className="label-mono">Prochain partiel</div>
        <div className="devoir-form">
          <input
            name="nom"
            placeholder="Matière (ex : Optique cohérente)"
            value={draft.matiere}
            onChange={(e) => setDraft((d) => ({ ...d, matiere: e.target.value }))}
          />
          <input
            name="date"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
          <div
            className="pill pill-accent"
            onClick={() => {
              if (!draft.matiere.trim() || !draft.date) return
              onSetExam({ matiere: draft.matiere.trim(), date: draft.date })
              setEditing(false)
            }}
          >
            Enregistrer
          </div>
          {nextExam && (
            <div className="pill" onClick={() => setEditing(false)}>
              Annuler
            </div>
          )}
        </div>
      </div>
    )
  }

  const daysLeft = daysBetween(now, nextExam.date)
  const fillPct = Math.max(0, Math.min(100, (1 - daysLeft / HORIZON_DAYS) * 100))

  const ticks = devoirs.map((d) => {
    const j = daysBetween(now, d.dateEcheance)
    const pos = Math.max(2, Math.min(94, (Math.max(j, 0) / HORIZON_DAYS) * 100))
    return { ...d, j, pos }
  })

  return (
    <div className="glass exam-card">
      <div className="exam-head">
        <div>
          <div className="label-mono">Prochain partiel</div>
          <div style={{ fontSize: 19 }}>
            {nextExam.matiere} — {new Date(nextExam.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div className="exam-days">
          <div className="exam-days-n">{daysLeft}</div>
          <div className="label-mono" style={{ letterSpacing: '.08em' }}>
            jour{Math.abs(daysLeft) > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div className="gauge">
        <div className="gauge-fill" style={{ right: `${100 - fillPct}%` }} />
        {ticks.map((d) => (
          <div
            key={d.id}
            className="gauge-tick"
            style={{ left: `${d.pos}%` }}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="gauge-tick-line" style={hover === d.id ? { background: 'var(--text)' } : undefined} />
            <div className="gauge-tip" style={hover === d.id ? { opacity: 1 } : undefined}>
              {d.nom} · J-{d.j}
            </div>
          </div>
        ))}
        <div className="gauge-cursor" />
      </div>
      <div className="pill" style={{ alignSelf: 'flex-start' }} onClick={() => { setDraft({ matiere: nextExam.matiere, date: nextExam.date }); setEditing(true) }}>
        Modifier
      </div>
    </div>
  )
}
