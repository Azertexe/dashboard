# Dashboard L3 Physique — Spécification complète

## Objectif
Site perso pour suivre l'avancement en L3 Physique (UGA) : état des chapitres, badges de révision TD/Cours, devoirs, countdown partiels. Accessible et synchronisé entre PC et téléphone.

## Cours suivis (7)
- Analyse de données
- Mathématiques pour la physique
- Optique cohérente
- Mécanique analytique
- Électromagnétisme
- Anglais
- Informatique

*(à confirmer avant de lancer Claude Code : bien 7, ou un 8e cours à ajouter ?)*

## Architecture technique
- **Front** : React (via Vite) — choisi pour faciliter la maintenance et l'évolution du site dans la durée avec Claude Code
- **Hébergement** : GitHub Pages — un seul repo contenant le site + les ressources (PDF/HTML). Nécessite un build step avant déploiement (`npm run build`, puis publication du dossier généré)
- **Données & sync** : Firebase Firestore (accessible PC + téléphone), règles de sécurité basiques (pas ouvertes en écriture à tout le monde), pas de mot de passe côté site (accès par URL discrète, non indexée)
- **Ajout progressif** : chapitres, devoirs et liens ajoutés au fil de l'année via l'interface — pas de contenu figé pré-rempli au départ

## Modèle de données — chapitre
Chaque chapitre appartient à un cours et possède :
- Un **ID interne stable**, indépendant du nom affiché (renommer ne doit jamais casser l'historique)
- Nom (éditable)
- Description (éditable)
- État : dropdown *Pas commencé / En cours / Compris mais fragile / Solide*
- Statut **Standby / Actif** (voir Partie 3)
- Badge **TD** : date de dernière action + niveau d'alerte
- Badge **Cours** : date de dernière action + niveau d'alerte (indépendant du badge TD)
- Commentaires perso (texte libre)

### Logique des badges (TD et Cours, indépendants)
- Clock démarrée à la date d'**activation** du chapitre (pas la date de création — voir Partie 3)
- Mise à jour uniquement au clic sur le badge correspondant
- 4 niveaux : neutre (jour 1) → jaune (24h) → orange (J+3) → rouge (J+7 sans révision)
- Après le rouge (J+7+) : le signal revient tous les 2 jours pour relancer l'alerte
- **Éditer le nom/description d'un chapitre ne touche jamais ces dates** — deux systèmes complètement séparés

## Design (3 thèmes)
- **Glacier** (défaut) : blanc / bleu clair
- **Volcanique** (mode révision) : noir / orange / rouge / jaune
- **Détente** : marron / vert — stub "en construction", pas fonctionnel pour l'instant
- Arrière-plan : photos personnelles
- Effet **liquid glass** sur les onglets : flou + opacité suffisante pour rester lisible par-dessus la photo
- *(Construit dans Claude Design en Partie 1, avant tout code fonctionnel — coller ici la direction artistique finale une fois validée : couleurs précises, intensité du flou, etc.)*

---

## Parties à traiter une par une avec Claude Code

**Ordre volontaire : le design (structure + style) se fait en premier, dans Claude Design — c'est là que se décide où vont les boutons, onglets, badges. Claude Code prend ensuite ce squelette déjà posé et y branche la vraie logique, partie par partie. Pas l'inverse : on évite que Claude Code invente un layout par défaut qu'il faudrait ensuite retoucher.**

### Partie 1 — Design complet dans Claude Design
- Construire toutes les vues avec des données factices (pas besoin de vraies données) : liste de chapitres par cours (dropdown état, 2 badges TD/Cours, commentaires), header (countdown + devoirs), mode édition, section ressources, boutons export/backup
- C'est ici que se décide le placement réel des boutons/badges/onglets — pas pendant le codage
- Les 3 thèmes (glacier / volcanique / détente-stub), l'effet liquid glass sur les onglets, le fond photo
- Vu qu'on est sur React, utiliser l'option **"Create using Claude Code"** dans Claude Design (étape "Add a design system") pour générer un vrai design system en composants React réutilisables
- Une fois validé : **Export → Handoff to Claude Code → Send to local coding agent**

### Partie 2 — Modèle de données des chapitres
- Remplacer les données factices par le vrai modèle (voir ci-dessus), stocké en local pour l'instant (avant Firebase)
- ID interne stable par chapitre, indépendant du nom affiché

### Partie 3 — Badges TD/Cours + standby/actif (vraie logique)
- Chapitre créé = **Standby** par défaut : préremplissage libre (nom, description, commentaires), aucun clock actif, aucune couleur affichée
- Bouton **Activer** : passe le chapitre en actif, démarre les clocks TD/Cours à partir de ce moment (transition à sens unique, pas de retour en standby)
- Vraie implémentation des 2 badges indépendants (TD, Cours) avec les 4 niveaux d'alerte + rappel tous les 2 jours après le rouge

### Partie 4 — Header (vraies données)
- Countdown jours avant le prochain partiel
- Liste des devoirs avec échéance affichée en J-X

### Partie 5 — Mode édition (vraie logique)
- Modifier nom/description des chapitres sans jamais toucher aux dates/clocks des badges (grâce aux IDs stables)
- Ajout de nouveaux chapitres/devoirs au fil de l'année

### Partie 6 — Ressources
- Par cours : liens vers polys/annexes (PDF + HTML)
- Fiche de révision (côté cours) et fiche méthode (côté TD), par matière
- Fichiers hébergés dans le même repo, servis via GitHub Pages

### Partie 7 — Sync Firebase
- Créer un projet Firebase (Firestore)
- Connecter le site à Firestore : lecture/écriture de l'état des chapitres, devoirs, etc.
- Règles de sécurité Firestore basiques (pas ouvertes en écriture à n'importe qui)
- Tester le sync entre PC et téléphone

### Partie 8 — Export & backup
- Export de l'état en **Markdown/texte lisible** (à coller dans un chat IA pour générer des exercices ciblés sur les points fragiles)
- Export **JSON** téléchargeable en un clic, utilisable aussi comme sauvegarde/restauration
