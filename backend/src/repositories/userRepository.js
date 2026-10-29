const { pool } = require('../config/db');

// Toutes les requêtes sont paramétrées ($1, $2...) : les valeurs voyagent séparément
// du texte SQL et PostgreSQL ne les interprète jamais comme du code.
// Le paramètre `db` vaut le pool par défaut, ou un client de transaction.

// Colonnes renvoyées au client : jamais le hash du mot de passe.
const PUBLIC_COLUMNS = 'id, email, nom, role, created_at';

async function create({ email, passwordHash, nom, role = 'USER' }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, nom, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [email, passwordHash, nom, role],
  );
  return rows[0];
}

/** Seule fonction qui renvoie password_hash : réservée à la connexion. */
async function findByEmailWithPassword(email, db = pool) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

module.exports = { create, findByEmailWithPassword, findById };
