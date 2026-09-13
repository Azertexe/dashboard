// Barre "Accès rapide" du wireframe — décorative pour l'instant (pas de palette
// de commandes branchée derrière, cf. Partie 6/Ressources à venir).
export default function QuickAccess() {
  return (
    <div className="quick-access-row">
      <div className="quick-access">
        <div className="quick-access-dot" />
        <div className="quick-access-label">Accès rapide — chapitre, cours, poly, devoir…</div>
        <div className="quick-access-kbd">⌘K</div>
      </div>
    </div>
  )
}
