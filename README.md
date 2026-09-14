# Dashboard L3 Physique

Site perso pour suivre l'avancement en L3 Physique (UGA) : état des chapitres,
badges de révision TD/Cours indépendants, devoirs, countdown avant le prochain
partiel. Design basé sur le wireframe "L3 Physique" produit dans Claude Design
(version fonctionnelle desktop/mobile), implémenté ici en React.

## Stack

- **React + Vite**
- **GitHub Pages** pour l'hébergement (build via GitHub Actions, voir
  `.github/workflows/deploy.yml`)
- Données stockées en **localStorage** pour l'instant — la synchronisation
  Firebase (PC ↔ téléphone) arrive dans une prochaine partie

## Développement

```bash
npm install
npm run dev
```

```bash
npm run build    # build de prod dans dist/
npm run preview  # sert le build localement
npm run lint      # oxlint
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` build et déploie automatiquement
`dist/` sur GitHub Pages à chaque push sur `main`. Dans les réglages du dépôt,
**Settings → Pages → Source**, sélectionner **GitHub Actions**.

`vite.config.js` fixe `base: '/dashboard/'` pour matcher
`https://azertexe.github.io/dashboard/` — à adapter si le dépôt est renommé.

Le site n'a pas de mot de passe (accès par URL discrète, non indexée —
`<meta name="robots" content="noindex, nofollow">` dans `index.html`).

## Où en est l'implémentation

Suivi par rapport aux "Parties" de la spec (`uploads/dashboard-l3-physique-spec.md`) :

- ✅ **Partie 1 — Design** : fait dans Claude Design (wireframe "L3 Physique",
  version fonctionnelle 2a/2b) puis recréé en composants React ici.
- ✅ **Partie 2 — Modèle de données des chapitres** : ID stable, nom,
  description, état, statut standby/actif, 2 badges indépendants, commentaires
  (`src/state/store.jsx`). Stocké en local pour l'instant.
- ✅ **Partie 3 — Badges TD/Cours + standby/actif** : logique dans
  `src/logic/badges.js`, isolée de l'UI. Standby → Activer (sens unique,
  démarre les 2 horloges) ; 4 couleurs (rouge jour 1 < 24h, orange 24h–3j,
  jaune 3j–7j, vert ≥ 7j) ; une fois au vert, un pulse bleu revient tous les 2
  jours. Éditer nom/description ne touche jamais ces dates.
- ✅ **Partie 4 — Header** : countdown réel vers le prochain partiel, liste de
  devoirs réelle avec échéance en J-X. L'accueil n'affiche que des résumés en
  lecture seule ; ajouter/supprimer un partiel ou un devoir se fait sur leur
  écran dédié (clic sur la carte → `PartielsScreen` / `DevoirsScreen`).
- ✅ **Partie 5 — Mode édition** : édition nom/description/état/commentaires
  sans toucher aux badges ; ajout de chapitres au fil de l'année. Chaque
  matière a sa propre teinte (`src/data/courses.js`, `courseAccentStyle`),
  reprise en bordure/pastille dans les listes et le détail d'un cours.
- 🚧 **Partie 6 — Ressources** : cartes stub (fiche de révision / fiche
  méthode / polys) sans liens réels pour l'instant.
- ⬜ **Partie 7 — Sync Firebase** : pas encore fait, données en localStorage.
- ✅ **Partie 8 — Export & backup** : export JSON (backup/restauration) et
  export Markdown (état lisible, pour coller dans un chat IA), depuis
  Réglages. L'import JSON restaure une sauvegarde.

### Disposition (PC / Mac / iPhone)

Au démarrage, un sélecteur (fond flouté) demande de choisir l'écran cible —
**PC** (large, 3 colonnes), **Mac** (moyen, 2 colonnes) ou **iPhone**
(cadre mobile étroit + barre d'onglets en bas), indépendamment de la largeur
réelle de la fenêtre. Le choix est mémorisé (`localStorage`) et rappelé au
prochain démarrage ; il se change à tout moment depuis Réglages → Disposition
→ Changer. Piloté par l'attribut `data-layout` sur `<html>` et les variables
CSS `--layout-*` (`src/styles/global.css`).

### Thèmes

- **Glacier** (par défaut) et **Volcanique** sont fonctionnels.
- **Détente** reste un stub non fonctionnel (clic → message "en construction"),
  comme prévu par la spec.
- **Fond photo** : pas de photo perso fournie. Pour en ajouter une, la déposer
  dans `public/` et régler `--bg-photo` dans `src/styles/global.css`, ex. :
  `--bg-photo: url('/mon-fond.jpg');`. L'effet liquid glass (blur + opacité)
  est déjà en place sur les panneaux et fonctionnera par-dessus.

## Structure

```
src/
  data/       liste des 7 cours, énumération des états de chapitre
  logic/      logique des badges (pure, testable) + export JSON/Markdown
  state/      store React (context + reducer) avec persistance localStorage
  components/ écrans (Accueil, liste Cours/TD, détail d'un cours) et UI
  styles/     variables de thème + classes "liquid glass"
```
