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
  jours. Éditer nom/description ne touche jamais ces dates. Un point
  d'exclamation rouge apparaît en haut à droite de la tuile d'une matière (vue
  Cours/TD) dès qu'un de ses badges est orange ou jaune — pas au rouge (trop
  tôt), plus au vert/bleu (le pulse suffit déjà). Chaque clic sur un badge
  garde l'état précédent ; un bouton ↺ dans le panneau d'édition du chapitre
  permet d'annuler un clic fait par erreur.
- ✅ **Partie 4 — Header** : countdown réel vers le prochain partiel, liste de
  devoirs réelle avec échéance en J-X. L'accueil n'affiche que des résumés en
  lecture seule ; ajouter/supprimer un partiel ou un devoir se fait sur leur
  écran dédié (clic sur la carte → `PartielsScreen` / `DevoirsScreen`).
- ✅ **Partie 5 — Mode édition** : édition nom/description/état/commentaires
  sans toucher aux badges ; ajout de chapitres au fil de l'année ; recherche
  dans la liste des chapitres d'un cours dès qu'il y en a plus de 3. Chaque
  matière a sa propre teinte (`src/data/courses.js`, `courseAccentStyle`),
  reprise en bordure/pastille dans les listes et le détail d'un cours.
- ✅ **Partie 6 — Ressources** : fiche de révision, fiche méthode et polys
  sont éditables par matière (`ResourceLinkCard` / `ResourcePolysCard`) —
  lien vers une URL externe ou un fichier hébergé dans le repo (ex. PDF dans
  `public/`), avec édition/suppression en place.
- ⬜ **Partie 7 — Sync Firebase** : pas encore fait, données en localStorage
  (report demandé par l'utilisateur — nécessite un projet Firebase de son
  côté). En attendant : export/import JSON manuel, et un rappel périodique
  suggère d'exporter une sauvegarde si ça fait plus de 14 jours.
- ✅ **Partie 8 — Export & backup** : export JSON (backup/restauration) et
  export Markdown (état lisible, pour coller dans un chat IA), depuis
  Réglages. L'import JSON restaure une sauvegarde.

### Disposition (PC / Mac / iPhone)

Au démarrage, un sélecteur (fond flouté) demande de choisir l'écran cible —
**PC** (large, colonnes en `auto-fit`), **Mac** (un peu plus serré) ou
**iPhone** (cadre mobile étroit + barre d'onglets en bas), indépendamment de
la largeur réelle de la fenêtre. La largeur (`--layout-max-width`) est fluide
(`clamp`) pour remplir l'écran sans vide sur les côtés, quelle que soit la
taille du moniteur. Le choix est mémorisé (`localStorage`) et rappelé au
prochain démarrage ; il se change à tout moment depuis Réglages → Disposition
→ Changer. Piloté par l'attribut `data-layout` sur `<html>` et les variables
CSS `--layout-*` (`src/styles/global.css`).

### Accueil

Pas de barre de titre classique : le partiel à venir est tout en haut, les
onglets Cours/TD centrés avec beaucoup d'espace autour (pour laisser voir le
fond), et les devoirs à faire tout en bas. Au milieu, un logo "L3 Physique"
(silhouette de montagne + typographie manuscrite) fait office de titre —
cliquer dessus bascule entre les thèmes Glacier et Volcanique. Un bouton ⚙
discret en haut à droite ouvre Réglages depuis l'accueil.

### Thèmes

- **Glacier** (par défaut) et **Volcanique** sont fonctionnels, choisis
  depuis Réglages → Thème (ou en cliquant le logo de l'accueil).
- **Détente** (marron/vert) est maintenant fonctionnel comme les deux autres.
- **Fond photo** : pas de photo perso fournie. Pour en ajouter une, la déposer
  dans `public/` et régler `--bg-photo` dans `src/styles/global.css`, ex. :
  `--bg-photo: url('/mon-fond.jpg');`. L'effet liquid glass (blur + opacité)
  est déjà en place sur les panneaux et fonctionnera par-dessus.

### Vue d'ensemble

Un lien "Vue d'ensemble →" sous les onglets Cours/TD de l'accueil ouvre un
écran récapitulatif (`StatsScreen.jsx`) : nombre de chapitres, actifs vs
standby, badges en retard, répartition par état, et par matière (avec le même
point d'exclamation que sur les tuiles Cours/TD si une matière a du retard).

### App installable (PWA)

Le site est installable sur l'écran d'accueil (mobile ou desktop) et reste
consultable hors-ligne grâce à un service worker minimal
(`public/sw.js`, réseau-d'abord avec repli sur le cache — pas de précache figé
puisque les noms de fichiers changent à chaque build Vite). Manifest et icônes
dans `public/manifest.json` et `public/icons/`.

### Notifications

Depuis Réglages → Notifications, on peut activer des notifications
navigateur : un badge qui passe orange ou jaune sans être traité déclenche une
notification (au plus une par badge et par jour), via `src/logic/notifications.js`.
Nécessite que l'onglet soit ouvert (pas de push serveur).

## Structure

```
src/
  data/       liste des 7 cours, énumération des états de chapitre, thèmes
  logic/      logique des badges, dates, export, notifications (pur, testable)
  state/      store React (context + reducer) avec persistance localStorage
  components/ écrans (Accueil, liste Cours/TD, détail d'un cours, vue
              d'ensemble, partiels, devoirs) et UI
  styles/     variables de thème + classes "liquid glass"
public/
  manifest.json, icons/, sw.js   PWA
```
