import { useRef } from 'react'
import { useStore } from '../state/store.jsx'
import { downloadJSON, downloadMarkdown } from '../logic/exportData.js'
import { THEMES } from '../data/themes.js'

const LAYOUT_LABEL = { pc: 'PC', mac: 'Mac', iphone: 'iPhone' }

export default function SettingsPanel({ onClose, layoutMode, onChangeLayout, onStubTheme }) {
  const { state, dispatch } = useStore()
  const fileInput = useRef(null)

  const pickTheme = (id) => {
    if (id === 'detente') {
      onStubTheme()
      return
    }
    dispatch({ type: 'SET_THEME', theme: id })
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
        style={{ padding: 24, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16 }}>Réglages</div>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="field-row">
          <label>Thème</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {THEMES.map((t) => (
              <div
                key={t.id}
                className={
                  'theme-pill' +
                  (state.theme === t.id ? ' active' : '') +
                  (t.id === 'detente' ? ' pill-disabled' : '')
                }
                onClick={() => pickTheme(t.id)}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label>Disposition</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
              Actuelle : {LAYOUT_LABEL[layoutMode] || layoutMode}
            </div>
            <div className="pill" onClick={onChangeLayout}>
              Changer
            </div>
          </div>
        </div>

        <div className="field-row">
          <label>Arrière-plan</label>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
            Pour utiliser une photo perso comme fond, ajoutez-la dans <code>public/</code> et
            réglez <code>--bg-photo</code> dans <code>src/styles/global.css</code> (ex :{' '}
            <code>url('/mon-fond.jpg')</code>).
          </div>
        </div>

        <div className="field-row">
          <label>Export &amp; sauvegarde</label>
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

        <div style={{ fontSize: 11.5, color: 'var(--text-dimmer)' }}>
          Données stockées localement dans ce navigateur pour l'instant (la synchronisation
          Firebase entre PC et téléphone arrive dans une prochaine partie).
        </div>
      </div>
    </div>
  )
}
