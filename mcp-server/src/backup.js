import { normalizeState } from '../../src/state/reducer.js'
import { toMarkdown } from '../../src/logic/exportData.js'
import { fetchState } from './firestore.js'

// Sauvegarde automatique quotidienne, déclenchée par le Cron Trigger
// Cloudflare (voir wrangler.toml) — complète le rappel manuel existant dans
// l'app (Réglages → Export) plutôt que de le remplacer : un oubli ne peut
// plus faire perdre de données. Écrit dans un Gist GitHub fixe (créé une
// fois par toi, jamais par ce Worker) plutôt que d'en créer un nouveau
// chaque jour, pour garder un seul lien stable à retrouver.
//
// No-op silencieux si GIST_TOKEN/GIST_ID ne sont pas configurés (secrets
// Cloudflare) — la fonctionnalité reste désactivée par défaut.
export async function runBackup(env) {
  if (!env.GIST_TOKEN || !env.GIST_ID) return { skipped: true }

  const remote = await fetchState()
  const state = normalizeState(remote ?? {})
  const now = Date.now()
  const dateStr = new Date(now).toISOString().slice(0, 10)

  const res = await fetch(`https://api.github.com/gists/${env.GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.GIST_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'l3-physique-mcp-backup',
    },
    body: JSON.stringify({
      description: `Sauvegarde L3 Physique — ${dateStr}`,
      files: {
        'l3-physique-backup.json': { content: JSON.stringify(state, null, 2) },
        'l3-physique-etat.md': { content: toMarkdown(state, now) },
      },
    }),
  })

  if (!res.ok) throw new Error(`Gist PATCH a échoué (${res.status}) : ${await res.text()}`)
  return { skipped: false, dateStr }
}
