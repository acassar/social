# BACKLOG — Réseau social de groupe (franco-allemand)

Backlog d'implémentation destiné à des **agents autonomes**. Chaque tâche est
pensée pour être prise isolément : elle a un périmètre, ses dépendances, et des
critères d'acceptation vérifiables. Se lit avec `SPEC.md`.

Dépôt : `https://github.com/acassar/social` — **greenfield** (un seul commit, README vide).
Cible de déploiement : **VPS Infomaniak**, derrière le reverse proxy existant (TLS déjà en place).

---

## Conventions pour les agents (à respecter sur chaque tâche)

- **Une tâche = une branche = une PR.** Nommage : `feat/<id>-slug`, `chore/<id>-slug`, `fix/…`.
- **Definition of Done** : le code compile, le lint passe, les tests de la tâche passent, la PR décrit le périmètre et coche les critères d'acceptation.
- **Ne pas élargir le périmètre** d'une tâche : si un besoin adjacent apparaît, l'écrire en fin de fichier dans « Backlog différé » plutôt que de l'implémenter.
- **Types partagés d'abord** : tout DTO ou enum utilisé des deux côtés vit dans `packages/shared` et n'est jamais dupliqué.
- **Migrations** : jamais de modif de schéma en direct — toujours une migration versionnée (voir M0-T4).
- **Secrets** : rien en dur, tout via variables d'environnement (`.env` non commité, `.env.example` commité et tenu à jour).
- **Commits** : convention Conventional Commits (`feat:`, `fix:`, `chore:`…).

Légende des dépendances : `M2-T3` = milestone 2, tâche 3.

---

## Modèle de données de référence (cible)

Tables dédiées (pas de `payload` jsonb). Spine commune `posts` + tables de détail 1:1 là où il y a de la structure.

```
users(id, display_name, native_lang['fr'|'de'], avatar_url?, created_at)
groups(id, name, created_at)
memberships(id, group_id→groups, user_id→users, role['owner'|'member'], UNIQUE(group_id,user_id))
invites(id, group_id→groups, code UNIQUE, created_by→users, expires_at?, used_by?→users, created_at)
channels(id, group_id→groups, name, type['text'|'word_of_day'|'memes'], position, created_at)
posts(id, channel_id→channels, author_id→users, type, created_at, edited_at?, deleted_at?)
text_messages(post_id PK→posts, body)
word_entries(post_id PK→posts, term, lang['fr'|'de'], translation, note?)
attachments(id, post_id→posts, url, mime, width?, height?, thumb_url?)
reactions(id, post_id→posts, user_id→users, emoji, UNIQUE(post_id,user_id,emoji))
push_subscriptions(id, user_id→users, endpoint UNIQUE, p256dh, auth, created_at)
```

