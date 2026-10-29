const { pool } = require('../config/db');

/** Statistiques globales de la plateforme (espace admin). */
async function getGlobalStats(db = pool) {
  const totals = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'USER')                          AS utilisateurs,
       (SELECT COUNT(*) FROM organisateurs WHERE statut_validation = 'VALIDE')     AS organisateurs_valides,
       (SELECT COUNT(*) FROM organisateurs WHERE statut_validation = 'EN_ATTENTE') AS organisateurs_en_attente,
       (SELECT COUNT(*) FROM events)                                               AS evenements,
       (SELECT COUNT(*) FROM events WHERE statut = 'PUBLIE' AND date_debut > now()) AS evenements_a_venir,
       (SELECT COUNT(*) FROM tickets WHERE statut IN ('VALIDE', 'UTILISE'))        AS billets_vendus,
       (SELECT COALESCE(SUM(e.prix), 0)
          FROM tickets t JOIN events e ON e.id = t.event_id
          WHERE t.statut IN ('VALIDE', 'UTILISE'))                                AS chiffre_affaires`,
  );

  const topCategories = await db.query(
    `SELECT e.categorie, COUNT(t.id) AS billets_vendus
     FROM events e
     JOIN tickets t ON t.event_id = e.id AND t.statut IN ('VALIDE', 'UTILISE')
     GROUP BY e.categorie
     ORDER BY billets_vendus DESC, e.categorie
     LIMIT 5`,
  );

  // Regroupement insensible à la casse ("Paris" et "paris" comptent ensemble)
  const topVilles = await db.query(
    `SELECT min(e.ville) AS ville, COUNT(t.id) AS billets_vendus
     FROM events e
     JOIN tickets t ON t.event_id = e.id AND t.statut IN ('VALIDE', 'UTILISE')
     GROUP BY lower(e.ville)
     ORDER BY billets_vendus DESC, ville
     LIMIT 5`,
  );

  return {
    ...totals.rows[0],
    top_categories: topCategories.rows,
    top_villes: topVilles.rows,
  };
}

module.exports = { getGlobalStats };
