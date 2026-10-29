const { pool } = require('../config/db');
const { statutSql } = require('./eventColumns');

/** Crée `quantite` billets en une seule requête grâce à generate_series. */
async function createMany(userId, eventId, quantite, client) {
  const { rows } = await client.query(
    `INSERT INTO tickets (user_id, event_id)
     SELECT $1, $2 FROM generate_series(1, $3)
     RETURNING *`,
    [userId, eventId, quantite],
  );
  return rows;
}

/** Billets qui comptent dans le quota de 4 : valides ou déjà utilisés (pas les annulés). */
async function countActiveByUserAndEvent(userId, eventId, db = pool) {
  const { rows } = await db.query(
    `SELECT COUNT(*) AS total FROM tickets
     WHERE event_id = $1 AND user_id = $2 AND statut IN ('VALIDE', 'UTILISE')`,
    [eventId, userId],
  );
  return rows[0].total;
}

async function findById(id, db = pool) {
  const { rows } = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
  return rows[0] ?? null;
}

async function findByUser(userId, { limit, offset }, db = pool) {
  const { rows } = await db.query(
    `SELECT t.id, t.code, t.statut, t.reserved_at, t.checked_in_at,
            e.id AS event_id, e.titre, e.date_debut, e.ville, e.lieu, e.prix,
            e.image_url, ${statutSql('e')} AS event_statut
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     WHERE t.user_id = $1
     ORDER BY e.date_debut ASC, t.id ASC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  const count = await db.query('SELECT COUNT(*) AS total FROM tickets WHERE user_id = $1', [
    userId,
  ]);
  return { rows, total: count.rows[0].total };
}

async function findByEvent(eventId, { limit, offset }, db = pool) {
  const { rows } = await db.query(
    `SELECT t.id, t.code, t.statut, t.reserved_at, t.checked_in_at,
            u.id AS user_id, u.nom, u.email
     FROM tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.event_id = $1
     ORDER BY t.reserved_at DESC, t.id DESC
     LIMIT $2 OFFSET $3`,
    [eventId, limit, offset],
  );
  const count = await db.query('SELECT COUNT(*) AS total FROM tickets WHERE event_id = $1', [
    eventId,
  ]);
  return { rows, total: count.rows[0].total };
}

/**
 * Annule le billet seulement si toutes les règles sont respectées : il appartient à
 * l'utilisateur, il est VALIDE et l'événement commence dans plus de 24 h.
 * Comme pour la réservation, la vérification et l'écriture se font dans la même instruction :
 * deux annulations simultanées du même billet ne peuvent pas réussir toutes les deux.
 */
async function cancelIfAllowed(ticketId, userId, client) {
  const { rows } = await client.query(
    `UPDATE tickets t
     SET statut = 'ANNULE'
     FROM events e
     WHERE t.id = $1
       AND t.user_id = $2
       AND t.statut = 'VALIDE'
       AND e.id = t.event_id
       AND e.date_debut > now() + interval '24 hours'
     RETURNING t.*`,
    [ticketId, userId],
  );
  return rows[0] ?? null;
}

async function cancelAllValidForEvent(eventId, client) {
  const { rowCount } = await client.query(
    `UPDATE tickets SET statut = 'ANNULE' WHERE event_id = $1 AND statut = 'VALIDE'`,
    [eventId],
  );
  return rowCount;
}

module.exports = {
  createMany,
  countActiveByUserAndEvent,
  findById,
  findByUser,
  findByEvent,
  cancelIfAllowed,
  cancelAllValidForEvent,
};
