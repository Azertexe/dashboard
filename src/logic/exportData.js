import { COURSES, courseName } from '../data/courses.js'
import { etatLabel } from '../data/etats.js'
import { badgeStatus } from './badges.js'

const BADGE_LABEL = {
  inactive: 'standby',
  rouge: 'à réviser',
  orange: 'à réviser bientôt',
  jaune: 'ok',
  vert: 'à jour',
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
      const cours = badgeStatus(c, 'cours', now)
      const td = badgeStatus(c, 'td', now)
      lines.push(`- **${c.nom}** — ${etatLabel(c.etat)}`)
      lines.push(`  - Cours : ${BADGE_LABEL[cours.level]}`)
      lines.push(`  - TD : ${BADGE_LABEL[td.level]}`)
      if (c.description) lines.push(`  - Description : ${c.description}`)
      if (c.commentaires) lines.push(`  - Commentaires : ${c.commentaires}`)
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
