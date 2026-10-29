const { pool } = require('../config/db');
const { eventColumns } = require('./eventColumns');

const COLUMNS_WITH_ORGANISATION = `${eventColumns('e')}, o.nom_organisation`;
// Pour RETURNING (UPDATE/INSERT sans alias) : la table elle-même sert de préfixe
const RETURNING = `RETURNING ${eventColumns('events')}`;

/**
 * Construit le WHERE de la recherche publique à partir des filtres présents.
 * On assemble dynamiquement des *placeholders* ($1, $2...), jamais des valeurs :
 * les valeurs vont dans le tableau `values`, transmis séparément à PostgreSQL.
 */
function buildPublicFilters(filters) {
  const conditions = ["e.statut = 'PUBLIE'", 'e.date_debut > now()'];
  const values = [];
  const add = (toSql, value) => {
    values.push(value);
    conditions.push(toSql(`$${values.length}`));
  };

  if (filters.ville) add((p) => `lower(e.ville) = lower(${p})`, filters.ville);
  if (filters.categorie) add((p) => `e.categorie = ${p}`, filters.categorie);
  if (filters.date_min) add((p) => `e.date_debut >= ${p}`, filters.date_min);
  if (filters.date_max) add((p) => `e.date_debut <= ${p}`, filters.date_max);
  if (filters.prix_min !== undefined) add((p) => `e.prix >= ${p}`, filters.prix_min);
  if (filters.prix_max !== undefined) add((p) => `e.prix <= ${p}`, filters.prix_max);

  return { where: conditions.join(' AND '), values };
}

async function searchPublic(filters, { limit, offset }, db = pool) {
  const { where, values } = buildPublicFilters(filters);
  const n = values.length;
  const { rows } = await db.query(
    `SELECT ${COLUMNS_WITH_ORGANISATION}
     FROM events e
     JOIN organisateurs o ON o.user_id = e.organisateur_id
     WHERE ${where}
     ORDER BY e.date_debut ASC, e.id ASC
     LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...values, limit, offset],
  );
  const count = await db.query(`SELECT COUNT(*) AS total FROM events e WHERE ${where}`, values);
  return { rows, total: count.rows[0].total };
}

async function findById(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS_WITH_ORGANISATION}
     FROM events e
     JOIN organisateurs o ON o.user_id = e.organisateur_id
     WHERE e.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Lit l'événement en posant un verrou sur sa ligne jusqu'à la fin de la transaction :
 * les autres transactions qui veulent modifier cette ligne attendent leur tour.
 * À utiliser uniquement avec un client de transaction.
 */
async function findByIdForUpdate(id, client) {
  const { rows } = await client.query(
    `SELECT ${eventColumns('events')} FROM events WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

async function findByOrganisateur(organisateurId, { limit, offset }, db = pool) {
  const { rows } = await db.query(
    `SELECT ${eventColumns('events')} FROM events
     WHERE organisateur_id = $1
     ORDER BY date_debut DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [organisateurId, limit, offset],
  );
  const count = await db.query('SELECT COUNT(*) AS total FROM events WHERE organisateur_id = $1', [
    organisateurId,
  ]);
  return { rows, total: count.rows[0].total };
}

async function create(organisateurId, data, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO events (organisateur_id, titre, description, categorie, ville, lieu,
                         date_debut, capacite, places_restantes, prix, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
     ${RETURNING}`,
    [
      organisateurId,
      data.titre,
      data.description ?? null,
      data.categorie,
      data.ville,
      data.lieu,
      data.date_debut,
      data.capacite,
      data.prix,
      data.image_url ?? null,
    ],
  );
  return rows[0];
}

async function update(id, data, placesRestantes, db = pool) {
  const { rows } = await db.query(
    `UPDATE events
     SET titre = $2, description = $3, categorie = $4, ville = $5, lieu = $6,
         date_debut = $7, capacite = $8, places_restantes = $9, prix = $10, image_url = $11
     WHERE id = $1
     ${RETURNING}`,
    [
      id,
      data.titre,
      data.description ?? null,
      data.categorie,
      data.ville,
      data.lieu,
      data.date_debut,
      data.capacite,
      placesRestantes,
      data.prix,
      data.image_url ?? null,
    ],
  );
  return rows[0];
}

async function updateStatut(id, statut, db = pool) {
  const { rows } = await db.query(`UPDATE events SET statut = $2 WHERE id = $1 ${RETURNING}`, [
    id,
    statut,
  ]);
  return rows[0];
}

/**
 * Cœur de l'anti-survente : décrément *conditionnel* en une seule instruction.
 * PostgreSQL verrouille la ligne pendant l'UPDATE ; si une autre transaction a déjà
 * modifié la ligne, il attend sa fin puis réévalue le WHERE sur la nouvelle valeur.
 * Résultat : la condition "places_restantes >= $2" est toujours testée sur la valeur à jour.
 * Renvoie null si la condition n'est pas remplie (aucune ligne modifiée).
 */
async function decrementPlaces(id, quantite, client) {
  const { rows } = await client.query(
    `UPDATE events
     SET places_restantes = places_restantes - $2
     WHERE id = $1
       AND statut = 'PUBLIE'
       AND date_debut > now()
       AND places_restantes >= $2
     ${RETURNING}`,
    [id, quantite],
  );
  return rows[0] ?? null;
}

async function incrementPlaces(id, quantite, client) {
  const { rows } = await client.query(
    `UPDATE events SET places_restantes = places_restantes + $2 WHERE id = $1 ${RETURNING}`,
    [id, quantite],
  );
  return rows[0];
}

/**
 * Statistiques d'un événement en une requête.
 * COUNT(*) FILTER (WHERE ...) compte seulement les lignes qui vérifient la condition :
 * plusieurs compteurs différents en un seul parcours de la table tickets.
 */
async function getStats(id, db = pool) {
  const { rows } = await db.query(
    `SELECT e.id, e.titre, e.capacite, e.places_restantes, e.prix,
            COUNT(t.id) FILTER (WHERE t.statut IN ('VALIDE', 'UTILISE')) AS billets_vendus,
            COUNT(t.id) FILTER (WHERE t.statut = 'ANNULE')               AS billets_annules,
            COUNT(t.id) FILTER (WHERE t.statut = 'UTILISE')              AS check_ins,
            MAX(t.checked_in_at)                                          AS dernier_check_in
     FROM events e
     LEFT JOIN tickets t ON t.event_id = e.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [id],
  );
  return rows[0] ?? null;
}

module.exports = {
  searchPublic,
  findById,
  findByIdForUpdate,
  findByOrganisateur,
  create,
  update,
  updateStatut,
  decrementPlaces,
  incrementPlaces,
  getStats,
};
