// Tests de concurrence : on envoie de vraies requêtes HTTP en parallèle (Promise.all).
// Le serveur les traite en même temps et leurs transactions PostgreSQL se chevauchent,
// exactement comme lors d'une ouverture de billetterie très demandée.
const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb, getEvent, countTickets } = require('./helpers/db');
const { createUser, createOrganisateur, createEvent, auth } = require('./helpers/factories');

let server;
let organisateur;

beforeAll(async () => {
  // Un seul serveur pour toutes les requêtes (au lieu d'un serveur par appel Supertest)
  server = app.listen(0);
  await resetDb();
  organisateur = (await createOrganisateur()).user;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

function reserver(eventId, token, quantite) {
  return request(server)
    .post(`/api/v1/events/${eventId}/tickets`)
    .set(auth(token))
    .send({ quantite });
}

test('20 utilisateurs se disputent 5 places : exactement 5 réservations réussissent', async () => {
  const event = await createEvent(organisateur.id, { capacite: 5 });
  const users = await Promise.all(Array.from({ length: 20 }, () => createUser()));

  const responses = await Promise.all(users.map(({ token }) => reserver(event.id, token, 1)));

  const succes = responses.filter((r) => r.status === 201);
  const refus = responses.filter((r) => r.status === 409);
  expect(succes).toHaveLength(5);
  expect(refus).toHaveLength(15);
  refus.forEach((r) => expect(r.body.error.code).toBe('PLACES_INSUFFISANTES'));

  // Vérification directement en base : aucune survente
  expect((await getEvent(event.id)).places_restantes).toBe(0);
  expect(await countTickets(event.id)).toBe(5);
});

test('demandes simultanées de quantités différentes : jamais plus que la capacité', async () => {
  const event = await createEvent(organisateur.id, { capacite: 7 });
  const users = await Promise.all(Array.from({ length: 12 }, () => createUser()));

  const responses = await Promise.all(
    users.map(({ token }, i) => reserver(event.id, token, (i % 4) + 1)),
  );

  const vendus = responses
    .filter((r) => r.status === 201)
    .reduce((total, r) => total + r.body.tickets.length, 0);
  const { places_restantes } = await getEvent(event.id);

  expect(vendus).toBeLessThanOrEqual(7);
  expect(places_restantes).toBe(7 - vendus);
  expect(await countTickets(event.id)).toBe(vendus);
});

test.each(Array.from({ length: 10 }, (_, i) => i + 1))(
  'même utilisateur, 2 réservations de 3 billets simultanées : une seule passe (essai %i)',
  async () => {
    const event = await createEvent(organisateur.id, { capacite: 50 });
    const { user, token } = await createUser();

    const responses = await Promise.all([
      reserver(event.id, token, 3),
      reserver(event.id, token, 3),
    ]);

    const statuts = responses.map((r) => r.status).sort();
    expect(statuts).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409).body.error.code).toBe('QUOTA_DEPASSE');

    // La transaction refusée a été annulée : ses 3 places sont revenues
    expect(await countTickets(event.id, { userId: user.id })).toBe(3);
    expect((await getEvent(event.id)).places_restantes).toBe(47);
  },
);

test('même utilisateur, 4 réservations de 2 billets simultanées : le total reste à 4', async () => {
  const event = await createEvent(organisateur.id, { capacite: 50 });
  const { user, token } = await createUser();

  const responses = await Promise.all(Array.from({ length: 4 }, () => reserver(event.id, token, 2)));

  expect(responses.filter((r) => r.status === 201)).toHaveLength(2);
  expect(await countTickets(event.id, { userId: user.id })).toBe(4);
  expect((await getEvent(event.id)).places_restantes).toBe(46);
});

test('le même billet annulé deux fois en même temps : la place est rendue une seule fois', async () => {
  const event = await createEvent(organisateur.id, { capacite: 10 });
  const { token } = await createUser();
  const reservation = await reserver(event.id, token, 1);
  const ticketId = reservation.body.tickets[0].id;

  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      request(server).patch(`/api/v1/me/tickets/${ticketId}/annuler`).set(auth(token)),
    ),
  );

  expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
  expect((await getEvent(event.id)).places_restantes).toBe(10);
});
