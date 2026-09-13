import { useStore } from '../state/store.jsx'

const THEMES = [
  { id: 'glacier', label: 'Glacier' },
  { id: 'volcanique', label: 'Volcanique' },
  { id: 'detente', label: 'Détente' },
]

export default function Header({ onOpenSettings, onStubTheme }) {
  const { state, dispatch } = useStore()

  const pick = (id) => {
    if (id === 'detente') {
      onStubTheme()
      return
    }
    dispatch({ type: 'SET_THEME', theme: id })
  }

  return (
    <div className="header-bar glass-strong">
      <div className="brand">
        <div className="brand-dot" />
        <div className="brand-name">L3 PHYSIQUE</div>
      </div>
      <div className="theme-switch">
        {THEMES.map((t) => (
          <div
            key={t.id}
            className={
              'theme-pill' +
              (state.theme === t.id ? ' active' : '') +
              (t.id === 'detente' ? ' pill-disabled' : '')
            }
            onClick={() => pick(t.id)}
          >
            {t.label}
          </div>
        ))}
        <div className="theme-pill" onClick={onOpenSettings}>
          Réglages
        </div>
      </div>
    </div>
  )
}
