# Dashboard L3 Physique

Site perso pour suivre l'avancement en L3 Physique (UGA) : état des chapitres,
badges de révision TD/Cours indépendants, devoirs, countdown avant le prochain
partiel. Design basé sur le wireframe "L3 Physique" produit dans Claude Design
(version fonctionnelle desktop/mobile), implémenté ici en React.

## Stack

- **React + Vite**
- **GitHub Pages** pour l'hébergement (build via GitHub Actions, voir
  `.github/workflows/deploy.yml`)
- Données stockées en **localStorage** (source de vérité locale, marche hors
  ligne) et synchronisées en temps réel via **Firebase Firestore** entre tous
  les appareils, sans compte à créer — voir la section
  [Synchronisation Firebase](#synchronisation-firebase) plus bas

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

## Synchronisation Firebase

Tous les appareils qui ouvrent le site lisent/écrivent le même document
Firestore en temps réel (`dashboards/l3-physique`) — pas de compte, pas de
code à taper : ouvrir l'URL suffit. Un changement fait sur PC (cocher un
badge, ajouter un chapitre...) apparaît automatiquement sur le téléphone dans
la seconde, et inversement. Hors ligne, les changements restent en attente
localement (cache IndexedDB) et repartent seuls à la reconnexion.

C'est un choix volontairement simple (pas d'authentification) : accepté ici
parce que les données ne sont pas sensibles (juste une progression de
révisions) et que l'URL du site n'est pas indexée. La sécurité réelle vient
des règles Firestore ci-dessous, qui limitent l'accès à ce document précis
plutôt qu'à toute la base.

### Mise en place (une seule fois)

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com),
   **Ajouter un projet** (nom libre, ex. "l3-physique-dashboard"). Google
   Analytics n'est pas nécessaire, on peut le désactiver.
2. Dans le projet, menu de gauche **Build → Firestore Database** →
   **Créer une base de données**. Choisir une région proche (ex. `eur3`,
   Europe), démarrer **en mode production** (les règles ci-dessous
   remplacent le mode test).
