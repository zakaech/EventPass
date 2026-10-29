# Tests de bout en bout (Playwright)

`parcours.mjs` pilote un vrai navigateur et rejoue les parcours des trois rôles :
visiteur, spectateur (inscription, réservation, annulation), organisateur (inscription,
création/modification/annulation d'événement, check-in) et admin (validation des comptes).
Il vérifie aussi l'intercepteur 401 et l'absence de défilement horizontal sur mobile (390 px).
Les captures d'écran sont écrites dans `e2e/screenshots/` (non versionné).

## Lancer

Trois terminaux, depuis la racine du dépôt :

```bash
# 1. Base de données fraîche avec les données de démo (le script en dépend)
docker compose up -d
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

## Options

| Variable | Défaut | Rôle |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | URL du frontend |
| `E2E_CHANNEL` | `msedge` | Navigateur : `msedge`, `chrome`, ou `chromium` (après `npx playwright install chromium`) |

En cas d'échec, le script s'arrête et enregistre `screenshots/ECHEC-<étape>.png`.
