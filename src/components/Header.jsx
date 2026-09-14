// Barre légère utilisée sur les écrans autres que l'accueil (qui a son propre
// logo centré). Le choix du thème vit désormais dans Réglages.
export default function Header({ onOpenSettings }) {
  return (
    <div className="header-bar glass-strong">
      <div className="brand">
        <div className="brand-dot" />
        <div className="brand-name">L3 PHYSIQUE</div>
      </div>
      <div className="pill" onClick={onOpenSettings}>
        Réglages
      </div>
    </div>
  )
}
