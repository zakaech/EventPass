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
- **Frontend** (`frontend/`, phase 2) : React + Vite, React Router, Context API, axios.

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

## Commandes (depuis `backend/`)
- `docker compose up -d` (racine) — PostgreSQL ; `npm run db:migrate` ; `npm run db:seed`
- `npm run dev` — API sur http://localhost:3000/api/v1
- `npm test` — Jest (recrée le schéma de `eventpass_test` puis lance les tests en série)
- `npm run lint`
- Collection de requêtes : `backend/requests/eventpass.http` (extension REST Client)
- Comptes de démo (mot de passe `Password123!`) : admin@, alice@, bob@, sonora@, atlas@,
  nouveau@ (organisateur en attente) — tous en `@eventpass.dev`

## Décisions prises
- Projet dans `C:\dev\EventPass` (hors OneDrive). Dépôt GitHub distant : pas encore configuré.
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
- Le statut `TERMINE` n'est pas encore attribué automatiquement ; les événements passés sont
  exclus de la liste publique par la condition `date_debut > now()`.
- `pg` : parseurs de type pour renvoyer BIGINT et NUMERIC en `Number`.

## Avancement
- [x] Phase 1 — MVP backend (42 tests verts, dont les tests de concurrence)
- [ ] Phase 2 — Frontend React
- [ ] Phase 3 — QR code et check-in
- [ ] Phase 4 — Tests, Docker, CI
- [ ] Phase 5 — Déploiement
