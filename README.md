# EventPass

Plateforme de billetterie d'événements : réservation de billets avec QR code, espace organisateur
(création d'événements, statistiques, check-in à l'entrée) et espace administrateur.

> README complet prévu en phase 4.

## Démarrage rapide (backend)

Prérequis : Node.js 22+, Docker.

```bash
docker compose up -d          # PostgreSQL sur localhost:5433 (bases eventpass et eventpass_test)
cd backend
cp .env.example .env          # puis remplacer JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # API sur http://localhost:3000/api/v1
```

Tests : `npm test` (dans `backend/`, avec PostgreSQL démarré).

Requêtes d'exemple : [backend/requests/eventpass.http](backend/requests/eventpass.http)
(extension VS Code « REST Client »).

## Comptes de démo

Mot de passe commun : `Password123!`

| Rôle | Email |
|---|---|
| Admin | admin@eventpass.dev |
| Utilisateur | alice@eventpass.dev, bob@eventpass.dev |
| Organisateur validé | sonora@eventpass.dev, atlas@eventpass.dev |
| Organisateur en attente | nouveau@eventpass.dev |
