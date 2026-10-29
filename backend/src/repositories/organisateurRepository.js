const { pool } = require('../config/db');

async function create({ userId, nomOrganisation, ville, description }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO organisateurs (user_id, nom_organisation, ville, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, nomOrganisation, ville, description ?? null],
  );
  return rows[0];
}

async function findByUserId(userId, db = pool) {
  const { rows } = await db.query('SELECT * FROM organisateurs WHERE user_id = $1', [userId]);
  return rows[0] ?? null;
}

/**
 * Liste paginée, filtrée par statut si `statut` est fourni.
 * "$1::statut_validation IS NULL OR ..." : un seul texte SQL pour les deux cas,
 * le filtre est simplement neutralisé quand le paramètre vaut NULL.
 */
async function findAll({ statut, limit, offset }, db = pool) {
  const statutParam = statut ?? null;
  const { rows } = await db.query(
    `SELECT o.user_id AS id, o.nom_organisation, o.ville, o.description, o.statut_validation,
            u.email, u.nom, u.created_at
     FROM organisateurs o
     JOIN users u ON u.id = o.user_id
     WHERE $1::statut_validation IS NULL OR o.statut_validation = $1
     ORDER BY u.created_at ASC
     LIMIT $2 OFFSET $3`,
    [statutParam, limit, offset],
  );
  const count = await db.query(
    `SELECT COUNT(*) AS total FROM organisateurs
     WHERE $1::statut_validation IS NULL OR statut_validation = $1`,
    [statutParam],
  );
  return { rows, total: count.rows[0].total };
}

async function updateStatut(userId, statut, db = pool) {
  const { rows } = await db.query(
    `UPDATE organisateurs SET statut_validation = $2 WHERE user_id = $1 RETURNING *`,
    [userId, statut],
  );
  return rows[0] ?? null;
}

module.exports = { create, findByUserId, findAll, updateStatut };
