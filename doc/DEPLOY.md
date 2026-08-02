# DEPLOY — VPS Infomaniak (M7-T2)

Procédure de déploiement de la stack de prod (`docker-compose.prod.yml`,
M7-T1) derrière le reverse proxy existant du VPS (TLS déjà en place — voir
`SPEC.md` §2/§9). Périmètre de cette page : câblage du proxy vers les
conteneurs, TLS, WebSocket, uploads. Le build/run des conteneurs eux-mêmes
est documenté dans le README (« Conteneurisation »).

## 1. Choix retenu : deux sous-domaines

Le front et l'API sont exposés sous deux hôtes distincts derrière le même
reverse proxy :

- `social.example.com` → conteneur `web` (front statique, port `WEB_PORT`)
- `api.social.example.com` → conteneur `api` (REST + Socket.io + `/uploads`,
  port `API_PORT`)

Ce n'est pas un détail cosmétique : le front est déjà écrit pour un
cross-origin (`CORS_ORIGINS` côté API, `VITE_API_URL` côté front — voir
`apps/api/src/main.ts` et `apps/web/src/lib/http.ts`), et les URLs
d'attachments renvoyées par l'API sont préfixées côté front avec
`VITE_API_URL` (`apps/web/src/components/MemeChannelView.vue`, `assetUrl()`)
plutôt qu'utilisées telles quelles. Un découpage par sous-domaine élimine
tout risque de collision entre les routes de l'API (`/auth`, `/me`,
`/uploads`, …) et les routes du SPA côté front, sans configuration de proxy
supplémentaire. Une alternative par chemin (`/api` sur un domaine unique)
est possible mais demanderait de réécrire les routes API sous un préfixe
commun — hors périmètre ici, non retenue.

## 2. Prérequis

- Reverse proxy existant sur le VPS, TLS déjà en place pour le domaine
  utilisé (certificats gérés par le mécanisme déjà en service, ex. certbot —
  non re-décrit ici).
- Deux entrées DNS pointant vers le VPS : le domaine du front et le
  sous-domaine `api.`.
- Docker + Docker Compose sur le VPS (pour lancer `docker-compose.prod.yml`).

## 3. Déployer la stack applicative

```
cp .env.example .env   # remplir : secrets, domaines, UPLOADS_HOST_DIR
docker compose -f docker-compose.prod.yml up --build -d
```

Voir le README (« Conteneurisation ») pour le détail des services
(`postgres`, `api`, `web`) et des migrations Prisma appliquées
automatiquement au démarrage de `api`.

Deux variables de `.env` sont spécifiques au routage par le reverse proxy
(voir `.env.example`) :

- `UPLOADS_HOST_DIR` : chemin **absolu** sur l'hôte (ex. `/srv/social/uploads`)
  monté en bind mount dans le conteneur `api`. Le reverse proxy doit servir
  ce même chemin directement sous `/uploads` (§5) — un chemin relatif rend
  le vhost du proxy dépendant du répertoire courant de `docker compose`, à
  éviter en prod.
- `VITE_API_URL` : URL publique de l'API (`https://api.social.example.com`),
  figée dans le bundle du front **au moment du build de l'image `web`**
  (Vite ne lit pas l'environnement à l'exécution du conteneur). Changer ce
  domaine après coup impose de reconstruire l'image (`docker compose -f
  docker-compose.prod.yml up --build -d web`), pas juste de relancer le
  conteneur.

## 4. Configurer le reverse proxy

Exemples de vhost nginx dans `deploy/nginx/` :

- `social-web.conf.example` — domaine front, `proxy_pass` vers `web`
  (`127.0.0.1:${WEB_PORT}`).
- `social-api.conf.example` — sous-domaine API, `proxy_pass` vers `api`
  (`127.0.0.1:${API_PORT}`), avec le upgrade WebSocket (§6) et le service
  direct des uploads (§5).

Adapter domaines, chemins de certificats et `UPLOADS_HOST_DIR` réel avant de
déposer ces fichiers dans la conf du reverse proxy existant du VPS (le nom
exact du répertoire dépend de ce qui est déjà en place — ex.
`sites-available`/`sites-enabled`), puis recharger le proxy.

> Le reverse proxy réellement en place sur le VPS peut ne pas être nginx —
> ces fichiers sont fournis comme référence du câblage attendu
> (domaine → conteneur, upgrade WS, uploads en direct) ; à traduire dans la
> syntaxe du proxy effectivement utilisé si ce n'est pas nginx.

## 5. Uploads servis en direct par le proxy

`apps/api` sait aussi servir `/uploads` lui-même (utile en dev, voir
`apps/api/src/main.ts`), mais en prod le reverse proxy sert ce dossier
**directement depuis le disque** (`UPLOADS_HOST_DIR`), sans repasser par
Node — c'est la convention actée depuis M5-T1 (`apps/api/.env.example`).
Le `location /uploads/` de `social-api.conf.example` pointe donc en `alias`
vers `UPLOADS_HOST_DIR`, pas en `proxy_pass` vers le conteneur `api`.

## 6. WebSocket (Socket.io)

La gateway Socket.io (M2-T2) négocie sur `/socket.io/` avant de basculer en
WebSocket. Le `location /socket.io/` dédié dans `social-api.conf.example`
fixe les en-têtes `Upgrade`/`Connection: upgrade` et un `proxy_read_timeout`
plus long que le défaut nginx (60s), pour ne pas couper une connexion WS
restée idle entre deux événements.

## 7. Vérification post-déploiement

- `https://social.example.com` charge l'app (front servi en HTTPS).
- `https://api.social.example.com/health` répond `{ "status": "ok" }`.
- Se connecter puis observer dans la console navigateur que le socket
  passe en `readyState: open` (pas de reconnexion en boucle) — confirme que
  l'upgrade WebSocket traverse le proxy.
- Poster un mème et vérifier que l'image s'affiche (uploads servis par le
  proxy) et que le post apparaît en direct sur un second onglet/navigateur
  (WebSocket fonctionnel de bout en bout).

## Limite connue de cette tâche

Cette procédure n'a pas pu être exécutée sur un vrai VPS ni contre un vrai
reverse proxy dans cet environnement d'agent (pas d'accès à une machine
avec TLS/DNS réels, ni au reverse proxy existant du VPS visé). Le câblage
ci-dessus (domaines séparés, upgrade WS, uploads en direct) est déduit du
code réellement en place (CORS, `assetUrl`, `UPLOADS_DIR`, gateway
Socket.io) et validé par relecture, pas par un déploiement de bout en bout.
À confirmer en conditions réelles avant mise en prod.
