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
npm test          # tests automatisés (Vitest) sur la logique des badges
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
  `src/logic/badges.js`, isolée de l'UI. Cours et TD sont deux horloges
  **totalement indépendantes**, y compris pour standby/actif : chacun porte
  son propre `statut`/`activatedAt` (dans `badgeCours`/`badgeTD`) — activer,
  cliquer ou forcer un côté ne touche jamais l'autre. Standby → Activer est
  à sens unique, par côté. Cycle par étapes, chaque couleur devant être
  validée (clic) pour lancer l'attente vers la suivante :
  activation → 1j → **rouge** (validé) → 3j → **orange** (validé) → 7j →
  **jaune** (validé) → 2j → **vert turquoise** (validé) → 2j → **vert
  turquoise**, en boucle tant qu'on continue de cliquer (vert et bleu sont la
  même couleur unique — le pulse n'est qu'un rappel visuel périodique, pas un
  statut à part). Pendant l'attente le badge est grisé, pas cliquable, et
  affiche juste le prochain statut (horloge + jours restants) ; une fois la
  couleur active, il est cliquable et affiche son libellé (« à réviser ! »,
  « à réviser bientôt », « ok », « à jour »). Si on ne clique jamais une
  couleur active, elle reste affichée telle quelle indéfiniment (pas de
  progression automatique au-delà du tout premier passage au rouge). Tant
  qu'un badge rouge/orange/jaune est actif, il pulse en continu (un reflet
  qui glisse horizontalement, simple variation de sa propre couleur) pour
  attirer l'oeil ; une fois vert turquoise, le pulse (bleuté) ne revient que
  tous les 2 jours pour rappeler discrètement. Éditer nom/description ne
  touche jamais ces horloges. Un point d'exclamation rouge apparaît en haut
  à droite de la tuile d'une matière (vue Cours/TD) dès qu'un de ses badges
  est orange ou jaune **actif** — pas pendant une attente, pas au rouge (trop
  tôt), plus au vert turquoise (le pulse suffit déjà). Chaque clic sur un
  badge garde un instantané de l'état précédent ; un bouton ↺ dans le
  panneau d'édition du chapitre permet d'annuler la dernière action sur ce
  badge — une validation de couleur, un forçage debug, **ou même un clic sur
  "Activer" fait par erreur** — et restaure exactement l'état d'avant (pas
  juste le statut "auto" par défaut). Un **mode debug**
  dans Réglages permet de forcer le badge Cours ou TD d'un chapitre choisi à
  n'importe quelle couleur (ou de revenir en "Auto") ; ce forçage règle
  réellement l'horloge du badge (comme un vrai clic dans le passé), donc il
  s'intègre au cycle normal et peut lui aussi être annulé avec ↺. Le même
  mode debug permet aussi de forcer l'affichage (ou le masquage) du point
  d'exclamation sur un chapitre précis, indépendamment de son statut réel,
  pour tester l'alerte sans attendre. La logique du cycle (`src/logic/badges.js`)
  est couverte par des tests automatisés (`npm test`, via Vitest).
- ✅ **Partie 4 — Header** : countdown réel vers le prochain partiel, liste de
  devoirs réelle avec échéance en J-X. L'accueil n'affiche que des résumés en
  lecture seule ; ajouter/supprimer un partiel ou un devoir se fait sur leur
  écran dédié (clic sur la carte → `PartielsScreen` / `DevoirsScreen`).
- ✅ **Partie 5 — Mode édition** : édition nom/description/état/commentaires
  sans toucher aux badges ; ajout de chapitres au fil de l'année ; recherche
  dans la liste des chapitres d'un cours dès qu'il y en a plus de 3. Chaque
  matière a sa propre teinte (`src/data/courses.js`, `courseAccentStyle`),
  reprise en bordure/pastille dans les listes et le détail d'un cours.
- ✅ **Sous-parties** : chaque chapitre choisit, dans son panneau d'édition,
  entre "un badge pour le chapitre" (défaut) et "un badge par partie". En
  mode partie, la ligne du chapitre dans Cours/TD n'affiche plus de badge —
  juste "N parties →", qui ouvre un sous-écran dédié (`PartiesScreen.jsx`)
  listant les sous-parties (ex-exercices), chacune avec ses propres badges
  Cours/TD, totalement indépendants entre eux, du chapitre et des autres
  parties. Les fonctions de `src/logic/badges.js` sont déjà génériques sur
  tout objet `{badgeCours, badgeTD}` — elles marchent donc sans changement
  sur une sous-partie comme sur un chapitre. Le "!" sur une tuile de
  matière, le nombre de "badges en retard" (Vue d'ensemble), les
  notifications et l'export Markdown tiennent tous compte des sous-parties
  (`badgeUnits`/`chapitreNeedsAttention` dans badges.js). Dans l'Agenda, une
  entrée venant d'une sous-partie précise toujours d'où elle vient
  (« Matière — Chapitre — Partie ») pour ne jamais se perdre quand plusieurs
  chapitres sont mélangés dans la même liste.
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

### Agenda

Un lien "Agenda →" à côté de "Vue d'ensemble →" ouvre `AgendaScreen.jsx` :
tout ce qui presse au même endroit — les badges actifs orange/jaune (cliquables
directement depuis là pour les valider) en premier, puis les devoirs et
partiels à venir triés par date avec leur J-X.

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
