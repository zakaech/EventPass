// Check-in à l'entrée : POST /api/v1/organisateur/checkin { event_id, token }
const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const { createUser, createOrganisateur, createEvent, auth } = require('./helpers/factories');
const { signQrToken, backupCode } = require('../src/utils/qrToken');
const checkinService = require('../src/services/checkinService');

const HOUR = 60 * 60 * 1000;
let server;

beforeAll(() => {
  server = app.listen(0);
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

let orgaA;
let orgaB;
let spectateur;
let eventA;
let eventA2;
let eventB;

beforeEach(async () => {
  await resetDb();
  orgaA = await createOrganisateur();
  orgaB = await createOrganisateur();
  spectateur = await createUser();
  eventA = await createEvent(orgaA.user.id, { titre: 'Concert A' });
  eventA2 = await createEvent(orgaA.user.id, { titre: 'Autre date de A' });
  eventB = await createEvent(orgaB.user.id, { titre: 'Concert B' });
});

async function createTicket(eventId, statut = 'VALIDE') {
  const { rows } = await pool.query(
    'INSERT INTO tickets (user_id, event_id, statut) VALUES ($1, $2, $3) RETURNING *',
    [spectateur.user.id, eventId, statut],
  );
  return rows[0];
}

async function ticketStatut(id) {
  const { rows } = await pool.query('SELECT statut, checked_in_at FROM tickets WHERE id = $1', [
    id,
  ]);
  return rows[0];
}

const scan = (orga, eventId, token) =>
  request(server)
    .post('/api/v1/organisateur/checkin')
    .set(auth(orga.token))
    .send({ event_id: eventId, token });

describe('jetons dans « mes billets »', () => {
  test('un billet VALIDE reçoit un jeton QR et un code de secours, un billet annulé non', async () => {
    const valide = await createTicket(eventA.id);
    await createTicket(eventA.id, 'ANNULE');

    const res = await request(server).get('/api/v1/me/tickets').set(auth(spectateur.token));
    const parId = Object.fromEntries(res.body.data.map((t) => [t.id, t]));

    expect(parId[valide.id].qr_token).toBe(signQrToken(valide.code));
    expect(parId[valide.id].code_secours).toBe(backupCode(valide.code));
    const annule = res.body.data.find((t) => t.statut === 'ANNULE');
    expect(annule.qr_token).toBeNull();
    expect(annule.code_secours).toBeNull();
  });
});

describe('scan valide puis second scan', () => {
  test('premier scan → VALIDE et billet UTILISE ; second scan → DEJA_UTILISE avec l’heure', async () => {
    const ticket = await createTicket(eventA.id);
    const token = signQrToken(ticket.code);

    const premier = await scan(orgaA, eventA.id, token);
    expect(premier.status).toBe(200);
    expect(premier.body.resultat).toBe('VALIDE');
    expect(premier.body.billet).toMatchObject({ statut: 'UTILISE', nom: spectateur.user.nom });
    const enBase = await ticketStatut(ticket.id);
    expect(enBase.statut).toBe('UTILISE');
    expect(enBase.checked_in_at).not.toBeNull();

    const second = await scan(orgaA, eventA.id, token);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DEJA_UTILISE');
    expect(new Date(second.body.error.details.checked_in_at)).toEqual(enBase.checked_in_at);

    const stats = await request(server)
      .get(`/api/v1/organisateur/events/${eventA.id}/stats`)
      .set(auth(orgaA.token));
    expect(stats.body.stats).toMatchObject({ check_ins: 1, taux_presence: 100 });
  });

  test('10 scans simultanés du même billet → exactement un succès', async () => {
    const ticket = await createTicket(eventA.id);
    const token = signQrToken(ticket.code);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => scan(orgaA, eventA.id, token)),
    );

    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    const refus = responses.filter((r) => r.status === 409);
    expect(refus).toHaveLength(9);
    refus.forEach((r) => expect(r.body.error.code).toBe('DEJA_UTILISE'));
  });

  // Via HTTP, les middlewares (dont une requête SQL d'authentification) étalent les
  // requêtes dans le temps. En appelant le service directement, les 20 check-ins partent
  // réellement en même temps sur les connexions du pool : une version « lire puis écrire »
  // non atomique laisserait passer plusieurs scans (vérifié en remplaçant l'UPDATE).
  test('20 check-ins lancés en parallèle sur le service → un seul succès', async () => {
    const ticket = await createTicket(eventA.id);
    const token = signQrToken(ticket.code);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => checkinService.checkIn(orgaA.user.id, eventA.id, token)),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    results
      .filter((r) => r.status === 'rejected')
      .forEach((r) => expect(r.reason.code).toBe('DEJA_UTILISE'));
  });

  test('code de secours saisi à la main (minuscules, espaces) → VALIDE', async () => {
    const ticket = await createTicket(eventA.id);
    const saisie = backupCode(ticket.code).toLowerCase().replace(/-/g, ' ');

    const res = await scan(orgaA, eventA.id, saisie);
    expect(res.status).toBe(200);
    expect((await ticketStatut(ticket.id)).statut).toBe('UTILISE');
  });
});