3. Toujours dans Firestore, onglet **Règles**, remplacer le contenu par :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /dashboards/l3-physique {
         allow read, write: if true;
       }
     }
   }
   ```

   Cliquer **Publier**. Ça n'autorise l'accès qu'à CE document précis (pas au
   reste de la base), ce qui suffit puisque personne d'autre ne connaît son
   chemin ni l'URL du site.
4. Revenir à la page d'accueil du projet (icône ⚙️ **Paramètres du projet**),
   section **Vos applications** → cliquer l'icône **Web `</>`** → donner un
   nom (ex. "dashboard") → **Enregistrer l'application** (pas besoin de
   Firebase Hosting, on utilise GitHub Pages).
5. Copier l'objet `firebaseConfig` affiché (`apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId`) et le coller
   dans `src/firebase/config.js` à la place des `'TODO'`.
6. `npm run build` puis déployer (push sur `main`) — Réglages doit alors
   afficher "Synchronisé" au lieu de "Non configuré".

Ces valeurs de config ne sont pas des secrets (Firebase les rend publiques
par design, y compris dans le code source d'un site statique) — c'est
normal qu'elles se retrouvent dans le bundle JS déployé sur GitHub Pages.

## Serveur MCP (connecter Claude au dashboard)

Le site est une page statique : il ne peut pas être ajouté comme "connecteur
personnalisé" dans Claude (ça demande un vrai serveur). `mcp-server/` fournit
ce serveur séparément (à déployer sur Cloudflare Workers, gratuit) — il
réutilise directement `src/state/reducer.js`/`src/logic/` pour parler au
même document Firestore, sans dupliquer la logique. Voir `mcp-server/README.md`.

## Où en est l'implémentation

Suivi par rapport aux "Parties" de la spec (`uploads/dashboard-l3-physique-spec.md`) :

- ✅ **Partie 1 — Design** : fait dans Claude Design (wireframe "L3 Physique",
  version fonctionnelle 2a/2b) puis recréé en composants React ici.
- ✅ **Partie 2 — Modèle de données des chapitres** : ID stable, nom,
  description, état, statut standby/actif, badge, commentaires
  (`src/state/store.jsx`). Un chapitre appartient à un seul côté (`side`:
  'cours' ou 'td', fixé à sa création selon l'onglet où on était) — créer
  "Interférences" côté Cours ne le fait pas apparaître côté TD ; il faut
  l'ajouter séparément là-bas si besoin, avec sa propre fiche complètement
  indépendante (nom, description, badge). Stocké en local pour l'instant.
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
  touche jamais ces horloges. Un point d'exclamation rouge apparaît
  directement **sur le badge concerné** (`.badge-alert-dot`, coin
  supérieur droit du badge lui-même) dès qu'il est orange ou jaune
  **actif** — pas pendant une attente, pas au rouge (trop tôt), plus au
  vert turquoise (le pulse suffit déjà), et jamais comme un indicateur
  générique au niveau du chapitre ou de la tuile d'une matière. Chaque clic
  sur un badge garde un instantané de l'état précédent ; un mini bouton ↺
  juste à côté de N'IMPORTE QUEL badge (liste, carte, agenda — pas
  seulement dans un panneau d'édition) permet d'annuler la dernière
  **couleur** validée par erreur (clic ou forçage debug) et restaure
  exactement l'état d'avant, pas juste le statut "auto" par défaut. Un
  simple clic sur "Activer" n'est volontairement pas annulable par ↺ (rien
  n'a encore été "fait" à ce stade, juste démarré). Le panneau d'édition
  d'un chapitre n'affiche jamais que le badge du côté qu'on est en train de
  consulter (Cours ou TD) — jamais les deux ensemble. Un **mode debug**
  dans Réglages permet de forcer le badge Cours ou TD d'un chapitre choisi à
  n'importe quelle couleur (ou de revenir en "Auto") ; ce forçage règle
  réellement l'horloge du badge (comme un vrai clic dans le passé), donc il
  s'intègre au cycle normal et peut lui aussi être annulé avec ↺. Le même
  mode debug permet aussi de forcer l'affichage (ou le masquage) du point
  d'exclamation sur un chapitre précis, indépendamment de son statut réel,
  pour tester l'alerte sans attendre. La logique du cycle (`src/logic/badges.js`)
  est couverte par des tests automatisés (`npm test`, via Vitest).
- ✅ **Partie 4 — Header** : countdown réel vers le prochain partiel, liste de
  devoirs réelle avec échéance en J-X. Un devoir peut être coché comme fait
  (case à cocher, `TOGGLE_DEVOIR_FAIT`) — il sort alors des listes "à faire"
  (accueil, Agenda) sans être supprimé — et rattaché en option à une matière
  (tag affiché sur sa ligne). Ajouter/supprimer un partiel ou un
  devoir se fait sur leur écran dédié (`PartielsScreen` / `DevoirsScreen`),
  via un vrai calendrier (`<input type="date">`, borné à l'année scolaire
  2026-2027 — `SCHOOL_YEAR_START`/`SCHOOL_YEAR_END` dans `src/logic/dates.js`)
  plutôt qu'un nombre de jours à calculer soi-même. L'axe de la jauge de
  l'accueil est fixe, ancré sur la rentrée (`GAUGE_START` = 1er septembre
  2026, `src/logic/dates.js`) — le repère "aujourd'hui" avance donc
  visiblement le long de la barre au fil de l'année (plutôt que de toujours
  rester au même endroit, ou une barre de remplissage dont la largeur
  induisait en erreur), et chaque partiel a son trait dans l'étendue
  affichée. La date de fin de cette étendue se choisit librement ("Voir
  jusqu'au", `ExamGauge.jsx`, par défaut le partiel/devoir le plus lointain) ;
  les partiels au-delà sont simplement masqués (pas tassés au bord). Survoler
  le trait
  d'un partiel bascule l'en-tête (en fondu) sur son nom/sa date. Cliquer sur
  l'en-tête, un trait de partiel, ou sa ligne dans
  `PartielsScreen` ouvre sa fiche détail — une pop-up par-dessus la page
  (`ExamDetailModal`, jamais une navigation) avec un champ libre éditable
  ("ce qu'il y aura", bouton Modifier) et un badge d'avancement dédié
  ("Urgent"/"Fait", complètement séparé des badges de révision Cours/TD).
- ✅ **Partie 5 — Mode édition** : édition nom/description/état/commentaires
  sans toucher aux badges ; ajout de chapitres au fil de l'année ; recherche
  dans la liste des chapitres d'un cours dès qu'il y en a plus de 3. Chaque
  matière a sa propre teinte (`src/data/courses.js`, `courseAccentStyle`),
  reprise en bordure/pastille dans les listes et le détail d'un cours.
- ✅ **Sommaire** : un chapitre n'a toujours qu'un seul badge (Cours ou TD,
  selon son côté) — mais sa ligne dans le détail d'un cours affiche aussi un
  lien "Sommaire" (ou "N partie(s) →"), toujours disponible, qui ouvre un
  sous-écran dédié (`SommaireScreen.jsx`) sans rapport avec le badge :
  juste un plan (parties, ex. "Exercice 1"), dépliable en accordéon pour
  y ajouter des sous-parties, chacune éditable en place (crayon) ou
  supprimable (×). Sert à noter ce qu'il y a dans un chapitre sans avoir à
  activer son suivi de révision pour ça. (Avant, les "parties" portaient
  chacune leur propre badge indépendant — retiré : un seul badge par
  chapitre, plus simple, le sommaire ne fait plus que lister le contenu.)
- ✅ **Partie 6 — Ressources** : fiche de révision, fiche méthode et polys
  sont éditables par matière (`ResourceLinkCard` / `ResourcePolysCard`) —
  lien vers une URL externe ou un fichier hébergé dans le repo (ex. PDF dans
  `public/`), avec édition/suppression en place.
- ✅ **Partie 7 — Sync Firebase** : synchronisation temps réel entre tous les
  appareils via un seul document Firestore partagé, sans compte/mot de passe
  (voir [Synchronisation Firebase](#synchronisation-firebase)). Tant que
  `src/firebase/config.js` garde ses valeurs `'TODO'`, l'app fonctionne
  normalement en localStorage seul (Réglages affiche "Non configuré"). Export/
  import JSON manuel reste dispo en complément (sauvegarde locale).
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
standby, badges en retard, répartition par état, et par matière. Inclut un
**classement par matière** : les matières triées par part de leurs chapitres
actifs actuellement au vert (à jour) — celles sans aucun chapitre actif
apparaissent à part ("pas commencé"), pas dernières par défaut.

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
