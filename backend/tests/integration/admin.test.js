const request = require('supertest');
const app = require('../../src/app');
const { pool, resetDb } = require('../helpers/db');
const { createUser, createOrganisateur, createEvent, auth } = require('../helpers/factories');

let admin;
let spectateur;

beforeAll(async () => {
  await resetDb();
  admin = await createUser({ role: 'ADMIN' });
  spectateur = await createUser();
  const orga = await createOrganisateur();
  await createOrganisateur({ statut: 'EN_ATTENTE' });

  const paris = await createEvent(orga.user.id, { ville: 'Paris', categorie: 'CONCERT', prix: 20 });
  const lyon = await createEvent(orga.user.id, { ville: 'lyon', categorie: 'SPORT', prix: 10 });
  const parisMinuscule = await createEvent(orga.user.id, { ville: 'paris', categorie: 'CONCERT' });
  const reserver = (event, quantite) =>
    request(app)
      .post(`/api/v1/events/${event.id}/tickets`)
      .set(auth(spectateur.token))
      .send({ quantite });
  await reserver(paris, 3);
  await reserver(parisMinuscule, 1);
  await reserver(lyon, 2);
});

afterAll(() => pool.end());

test('statistiques globales : totaux, chiffre d’affaires et classements', async () => {
  const res = await request(app).get('/api/v1/admin/stats').set(auth(admin.token));

  expect(res.status).toBe(200);
  expect(res.body.stats).toMatchObject({
    utilisateurs: 1,
    organisateurs_valides: 1,
    organisateurs_en_attente: 1,
    evenements: 3,
    billets_vendus: 6,
    chiffre_affaires: 3 * 20 + 20 + 2 * 10,
  });
  expect(res.body.stats.top_categories[0]).toEqual({ categorie: 'CONCERT', billets_vendus: 4 });
  // « Paris » et « paris » sont regroupés
  expect(res.body.stats.top_villes[0]).toMatchObject({ billets_vendus: 4 });
  expect(res.body.stats.top_villes[0].ville.toLowerCase()).toBe('paris');
});

test('liste des organisateurs filtrée par statut, validation d’un id inconnu → 404', async () => {
  const enAttente = await request(app)
    .get('/api/v1/admin/organisateurs?statut=EN_ATTENTE')
    .set(auth(admin.token));
  expect(enAttente.body.data).toHaveLength(1);
  expect(enAttente.body.data[0].statut_validation).toBe('EN_ATTENTE');

  const tous = await request(app).get('/api/v1/admin/organisateurs').set(auth(admin.token));
  expect(tous.body.pagination.total).toBe(2);

  const inconnu = await request(app)
    .patch('/api/v1/admin/organisateurs/99999/validation')
    .set(auth(admin.token))
    .send({ statut: 'VALIDE' });
  expect(inconnu.status).toBe(404);
});

test('corps JSON mal formé → 400 JSON_INVALIDE', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email": ');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('JSON_INVALIDE');
});

test('route inconnue → 404 ROUTE_INTROUVABLE', async () => {
  const res = await request(app).get('/api/v1/nexiste-pas');
  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe('ROUTE_INTROUVABLE');
});
