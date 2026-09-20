# Serveur MCP — L3 Physique

Un petit serveur qui permet à Claude de **lire et modifier directement** les
données du dashboard (chapitres, badges de révision, partiels, devoirs) —
contrairement au site lui-même (`azertexe.github.io/dashboard`), qui est une
page statique et ne peut pas être branchée comme "connecteur personnalisé"
dans Claude.

Il parle au même document Firestore partagé que l'app (`dashboards/l3-physique`,
projet `l3-physic`) et réutilise directement la même logique métier
(`src/state/reducer.js`, `src/logic/badges.js`, `src/logic/dates.js`, importés
tels quels depuis le dépôt principal) — aucune règle n'est dupliquée ni
réécrite ici.

## Outils exposés

- `get_state` — lecture complète : chapitres avec statut de badge
  (phase/couleur/jours restants) et sommaire (parties/sous-parties, un plan
  texte sans rapport avec le badge), partiels et devoirs (avec jours
  restants). Toujours appelé en premier pour récupérer les bons `id`.
- `add_partiel` / `edit_partiel` / `delete_partiel`
- `add_devoir` / `delete_devoir`
- `add_chapitre` / `edit_chapitre` / `delete_chapitre`
- `activate_chapitre` — démarre l'horloge de révision (Cours ou TD)
- `mark_badge` — valide la couleur active, relance l'attente vers la suivante
- `undo_badge` — annule la dernière action sur un badge
- `add_partie` / `delete_partie` — sommaire du chapitre (un plan, pas de badge)
- `add_sous_partie` / `delete_sous_partie` — sous-parties d'une partie du sommaire

(Les liens de ressources par matière ne sont pas encore exposés — prévenir
si besoin, l'ajout suit exactement le même schéma.)

Chaque outil d'écriture relit l'état distant juste avant d'écrire (même
garde-fou que l'app, `src/state/store.jsx`) pour limiter le risque d'écraser
un changement fait entre-temps depuis un autre appareil.

## Sécurité

Comme pour le site (voir README principal), **pas d'authentification par
défaut** : le document Firestore n'est protégé que par son chemin (règles
`allow read, write: if true` sur CE document précis) et par le fait que
l'URL du serveur n'est connue que de toi. C'est un choix assumé, cohérent
avec celui déjà fait pour le site — rien de sensible n'y est stocké.

Pour ajouter un minimum de protection, définir un secret `MCP_TOKEN` (dans
Cloudflare : Worker → Settings → Variables → Secret) rend l'en-tête
`Authorization: Bearer <token>` obligatoire sur chaque requête ; sans ce
secret défini, le serveur reste ouvert.

## Déploiement (gratuit, sans carte bancaire)

Voir les instructions données par Claude au moment de la mise en place —
soit en collant le code déjà "assemblé" dans l'éditeur en ligne de Cloudflare
(le plus simple, sans rien installer), soit via `npx wrangler deploy` en
ligne de commande si tu préfères (nécessite un jeton d'API Cloudflare).

Une fois déployé, l'URL à ajouter comme connecteur personnalisé dans Claude
est `https://<nom-du-worker>.<ton-compte>.workers.dev/mcp` (bien avec le
`/mcp` à la fin).

## Développement local

```
cd mcp-server
npx wrangler dev
```

Lance le serveur sur `http://localhost:8787/mcp` (appelle le vrai Firestore
de production — pas d'environnement de test séparé, donc prudence avec les
outils d'écriture en local).
