const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb, getEvent } = require('./helpers/db');
const { createUser, createOrganisateur, createEvent, auth } = require('./helpers/factories');

let organisateur;
let user;

beforeEach(async () => {
  await resetDb();
  organisateur = await createOrganisateur();
  user = await createUser();
});

afterAll(() => pool.end());

const reserver = (eventId, token, quantite) =>
  request(app).post(`/api/v1/events/${eventId}/tickets`).set(auth(token)).send({ quantite });

const annuler = (ticketId, token) =>
  request(app).patch(`/api/v1/me/tickets/${ticketId}/annuler`).set(auth(token));

describe('POST /events/:id/tickets', () => {
  test('quota de 4 billets au total par utilisateur et par événement', async () => {
    const event = await createEvent(organisateur.user.id);

    expect((await reserver(event.id, user.token, 3)).status).toBe(201);
    const refus = await reserver(event.id, user.token, 2);
    expect(refus.status).toBe(409);
    expect(refus.body.error.code).toBe('QUOTA_DEPASSE');
    expect(refus.body.error.details).toEqual({ deja_reserves: 3, maximum: 4 });
    expect((await reserver(event.id, user.token, 1)).status).toBe(201);

    // Le refus n'a consommé aucune place
    expect((await getEvent(event.id)).places_restantes).toBe(96);
  });

  test('un billet annulé ne compte plus dans le quota', async () => {
    const event = await createEvent(organisateur.user.id);
    const res = await reserver(event.id, user.token, 4);
    await annuler(res.body.tickets[0].id, user.token);

    expect((await reserver(event.id, user.token, 1)).status).toBe(201);
  });

  test('quantité hors de 1..4 → 400', async () => {
    const event = await createEvent(organisateur.user.id);
    const res = await reserver(event.id, user.token, 5);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  test('places insuffisantes → 409 avec le nombre de places restantes', async () => {
    const event = await createEvent(organisateur.user.id, { capacite: 2 });
    const res = await reserver(event.id, user.token, 3);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLACES_INSUFFISANTES');
    expect(res.body.error.details.places_restantes).toBe(2);
  });

  test('événement annulé ou inexistant', async () => {
    const annule = await createEvent(organisateur.user.id, { statut: 'ANNULE' });
    expect((await reserver(annule.id, user.token, 1)).body.error.code).toBe('EVENEMENT_INDISPONIBLE');
    expect((await reserver(99999, user.token, 1)).status).toBe(404);
  });

  test('seuls les comptes USER peuvent réserver', async () => {
    const event = await createEvent(organisateur.user.id);
    expect((await reserver(event.id, organisateur.token, 1)).status).toBe(403);
    expect((await request(app).post(`/api/v1/events/${event.id}/tickets`).send({ quantite: 1 })).status).toBe(401);
  });
});

describe('PATCH /me/tickets/:id/annuler', () => {
  test('refusée à moins de 24 h de l’événement', async () => {
    const event = await createEvent(organisateur.user.id, {
      date_debut: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });
    const res = await reserver(event.id, user.token, 1);

    const refus = await annuler(res.body.tickets[0].id, user.token);
    expect(refus.status).toBe(409);
    expect(refus.body.error.code).toBe('DELAI_ANNULATION_DEPASSE');
    expect((await getEvent(event.id)).places_restantes).toBe(99);
  });

  test("le billet d'un autre utilisateur est introuvable", async () => {
    const event = await createEvent(organisateur.user.id);
    const res = await reserver(event.id, user.token, 1);
    const autre = await createUser();

    expect((await annuler(res.body.tickets[0].id, autre.token)).status).toBe(404);
  });

  test('un billet déjà annulé ne peut pas être annulé à nouveau', async () => {
    const event = await createEvent(organisateur.user.id);
    const res = await reserver(event.id, user.token, 1);
    const ticketId = res.body.tickets[0].id;

    expect((await annuler(ticketId, user.token)).status).toBe(200);
    const second = await annuler(ticketId, user.token);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('BILLET_NON_ANNULABLE');
    expect((await getEvent(event.id)).places_restantes).toBe(100);
  });
});
