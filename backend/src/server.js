const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

const server = app.listen(env.PORT, () => {
  console.log(`API EventPass démarrée sur http://localhost:${env.PORT}/api/v1`);
});

// Arrêt propre (Ctrl+C, arrêt du conteneur) : on termine les requêtes en cours
// puis on ferme les connexions à PostgreSQL.
function shutdown() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