describe('QR modifié ou fabriqué', () => {
  test.each([
    ['signature modifiée', (t) => signQrToken(t.code).slice(0, -2) + 'xx'],
    [
      'code d’un autre billet avec la signature recopiée',
      (t, autre) => `EP1.${autre.code}.${signQrToken(t.code).split('.')[2]}`,
    ],
    ['uuid du billet sans signature', (t) => t.code],
    ['texte quelconque', () => 'https://exemple.com/billet/42'],
    ['code de secours avec une signature fausse', (t) => backupCode(t.code).slice(0, -4) + '0000'],
  ])('%s → 400 QR_INVALIDE, billet inchangé', async (_label, forge) => {
    const ticket = await createTicket(eventA.id);
    const autre = await createTicket(eventA.id);

    const res = await scan(orgaA, eventA.id, forge(ticket, autre));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QR_INVALIDE');
    expect((await ticketStatut(ticket.id)).statut).toBe('VALIDE');
    expect((await ticketStatut(autre.id)).statut).toBe('VALIDE');
  });
});

describe('événements et organisateurs', () => {
  test("un organisateur ne peut pas valider le billet d'un autre organisateur", async () => {
    const ticket = await createTicket(eventA.id);
    const token = signQrToken(ticket.code);

    // B contrôle son propre événement : billet refusé, sans révéler l'événement de A
    const res = await scan(orgaB, eventB.id, token);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUTRE_EVENEMENT');
    expect(res.body.error.details).toBeUndefined();

    // B indique l'événement de A : il ne lui appartient pas
    const interdit = await scan(orgaB, eventA.id, token);
    expect(interdit.status).toBe(403);

    expect((await ticketStatut(ticket.id)).statut).toBe('VALIDE');
  });

  test('billet d’un autre événement du même organisateur → AUTRE_EVENEMENT avec son titre', async () => {
    const ticket = await createTicket(eventA2.id);
    const res = await scan(orgaA, eventA.id, signQrToken(ticket.code));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'AUTRE_EVENEMENT',
      details: { evenement: 'Autre date de A' },
    });
  });

  test('billet annulé → BILLET_ANNULE', async () => {
    const ticket = await createTicket(eventA.id, 'ANNULE');
    const res = await scan(orgaA, eventA.id, signQrToken(ticket.code));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BILLET_ANNULE');
  });

  test('événement annulé → EVENEMENT_ANNULE', async () => {
    const annule = await createEvent(orgaA.user.id, { statut: 'ANNULE' });
    const ticket = await createTicket(annule.id);
    const res = await scan(orgaA, annule.id, signQrToken(ticket.code));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENEMENT_ANNULE');
    expect((await ticketStatut(ticket.id)).statut).toBe('VALIDE');
  });
});

describe('fenêtre de check-in (CHECKIN_WINDOW_HOURS = 12 par défaut)', () => {
  test('événement commencé il y a 2 h (statut TERMINE) → check-in encore possible', async () => {
    const enCours = await createEvent(orgaA.user.id, {
      date_debut: new Date(Date.now() - 2 * HOUR),
    });
    const ticket = await createTicket(enCours.id);

    const publicRes = await request(server).get(`/api/v1/events/${enCours.id}`);
    expect(publicRes.body.event.statut).toBe('TERMINE');

    const res = await scan(orgaA, enCours.id, signQrToken(ticket.code));
    expect(res.status).toBe(200);
  });

  test('événement commencé il y a 13 h → CHECKIN_FERME', async () => {
    const fini = await createEvent(orgaA.user.id, {
      date_debut: new Date(Date.now() - 13 * HOUR),
    });
    const ticket = await createTicket(fini.id);

    const res = await scan(orgaA, fini.id, signQrToken(ticket.code));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECKIN_FERME');
    expect((await ticketStatut(ticket.id)).statut).toBe('VALIDE');
  });

  test('checkin_ouvert est exposé dans la liste des événements de l’organisateur', async () => {
    await createEvent(orgaA.user.id, {
      titre: 'Fini',
      date_debut: new Date(Date.now() - 13 * HOUR),
    });
    const res = await request(server).get('/api/v1/organisateur/events').set(auth(orgaA.token));
    const parTitre = Object.fromEntries(res.body.data.map((e) => [e.titre, e.checkin_ouvert]));
    expect(parTitre).toMatchObject({ 'Concert A': true, Fini: false });
  });
});

test('accès réservé aux organisateurs validés, corps validé', async () => {
  const ticket = await createTicket(eventA.id);
  const token = signQrToken(ticket.code);

  const parUnSpectateur = await request(server)
    .post('/api/v1/organisateur/checkin')
    .set(auth(spectateur.token))
    .send({ event_id: eventA.id, token });
  expect(parUnSpectateur.status).toBe(403);

  const sansEvenement = await request(server)
    .post('/api/v1/organisateur/checkin')
    .set(auth(orgaA.token))
    .send({ token });
  expect(sansEvenement.status).toBe(400);
});
