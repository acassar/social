# SPEC — Réseau social de groupe (franco-allemand)

> Petit réseau social privé pour garder le lien avec un groupe d'amis franco-allemand.
> Inspiration **Discord** : salons, temps réel, PWA légère. Pas de mécanique de contrainte —
> on poste quand on veut, ou pas.

---

## 1. Vision & principes

- **Privé et à taille humaine.** Un seul groupe fermé au départ, accès sur invitation. Pas d'annuaire public, pas de découverte, pas d'algo.
- **Liberté de publication.** Aucune notification qui force à poster, aucun blocage « poste pour voir les autres ». On consulte et on contribue librement. La rétention vient du plaisir, pas de la pression.
- **Organisé en salons (façon Discord).** Le contenu vit dans des salons thématiques, pas dans un feed unique. Chaque salon a un *type* qui conditionne son rendu et le format des messages.
- **Extensible par design.** Un salon = un type. Ajouter une feature = ajouter un type de salon + son rendu, sans toucher au socle (auth, temps réel, réactions, membres).
- **Bilingue par nature.** L'app assume le mélange FR/DE : le « mot du jour » est la première brique de ça.

---

## 2. Stack

| Couche | Techno |
|---|---|
| Front | Vue 3 + Vite + TypeScript, Vuetify |
| PWA | Service worker + Web App Manifest (installable, offline-friendly) |
| Back | NestJS |
| Temps réel | Socket.io (gateway NestJS) |
| Base de données | PostgreSQL |
| ORM & migrations | Prisma |
| Auth | JWT + codes d'invitation |
| Hébergement | VPS Infomaniak, derrière le reverse proxy existant (TLS déjà en place) |

---

## 3. Modèle « à la Discord »

L'ossature reprend les concepts Discord, volontairement simplifiés :

- **Group** (≈ *server/guild*) — le cercle d'amis. Une seule instance au début ; le modèle reste multi-groupe pour ne pas se fermer de porte.
- **Channel / salon** — appartient à un group, porte un `type` qui décide du format des messages et de leur rendu.
- **Membership** — lien user ↔ group, avec un rôle (`owner` / `member`).
- **Message / post** — appartient à un salon, porte lui aussi un `type` (aligné sur celui du salon). Le contenu structuré vit dans une table de détail dédiée selon le type (voir §4).
- **Reaction** — emoji sur un message (façon Discord).

Types de salons prévus :

| Type de salon | Contenu | Statut |
|---|---|---|
| `text` | messages texte libres | socle |
| `word_of_day` | mot du jour (terme + traduction + note) | Feature 1 |
| `memes` | images/gifs partagés | Feature 2 |

---

## 4. Modèle de données

Postgres. Les identifiants sont des `uuid`. Format compact ci-dessous ; à affiner en migrations.

```
users
  id            uuid pk
  display_name  text
  native_lang   text        -- 'fr' | 'de'
  avatar_url    text null
  created_at    timestamptz

groups
  id            uuid pk
  name          text
  created_at    timestamptz

memberships
  id            uuid pk
  group_id      uuid fk -> groups
  user_id       uuid fk -> users
  role          text        -- 'owner' | 'member'
  UNIQUE (group_id, user_id)

channels
  id            uuid pk
  group_id      uuid fk -> groups
  name          text        -- ex. 'mot-du-jour', 'memes', 'general'
  type          text        -- 'text' | 'word_of_day' | 'memes'
  position      int         -- ordre d'affichage dans la sidebar
  created_at    timestamptz

posts                        -- colonne vertébrale commune à tous les types
  id            uuid pk
  channel_id    uuid fk -> channels
  author_id     uuid fk -> users
  type          text        -- reprend le type du salon
  created_at    timestamptz
  edited_at     timestamptz null
  deleted_at    timestamptz null   -- soft-delete

text_messages                -- détail 1:1 pour type 'text'
  post_id       uuid pk fk -> posts
  body          text

word_entries                 -- détail 1:1 pour type 'word_of_day'
  post_id       uuid pk fk -> posts
  term          text
  lang          text        -- 'fr' | 'de'
  translation   text
  note          text null

reactions
  id            uuid pk
  post_id       uuid fk -> posts
  user_id       uuid fk -> users
  emoji         text
  UNIQUE (post_id, user_id, emoji)

attachments                  -- fichiers : mèmes, audio plus tard
  id            uuid pk
  post_id       uuid fk -> posts
  url           text
  thumb_url     text null
  mime          text
  width         int null
  height        int null

invites
  id            uuid pk
  group_id      uuid fk -> groups
  code          text UNIQUE
  created_by    uuid fk -> users
  expires_at    timestamptz null
  used_by       uuid null fk -> users
```

**Choix : tables de détail dédiées (pas de `payload` jsonb).** `posts` porte les champs
communs à tous les types (auteur, salon, dates) ; le contenu spécifique vit dans une table
1:1 par type qui en a besoin. On y gagne de vraies contraintes, des FK, des index et des
requêtes triviales pour le glossaire — au prix d'une petite table + jointure par type structuré.

