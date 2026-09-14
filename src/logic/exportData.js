import { COURSES, courseName } from '../data/courses.js'
import { etatLabel } from '../data/etats.js'
import { badgeStatus } from './badges.js'

const ACTIVE_LABEL = {
  rouge: 'à réviser !',
  orange: 'à réviser bientôt',
  jaune: 'ok',
  vert: 'à jour',
}

const COLOR_NAME = { rouge: 'Rouge', orange: 'Orange', jaune: 'Jaune', vert: 'Vert turquoise' }

function badgeLabel(status) {
  if (status.phase === 'inactive') return 'standby'
  if (status.phase === 'wait') return `en attente (${COLOR_NAME[status.level]} dans J-${status.daysLeft})`
  return ACTIVE_LABEL[status.level]
}

export function toMarkdown(state, now = Date.now()) {
  const lines = ['# État L3 Physique', '']
  for (const course of COURSES) {
    const ch = state.chapitres
      .filter((c) => c.courseId === course.id)
      .sort((a, b) => b.createdAt - a.createdAt)
    if (ch.length === 0) continue
    lines.push(`## ${course.nom}`, '')
    for (const c of ch) {
      lines.push(`- **${c.nom}** — ${etatLabel(c.etat)}`)
      if (c.partitionMode === 'parties' && c.parties?.length) {
        for (const p of c.parties) {
          lines.push(`  - **${p.nom}**`)
          lines.push(`    - Cours : ${badgeLabel(badgeStatus(p, 'cours', now))}`)
          lines.push(`    - TD : ${badgeLabel(badgeStatus(p, 'td', now))}`)
        }
      } else {
        lines.push(`  - Cours : ${badgeLabel(badgeStatus(c, 'cours', now))}`)
        lines.push(`  - TD : ${badgeLabel(badgeStatus(c, 'td', now))}`)
      }
      if (c.description) lines.push(`  - Description : ${c.description}`)
      if (c.commentaires) lines.push(`  - Commentaires : ${c.commentaires}`)
    }
    lines.push('')
  }

  if (state.exams?.length) {
    lines.push('## Partiels', '')
    for (const e of state.exams) {
      lines.push(`- ${e.matiere} — ${e.date}`)
    }
    lines.push('')
  }

  if (state.devoirs.length) {
    lines.push('## Devoirs', '')
    for (const d of state.devoirs) {
      lines.push(`- ${d.nom} — échéance ${d.dateEcheance}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

const LAST_EXPORT_KEY = 'l3-physique-last-export'

export function lastExportAt() {
  const raw = localStorage.getItem(LAST_EXPORT_KEY)
  return raw ? Number(raw) : null
}

function markExported() {
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  markExported()
}

export function downloadJSON(state) {
  download(`l3-physique-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), 'application/json')
}

export function downloadMarkdown(state) {
  download(`l3-physique-etat-${new Date().toISOString().slice(0, 10)}.md`, toMarkdown(state), 'text/markdown')
}

export function courseLabelFor(id) {
  return courseName(id)
}
