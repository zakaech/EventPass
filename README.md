# EventPass

Plateforme de billetterie d'événements : réservation de billets avec QR code, espace organisateur
(création d'événements, statistiques, check-in à l'entrée) et espace administrateur.

> README complet prévu en phase 4.

## Démarrage rapide

Prérequis : Node.js 22+, Docker.

```bash
docker compose up -d          # PostgreSQL sur localhost:5433 (bases eventpass et eventpass_test)

cd backend
cp .env.example .env          # puis remplacer JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # API sur http://localhost:3000/api/v1

# dans un second terminal
cd frontend
cp .env.example .env
npm install
npm run dev                   # interface sur http://localhost:5173
```

Tests backend : `npm test` (dans `backend/`, avec PostgreSQL démarré).

Requêtes d'exemple : [backend/requests/eventpass.http](backend/requests/eventpass.http)
(extension VS Code « REST Client »).

## Tester le scanner de billets sur un téléphone

Les navigateurs n'autorisent la caméra que sur une page sécurisée : HTTPS, ou `localhost`.
Depuis un téléphone, il faut donc servir le frontend en HTTPS :

```bash
cd frontend
npm run dev:phone        # affiche une URL « Network: https://192.168.x.x:5173 »
```

1. Le téléphone doit être sur le **même réseau Wi-Fi** que l'ordinateur (autoriser Node.js dans
   le pare-feu Windows si une fenêtre le demande).
2. Ouvrir l'URL `https://192.168.x.x:5173` sur le téléphone. Le certificat est auto-signé :
   accepter l'avertissement (« Paramètres avancés » → « Continuer »).
3. Se connecter avec `sonora@eventpass.dev`, ouvrir **Scanner**, autoriser la caméra.
4. Sur l'ordinateur, se connecter avec `alice@eventpass.dev` → Mes billets → « Afficher » sur un
   billet de *Live au Point Éphémère*, et le présenter à la caméra du téléphone.

L'API n'a pas besoin d'être exposée : le serveur de Vite relaie `/api` vers `localhost:3000`
(une page HTTPS ne peut pas appeler une API en HTTP simple). Alternative sans certificat à
accepter : un tunnel HTTPS (`cloudflared tunnel --url http://localhost:5173`, ngrok…).

## Comptes de démo

Mot de passe commun : `Password123!` — la page de connexion propose aussi une connexion en un clic.

| Rôle | Email |
|---|---|
| Admin | admin@eventpass.dev |
| Utilisateur | alice@eventpass.dev, bob@eventpass.dev |
| Organisateur validé | sonora@eventpass.dev, atlas@eventpass.dev |
| Organisateur en attente | nouveau@eventpass.dev |