Un `post` de type `text` a exactement une ligne `text_messages`. Un `post` `word_of_day`
a exactement une ligne `word_entries`. Un `post` `memes` a une ligne `attachments` (l'image)
et éventuellement une légende (colonne `body` réutilisée via `text_messages`, ou champ dédié — à trancher en M5-T1).

---

## M0 — Scaffolding & socle technique

### M0-T1 — Initialiser le monorepo
- **Dépend de** : —
- **Périmètre** : mettre en place le monorepo (pnpm workspaces ; Rush optionnel si l'agent maîtrise). Créer `apps/api`, `apps/web`, `packages/shared`. Racine avec `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.editorconfig`, `README` mis à jour (setup local).
- **Acceptation** : `pnpm install` à la racine installe tout ; `packages/shared` est importable depuis `api` et `web`.

### M0-T2 — Outillage qualité
- **Dépend de** : M0-T1
- **Périmètre** : ESLint + Prettier partagés, config TypeScript de base (`tsconfig.base.json` étendu par chaque package). Scripts racine `lint`, `format`, `typecheck`, `build`, `test`. Vitest côté web, Jest (fourni par Nest) côté api.
- **Acceptation** : `pnpm lint` et `pnpm typecheck` passent sur un repo vide de logique.

### M0-T3 — Squelette NestJS (`apps/api`)
- **Dépend de** : M0-T1
- **Périmètre** : app NestJS minimale, `ConfigModule` (env typées), endpoint `GET /health` renvoyant `{ status: 'ok' }`, structure de modules vide prête à accueillir `auth`, `groups`, `channels`, `posts`, `reactions`, `realtime`.
- **Acceptation** : `pnpm --filter api start:dev` démarre ; `GET /health` répond 200.

### M0-T4 — Base de données & migrations
- **Dépend de** : M0-T3
- **Périmètre** : intégrer Postgres avec **Prisma** (ORM + migrations) — décision actée, s'y tenir. `schema.prisma` initial, `docker-compose.yml` avec un Postgres pour le dev local. Première migration : tables `users`, `groups`, `memberships`, `invites`. Seed script minimal (un group + un owner de dev).
- **Acceptation** : `docker compose up -d` lance Postgres ; la migration crée les tables ; le seed insère un group + owner.

### M0-T5 — Squelette Vue (`apps/web`)
- **Dépend de** : M0-T1
- **Périmètre** : app Vue 3 + Vite + TS + Vuetify. Router avec une page publique (login/join) et une page app protégée (vide). Client HTTP centralisé (axios/fetch wrapper) lisant l'URL d'API depuis l'env Vite.
- **Acceptation** : `pnpm --filter web dev` sert l'app ; navigation login ↔ app fonctionne.

---

## M1 — Auth, groups & invitations

### M1-T1 — Inscription par code d'invitation
- **Dépend de** : M0-T4
- **Périmètre** : `POST /auth/register` (code d'invitation + display_name + native_lang + mot de passe). Valide le code (`invites`), crée `users` + `memberships`, marque l'invite comme utilisée. Hash de mot de passe (argon2/bcrypt).
- **Acceptation** : un code valide crée un compte membre du bon group ; un code invalide/expiré/déjà utilisé est rejeté (400/409).

### M1-T2 — Login & JWT
- **Dépend de** : M1-T1
- **Périmètre** : `POST /auth/login` → access token (courte durée) + refresh token. `POST /auth/refresh`, `POST /auth/logout`. Guard JWT réutilisable + décorateur `@CurrentUser()`. `GET /me`.
- **Acceptation** : login renvoie les tokens ; une route protégée refuse sans token (401) et accepte avec ; le refresh régénère un access token.

### M1-T3 — Génération d'invitations (owner)
- **Dépend de** : M1-T2
- **Périmètre** : `POST /groups/:id/invites` réservé au rôle `owner` (guard de rôle) → crée un `invites.code`. `GET /groups/:id/invites` liste les invitations. Optionnel : `expires_at`.
- **Acceptation** : un owner génère un code ; un membre non-owner reçoit 403.

### M1-T4 — Écrans auth (front)
- **Dépend de** : M1-T2, M0-T5
- **Périmètre** : pages Login et « Rejoindre avec un code ». Store d'auth (Pinia) gérant tokens (stockage sécurisé), refresh automatique sur 401, garde de navigation. Profil minimal (display_name, langue) affiché quelque part.
- **Acceptation** : un utilisateur rejoint via code, se connecte, et atterrit sur l'app protégée ; le rafraîchissement de page conserve la session.

---

## M2 — Salons & socle temps réel

### M2-T1 — CRUD des salons
- **Dépend de** : M1-T2 ; migration `channels`
- **Périmètre** : migration `channels`. `GET /groups/:id/channels` (membres), `POST /groups/:id/channels` (owner : name, type, position), `PATCH`/`DELETE` (owner). Validation du `type` contre l'enum partagé.
- **Acceptation** : un owner crée des salons de chaque type ; un membre les liste ; un non-membre reçoit 403.

### M2-T2 — Gateway Socket.io + auth
- **Dépend de** : M1-T2
- **Périmètre** : gateway NestJS Socket.io. Handshake authentifié par JWT (guard socket). À la connexion, l'utilisateur rejoint une room par salon de ses groups (`channel:{id}`). Gestion propre déconnexion/reconnexion.
- **Acceptation** : un client fournissant un JWT valide se connecte et est joint aux bonnes rooms ; un JWT absent/invalide est rejeté.

### M2-T3 — Contrat d'événements temps réel
- **Dépend de** : M2-T2
- **Périmètre** : définir dans `packages/shared` les événements et leurs payloads : `post:created`, `post:updated`, `post:deleted`, `reaction:added`, `reaction:removed`, `presence:update`. Émetteur central côté serveur (service) que les modules appellent après écriture. **Aucune** logique métier dans le gateway au-delà du routage.
- **Acceptation** : les types d'événements sont partagés front/back ; un événement de test émis vers une room est reçu par les clients de cette room uniquement.

### M2-T4 — Shell applicatif façon Discord (front)
- **Dépend de** : M2-T1, M0-T5
- **Périmètre** : layout à colonnes — sidebar des salons (groupée par group, triée par `position`), zone de contenu principale, en-tête de salon. Connexion au socket au montage de l'app ; store temps réel (Pinia) qui applique les événements reçus. Design sobre inspiré Discord (thème sombre par défaut, densité d'info élevée).
- **Acceptation** : la sidebar liste les salons ; cliquer sur un salon ouvre sa vue (contenu vide OK) ; le socket est connecté et loggue les événements reçus.

---

## M3 — Salon texte (socle post + réactions)

### M3-T1 — Poster & lister des messages texte
- **Dépend de** : M2-T3 ; migrations `posts`, `text_messages`
- **Périmètre** : migrations `posts` + `text_messages`. `POST /channels/:id/posts` (type `text` : body) → crée `posts` + `text_messages`, émet `post:created`. `GET /channels/:id/posts` paginé (curseur sur `created_at`, ordre chronologique). `PATCH`/`DELETE` d'un post par son auteur (soft-delete via `deleted_at`, émission des événements).
- **Acceptation** : poster crée le message et le diffuse en direct aux autres clients du salon ; la pagination fonctionne ; seul l'auteur peut éditer/supprimer.

### M3-T2 — Réactions emoji
- **Dépend de** : M3-T1 ; migration `reactions`
- **Périmètre** : migration `reactions`. `POST /posts/:id/reactions` (emoji, idempotent via contrainte unique), `DELETE /posts/:id/reactions/:emoji`. Émission `reaction:added`/`removed`. Les compteurs de réactions sont dérivés (agrégat), pas stockés.
- **Acceptation** : réagir/retirer se répercute en direct ; une même réaction du même user n'est pas dupliquée.

### M3-T3 — Vue de salon texte (front)
- **Dépend de** : M3-T1, M2-T4
- **Périmètre** : liste de messages (chargement initial + application des événements socket sans refetch), champ de saisie, affichage auteur/heure, réactions cliquables avec compteurs. Défilement et chargement des messages plus anciens.
- **Acceptation** : conversation temps réel fonctionnelle entre deux navigateurs ; réactions live ; historique chargeable.

---

## M4 — Feature 1 : Mot du jour

### M4-T1 — API des entrées de mot
- **Dépend de** : M3-T1 ; migration `word_entries`
- **Périmètre** : migration `word_entries`. Extension de `POST /channels/:id/posts` pour le type `word_of_day` (term, lang, translation, note?) → crée `posts` + `word_entries`, émet `post:created`. Validation : `lang` ∈ {fr, de}, `term`/`translation` non vides. Réactions/édition héritées du socle M3.
- **Acceptation** : poster un mot crée l'entrée typée et la diffuse ; les champs invalides sont rejetés.

### M4-T2 — Rendu « carte de mot » (front)
- **Dépend de** : M4-T1, M2-T4
- **Périmètre** : rendu dédié pour un salon `word_of_day` : chaque post s'affiche en **carte** (terme en avant, traduction, note, langue, auteur, date) plutôt qu'en bulle de chat. Formulaire d'ajout adapté (terme / traduction / note). Réactions présentes.
- **Acceptation** : le salon mot-du-jour affiche des cartes ; ajouter un mot le fait apparaître en direct.

### M4-T3 — Glossaire (vue dérivée)
- **Dépend de** : M4-T1
- **Périmètre** : `GET /groups/:id/glossary` — agrégation des `word_entries` du group, filtrable par `lang`, recherche texte sur `term`/`translation`, tri par date, pagination. Écran front « Glossaire » : recherche + filtre langue + liste. Purement lecture, aucune nouvelle table.
- **Acceptation** : tous les mots postés sont consultables/recherchables/filtrables ; la recherche renvoie les bons résultats.

---

## M5 — Feature 2 : Partage de mèmes

### M5-T1 — Stockage & upload de fichiers
- **Dépend de** : M0-T4 ; migration `attachments`
- **Périmètre** : migration `attachments`. Stratégie de stockage : **dossier sur le VPS servi par le reverse proxy** (cohérent avec l'hébergement ; pas de dépendance externe). `POST /uploads` : multipart, validation MIME (`image/png|jpeg|gif|webp`) + taille max, écrit le fichier + génère une **miniature** (sharp) → renvoie `{ url, thumb_url, mime, width, height }`. Nommage non devinable (uuid). Servir les fichiers en statique via le proxy.
- **Acceptation** : uploader une image renvoie une URL servie correctement + une miniature ; un type non-image ou trop lourd est rejeté (400).

### M5-T2 — Posts de type mème
- **Dépend de** : M5-T1, M3-T1
- **Périmètre** : `POST /channels/:id/posts` pour le type `memes` : réutilise l'upload (M5-T1), crée `posts` + `attachments` + légende optionnelle, émet `post:created`. GIF animés : conserver l'original animé, miniature statique.
- **Acceptation** : poster un mème crée le post avec son image et le diffuse en direct ; la légende est optionnelle.

### M5-T3 — Galerie de mèmes (front)
- **Dépend de** : M5-T2, M2-T4
- **Périmètre** : rendu d'un salon `memes` en **galerie/grille** (miniatures, lightbox au clic pour l'original, légende, réactions). Composant d'upload avec aperçu avant envoi. Application des événements socket (nouveaux mèmes en direct).
- **Acceptation** : la grille affiche les mèmes ; l'upload avec aperçu fonctionne ; un nouveau mème apparaît en direct chez les autres.

---

## M6 — PWA & notifications (opt-in, non contraignantes)

### M6-T1 — PWA installable
- **Dépend de** : M2-T4
- **Périmètre** : manifest + icônes, service worker (app shell en cache, données en network-first), critères d'installabilité satisfaits. Bannière/prompt d'installation discret.
- **Acceptation** : l'app est installable (Lighthouse PWA au vert sur les critères de base) et consultable hors-ligne pour l'app shell.

### M6-T2 — Web Push (VAPID), opt-in par salon
- **Dépend de** : M6-T1, M2-T3 ; migration `push_subscriptions`
- **Périmètre** : génération de clés VAPID (env). `POST /push/subscribe` / `DELETE /push/subscribe` (stocke `push_subscriptions`). Envoi d'une notification quand un post est créé **dans un salon où l'utilisateur a activé les notifs** — jamais de relance « viens poster ». Réglage par salon côté front (opt-in explicite, désactivé par défaut).
- **Acceptation** : un utilisateur qui a opt-in reçoit une notif à la publication d'un post dans ce salon ; aucun envoi si non abonné ; désinscription fonctionnelle.

> Rappel produit : **aucune** mécanique de forcing. Les notifs sont un confort opt-in, jamais un levier de pression à publier.

---

## M7 — Déploiement VPS

### M7-T1 — Conteneurisation
- **Dépend de** : M3-T3 (socle fonctionnel minimal)
- **Périmètre** : `Dockerfile` pour `api` (build + run) et `web` (build statique). `docker-compose.prod.yml` : api + Postgres + volume de données + volume des uploads. Variables via `.env` de prod (documenté dans `.env.example`).
- **Acceptation** : `docker compose -f docker-compose.prod.yml up` lève une stack fonctionnelle en local avec les images de prod.

### M7-T2 — Intégration reverse proxy + TLS
- **Dépend de** : M7-T1
- **Périmètre** : documenter/configurer le vhost du reverse proxy existant : front statique, `/api` → NestJS, **WebSocket (upgrade) vers le gateway Socket.io**, et service des uploads. TLS via le mécanisme déjà en place. `README`/`docs/DEPLOY.md` décrivant la procédure de déploiement sur le VPS.
- **Acceptation** : en conditions VPS, l'app est jointe en HTTPS, l'API répond, le WebSocket s'établit (pas de coupure Socket.io), les images s'affichent.

### M7-T3 — CI (GitHub Actions)
- **Dépend de** : M0-T2
- **Périmètre** : workflow CI : install + lint + typecheck + tests + build sur chaque PR. Optionnel : build des images Docker sur merge en `main`.
- **Acceptation** : la CI tourne sur les PR et bloque le merge si lint/tests/build échouent.

---

## Backlog différé (post-MVP, à ne pas implémenter tout de suite)

- **Streak de groupe** du mot du jour (informatif, jamais punitif) — vue dérivée des `word_entries`.
- **Audio de prononciation** sur une entrée de mot (`attachments` audio) + lecteur.
- **Récap hebdo** des mots de la semaine.
- **Mode quiz** sur le vocabulaire du glossaire.
- **Présence** (`presence:update`) affichée dans la sidebar.
- **Threads/réponses** sur un post.
- **Multi-groupes** réellement exploité (aujourd'hui modélisé, un seul group en usage).
- **Rôles fins** au-delà de owner/member.
- **Lecture des réactions existantes d'un post** (`GET`) — seuls `POST`/`DELETE` existent (M3-T2) ; le front (M3-T3) n'affiche donc les compteurs qu'à partir des événements temps réel reçus pendant la session, pas de l'historique.
- **Pagination arrière** sur `GET /channels/:id/posts` (curseur "avant") — le curseur actuel (M3-T1) ne pagine qu'en avant (de la plus ancienne page vers le direct), impossible de remonter au-delà de la première page une fois tout l'historique chargé.
- **Annuaire des membres d'un group** (nom affiché) — en son absence, le front (M3-T3) n'affiche que « Toi » ou un identifiant court pour les auteurs des messages.

---

## Ordre de réalisation conseillé

`M0 → M1 → M2 → M3 → (M4 ∥ M5) → M6 → M7`

M4 (mot du jour) et M5 (mèmes) sont indépendants une fois le socle M3 en place :
ils peuvent être menés en parallèle par deux agents distincts. M7-T3 (CI) peut être
fait très tôt, dès la fin de M0.
