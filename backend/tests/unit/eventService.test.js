jest.mock('../../src/config/db', () => ({ pool: {}, withTransaction: jest.fn() }));
jest.mock('../../src/repositories/eventRepository');
jest.mock('../../src/repositories/ticketRepository');

const db = require('../../src/config/db');
const eventRepository = require('../../src/repositories/eventRepository');
const ticketRepository = require('../../src/repositories/ticketRepository');
const eventService = require('../../src/services/eventService');

const CLIENT = 'client-de-transaction';
const ORGA = 10;
const HOUR = 3600 * 1000;
const data = { titre: 'Concert', capacite: 20 };

beforeEach(() => {
  jest.resetAllMocks();
  db.withTransaction.mockImplementation((callback) => callback(CLIENT));
});

// 10 places, 6 restantes → 4 billets vendus
const enVente = {
  id: 7,
  organisateur_id: ORGA,
  statut: 'PUBLIE',
  capacite: 10,
  places_restantes: 6,
};

describe('update', () => {
  test('nouvelle capacité 20 → places restantes = 20 − 4 vendus, sous verrou', async () => {
    eventRepository.findByIdForUpdate.mockResolvedValue(enVente);
    eventRepository.update.mockResolvedValue({ id: 7 });

    await eventService.update(ORGA, 7, data);

    expect(eventRepository.findByIdForUpdate).toHaveBeenCalledWith(7, CLIENT);
    expect(eventRepository.update).toHaveBeenCalledWith(7, data, 16, CLIENT);
  });

  test('capacité inférieure aux billets vendus → CAPACITE_INSUFFISANTE', async () => {
    eventRepository.findByIdForUpdate.mockResolvedValue(enVente);

    await expect(eventService.update(ORGA, 7, { ...data, capacite: 3 })).rejects.toMatchObject({
      code: 'CAPACITE_INSUFFISANTE',
      details: { billets_vendus: 4 },
    });
    expect(eventRepository.update).not.toHaveBeenCalled();
  });

  test.each([
    ['inexistant', null, 404],
    ["d'un autre organisateur", { ...enVente, organisateur_id: 99 }, 403],
    ['terminé', { ...enVente, statut: 'TERMINE' }, 409],
    ['annulé', { ...enVente, statut: 'ANNULE' }, 409],
  ])('événement %s → %s', async (_cas, event, status) => {
    eventRepository.findByIdForUpdate.mockResolvedValue(event);
    await expect(eventService.update(ORGA, 7, data)).rejects.toMatchObject({ status });
    expect(eventRepository.update).not.toHaveBeenCalled();
  });
});

test('cancel : événement et billets annulés dans la même transaction', async () => {
  eventRepository.findByIdForUpdate.mockResolvedValue(enVente);
  eventRepository.updateStatut.mockResolvedValue({ id: 7, statut: 'ANNULE' });
  ticketRepository.cancelAllValidForEvent.mockResolvedValue(4);

  const result = await eventService.cancel(ORGA, 7);

  expect(eventRepository.updateStatut).toHaveBeenCalledWith(7, 'ANNULE', CLIENT);
  expect(ticketRepository.cancelAllValidForEvent).toHaveBeenCalledWith(7, CLIENT);
  expect(result).toMatchObject({ statut: 'ANNULE', billets_annules: 4 });
});

test('getStats : taux de remplissage, de présence et chiffre d’affaires arrondis', async () => {
  eventRepository.findById.mockResolvedValue({ ...enVente, date_debut: new Date() });
  eventRepository.getStats.mockResolvedValue({
    capacite: 3,
    billets_vendus: 1,
    check_ins: 1,
    prix: 19.99,
  });

  const stats = await eventService.getStats(ORGA, 7);

  expect(stats).toMatchObject({
    taux_remplissage: 33.3,
    taux_presence: 100,
    chiffre_affaires: 19.99,
  });
});

describe('fenêtre de check-in (6 h avant → 12 h après le début)', () => {
  const debut = new Date('2026-06-21T20:00:00Z');
  const event = { statut: 'PUBLIE', date_debut: debut };
  const a = (heures) => debut.getTime() + heures * HOUR;

  test('bornes calculées', () => {
    expect(eventService.checkinWindow(event)).toEqual({
      ouverture: new Date('2026-06-21T14:00:00Z'),
      fermeture: new Date('2026-06-22T08:00:00Z'),
    });
  });

  test.each([
    [-7, false],
    [-6, true], // borne incluse
    [0, true],
    [12, true], // borne incluse
    [12.01, false],
  ])('à début %s h → ouvert = %s', (heures, attendu) => {
    expect(eventService.isCheckinOpen(event, a(heures))).toBe(attendu);
  });

  test('événement annulé → jamais ouvert', () => {
    expect(eventService.isCheckinOpen({ ...event, statut: 'ANNULE' }, a(0))).toBe(false);
  });
});
