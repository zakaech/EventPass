const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const {
  createUser,
  createOrganisateur,
  createEvent,
  daysFromNow,
  auth,
} = require('./helpers/factories');

afterAll(() => pool.end());

describe('GET /events (recherche publique)', () => {
  let orga;

  beforeAll(async () => {
    await resetDb();
    orga = (await createOrganisateur()).user;
    await createEvent(orga.id, { titre: 'A', ville: 'Paris', prix: 10, categorie: 'CONCERT' });
    await createEvent(orga.id, { titre: 'B', ville: 'paris', prix: 50, categorie: 'SPORT' });
    await createEvent(orga.id, { titre: 'C', ville: 'Lyon', prix: 30, categorie: 'CONCERT' });
    await createEvent(orga.id, { titre: 'D', ville: 'Paris', prix: 0, statut: 'ANNULE' });
    await createEvent(orga.id, { titre: 'E', ville: 'Paris', prix: 5, date_debut: daysFromNow(-1) });
  });

  const titres = (res) => res.body.data.map((e) => e.titre).sort();

  test('seuls les événements publiés et à venir sont listés', async () => {
    const res = await request(app).get('/api/v1/events');
    expect(res.status).toBe(200);
    expect(titres(res)).toEqual(['A', 'B', 'C']);
  });

  test('filtre ville insensible à la casse', async () => {
    expect(titres(await request(app).get('/api/v1/events?ville=PARIS'))).toEqual(['A', 'B']);
  });

  test('filtres prix_min / prix_max (bornes incluses) et catégorie', async () => {
    expect(titres(await request(app).get('/api/v1/events?prix_min=10&prix_max=30'))).toEqual(['A', 'C']);
    expect(titres(await request(app).get('/api/v1/events?categorie=CONCERT'))).toEqual(['A', 'C']);
  });

  test('pagination', async () => {
    const res = await request(app).get('/api/v1/events?limit=2&page=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  test('paramètres invalides → 400 avec le détail', async () => {
    const res = await request(app).get('/api/v1/events?prix_min=50&prix_max=10&limit=500');
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.champ).sort()).toEqual(['limit', 'prix_min']);
  });

  test('détail inexistant → 404', async () => {
    expect((await request(app).get('/api/v1/events/99999')).status).toBe(404);
  });
});

describe('Espace organisateur', () => {
  let orga;
  let autreOrga;
  let user;

  beforeEach(async () => {
    await resetDb();
    orga = await createOrganisateur();
    autreOrga = await createOrganisateur();
    user = await createUser();
  });

  const body = (overrides = {}) => ({
    titre: 'Mon événement',
    categorie: 'THEATRE',
    ville: 'Lille',
    lieu: 'Salle',
    date_debut: daysFromNow(30).toISOString(),
    capacite: 10,
    prix: 15,
    ...overrides,
  });

  test('création invalide → 400 (date passée, catégorie inconnue)', async () => {
    const res = await request(app)
      .post('/api/v1/organisateur/events')
      .set(auth(orga.token))
      .send(body({ date_debut: daysFromNow(-2).toISOString(), categorie: 'CIRQUE' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.champ).sort()).toEqual(['categorie', 'date_debut']);
  });

  test("un organisateur ne peut pas modifier l'événement d'un autre", async () => {
    const event = await createEvent(orga.user.id);
    const res = await request(app)
      .put(`/api/v1/organisateur/events/${event.id}`)
      .set(auth(autreOrga.token))
      .send(body());
    expect(res.status).toBe(403);
  });

  test('modifier la capacité recalcule les places restantes', async () => {
    const event = await createEvent(orga.user.id, { capacite: 10 });
    await request(app)
      .post(`/api/v1/events/${event.id}/tickets`)
      .set(auth(user.token))
      .send({ quantite: 4 });

    const ok = await request(app)
      .put(`/api/v1/organisateur/events/${event.id}`)
      .set(auth(orga.token))
      .send(body({ capacite: 20 }));
    expect(ok.status).toBe(200);
    expect(ok.body.event.places_restantes).toBe(16);

    const refus = await request(app)
      .put(`/api/v1/organisateur/events/${event.id}`)
      .set(auth(orga.token))
      .send(body({ capacite: 3 }));
    expect(refus.status).toBe(409);
    expect(refus.body.error.code).toBe('CAPACITE_INSUFFISANTE');
  });

  test("annuler un événement annule ses billets et le retire de la liste publique", async () => {
    const event = await createEvent(orga.user.id);
    await request(app)
      .post(`/api/v1/events/${event.id}/tickets`)
      .set(auth(user.token))
      .send({ quantite: 2 });

    const res = await request(app)
      .patch(`/api/v1/organisateur/events/${event.id}/annuler`)
      .set(auth(orga.token));
    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({ statut: 'ANNULE', billets_annules: 2 });

    const billets = await request(app).get('/api/v1/me/tickets').set(auth(user.token));
    expect(billets.body.data.every((t) => t.statut === 'ANNULE')).toBe(true);

    const liste = await request(app).get('/api/v1/events');
    expect(liste.body.data).toHaveLength(0);
  });

  test('réservations : visibles uniquement par le propriétaire', async () => {
    const event = await createEvent(orga.user.id);
    await request(app)
      .post(`/api/v1/events/${event.id}/tickets`)
      .set(auth(user.token))
      .send({ quantite: 1 });

    const res = await request(app)
      .get(`/api/v1/organisateur/events/${event.id}/reservations`)
      .set(auth(orga.token));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ email: user.user.email, statut: 'VALIDE' });

    expect(
      (
        await request(app)
          .get(`/api/v1/organisateur/events/${event.id}/reservations`)
          .set(auth(autreOrga.token))
      ).status,
    ).toBe(403);
  });
});
