// Critère de la phase 1 : inscription → création d'événement → réservation → annulation,
// entièrement à travers l'API HTTP.
const request = require('supertest');
const app = require('../../src/app');
const { pool, resetDb } = require('../helpers/db');
const { createUser, auth, daysFromNow } = require('../helpers/factories');

beforeAll(resetDb);
afterAll(() => pool.end());

test('parcours complet utilisateur / organisateur / admin', async () => {
  // 1. Un organisateur s'inscrit : son compte est en attente
  const orgaRes = await request(app).post('/api/v1/auth/register/organisateur').send({
    email: 'Orga@Test.dev',
    password: 'Password123!',
    nom: 'Sarah Orga',
    nom_organisation: 'Sonora',
    ville: 'Paris',
  });
  expect(orgaRes.status).toBe(201);
  expect(orgaRes.body.user.email).toBe('orga@test.dev');
  expect(orgaRes.body.user.organisateur.statut_validation).toBe('EN_ATTENTE');
  const orgaToken = orgaRes.body.token;
  const orgaId = orgaRes.body.user.id;

  const evenement = {
    titre: 'Concert de printemps',
    categorie: 'CONCERT',
    ville: 'Paris',
    lieu: 'Olympia',
    date_debut: daysFromNow(15).toISOString(),
    capacite: 10,
    prix: 25.5,
  };

  // 2. Tant qu'il n'est pas validé, il ne peut pas créer d'événement
  const refus = await request(app)
    .post('/api/v1/organisateur/events')
    .set(auth(orgaToken))
    .send(evenement);
  expect(refus.status).toBe(403);
  expect(refus.body.error.code).toBe('ORGANISATEUR_NON_VALIDE');

  // 3. L'admin voit la demande et la valide
  const { token: adminToken } = await createUser({ role: 'ADMIN' });
  const enAttente = await request(app)
    .get('/api/v1/admin/organisateurs?statut=EN_ATTENTE')
    .set(auth(adminToken));
  expect(enAttente.status).toBe(200);
  expect(enAttente.body.data.map((o) => o.id)).toContain(orgaId);

  const validation = await request(app)
    .patch(`/api/v1/admin/organisateurs/${orgaId}/validation`)
    .set(auth(adminToken))
    .send({ statut: 'VALIDE' });
  expect(validation.status).toBe(200);

  // 4. Le même jeton fonctionne maintenant : le statut est relu en base à chaque requête
  const creation = await request(app)
    .post('/api/v1/organisateur/events')
    .set(auth(orgaToken))
    .send(evenement);
  expect(creation.status).toBe(201);
  expect(creation.body.event.places_restantes).toBe(10);
  const eventId = creation.body.event.id;

  // 5. Un utilisateur s'inscrit et trouve l'événement (filtre ville insensible à la casse)
  const userRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: 'alice@test.dev', password: 'Password123!', nom: 'Alice' });
  expect(userRes.status).toBe(201);
  const userToken = userRes.body.token;

  const recherche = await request(app).get('/api/v1/events?ville=PARIS');
  expect(recherche.body.data.map((e) => e.id)).toContain(eventId);

  // 6. Il réserve 2 billets
  const reservation = await request(app)
    .post(`/api/v1/events/${eventId}/tickets`)
    .set(auth(userToken))
    .send({ quantite: 2 });
  expect(reservation.status).toBe(201);
  expect(reservation.body.tickets).toHaveLength(2);
  expect(reservation.body.places_restantes).toBe(8);

  const mesBillets = await request(app).get('/api/v1/me/tickets').set(auth(userToken));
  expect(mesBillets.body.pagination.total).toBe(2);

  // 7. Il annule un billet : la place est rendue
  const ticketId = reservation.body.tickets[0].id;
  const annulation = await request(app)
    .patch(`/api/v1/me/tickets/${ticketId}/annuler`)
    .set(auth(userToken));
  expect(annulation.status).toBe(200);
  expect(annulation.body.ticket.statut).toBe('ANNULE');
  expect(annulation.body.places_restantes).toBe(9);

  const detail = await request(app).get(`/api/v1/events/${eventId}`);
  expect(detail.body.event.places_restantes).toBe(9);

  // 8. L'organisateur voit ses statistiques
  const stats = await request(app)
    .get(`/api/v1/organisateur/events/${eventId}/stats`)
    .set(auth(orgaToken));
  expect(stats.status).toBe(200);
  expect(stats.body.stats).toMatchObject({
    billets_vendus: 1,
    billets_annules: 1,
    check_ins: 0,
    taux_remplissage: 10,
    chiffre_affaires: 25.5,
  });
});
