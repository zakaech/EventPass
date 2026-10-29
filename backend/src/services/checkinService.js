const env = require('../config/env');
const ticketRepository = require('../repositories/ticketRepository');
const eventService = require('./eventService');
const { verifyQrToken, parseBackupCode, verifyBackupMac } = require('../utils/qrToken');
const { AppError, ConflictError } = require('../utils/errors');

class InvalidQrError extends AppError {
  constructor() {
    super('QR code invalide ou falsifié', { status: 400, code: 'QR_INVALIDE' });
  }
}

/**
 * Retrouve le code (uuid) du billet à partir de ce qu'a lu le scanner ou de la saisie
 * manuelle. Renvoie null si la signature est absente ou fausse : aucun accès à la base
 * n'est fait pour un jeton fabriqué ou modifié.
 */
async function resolveTicketCode(input) {
  if (input.startsWith('EP1.')) {
    return verifyQrToken(input);
  }
  const backup = parseBackupCode(input);
  if (!backup) return null;
  // Plusieurs billets peuvent partager les 8 premiers caractères : on garde celui dont la
  // signature courte correspond.
  const candidates = await ticketRepository.findCodesByPrefix(backup.prefix);
  return candidates.find((code) => verifyBackupMac(code, backup.mac)) ?? null;
}

/**
 * Le check-in a été refusé par l'UPDATE atomique : on relit les données uniquement pour
 * renvoyer un message précis. L'ordre des vérifications compte : on ne révèle rien sur
 * un billet qui appartient à un autre organisateur.
 */
async function explainRefusal(organisateurId, eventId, code) {
  const event = await eventService.getOwned(organisateurId, eventId); // 404 / 403
  if (event.statut === 'ANNULE') {
    throw new ConflictError(
      "Cet événement est annulé : aucune entrée n'est possible",
      'EVENEMENT_ANNULE',
    );
  }
  if (!event.checkin_ouvert) {
    throw new ConflictError(
      `Le contrôle des billets est fermé (plus de ${env.CHECKIN_WINDOW_HOURS} h après le début)`,
      'CHECKIN_FERME',
    );
  }

  const ticket = await ticketRepository.findForCheckin(code);
  if (!ticket) {
    throw new InvalidQrError();
  }
  if (ticket.event_id !== eventId) {
    const memeOrganisateur = ticket.organisateur_id === organisateurId;
    throw new ConflictError(
      'Ce billet est valable pour un autre événement',
      'AUTRE_EVENEMENT',
      memeOrganisateur ? { evenement: ticket.titre } : undefined,
    );
  }
  if (ticket.statut === 'UTILISE') {
    throw new ConflictError('Billet déjà utilisé', 'DEJA_UTILISE', {
      nom: ticket.nom,
      checked_in_at: ticket.checked_in_at,
    });
  }
  if (ticket.statut === 'ANNULE') {
    throw new ConflictError('Ce billet a été annulé', 'BILLET_ANNULE', { nom: ticket.nom });
  }
  // Cas théorique (billet devenu valide entre l'UPDATE et cette lecture)
  throw new ConflictError('Check-in impossible, réessayez', 'CHECKIN_IMPOSSIBLE');
}

async function checkIn(organisateurId, eventId, input) {
  const code = await resolveTicketCode(input.trim());
  if (!code) {
    throw new InvalidQrError();
  }

  const billet = await ticketRepository.checkIn({
    code,
    eventId,
    organisateurId,
    windowHours: env.CHECKIN_WINDOW_HOURS,
  });
  if (!billet) {
    await explainRefusal(organisateurId, eventId, code);
  }

  return { resultat: 'VALIDE', billet };
}

module.exports = { checkIn };