- `type = 'text'` → une ligne `text_messages` (le `body`).
- `type = 'word_of_day'` → une ligne `word_entries` (term / lang / translation / note).
- `type = 'memes'` → une ligne `attachments` (l'image) + légende optionnelle (réutilise `text_messages`).

Le **glossaire** et les **stats/streaks** n'ont pas de table propre : ce sont des vues/requêtes
dérivées de `word_entries`.

---

## 5. Feature 1 — Mot du jour

Un salon de type `word_of_day`. Chacun peut y déposer, quand il veut, un mot **dans sa langue** :

- **terme** (le mot)
- **traduction** dans l'autre langue
- **note** libre : pourquoi ce mot, contexte, anecdote → c'est ce qui rend l'objet vivant plutôt qu'un simple dico

Rendu dédié : une carte par mot plutôt qu'une bulle de chat, avec réactions. Comme FR et DE partagent le même fuseau, aucun casse-tête de timezone.

Extensions naturelles (post-MVP, gratuites sur ce socle) :
- **Glossaire** : vue agrégée de tous les mots postés, filtrable par langue, recherchable.
- **Audio de prononciation** : un `attachment` audio sur le post (un·e Allemand·e qui prononce un mot français = déjà un contenu en soi).
- **Streak** de groupe (nb de jours consécutifs avec au moins un mot) — informatif, jamais punitif, cohérent avec le principe « zéro forcing ».
- **Récap hebdo** des mots de la semaine.
- **Quiz** plus tard sur le vocabulaire accumulé.

---

## 6. Feature 2 — Partage de mèmes

Un salon de type `memes`. Upload d'image/gif + légende optionnelle, réactions emoji, rendu en galerie ou en flux d'images (au choix, plutôt galerie facile à scanner).

Points d'attention :
- **Upload** : endpoint NestJS qui valide type MIME + taille max, stocke sur le VPS (ou dossier servi par le reverse proxy), écrit dans `attachments`.
- **Aperçus** : générer une miniature à l'upload (sharp) pour ne pas charger les originaux dans la galerie.
- **GIF animés** : garder l'original pour l'animation, miniature statique pour la grille.
- Rien de neuf côté data : c'est un `post` type `memes` + un `attachment`. Le socle réactions/temps réel fonctionne tel quel.

---

## 7. Temps réel (Socket.io)

- **Une room Socket par salon** (`channel:{id}`). L'utilisateur rejoint les rooms des salons de ses groupes.
- Événements émis serveur → clients :
  - `post:created` (nouveau message, quel que soit le type)
  - `post:updated` / `post:deleted`
  - `reaction:added` / `reaction:removed`
  - `presence:update` (qui est en ligne — optionnel)
- Le REST NestJS gère le CRUD ; le gateway diffuse les changements en direct. Un post créé via REST déclenche l'émission Socket vers la room concernée.
- Auth du socket : le JWT est passé à la connexion et validé par un guard côté gateway.

---

## 8. PWA

- **Manifest** + icônes → installable sur mobile/desktop.
- **Service worker** : cache de l'app shell (offline-friendly pour la consultation), stratégie network-first pour les données.
- **Web Push (VAPID)** — *optionnel et non contraignant*, dans l'esprit « liberté » : notifications opt-in par salon (ex. « quelqu'un a posté un mème »), jamais de relance forcée à publier. À traiter comme un plus, pas comme le cœur du produit.

---

## 9. Auth & accès

- **Invitation only.** L'`owner` génère un `invite.code`. Le nouvel arrivant s'inscrit avec ce code → création du user + membership dans le group.
- **JWT** (access + refresh) pour les sessions. Vu la taille du groupe (confiance élevée), pas besoin d'usine à gaz.
- Rôles minimalistes : `owner` (gère salons + invitations), `member` (poste, réagit).

---

## 10. Périmètre du MVP

Objectif : la plus petite version qui donne envie d'y revenir.

- [ ] Auth par code d'invitation + JWT
- [ ] Un group, sidebar de salons façon Discord
- [ ] Salon `text` fonctionnel (poster / lire / réactions) en temps réel
- [ ] Salon `word_of_day` avec son rendu en cartes
- [ ] Salon `memes` avec upload + galerie
- [ ] PWA installable
- [ ] Push opt-in (peut arriver juste après le MVP)

Le glossaire, les streaks, l'audio et le quiz viennent ensuite : ils ne sont que des vues/ajouts sur le socle déjà en place.

---

## 11. Pistes d'arborescence du dépôt

```
/apps
  /api        # NestJS (REST + Socket.io gateway)
  /web        # Vue 3 + Vite + Vuetify (PWA)
/packages
  /shared     # types TS partagés (DTO, enums de type de salon/post)
/docs
  SPEC.md     # ce fichier
```

> Un monorepo (pnpm / Rush) permet de partager les types entre `api` et `web` — notamment les enums de `channel.type` / `post.type` et les DTO, pour que le contrat front/back reste synchronisé.
