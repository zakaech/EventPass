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

## Régénérer le GIF du README : `demo-gif.mjs`

`demo-gif.mjs` rejoue le parcours réservation → QR code → scan (validé, puis refusé) →
statistiques au format téléphone, incruste une légende sur chaque capture et assemble
`docs/screenshots/parcours.gif` (encodeur `gifenc`, en JavaScript : pas besoin de ffmpeg).
Il crée son propre événement, qui commence 3 h plus tard pour que le contrôle soit déjà ouvert.
Les images intermédiaires sont gardées dans `screenshots/gif-*.png`.

```bash
docker compose down -v && docker compose up -d --build --wait
cd e2e && E2E_BASE_URL=http://localhost:8080 npm run gif
```

## Options

| Variable | Défaut | Rôle |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | URL du frontend |
| `E2E_CHANNEL` | `msedge` | Navigateur : `msedge`, `chrome`, ou `chromium` (après `npx playwright install chromium`) |

En cas d'échec, le script s'arrête et enregistre `screenshots/ECHEC-<étape>.png`.
