// Compte admin en lecture seule (démo publique). La variable doit être définie AVANT le
// chargement de l'application, qui lit la configuration une seule fois.
process.env.READ_ONLY_EMAILS = 'Demo-Admin@test.dev, autre@test.dev';

const request = require('supertest');
const app = require('../../src/app');
const { pool, resetDb } = require('../helpers/db');
const { createUser, createOrganisateur, auth } = require('../helpers/factories');

let adminDemo;
let vraiAdmin;
let enAttente;

beforeAll(async () => {
  await resetDb();
  adminDemo = await createUser({ role: 'ADMIN', email: 'demo-admin@test.dev' });
  vraiAdmin = await createUser({ role: 'ADMIN' });
  enAttente = await createOrganisateur({ statut: 'EN_ATTENTE' });
});

afterAll(() => pool.end());

const valider = (admin) =>
  request(app)
    .patch(`/api/v1/admin/organisateurs/${enAttente.user.id}/validation`)
    .set(auth(admin.token))
    .send({ statut: 'VALIDE' });

test('le compte de démo est signalé en lecture seule par /auth/me (casse ignorée)', async () => {
  const demo = await request(app).get('/api/v1/auth/me').set(auth(adminDemo.token));
  expect(demo.body.user.lecture_seule).toBe(true);

  const autre = await request(app).get('/api/v1/auth/me').set(auth(vraiAdmin.token));
  expect(autre.body.user.lecture_seule).toBe(false);
});

test('lecture autorisée : statistiques et comptes en attente', async () => {
  const stats = await request(app).get('/api/v1/admin/stats').set(auth(adminDemo.token));
  expect(stats.status).toBe(200);

  const liste = await request(app)
    .get('/api/v1/admin/organisateurs?statut=EN_ATTENTE')
    .set(auth(adminDemo.token));
  expect(liste.status).toBe(200);
  expect(liste.body.data.map((o) => o.id)).toContain(enAttente.user.id);
});

test('écriture refusée par le serveur (403 LECTURE_SEULE), rien n’est modifié', async () => {
  const res = await valider(adminDemo);
  expect(res.status).toBe(403);
  expect(res.body.error.code).toBe('LECTURE_SEULE');

  const { rows } = await pool.query(
    'SELECT statut_validation FROM organisateurs WHERE user_id = $1',
    [enAttente.user.id],
  );
  expect(rows[0].statut_validation).toBe('EN_ATTENTE');
});

test('un autre admin garde tous ses droits', async () => {
  const res = await valider(vraiAdmin);
  expect(res.status).toBe(200);
  expect(res.body.organisateur.statut_validation).toBe('VALIDE');
});
