# EventPass — contexte pour Claude Code

## Contexte
Plateforme de billetterie d'événements, projet de portfolio d'un étudiant en dernière année
d'informatique (candidatures PFE). L'étudiant doit pouvoir **expliquer chaque partie du code
en entretien** : l'apprentissage compte autant que le résultat.

Le cahier des charges complet est dans `EventPass_prompt_ClaudeCode.md`.

## Mode de travail
- Travail **phase par phase** : plan court → validation → code → résumé + explications + commandes
  de test → **attendre la validation** avant la phase suivante.
- Expliquer brièvement (3–5 lignes) chaque concept nouveau la première fois qu'il apparaît.
- Commits petits, format Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
- Une phase n'est terminée que si elle démarre et que ses tests passent.
- Aucun secret dans le code : variables d'environnement + `.env.example`.
- **JavaScript uniquement** (pas de TypeScript). Commentaires et messages en français.

## Stack
- **Backend** (`backend/`) : Node.js + Express 5, API REST sous `/api/v1`, **CommonJS**
  (pour que `jest.mock` fonctionne sans configuration ESM expérimentale).
- **BDD** : PostgreSQL 18 (docker-compose, port hôte **5433**), `pg` avec **SQL écrit à la main,
  toujours paramétré** (pas d'ORM). Migrations SQL versionnées avec `node-pg-migrate`.
  Une seule instance avec deux bases : `eventpass` (dev) et `eventpass_test` (tests).
- **Auth** : JWT (en-tête `Authorization: Bearer`, durée configurable `JWT_EXPIRES_IN`) + bcrypt.
- **Validation** : zod. **Sécurité** : helmet, CORS, express-rate-limit sur le login.
- **Tests** : Jest en deux projets — `tests/unit/` (services isolés, `jest.mock` des
  repositories et de `config/db`, pas de base) et `tests/integration/` (Supertest sur la base
  `eventpass_test`, `globalSetup` qui recrée le schéma). Seuils de couverture dans
  `jest.config.js` (90 % lignes/fonctions/instructions, 80 % branches) : la CI échoue en dessous.
  Bout en bout : Playwright dans `e2e/` (voir `e2e/README.md`).
- **Docker** : `backend/Dockerfile` et `frontend/Dockerfile` multi-étapes, utilisateurs non-root
  (`node`, Nginx « unprivileged » sur le port 8080). Le conteneur backend lance
  `scripts/docker-entrypoint.sh` : secrets aléatoires si `GENERATE_DEV_SECRETS=true` et absents,
  migrations, `seed.js --if-empty` si `SEED_DEMO=true`, puis `exec node src/server.js`.
  `frontend/nginx.conf` : `try_files … /index.html` (SPA) et proxy `/api/` → `backend:3000`.
- **CI** : `.github/workflows/ci.yml` — jobs backend (service PostgreSQL, secrets aléatoires,
  lint, `test:coverage`, résumé + artefact), frontend (lint, build), docker (compose up --wait +
  curl), e2e (après backend et frontend : pile Docker + Playwright Chromium, captures en artefact).
- **Frontend** (`frontend/`) : React 19 + Vite 8 (ES modules), React Router 8 (mode déclaratif
  `BrowserRouter`/`Routes`), Context API, axios. CSS Modules + variables CSS globales.
  Lint : oxlint (`npm run lint`). Polices auto-hébergées via `@fontsource-variable`.
  QR : `qrcode` (génération), `html5-qrcode` (scan caméra, page chargée en `lazy()`).
- **Dépôt** : https://github.com/zakaech/EventPass (branche `main`).

## QR code et check-in (phase 3)
- Jeton du QR : `EP1.<uuid du billet>.<HMAC-SHA256(QR_SECRET, "qr:"+uuid) en base64url>`,
  calculé à la volée dans `GET /me/tickets` (champ `qr_token`, null si le billet n'est pas
  VALIDE), jamais stocké. Code de secours : `XXXX-XXXX-XXXX-XXXX` = 8 premiers caractères de
  l'uuid + 8 caractères hex de `HMAC("secours:"+uuid)` (champ `code_secours`).
  Tout est dans `backend/src/utils/qrToken.js` (comparaisons en temps constant).
- `QR_SECRET` obligatoire, ≥ 32 caractères, **différent** de `JWT_SECRET` (vérifié au démarrage).
- `POST /organisateur/checkin { event_id, token }` (token = QR ou code de secours). Signature
  vérifiée AVANT toute requête SQL, puis UN seul `UPDATE … WHERE statut = 'VALIDE' AND
  event_id = $2 AND e.organisateur_id = $3 AND e.statut = 'PUBLIE' AND now() BETWEEN
  date_debut - CHECKIN_OPENS_HOURS_BEFORE AND date_debut + CHECKIN_WINDOW_HOURS`. Si 0 ligne :
  relecture pour le message. Codes d'erreur : `QR_INVALIDE` (400), `DEJA_UTILISE` (409,
  `details.checked_in_at`), `BILLET_ANNULE`, `AUTRE_EVENEMENT` (titre en `details` seulement si
  même organisateur), `EVENEMENT_ANNULE`, `CHECKIN_PAS_ENCORE_OUVERT` (`details.ouverture`),
  `CHECKIN_FERME` (409), 403/404 si l'événement n'est pas à l'organisateur.
