# Tests de bout en bout (Playwright)

`parcours.mjs` pilote un vrai navigateur et rejoue les parcours des trois rôles :
visiteur, spectateur (inscription, réservation, annulation), organisateur (inscription,
création/modification/annulation d'événement, check-in) et admin (validation des comptes).
Il vérifie aussi l'intercepteur 401 et l'absence de défilement horizontal sur mobile (390 px).
Les captures d'écran sont écrites dans `e2e/screenshots/` (non versionné) ; les plus utiles
sont recopiées à la main dans `docs/screenshots/`.

**Check-in avec une vraie caméra (simulée).** Pour le scan, le script lance un second
navigateur au format téléphone dont la webcam est remplacée par une vidéo : `lib/fakeCamera.mjs`
fabrique un fichier `.y4m` qui montre le QR code d'un vrai billet, et Chromium le diffuse
comme flux de caméra (`--use-file-for-fake-video-capture`). Le décodage du QR, l'appel à l'API
et l'affichage du résultat sont donc testés de bout en bout.

Le scénario s'appuie sur les données de démo : **relancer `npm run db:seed` avant chaque
exécution** (il réserve, annule et scanne des billets).

## Lancer contre la pile Docker (le plus simple, comme la CI)

```bash
docker compose down -v                                   # base vide → données de démo fraîches
LOGIN_RATE_LIMIT_MAX=1000 docker compose up -d --build --wait
cd e2e && npm install
E2E_BASE_URL=http://localhost:8080 npm test
```

Sous PowerShell : `$env:LOGIN_RATE_LIMIT_MAX=1000` puis `$env:E2E_BASE_URL="http://localhost:8080"`.

## Lancer en mode développement

Trois terminaux, depuis la racine du dépôt :

```bash
# 1. Base de données fraîche avec les données de démo (le script en dépend)
docker compose up -d db
cd backend && npm run db:migrate && npm run db:seed

# 2. API avec une limite de connexions relevée (voir plus bas)
cd backend
LOGIN_RATE_LIMIT_MAX=1000 npm run dev            # bash
$env:LOGIN_RATE_LIMIT_MAX=1000; npm run dev      # PowerShell

# 3. Frontend
cd frontend && npm run dev
```

Puis :

```bash
cd e2e
npm install
npm test
```

### Pourquoi `LOGIN_RATE_LIMIT_MAX=1000` ?

L'API limite les connexions à 10 par tranche de 15 minutes et par adresse IP (protection
contre la force brute). Le scénario se connecte et se déconnecte une dizaine de fois depuis
la même IP : avec la limite par défaut, une deuxième exécution rapprochée recevrait des
réponses `429` et échouerait. On relève donc la limite uniquement pour ce lancement.

## Vérifier le site déployé : `production.mjs`

Scénario plus court (11 étapes) adapté à la production : il crée ses propres données au lieu
de dépendre de l'état de la démo, ne se connecte que 3 fois (limite de 10 connexions par
15 minutes) et vérifie que l'admin de démo est bien en lecture seule. L'API étant sur un autre
domaine que le site, son URL est demandée à part.

```bash
E2E_BASE_URL=https://<projet>.vercel.app \
E2E_API_URL=https://<service>.onrender.com/api/v1 \
node production.mjs
```

Pour l'essayer en local avec la même configuration que la démo en ligne :

```bash
docker compose down -v
READ_ONLY_EMAILS=admin@eventpass.dev DEMO_RESET_ON_START=true docker compose up -d --build --wait
E2E_BASE_URL=http://localhost:8080 E2E_API_URL=http://localhost:8080/api/v1 node production.mjs
```

## Options

| Variable | Défaut | Rôle |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | URL du frontend |
| `E2E_CHANNEL` | `msedge` | Navigateur : `msedge`, `chrome`, ou `chromium` (après `npx playwright install chromium`) |

En cas d'échec, le script s'arrête et enregistre `screenshots/ECHEC-<étape>.png`.
