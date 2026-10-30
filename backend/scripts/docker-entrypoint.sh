#!/bin/sh
# Point d'entrée du conteneur backend : migrations, données de démo facultatives, puis API.
set -e

# Secrets de développement : si GENERATE_DEV_SECRETS=true et qu'un secret manque, on en tire
# un au hasard (jamais écrit dans le code). Réservé au `docker compose up` local : les jetons
# et QR codes changent à chaque redémarrage. En production (Render), les secrets sont
# fournis par l'hébergeur et l'API refuse de démarrer s'ils manquent.
if [ "$GENERATE_DEV_SECRETS" = "true" ]; then
  random_secret() { node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"; }
  if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(random_secret)
    export JWT_SECRET
    echo "JWT_SECRET absent : secret aléatoire généré (développement uniquement)"
  fi
  if [ -z "$QR_SECRET" ]; then
    QR_SECRET=$(random_secret)
    export QR_SECRET
    echo "QR_SECRET absent : secret aléatoire généré (développement uniquement)"
  fi
fi

echo "Migrations…"
node scripts/migrate.js up

if [ "$DEMO_RESET_ON_START" = "true" ]; then
  # Démo publique : données remises à neuf à chaque démarrage (dates relatives à
  # aujourd'hui, billets à scanner disponibles, modifications des visiteurs effacées)
  echo "Démo : réinitialisation des données…"
  node scripts/seed.js --demo-reset
elif [ "$SEED_DEMO" = "true" ]; then
  echo "Données de démo (seulement si la base est vide)…"
  node scripts/seed.js --if-empty
fi

# exec : l'API remplace le shell et devient le processus principal (PID 1) du conteneur.
# Elle reçoit donc directement le signal SIGTERM de `docker stop` et s'arrête proprement.
exec node src/server.js
