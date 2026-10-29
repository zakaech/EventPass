// Tests unitaires du check-in : la signature est réelle (utils/qrToken), mais l'accès aux
// données (ticketRepository) et la vérification de l'événement (eventService) sont simulés.
jest.mock('../../src/repositories/ticketRepository');
jest.mock('../../src/services/eventService');

const ticketRepository = require('../../src/repositories/ticketRepository');
const eventService = require('../../src/services/eventService');
const checkinService = require('../../src/services/checkinService');
const { signQrToken, backupCode } = require('../../src/utils/qrToken');

const CODE = '3f2b8c1e-9d4a-4b7e-8f21-6a5c0d9e7b13';
const ORGA = 10;
const EVENT = 7;
const HOUR = 3600 * 1000;

beforeEach(() => jest.resetAllMocks());

test('jeton invalide → QR_INVALIDE sans aucune requête en base', async () => {
  await expect(checkinService.checkIn(ORGA, EVENT, 'EP1.faux.jeton')).rejects.toMatchObject({
    status: 400,
    code: 'QR_INVALIDE',
  });
  expect(ticketRepository.checkIn).not.toHaveBeenCalled();
  expect(ticketRepository.findCodesByPrefix).not.toHaveBeenCalled();
});

test('jeton valide → UPDATE atomique avec la fenêtre configurée', async () => {
  ticketRepository.checkIn.mockResolvedValue({ id: 1, code: CODE, statut: 'UTILISE' });

  const result = await checkinService.checkIn(ORGA, EVENT, `  ${signQrToken(CODE)}  `);

  expect(result).toMatchObject({ resultat: 'VALIDE', billet: { statut: 'UTILISE' } });
  expect(ticketRepository.checkIn).toHaveBeenCalledWith({
    code: CODE,
    eventId: EVENT,
    organisateurId: ORGA,
    opensHoursBefore: 6,
    windowHours: 12,
  });
});

test('code de secours → retrouve le bon billet parmi ceux qui ont le même préfixe', async () => {
  const memePrefixe = '3f2b8c1e-0000-4000-8000-000000000000';
  ticketRepository.findCodesByPrefix.mockResolvedValue([memePrefixe, CODE]);
  ticketRepository.checkIn.mockResolvedValue({ id: 1, code: CODE });

  await checkinService.checkIn(ORGA, EVENT, backupCode(CODE));

  expect(ticketRepository.findCodesByPrefix).toHaveBeenCalledWith('3f2b8c1e');
  expect(ticketRepository.checkIn).toHaveBeenCalledWith(expect.objectContaining({ code: CODE }));
});

describe("refus de l'UPDATE : le message dépend de la situation", () => {
  const evenementOuvert = {
    id: EVENT,
    statut: 'TERMINE', // en cours : statut calculé TERMINE, mais contrôle ouvert
    checkin_ouverture: new Date(Date.now() - 8 * HOUR),
    checkin_fermeture: new Date(Date.now() + 10 * HOUR),
  };
  const billet = (champs) => ({
    code: CODE,
    event_id: EVENT,
    organisateur_id: ORGA,
    nom: 'Alice',
    titre: 'Concert',
    ...champs,
  });

  test.each([
    ['événement annulé', { statut: 'ANNULE' }, null, 'EVENEMENT_ANNULE'],
    [
      'contrôle pas encore ouvert',
      { checkin_ouverture: new Date(Date.now() + HOUR) },
      null,
      'CHECKIN_PAS_ENCORE_OUVERT',
    ],
    ['contrôle fermé', { checkin_fermeture: new Date(Date.now() - HOUR) }, null, 'CHECKIN_FERME'],
    ['billet déjà utilisé', {}, billet({ statut: 'UTILISE' }), 'DEJA_UTILISE'],
    ['billet annulé', {}, billet({ statut: 'ANNULE' }), 'BILLET_ANNULE'],
    ['billet introuvable', {}, null, 'QR_INVALIDE'],
  ])('%s → %s', async (_cas, evenement, ticket, code) => {
    ticketRepository.checkIn.mockResolvedValue(null);
    eventService.getOwned.mockResolvedValue({ ...evenementOuvert, ...evenement });
    ticketRepository.findForCheckin.mockResolvedValue(ticket);

    await expect(checkinService.checkIn(ORGA, EVENT, signQrToken(CODE))).rejects.toMatchObject({
      code,
    });
  });

  test("billet d'un autre événement du même organisateur → titre fourni", async () => {
    ticketRepository.checkIn.mockResolvedValue(null);
    eventService.getOwned.mockResolvedValue(evenementOuvert);
    ticketRepository.findForCheckin.mockResolvedValue(billet({ event_id: 8, statut: 'VALIDE' }));

    await expect(checkinService.checkIn(ORGA, EVENT, signQrToken(CODE))).rejects.toMatchObject({
      code: 'AUTRE_EVENEMENT',
      details: { evenement: 'Concert' },
    });
  });

  test("billet d'un autre organisateur → refusé sans rien révéler", async () => {
    ticketRepository.checkIn.mockResolvedValue(null);
    eventService.getOwned.mockResolvedValue(evenementOuvert);
    ticketRepository.findForCheckin.mockResolvedValue(
      billet({ event_id: 99, organisateur_id: 42, statut: 'VALIDE' }),
    );

    const error = await checkinService.checkIn(ORGA, EVENT, signQrToken(CODE)).catch((e) => e);
    expect(error.code).toBe('AUTRE_EVENEMENT');
    expect(error.details).toBeUndefined();
  });

  test("événement d'un autre organisateur → l'erreur 403 de getOwned est propagée", async () => {
    ticketRepository.checkIn.mockResolvedValue(null);
    eventService.getOwned.mockRejectedValue(Object.assign(new Error('interdit'), { status: 403 }));

    await expect(checkinService.checkIn(ORGA, EVENT, signQrToken(CODE))).rejects.toMatchObject({
      status: 403,
    });
    expect(ticketRepository.findForCheckin).not.toHaveBeenCalled();
  });
});