- Le check-in utilise le statut **stocké** (`PUBLIE`), pas le statut calculé : un événement est
  `TERMINE` dès `date_debut` mais reste contrôlable de `date_debut − 6 h` à `date_debut + 12 h`
  (`CHECKIN_OPENS_HOURS_BEFORE`, `CHECKIN_WINDOW_HOURS`). `eventService.checkinWindow` /
  `isCheckinOpen` ajoutent `checkin_ouvert`, `checkin_ouverture`, `checkin_fermeture` aux
  événements de l'organisateur. Le scanner ne propose que les événements ouverts.
- Tests de concurrence du check-in : passer par le **service** (Promise.allSettled), car via HTTP
  les middlewares étalent les requêtes et un check-in non atomique passerait quand même.
- Test caméra sur téléphone : `npm run dev:phone` (HTTPS auto-signé + `--host`), API relayée par
  le proxy Vite (`/api` → `localhost:3000`) pour éviter le contenu mixte.

## Conventions frontend
- `pages/` (une page par route, sous-dossiers `organisateur/` et `admin/`), `components/`
  (réutilisables, styles des petits composants dans `ui.module.css`), `services/` (appels API,
  un fichier par domaine, tous via l'instance `api` de `services/api.js`), `context/`, `hooks/`,
  `utils/` (format Intl fr-FR, erreurs API, règles d'affichage).
- Un fichier `.jsx` n'exporte que des composants (sinon le rechargement à chaud casse) :
  constantes et fonctions dans `utils/`, contexte dans `context/authContext.js`.
- Chargement de données : hook `useAsync(fn, deps)` → `{ data, loading, error, reload, setData }`.
- Erreurs API affichées via `getErrorMessage(err)` ; erreurs par champ via `getFieldErrors(err)`
  + `<FormField error>`.
- API appelée en relatif (`/api/v1`) : en dev, le proxy Vite relaie vers `localhost:3000` ;
  en production, `VITE_API_URL` donne l'URL absolue.
- JWT dans `localStorage` (`services/tokenStorage.js`), ajouté par l'intercepteur de requête.
  Intercepteur de réponse : sur 401 (hors `/auth/login`), il appelle le handler enregistré par
  `AuthProvider` → `endSession()` : vide le jeton, `setUser(null)` **et** `navigate()` dans un
  même `startTransition` (sinon `<ProtectedRoute>` redirige avant et écrase la navigation).
- Effets React : toujours un corps `{ }` (ne rien renvoyer d'autre qu'une fonction de nettoyage).
- Filtres de la liste d'événements stockés dans l'URL (`useSearchParams`).

## Direction visuelle — « billet imprimé »
- Fond papier crème `--paper #f7f3ea`, encre bleu nuit `--ink #16182d`, accent vermillon
  `--accent #c93c1a` (texte blanc lisible ; `--accent-bright #f2542d` décoratif uniquement).
- Titres **Bricolage Grotesque** (700–800, interlettrage serré), texte **Inter**.
- Signature : cartes en forme de billet (encoches latérales en `mask` radial + perforation en
  pointillés, ombre `drop-shadow` qui suit la découpe) ; « tampon » de date incliné sur un aplat
  de la couleur de la catégorie (`--cat-*`) quand il n'y a pas d'image.
- Boutons en pilule, rayons 8/14/22 px, badges de statut uniques (`StatusBadge`).
- Toutes les valeurs sont des variables dans `src/styles/global.css`. Thème clair uniquement
  (pas de mode sombre prévu pour l'instant). Responsive : gouttière 16 px sous 640 px, menu
  burger sous 860 px, aucune page ne doit défiler horizontalement à 390 px.

## Conventions backend
- Couches : `routes` → `controllers` (HTTP) → `services` (métier, transactions) →
  `repositories` (SQL). Plus `middlewares`, `validators`, `utils`, `config`.
- Les repositories reçoivent un `client` optionnel pour participer à une transaction
  (`withTransaction` dans `src/config/db.js`).
- Erreurs : lever une sous-classe d'`AppError` (`utils/errors.js`) ; le middleware `errorHandler`
  renvoie `{ error: { code, message, details? } }`.
- Listes paginées : `{ data, pagination: { page, limit, total, totalPages } }`.
- Réservation anti-survente : `UPDATE` conditionnel sur `places_restantes` **puis** comptage
  du quota utilisateur (max 4 billets valides par utilisateur et par événement) dans la même
  transaction.

## Commandes
- `docker compose up --build` (racine) — toute la pile sur http://localhost:8080 ;
  `docker compose up -d db` — PostgreSQL seul pour le développement (`npm run dev`)
- `backend/` : `npm run db:migrate` ; `npm run db:seed` ; `npm run dev` (API sur
  http://localhost:3000/api/v1) ; `npm test` (tout) ; `npm run test:unit` (sans base) ;
  `npm run test:integration` ; `npm run test:coverage` ; `npm run lint`
- `frontend/` : `npm run dev` (http://localhost:5173) ; `npm run dev:phone` (HTTPS, réseau
  local, pour tester la caméra sur téléphone) ; `npm run build` ; `npm run lint`
- `e2e/` : `npm test` — après `npm run db:seed`, API lancée avec `LOGIN_RATE_LIMIT_MAX=1000`
  (sinon la limite de 10 connexions / 15 min par IP bloque le scénario) et frontend démarré.
- Mutations temporaires du code pour éprouver un test : toujours sur une **copie de
  sauvegarde** restaurée ensuite, jamais via `git checkout` (efface le travail non commité).
- Collection de requêtes : `backend/requests/eventpass.http` (extension REST Client)
- Comptes de démo (mot de passe `Password123!`) : admin@, alice@, bob@, sonora@, atlas@,
  nouveau@ (organisateur en attente) — tous en `@eventpass.dev`

## Décisions prises
- Projet dans `C:\dev\EventPass` (hors OneDrive). Remote `origin` = GitHub (push par HTTPS,
  CLI `gh` non installée ; API GitHub appelée avec l'identifiant enregistré par Git, sans
  jamais l'afficher). **Dépôt privé** à ce jour : le badge CI ne s'affiche qu'aux membres.
  `EventPass_prompt_ClaudeCode.md` est ignoré par git.
- `TRUST_PROXY` = nombre de proxys devant l'API (1 derrière Nginx ou Render) : sans lui, la
  limite de connexions verrait une seule IP (celle du proxy).
- Seed : `npm run db:seed` vide la base (refusé en production) ; `--if-empty` n'insère que si
  aucun compte n'existe (seul mode autorisé en production, utilisé par Docker).
- Captures d'écran pour le README : `docs/screenshots/` (desktop `NN-*.png`, mobile `m-NN-*.png`),
  régénérées par le scénario e2e puis recopiées.
- Quota : 4 billets max **au total** par utilisateur et par événement (VALIDE + UTILISE).
- Index composite `tickets (event_id, user_id)` (pas d'index `tickets (event_id)` seul).
- Filtre ville insensible à la casse (`lower(ville)`, index sur l'expression) ; filtres
  `prix_min` / `prix_max` / `date_min` / `date_max` / `categorie`.
- `categorie` est un ENUM PostgreSQL : CONCERT, THEATRE, SPORT, CONFERENCE, FESTIVAL,
  EXPOSITION, AUTRE.
- JWT envoyé dans l'en-tête `Authorization` (stocké côté frontend), pas en cookie httpOnly :
  frontend (Vercel) et API (Render) sur des domaines différents.
- Statut de validation de l'organisateur relu en base à chaque requête (pas dans le JWT).
- `PUT /organisateur/events/:id` = remplacement complet ; recalcule `places_restantes`
  sous `SELECT ... FOR UPDATE` ; refuse une capacité < billets vendus.
- Statut `TERMINE` **calculé à la lecture** (`CASE WHEN statut = 'PUBLIE' AND date_debut <= now()`),
  centralisé dans `src/repositories/eventColumns.js` : toute requête qui renvoie un événement
  doit utiliser `eventColumns()` / `statutSql()`, jamais `SELECT *`. En base, la colonne reste
  `PUBLIE`. Un événement terminé ne peut être ni réservé (`EVENEMENT_PASSE`) ni modifié.
- `pg` : parseurs de type pour renvoyer BIGINT et NUMERIC en `Number`.

## Avancement
- [x] Phase 1 — MVP backend (45 tests verts, dont les tests de concurrence) — revérifiée
  depuis une base vide (down -v → migrate → seed → tests → lint → collection .http complète)
- [x] Phase 2 — Frontend React — parcours des 3 rôles vérifiés dans un navigateur réel
  (Playwright + Edge, desktop et mobile 390 px, 0 erreur console). Script versionné dans `e2e/`.
- [x] Phase 3 — QR code et check-in — 73 tests Jest (dont 18 check-in, 10 signature) ; scénario
  e2e de 31 étapes, dont un scan réel par caméra simulée sur téléphone (valide puis déjà
  utilisé) et saisie manuelle (secours, falsifié, autre événement/organisateur, annulé).
- [x] Phase 4 — Tests, Docker, CI — 131 tests Jest (≈ 60 unitaires avec `jest.mock`, ≈ 70
  d'intégration), couverture ≈ 97 % des lignes ; `docker compose up` vérifié depuis une base
  vide ; e2e vert deux fois de suite contre la pile Docker ; CI verte sur `main` ; CI rouge
  prouvée sur une PR de démonstration (fermée, branche supprimée) ; README complet.
- [ ] Phase 5 — Déploiement
