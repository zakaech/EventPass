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
- **Tests** : Jest + Supertest sur la base `eventpass_test`.
- **Frontend** (`frontend/`) : React 19 + Vite 8 (ES modules), React Router 8 (mode déclaratif
  `BrowserRouter`/`Routes`), Context API, axios. CSS Modules + variables CSS globales.
  Lint : oxlint (`npm run lint`). Polices auto-hébergées via `@fontsource-variable`.

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
- `docker compose up -d` (racine) — PostgreSQL
- `backend/` : `npm run db:migrate` ; `npm run db:seed` ; `npm run dev` (API sur
  http://localhost:3000/api/v1) ; `npm test` (Jest : recrée le schéma de `eventpass_test` puis
  lance les tests en série) ; `npm run lint`
- `frontend/` : `npm run dev` (http://localhost:5173) ; `npm run build` ; `npm run lint`
- Tests de bout en bout manuels : lancer l'API avec `LOGIN_RATE_LIMIT_MAX=1000`, sinon la limite
  de 10 connexions / 15 min par IP bloque les scénarios qui se reconnectent souvent.
- Collection de requêtes : `backend/requests/eventpass.http` (extension REST Client)
- Comptes de démo (mot de passe `Password123!`) : admin@, alice@, bob@, sonora@, atlas@,
  nouveau@ (organisateur en attente) — tous en `@eventpass.dev`

## Décisions prises
- Projet dans `C:\dev\EventPass` (hors OneDrive). Dépôt GitHub distant : pas encore configuré
  (CLI `gh` non installée). `EventPass_prompt_ClaudeCode.md` est ignoré par git.
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
  (Playwright + Edge, 23 étapes, desktop et mobile 390 px, 0 erreur console). Script de
  vérification non versionné (prévu : tests E2E en phase 4 si souhaité).
- [ ] Phase 3 — QR code et check-in
- [ ] Phase 4 — Tests, Docker, CI
- [ ] Phase 5 — Déploiement
