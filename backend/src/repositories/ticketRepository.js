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
            e.categorie, e.image_url, ${statutSql('e')} AS event_statut
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

/**
 * Codes des billets dont l'uuid commence par `prefix` (8 caractères hexadécimaux).
 * Les uuid sont triés octet par octet : tous ceux qui commencent par "939b184c" sont compris
 * entre 939b184c-0000-… et 939b184c-ffff-…, ce qui permet d'utiliser l'index UNIQUE sur
 * `code` (un LIKE '939b184c%' sur code::text ne le pourrait pas).
 */
async function findCodesByPrefix(prefix, db = pool) {
  const { rows } = await db.query(
    `SELECT code FROM tickets
     WHERE code BETWEEN $1::uuid AND $2::uuid
     LIMIT 20`,
    [`${prefix}-0000-0000-0000-000000000000`, `${prefix}-ffff-ffff-ffff-ffffffffffff`],
  );
  return rows.map((row) => row.code);
}

/**
 * Check-in atomique : UNE seule instruction vérifie toutes les règles et écrit.
 *  - le billet est VALIDE (donc ni déjà scanné, ni annulé) ;
 *  - il appartient à l'événement contrôlé, qui appartient à l'organisateur connecté ;
 *  - l'événement n'est pas annulé (statut stocké = 'PUBLIE', y compris pendant qu'il a lieu,
 *    alors que le statut calculé vaut déjà TERMINE) ;
 *  - on est avant date_debut + la fenêtre de check-in.
 * Deux scans simultanés : PostgreSQL verrouille la ligne du billet ; le second UPDATE attend,
 * réévalue "statut = 'VALIDE'" sur la valeur à jour (UTILISE) et ne modifie rien.
 * Renvoie la ligne mise à jour, ou null si une règle n'est pas respectée.
 */
async function checkIn({ code, eventId, organisateurId, windowHours }, db = pool) {
  const { rows } = await db.query(
    `UPDATE tickets t
     SET statut = 'UTILISE', checked_in_at = now()
     FROM events e, users u
     WHERE t.code = $1
       AND t.event_id = $2
       AND t.statut = 'VALIDE'
       AND e.id = t.event_id
       AND e.organisateur_id = $3
       AND e.statut = 'PUBLIE'
       AND now() <= e.date_debut + make_interval(hours => $4::int)
       AND u.id = t.user_id
     RETURNING t.id, t.code, t.statut, t.checked_in_at, u.nom, e.titre`,
    [code, eventId, organisateurId, windowHours],
  );
  return rows[0] ?? null;
}

/** Billet + événement + spectateur, pour expliquer un refus de check-in. */
async function findForCheckin(code, db = pool) {
  const { rows } = await db.query(
    `SELECT t.id, t.code, t.statut, t.checked_in_at, t.event_id,
            e.organisateur_id, e.titre, u.nom
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     JOIN users u ON u.id = t.user_id
     WHERE t.code = $1`,
    [code],
  );
  return rows[0] ?? null;
}

module.exports = {
  createMany,
  countActiveByUserAndEvent,
  findById,
  findByUser,
  findByEvent,
  cancelIfAllowed,
  cancelAllValidForEvent,
  findCodesByPrefix,
  checkIn,
  findForCheckin,
};
