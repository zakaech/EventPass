# EventPass

Plateforme de billetterie d'événements : réservation de billets avec QR code, espace organisateur
(création d'événements, statistiques, check-in à l'entrée) et espace administrateur.

> README complet prévu en phase 4.

## Démarrage rapide (backend)

```bash
docker compose up -d          # PostgreSQL sur localhost:5433
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # API sur http://localhost:3000/api/v1
```
