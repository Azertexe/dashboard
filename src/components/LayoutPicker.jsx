const OPTIONS = [
  { id: 'pc', label: 'PC', sub: 'Grand écran, large' },
  { id: 'mac', label: 'Mac', sub: 'Écran plus petit' },
  { id: 'iphone', label: 'iPhone', sub: 'Disposition mobile' },
]

export default function LayoutPicker({ current, onPick }) {
  return (
    <div className="layout-picker-overlay">
      <div className="layout-picker">
        <div className="label-mono" style={{ marginBottom: 4 }}>
          Choisissez votre écran
        </div>
        <div className="layout-picker-options">
          {OPTIONS.map((o) => (
            <div
              key={o.id}
              className={`layout-picker-option${current === o.id ? ' active' : ''}`}
              onClick={() => onPick(o.id)}
            >
              <div className="layout-picker-label">{o.label}</div>
              <div className="layout-picker-sub">{o.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
