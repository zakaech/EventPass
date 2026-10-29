// Création rapide de données de test, directement en base (sans passer par l'API).
const { pool } = require('../../src/config/db');
const { hashPassword } = require('../../src/utils/password');
const { signToken } = require('../../src/utils/jwt');

const PASSWORD = 'Password123!';
let counter = 0;

async function createUser({ role = 'USER', email } = {}) {
  counter += 1;
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, nom, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, nom, role`,
    [email ?? `user${counter}@test.dev`, await hashPassword(PASSWORD), `Utilisateur ${counter}`, role],
  );
  const user = rows[0];
  return { user, token: signToken(user) };
}

async function createOrganisateur({ statut = 'VALIDE' } = {}) {
  const { user, token } = await createUser({ role: 'ORGANISATEUR' });
  await pool.query(
    `INSERT INTO organisateurs (user_id, nom_organisation, ville, statut_validation)
     VALUES ($1, $2, 'Paris', $3)`,
    [user.id, `Organisation ${user.id}`, statut],
  );
  return { user, token };
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function createEvent(organisateurId, overrides = {}) {
  const data = {
    titre: 'Concert de test',
    categorie: 'CONCERT',
    ville: 'Paris',
    lieu: 'Salle de test',
    date_debut: daysFromNow(10),
    capacite: 100,
    prix: 20,
    statut: 'PUBLIE',
    ...overrides,
  };
  const { rows } = await pool.query(
    `INSERT INTO events (organisateur_id, titre, categorie, ville, lieu, date_debut,
                         capacite, places_restantes, prix, statut)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      organisateurId,
      data.titre,
      data.categorie,
      data.ville,
      data.lieu,
      data.date_debut,
      data.capacite,
      data.places_restantes ?? data.capacite,
      data.prix,
      data.statut,
    ],
  );
  return rows[0];
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { PASSWORD, createUser, createOrganisateur, createEvent, daysFromNow, auth };
