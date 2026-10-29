// Tests unitaires du service des billets : les repositories (SQL) et la transaction sont
// remplacés par des mocks. On teste uniquement la logique du service : ordre des étapes,
// règles métier, erreurs renvoyées — sans base de données.

// jest.mock est « remonté » en haut du fichier par Jest : il s'applique avant les require.
// Avec une fabrique, on décide nous-mêmes du contenu du module simulé.
jest.mock('../../src/config/db', () => ({
  pool: {},
  withTransaction: jest.fn(),
}));
// Sans fabrique : « automock », chaque fonction exportée devient un jest.fn() vide.
jest.mock('../../src/repositories/eventRepository');
jest.mock('../../src/repositories/ticketRepository');

const db = require('../../src/config/db');
const eventRepository = require('../../src/repositories/eventRepository');
const ticketRepository = require('../../src/repositories/ticketRepository');
const ticketService = require('../../src/services/ticketService');
const { verifyQrToken } = require('../../src/utils/qrToken');

const CLIENT = 'client-de-transaction';

beforeEach(() => {
  jest.resetAllMocks(); // oublie les appels et valeurs de retour du test précédent
  // La « transaction » simulée exécute simplement le callback avec un faux client
  db.withTransaction.mockImplementation((callback) => callback(CLIENT));
});

describe('reserve', () => {
  test('décrémente les places AVANT de compter le quota, puis crée les billets', async () => {
    eventRepository.decrementPlaces.mockResolvedValue({ id: 7, places_restantes: 8 });
    ticketRepository.countActiveByUserAndEvent.mockResolvedValue(1);
    ticketRepository.createMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await ticketService.reserve(3, 7, 2);

    expect(result).toEqual({ tickets: [{ id: 1 }, { id: 2 }], places_restantes: 8 });
    // Toutes les requêtes passent par le client de la transaction
    expect(eventRepository.decrementPlaces).toHaveBeenCalledWith(7, 2, CLIENT);
    expect(ticketRepository.countActiveByUserAndEvent).toHaveBeenCalledWith(3, 7, CLIENT);
    expect(ticketRepository.createMany).toHaveBeenCalledWith(3, 7, 2, CLIENT);
    // L'ordre UPDATE puis comptage est ce qui protège le quota (voir ticketService.js)
    const ordreUpdate = eventRepository.decrementPlaces.mock.invocationCallOrder[0];
    const ordreComptage = ticketRepository.countActiveByUserAndEvent.mock.invocationCallOrder[0];
    expect(ordreUpdate).toBeLessThan(ordreComptage);
  });

  test('quota dépassé (3 déjà + 2) → QUOTA_DEPASSE et aucun billet créé', async () => {
    eventRepository.decrementPlaces.mockResolvedValue({ id: 7, places_restantes: 8 });
    ticketRepository.countActiveByUserAndEvent.mockResolvedValue(3);

    await expect(ticketService.reserve(3, 7, 2)).rejects.toMatchObject({
      status: 409,
      code: 'QUOTA_DEPASSE',
      details: { deja_reserves: 3, maximum: 4 },
    });
    expect(ticketRepository.createMany).not.toHaveBeenCalled();
  });

  test.each([
    ['événement inexistant', null, 404, 'INTROUVABLE'],
    ['événement terminé', { statut: 'TERMINE' }, 409, 'EVENEMENT_PASSE'],
    ['événement annulé', { statut: 'ANNULE' }, 409, 'EVENEMENT_INDISPONIBLE'],
    [
      'plus assez de places',
      { statut: 'PUBLIE', places_restantes: 1 },
      409,
      'PLACES_INSUFFISANTES',
    ],
  ])('UPDATE refusé, %s → %s %s', async (_cas, event, status, code) => {
    eventRepository.decrementPlaces.mockResolvedValue(null); // aucune ligne modifiée
    eventRepository.findById.mockResolvedValue(event);

    await expect(ticketService.reserve(3, 7, 2)).rejects.toMatchObject({ status, code });
    expect(ticketRepository.countActiveByUserAndEvent).not.toHaveBeenCalled();
    expect(ticketRepository.createMany).not.toHaveBeenCalled();
  });
});

describe('cancel', () => {
  test('billet annulé → la place est rendue dans la même transaction', async () => {
    ticketRepository.cancelIfAllowed.mockResolvedValue({ id: 5, event_id: 7 });
    eventRepository.incrementPlaces.mockResolvedValue({ places_restantes: 10 });

    const result = await ticketService.cancel(3, 5);

    expect(ticketRepository.cancelIfAllowed).toHaveBeenCalledWith(5, 3, CLIENT);
    expect(eventRepository.incrementPlaces).toHaveBeenCalledWith(7, 1, CLIENT);
    expect(result.places_restantes).toBe(10);
  });

  test.each([
    ['billet inexistant', null, 404, 'INTROUVABLE'],
    ["billet d'un autre utilisateur", { user_id: 99, statut: 'VALIDE' }, 404, 'INTROUVABLE'],
    ['billet déjà utilisé', { user_id: 3, statut: 'UTILISE' }, 409, 'BILLET_NON_ANNULABLE'],
    ['moins de 24 h avant', { user_id: 3, statut: 'VALIDE' }, 409, 'DELAI_ANNULATION_DEPASSE'],
  ])('refus, %s → %s %s', async (_cas, ticket, status, code) => {
    ticketRepository.cancelIfAllowed.mockResolvedValue(null);
    ticketRepository.findById.mockResolvedValue(ticket);

    await expect(ticketService.cancel(3, 5)).rejects.toMatchObject({ status, code });
    expect(eventRepository.incrementPlaces).not.toHaveBeenCalled();
  });
});

describe('listMine', () => {
  test('jeton QR et code de secours uniquement pour les billets valides', async () => {
    const code = '3f2b8c1e-9d4a-4b7e-8f21-6a5c0d9e7b13';
    ticketRepository.findByUser.mockResolvedValue({
      rows: [
        { id: 1, code, statut: 'VALIDE' },
        { id: 2, code: '9a1c2d3e-4f50-4617-8a9b-0c1d2e3f4a5b', statut: 'ANNULE' },
      ],
      total: 2,
    });

    const result = await ticketService.listMine(3, { page: 1, limit: 10 });

    expect(ticketRepository.findByUser).toHaveBeenCalledWith(3, { limit: 10, offset: 0 });
    expect(verifyQrToken(result.data[0].qr_token)).toBe(code);
    expect(result.data[0].code_secours).toMatch(/^3F2B-8C1E-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(result.data[1]).toMatchObject({ qr_token: null, code_secours: null });
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });
});
