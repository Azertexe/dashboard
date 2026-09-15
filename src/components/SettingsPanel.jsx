import { useRef, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { downloadJSON, downloadMarkdown } from '../logic/exportData.js'
import { THEMES } from '../data/themes.js'
import { COURSES } from '../data/courses.js'
import { badgeStatus, BADGE_LEVELS, BADGE_COLOR_NAME } from '../logic/badges.js'
import {
  notificationsEnabled,
  setNotificationsEnabled,
  notificationsSupported,
} from '../logic/notifications.js'

const LAYOUT_LABEL = { pc: 'PC', mac: 'Mac', iphone: 'iPhone' }

const FORCE_LEVELS = [BADGE_LEVELS.ROUGE, BADGE_LEVELS.ORANGE, BADGE_LEVELS.JAUNE, BADGE_LEVELS.VERT]

function levelPillStyle(level, active) {
  if (!active) return {}
  return { background: `var(--${level}-bg)`, color: `var(--${level}-ink)`, borderColor: 'transparent' }
}

function alertPillStyle(active) {
  if (!active) return {}
  return { background: 'var(--orange-bg)', color: 'var(--orange-ink)', borderColor: 'transparent' }
}

const SYNC_LABEL = {
  synced: 'Synchronisé',
  syncing: 'Synchronisation…',
  error: 'Erreur de synchronisation',
  off: 'Non configuré',
}

// Résumé de toutes les fonctionnalités du site, affiché dans Réglages > "Fonctionnalités"
// — utile pour se souvenir de ce qui existe sans avoir à tout retrouver en cliquant partout.
const FEATURES = [
  {
    title: 'Cours / TD indépendants',
    desc: "Chaque matière a une liste de chapitres séparée côté Cours et côté TD — créer un chapitre d'un côté ne l'ajoute pas de l'autre.",
  },
  {
    title: 'Cycle des badges',
    desc: 'Rouge → Orange → Jaune → Vert turquoise, chaque couleur validée (clic) déclenche une attente avant la suivante. Sans clic, la couleur active reste affichée indéfiniment.',
  },
  {
    title: 'Annuler (↺)',
    desc: 'Le petit bouton ↺ à côté d\'un badge annule sa toute dernière action (Activer, une couleur cliquée, ou un forçage debug) — un seul cran en arrière.',
  },
  {
    title: 'Point d\'exclamation (!)',
    desc: "Apparaît sur un badge Orange ou Jaune actif pas encore validé, directement sur le badge concerné (chapitre ou sous-partie).",
  },
  {
    title: 'Sous-parties',
    desc: 'Un chapitre peut être découpé en plusieurs parties (exercices, sections…), chacune avec son propre badge, au lieu d\'un badge unique pour tout le chapitre.',
  },
  {
    title: 'Agenda',
    desc: "Vue regroupant ce qui presse maintenant (badges en retard) et les devoirs/partiels à venir, triés par date.",
  },
  {
    title: "Vue d'ensemble",
    desc: 'Statistiques globales : chapitres par matière, nombre de badges en retard, etc.',
  },
  {
    title: 'Ressources par matière',
    desc: 'Fiche de révision, fiche méthode et polys/annexes (liens externes ou fichiers) éditables pour chaque matière.',
  },
  {
    title: 'Devoirs & partiels',
    desc: 'Échéances avec compte à rebours, affichées sur l\'accueil et dans l\'Agenda.',
  },
  {
    title: 'Notifications',
    desc: "Rappel navigateur, une fois par jour maximum, quand un badge prend du retard.",
  },
  {
    title: 'Synchronisation',
    desc: 'Les mêmes données apparaissent en temps réel sur tous tes appareils via Firebase, sans compte à créer.',
  },
  {
    title: 'Export & sauvegarde',
    desc: 'Export JSON (sauvegarde complète, réimportable) ou Markdown (résumé lisible, pour coller ailleurs).',
  },
  {
    title: 'Thèmes & disposition',
    desc: '3 thèmes de couleur (Glacier, Volcanique, Détente) et 3 dispositions d\'écran (PC, Mac, iPhone).',
  },
  {
    title: 'Mode debug',
    desc: 'Forcer un badge à une couleur ou un "!" précis, pour tester ou corriger sans attendre le cycle normal.',
  },
]

export default function SettingsPanel({ onClose, layoutMode, onChangeLayout, now }) {
  const { state, dispatch, syncStatus } = useStore()
  const fileInput = useRef(null)
  const [notifOn, setNotifOn] = useState(notificationsEnabled)
  const [debugMode, setDebugMode] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [debugCourseId, setDebugCourseId] = useState(COURSES[0]?.id ?? '')
  const [debugChapitreId, setDebugChapitreId] = useState('')

  const pickTheme = (id) => dispatch({ type: 'SET_THEME', theme: id })

  const debugChapitres = state.chapitres.filter((c) => c.courseId === debugCourseId)
  const debugChapitre = debugChapitres.find((c) => c.id === debugChapitreId) ?? null

  const forceBadge = (side, level) => dispatch({ type: 'FORCE_BADGE', id: debugChapitre.id, side, level })
  const forceAlert = (side, value) => dispatch({ type: 'SET_FORCED_ALERT', id: debugChapitre.id, side, value })

  const toggleNotifications = async () => {
    if (notifOn) {
      setNotificationsEnabled(false)
      setNotifOn(false)
      return
    }
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotificationsEnabled(true)
      setNotifOn(true)
    }
  }

  const onImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (confirm('Remplacer les données actuelles par ce fichier de sauvegarde ?')) {
          dispatch({ type: 'IMPORT_STATE', state: parsed })
        }
      } catch {
        alert("Fichier invalide : ce n'est pas un export JSON valide.")
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="glass-strong"
        style={{
          padding: 22,
          maxWidth: 460,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <div className="settings-title">Réglages</div>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-row">
            <div className="settings-section-title" style={{ marginBottom: 0 }}>
              Fonctionnalités
            </div>
            <div className="pill" onClick={() => setAboutOpen((v) => !v)}>
              {aboutOpen ? 'Fermer' : 'Voir tout'}
            </div>
          </div>
          <div className="settings-row-desc" style={{ minWidth: 0 }}>
            Tout ce que propose le site, en un coup d'œil.
          </div>

          {aboutOpen && (
            <div className="settings-subpanel features-list">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature-row">
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-section-title">Thème</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {THEMES.map((t) => (
              <div
                key={t.id}
                className={'theme-pill' + (state.theme === t.id ? ' active' : '')}
                onClick={() => pickTheme(t.id)}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-section-title">Disposition</div>
          <div className="settings-row">
            <div className="settings-row-desc">Actuelle : {LAYOUT_LABEL[layoutMode] || layoutMode}</div>
            <div className="pill" onClick={onChangeLayout}>
              Changer
            </div>
          </div>
        </div>

        {notificationsSupported() && (
          <div className="glass-tight settings-section">
            <div className="settings-section-title">Notifications</div>
            <div className="settings-row">
              <div className="settings-row-desc">
                {notifOn
                  ? 'Activées — badges en retard signalés une fois par jour.'
                  : 'Recevoir une notification quand un badge prend du retard.'}
              </div>
              <div className="pill" onClick={toggleNotifications}>
                {notifOn ? 'Désactiver' : 'Activer'}
              </div>
            </div>
          </div>
        )}

        <div className="glass-tight settings-section">
          <div className="settings-row">
            <div className="settings-section-title" style={{ marginBottom: 0 }}>
              Mode debug
            </div>
            <div className="pill" onClick={() => setDebugMode((v) => !v)}>
              {debugMode ? 'Fermer' : 'Ouvrir'}
            </div>
          </div>
          <div className="settings-row-desc" style={{ minWidth: 0 }}>
            Forcer un badge à une couleur précise, pour tester ou corriger un statut sans
            attendre le cycle normal.
          </div>

          {debugMode && (
            <div className="settings-subpanel">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={debugCourseId}
                  onChange={(e) => {
                    setDebugCourseId(e.target.value)
                    setDebugChapitreId('')
                  }}
                >
                  {COURSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
                <select value={debugChapitreId} onChange={(e) => setDebugChapitreId(e.target.value)}>
                  <option value="">— Choisir un chapitre —</option>
                  {debugChapitres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} ({c.side === 'td' ? 'TD' : 'Cours'})
                    </option>
                  ))}
                </select>
              </div>

              {!debugChapitre && debugChapitres.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-dimmer)' }}>
                  Aucun chapitre dans cette matière pour l'instant.
                </div>
              )}

              {debugChapitre &&
                (() => {
                  const side = debugChapitre.side
                  const status = badgeStatus(debugChapitre, side, now)
                  const active = status.phase === 'active' ? status.level : null
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {side === 'td' ? 'TD' : 'Cours'} — statut actuel :{' '}
                        {status.phase === 'inactive'
                          ? 'standby'
                          : status.phase === 'wait'
                            ? `attente (${BADGE_COLOR_NAME[status.level]})`
                            : BADGE_COLOR_NAME[status.level]}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {FORCE_LEVELS.map((level) => (
                          <div
                            key={level}
                            className="pill"
                            style={levelPillStyle(level, active === level)}
                            onClick={() => forceBadge(side, level)}
                          >
                            {BADGE_COLOR_NAME[level]}
                          </div>
                        ))}
                        <div className="pill" onClick={() => forceBadge(side, null)}>
                          Auto
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Point d'exclamation (!) :</span>
                        {(() => {
                          const badge = side === 'td' ? debugChapitre.badgeTD : debugChapitre.badgeCours
                          const forced = badge?.forcedAlert ?? null
                          return (
                            <>
                              <div
                                className="pill"
                                style={alertPillStyle(forced === true)}
                                onClick={() => forceAlert(side, true)}
                              >
                                Afficher
                              </div>
                              <div
                                className="pill"
                                style={alertPillStyle(forced === false)}
                                onClick={() => forceAlert(side, false)}
                              >
                                Masquer
                              </div>
                              <div className="pill" onClick={() => forceAlert(side, null)}>
                                Auto
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })()}
            </div>
          )}
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-section-title">Arrière-plan</div>
          <div className="settings-row-desc" style={{ minWidth: 0 }}>
            Pour utiliser une photo perso comme fond, ajoutez-la dans <code>public/</code> et
            réglez <code>--bg-photo</code> dans <code>src/styles/global.css</code> (ex :{' '}
            <code>url('/mon-fond.jpg')</code>).
          </div>
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-section-title">Export &amp; sauvegarde</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="pill" onClick={() => downloadJSON(state)}>
              Exporter JSON
            </div>
            <div className="pill" onClick={() => downloadMarkdown(state)}>
              Exporter Markdown
            </div>
            <div className="pill" onClick={() => fileInput.current?.click()}>
              Importer JSON
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={onImportFile}
            />
          </div>
        </div>

        <div className="glass-tight settings-section">
          <div className="settings-row">
            <div className="settings-section-title" style={{ marginBottom: 0 }}>
              Synchronisation
            </div>
            <div className={`sync-pill sync-${syncStatus}`}>{SYNC_LABEL[syncStatus]}</div>
          </div>
          <div className="settings-row-desc" style={{ minWidth: 0 }}>
            {syncStatus === 'off'
              ? "Firebase n'est pas encore configuré (src/firebase/config.js) — les données restent locales à cet appareil."
              : 'Les mêmes données apparaissent automatiquement sur tous tes appareils, sans compte à créer.'}
          </div>
        </div>

        <div className="settings-note">Données stockées localement sur cet appareil, et synchronisées via Firebase.</div>
      </div>
    </div>
  )
}
