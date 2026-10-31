const { pool } = require('../config/db');

/**
 * GET /api/v1/health — utilisé par le healthcheck Docker (et par tout hébergeur) pour
 * savoir si l'instance peut recevoir du trafic. On vérifie aussi la base : une API qui
 * répond mais ne joint plus PostgreSQL n'est pas « en bonne santé » (503).
 */
async function health(req, res) {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok', uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'injoignable' });
  }
}

module.exports = { health };
