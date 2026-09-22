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
  texte sans rapport avec le badge), partiels, devoirs (avec jours
  restants) et ressources par matière. Toujours appelé en premier pour
  récupérer les bons `id`.
- `get_digest` — résumé condensé de ce qui presse (badges en retard, devoirs
  <7j, partiels <14j), pour répondre directement sans relire tout `get_state`.
- `add_partiel` / `edit_partiel` / `delete_partiel`
- `add_devoir` (matière optionnelle) / `toggle_devoir_fait` / `delete_devoir`
- `add_chapitre` / `edit_chapitre` / `delete_chapitre`
- `activate_chapitre` — démarre l'horloge de révision (Cours ou TD)
- `mark_badge` — valide la couleur active, relance l'attente vers la suivante
- `undo_badge` — annule la dernière action sur un badge
- `add_partie` / `delete_partie` — sommaire du chapitre (un plan, pas de badge)
- `add_sous_partie` / `delete_sous_partie` — sous-parties d'une partie du sommaire
- `set_resource_link` / `delete_resource_link` — fiche de révision/méthode d'une matière
- `add_poly` / `delete_poly` — polys/annexes d'une matière

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

## Sauvegarde automatique (optionnelle)

En plus du rappel manuel dans l'app (Réglages → Export), ce Worker peut
sauvegarder l'état une fois par jour dans un Gist GitHub fixe (toujours le
même lien, mis à jour chaque jour plutôt que d'en créer un nouveau) —
contenant un export JSON complet et un résumé Markdown, comme le export
manuel. Désactivé par défaut (aucun impact si tu ne configures rien).

Pour l'activer :

1. Créer un Gist vide une fois, sur [gist.github.com](https://gist.github.com)
   (n'importe quel contenu, même un seul mot) → récupérer son id dans l'URL
   (`gist.github.com/<toi>/<GIST_ID>`).
2. Créer un jeton d'accès GitHub avec accès **Gists** en écriture seulement :
   [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens/new) →
   "Fine-grained token" → limiter aux Gists.
3. Dans Cloudflare (Worker → Settings → Variables) : ajouter `GIST_ID` (variable
   normale) et `GIST_TOKEN` (**Secret**, jamais en clair).
4. Ajouter le déclencheur : Worker → Triggers → Cron Triggers → `0 3 * * *`
   (une fois par jour, 3h UTC). Si le Worker a été déployé via
   `wrangler deploy`, ce déclencheur est déjà dans `wrangler.toml` et se met
   en place tout seul.

Ni le jeton ni l'id ne transitent jamais par Claude — ils se collent
directement dans Cloudflare.

## Notifications push (optionnelles)

En plus des notifications navigateur existantes dans l'app (Réglages →
Notifications, qui ont besoin que l'onglet soit ouvert), ce Worker peut
envoyer un résumé push une fois par jour — même app complètement fermée —
s'il y a vraiment quelque chose qui presse (badge en retard, devoir dans la
semaine, partiel dans les 2 semaines). Jamais de push s'il n'y a rien à
signaler. Chiffré de bout en bout (RFC 8291/8292, implémenté à la main avec
le seul Web Crypto natif — aucune dépendance).

Désactivé par défaut. Pour l'activer :

1. Dans Cloudflare (Worker → Settings → Variables) : ajouter `VAPID_PRIVATE_KEY_JWK`
   en **Secret** — la valeur (une paire de clés générée une seule fois pour
   ce projet) a été donnée directement dans la conversation au moment de la
   mise en place (jamais commitée dans le dépôt, volontairement).
2. Même déclencheur Cron que la sauvegarde (`0 3 * * *`) — déjà en place si
   tu as suivi l'étape de la sauvegarde automatique ; sinon, l'ajouter de la
   même façon (Worker → Triggers → Cron Triggers).
3. Dans l'app, Réglages → **Notifications push** → Activer (sur iPhone :
   d'abord ajouter le site à l'écran d'accueil via Partager → "Sur l'écran
   d'accueil" — Apple n'autorise le push que pour une PWA installée, pas un
   onglet Safari classique).

Si la clé privée doit être régénérée un jour (compromission, ou juste pour
repartir à zéro), une nouvelle paire peut être générée avec n'importe quel
outil ECDSA P-256 (ex. `openssl ecparam -genkey -name prime256v1`) — il
faudra alors aussi mettre à jour la clé publique correspondante dans
`mcp-server/src/webpush.js` et `src/logic/push.js` (ce n'est pas un secret,
elle peut être commitée).

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
