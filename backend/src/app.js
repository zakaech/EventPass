const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// L'application est créée ici sans app.listen() : Supertest peut ainsi l'utiliser
// directement dans les tests, sans ouvrir de port réseau.
const app = express();

// Derrière un proxy (Nginx, Render), la connexion TCP vient du proxy : sans ce réglage,
// tous les clients auraient la même IP et la limite de tentatives de connexion serait
// partagée par tout le monde. Avec N proxys de confiance, Express lit la vraie IP dans
// l'en-tête X-Forwarded-For. On ne fait confiance qu'au nombre de proxys réellement
// présents : sinon un client pourrait inventer son IP en envoyant cet en-tête.
app.set('trust proxy', env.TRUST_PROXY);

// helmet ajoute des en-têtes HTTP de sécurité (anti-sniffing MIME, anti-clickjacking...)
app.use(helmet());

// CORS : le navigateur bloque les appels d'un site vers une autre origine
// (ex. localhost:5173 → localhost:3000) sauf si l'API autorise explicitement cette origine.
app.use(cors({ origin: env.CORS_ORIGIN }));

app.use(express.json({ limit: '100kb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api/v1', routes);

// Ces deux middlewares doivent rester en dernier
app.use(notFound);
app.use(errorHandler);

module.exports = app;
