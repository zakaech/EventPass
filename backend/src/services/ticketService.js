const { withTransaction } = require('../config/db');
const eventRepository = require('../repositories/eventRepository');
const ticketRepository = require('../repositories/ticketRepository');
const { MAX_BILLETS_PAR_EVENEMENT } = require('../validators/ticketValidators');
const { toLimitOffset, paginated } = require('../utils/pagination');
const { NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Explique pourquoi le décrément conditionnel n'a modifié aucune ligne.
 * Ces lectures servent uniquement à choisir le bon message d'erreur :
 * la décision (réserver ou non) a déjà été prise de façon atomique par l'UPDATE.
 */
async function explainReservationFailure(eventId, quantite, client) {
  const event = await eventRepository.findById(eventId, client);
  if (!event) {
    throw new NotFoundError('Événement introuvable');
  }
  if (event.statut !== 'PUBLIE') {
    throw new ConflictError("Cet événement n'est plus disponible à la réservation", 'EVENEMENT_INDISPONIBLE');
  }
  if (event.date_debut <= new Date()) {
    throw new ConflictError('Cet événement a déjà commencé', 'EVENEMENT_PASSE');
  }
  throw new ConflictError(
    `Places insuffisantes : ${event.places_restantes} restante(s), ${quantite} demandée(s)`,
    'PLACES_INSUFFISANTES',
    { places_restantes: event.places_restantes },
  );
}

/**
 * Réserve `quantite` billets dans une transaction. L'ORDRE des étapes est important :
 *
 * 1. UPDATE conditionnel des places : il réserve les places ET pose un verrou sur la ligne
 *    de l'événement jusqu'au COMMIT/ROLLBACK. Toute autre réservation sur cet événement
 *    attend à cette étape : les réservations d'un même événement passent une par une.
 *
 * 2. Comptage des billets de l'utilisateur, APRÈS l'UPDATE : comme on détient le verrou,
 *    une éventuelle réservation concurrente du même utilisateur est soit déjà validée
 *    (en READ COMMITTED, chaque requête voit les données validées avant son lancement,
 *    donc ses billets sont comptés), soit bloquée à l'étape 1 derrière nous.
 *    Si on comptait AVANT l'UPDATE, deux requêtes simultanées pourraient compter 0 billet
 *    toutes les deux et dépasser ensemble la limite de 4.
 *
 * 3. Si le quota est dépassé, on lève une erreur : le ROLLBACK annule aussi l'étape 1,
 *    les places sont rendues automatiquement.
 */
async function reserve(userId, eventId, quantite) {
  return withTransaction(async (client) => {
    const event = await eventRepository.decrementPlaces(eventId, quantite, client);
    if (!event) {
      await explainReservationFailure(eventId, quantite, client);
    }

    const dejaReserves = await ticketRepository.countActiveByUserAndEvent(userId, eventId, client);
    if (dejaReserves + quantite > MAX_BILLETS_PAR_EVENEMENT) {
      throw new ConflictError(
        `Limite de ${MAX_BILLETS_PAR_EVENEMENT} billets par événement : vous en avez déjà ${dejaReserves}`,
        'QUOTA_DEPASSE',
        { deja_reserves: dejaReserves, maximum: MAX_BILLETS_PAR_EVENEMENT },
      );
    }

    const tickets = await ticketRepository.createMany(userId, eventId, quantite, client);
    return { tickets, places_restantes: event.places_restantes };
  });
}

async function listMine(userId, { page, limit }) {
  const { rows, total } = await ticketRepository.findByUser(userId, toLimitOffset({ page, limit }));
  return paginated(rows, total, { page, limit });
}

/** Annule un billet et rend la place, dans la même transaction. */
async function cancel(userId, ticketId) {
  return withTransaction(async (client) => {
    const ticket = await ticketRepository.cancelIfAllowed(ticketId, userId, client);

    if (!ticket) {
      const existing = await ticketRepository.findById(ticketId, client);
      // Le billet d'un autre utilisateur est traité comme inexistant : on ne révèle rien
      if (!existing || existing.user_id !== userId) {
        throw new NotFoundError('Billet introuvable');
      }
      if (existing.statut !== 'VALIDE') {
        throw new ConflictError(
          `Ce billet ne peut pas être annulé (statut : ${existing.statut})`,
          'BILLET_NON_ANNULABLE',
        );
      }
      throw new ConflictError(
        "L'annulation n'est plus possible moins de 24 h avant l'événement",
        'DELAI_ANNULATION_DEPASSE',
      );
    }

    const event = await eventRepository.incrementPlaces(ticket.event_id, 1, client);
    return { ticket, places_restantes: event.places_restantes };
  });
}

module.exports = { reserve, listMine, cancel };
