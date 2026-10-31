// Données de démonstration.
// Usage :
//   npm run db:seed                     → vide la base puis la remplit (développement)
//   node scripts/seed.js --if-empty     → ne fait rien si la base contient déjà des comptes
//                                         (utilisé au démarrage du conteneur Docker)
const { pool, withTransaction } = require('../src/config/db');
const env = require('../src/config/env');
const { hashPassword } = require('../src/utils/password');

const IF_EMPTY = process.argv.includes('--if-empty');

// En production, on ne vide jamais une base existante
if (env.NODE_ENV === 'production' && !IF_EMPTY) {
  console.error('Refus de vider la base en production : utiliser --if-empty.');
  process.exit(1);
}

const DEMO_PASSWORD = 'Password123!';

/** Date à J+jours, à l'heure indiquée (les événements de démo restent toujours à venir). */
function inDays(days, hour = 20) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function inHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

const users = [
  { key: 'admin', email: 'admin@eventpass.dev', nom: 'Admin EventPass', role: 'ADMIN' },
  { key: 'alice', email: 'alice@eventpass.dev', nom: 'Alice Martin', role: 'USER' },
  { key: 'bob', email: 'bob@eventpass.dev', nom: 'Bob Leroy', role: 'USER' },
  { key: 'sonora', email: 'sonora@eventpass.dev', nom: 'Sarah Benali', role: 'ORGANISATEUR' },
  { key: 'atlas', email: 'atlas@eventpass.dev', nom: 'Karim Haddad', role: 'ORGANISATEUR' },
  { key: 'nouveau', email: 'nouveau@eventpass.dev', nom: 'Julie Petit', role: 'ORGANISATEUR' },
];

const organisateurs = [
  {
    key: 'sonora',
    nom_organisation: 'Sonora Productions',
    ville: 'Paris',
    description: 'Concerts et festivals de musiques actuelles.',
    statut: 'VALIDE',
  },
  {
    key: 'atlas',
    nom_organisation: 'Atlas Events',
    ville: 'Lyon',
    description: 'Conférences tech, sport et spectacles.',
    statut: 'VALIDE',
  },
  {
    key: 'nouveau',
    nom_organisation: 'Petit Théâtre du Nord',
    ville: 'Lille',
    description: 'Compagnie de théâtre indépendante.',
    statut: 'EN_ATTENTE',
  },
];

const events = [
  ['sonora', 'Nuit Électro', 'CONCERT', 'Paris', 'Le Trianon', inDays(5), 800, 35],
  ['sonora', 'Jazz au Sunset', 'CONCERT', 'Paris', 'Sunset-Sunside', inDays(9, 21), 120, 28],
  [
    'sonora',
    'Festival Rives Sonores',
    'FESTIVAL',
    'Marseille',
    'Parc Borély',
    inDays(30, 16),
    5000,
    59,
  ],
  [
    'sonora',
    'Quatuor à cordes — Ravel & Debussy',
    'CONCERT',
    'Bordeaux',
    'Grand-Théâtre',
    inDays(14),
    300,
    42.5,
  ],
  ['sonora', 'Scène ouverte acoustique', 'CONCERT', 'Lyon', 'Le Périscope', inDays(3), 60, 0],
  ['sonora', 'Rap Contenders', 'CONCERT', 'Lille', 'L’Aéronef', inDays(21), 1500, 25],
  ['sonora', 'Session intimiste', 'CONCERT', 'Paris', 'Café de la Danse', inDays(7), 5, 18],
  [
    'sonora',
    'Apéro-concert de dernière minute',
    'CONCERT',
    'Paris',
    'La Bellevilloise',
    inHours(12),
    80,
    10,
  ],
  ['atlas', 'DevConf Lyon 2026', 'CONFERENCE', 'Lyon', 'Centre de Congrès', inDays(20, 9), 600, 89],
  ['atlas', 'Meetup JavaScript', 'CONFERENCE', 'Lyon', 'La Cordée', inDays(4, 19), 50, 0],
  ['atlas', 'Semi-marathon des Quais', 'SPORT', 'Lyon', 'Quai Rambaud', inDays(40, 8), 2000, 25],
  ['atlas', 'Match d’impro', 'THEATRE', 'Toulouse', 'Théâtre du Pavé', inDays(11), 150, 15],
  [
    'atlas',
    'Expo Photo — Lumières urbaines',
    'EXPOSITION',
    'Toulouse',
    'Les Abattoirs',
    inDays(2, 10),
    200,
    8,
  ],
  ['atlas', 'Tournoi e-sport', 'SPORT', 'Bordeaux', 'Hangar 14', inDays(25, 14), 400, 12],
  [
    'atlas',
    'Atelier IA générative',
    'AUTRE',
    'Marseille',
    'La Friche Belle de Mai',
    inDays(16, 18),
    40,
    30,
  ],
  // Commencé il y a 2 h : statut calculé TERMINE, mais check-in encore ouvert (démo du scan)
  ['sonora', 'Live au Point Éphémère', 'CONCERT', 'Paris', 'Point Éphémère', inHours(-2), 150, 20],
];

