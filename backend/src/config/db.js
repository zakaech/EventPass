const { Pool, types } = require('pg');
const env = require('./env');

// Par défaut, pg renvoie les BIGINT (ids, COUNT(*)) et les NUMERIC (prix) sous forme de
// chaînes, car JavaScript ne représente pas exactement tous les entiers 64 bits.
// Nos valeurs restent très loin de cette limite (2^53), on les convertit donc en nombres.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

// Un pool garde quelques connexions ouvertes et les prête aux requêtes :
// ouvrir une connexion PostgreSQL à chaque requête HTTP serait beaucoup trop lent.
const pool = new Pool({ connectionString: env.DATABASE_URL });

/**
 * Exécute `callback(client)` dans une transaction.
 * Toutes les requêtes passées par `client` sont validées ensemble (COMMIT),
 * ou annulées ensemble (ROLLBACK) si une erreur est levée.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Toujours rendre la connexion au pool, même en cas d'erreur
    client.release();
  }
}

module.exports = { pool, withTransaction };
