const { pool } = require('../../src/config/db');

/** Vide toutes les tables entre deux tests pour qu'ils restent indépendants. */
async function resetDb() {
  await pool.query('TRUNCATE tickets, events, organisateurs, users RESTART IDENTITY CASCADE');
}

async function getEvent(id) {
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  return rows[0];
}

async function countTickets(eventId, { userId, statuts = ['VALIDE', 'UTILISE'] } = {}) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total FROM tickets
     WHERE event_id = $1 AND ($2::bigint IS NULL OR user_id = $2) AND statut = ANY($3::statut_ticket[])`,
    [eventId, userId ?? null, statuts],
  );
  return rows[0].total;
}

module.exports = { pool, resetDb, getEvent, countTickets };