// [utilisateur, index de l'événement, nombre de billets]
const reservations = [
  ['alice', 0, 2],
  ['alice', 8, 1],
  ['alice', 7, 1], // événement dans 12 h : annulation refusée
  ['bob', 0, 1],
  ['bob', 6, 3], // "Session intimiste" : 3 places sur 5 vendues
  ['bob', 11, 4],
  ['alice', 15, 2], // événement en cours : billets à scanner
  ['bob', 15, 2],
];

async function seed() {
  if (IF_EMPTY) {
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM users');
    if (rows[0].total > 0) {
      console.log('Base déjà remplie : données de démo non insérées.');
      return;
    }
  }

  await withTransaction(async (client) => {
    // RESTART IDENTITY remet les compteurs d'id à 1 ; CASCADE vide aussi les tables liées
    await client.query('TRUNCATE tickets, events, organisateurs, users RESTART IDENTITY CASCADE');

    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const userIds = {};
    for (const user of users) {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, nom, role) VALUES ($1, $2, $3, $4) RETURNING id`,
        [user.email, passwordHash, user.nom, user.role],
      );
      userIds[user.key] = rows[0].id;
    }

    for (const orga of organisateurs) {
      await client.query(
        `INSERT INTO organisateurs (user_id, nom_organisation, ville, description, statut_validation)
         VALUES ($1, $2, $3, $4, $5)`,
        [userIds[orga.key], orga.nom_organisation, orga.ville, orga.description, orga.statut],
      );
    }

    const eventIds = [];
    for (const [orgaKey, titre, categorie, ville, lieu, dateDebut, capacite, prix] of events) {
      const { rows } = await client.query(
        `INSERT INTO events (organisateur_id, titre, description, categorie, ville, lieu,
                             date_debut, capacite, places_restantes, prix)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
         RETURNING id`,
        [
          userIds[orgaKey],
          titre,
          `${titre} — un événement à ne pas manquer à ${ville}.`,
          categorie,
          ville,
          lieu,
          dateDebut,
          capacite,
          prix,
        ],
      );
      eventIds.push(rows[0].id);
    }

    for (const [userKey, eventIndex, quantite] of reservations) {
      const eventId = eventIds[eventIndex];
      await client.query(
        `INSERT INTO tickets (user_id, event_id) SELECT $1, $2 FROM generate_series(1, $3)`,
        [userIds[userKey], eventId, quantite],
      );
      await client.query(
        'UPDATE events SET places_restantes = places_restantes - $2 WHERE id = $1',
        [eventId, quantite],
      );
    }

    // Un billet de Bob déjà scanné à l'entrée de l'événement en cours (statistiques de check-in)
    await client.query(
      `UPDATE tickets SET statut = 'UTILISE', checked_in_at = now() - interval '90 minutes'
       WHERE id = (SELECT min(id) FROM tickets WHERE event_id = $1 AND user_id = $2)`,
      [eventIds[15], userIds.bob],
    );
  });

  console.log('Données de démo insérées.');
  console.log(`Comptes (mot de passe commun : ${DEMO_PASSWORD}) :`);
  for (const user of users) {
    console.log(`  ${user.role.padEnd(12)} ${user.email}`);
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
