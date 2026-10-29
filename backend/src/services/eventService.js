const { withTransaction } = require('../config/db');
const eventRepository = require('../repositories/eventRepository');
const ticketRepository = require('../repositories/ticketRepository');
const { toLimitOffset, paginated } = require('../utils/pagination');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');

async function listPublic({ page, limit, ...filters }) {
  const { rows, total } = await eventRepository.searchPublic(filters, toLimitOffset({ page, limit }));
  return paginated(rows, total, { page, limit });
}

async function getById(id) {
  const event = await eventRepository.findById(id);
  if (!event) {
    throw new NotFoundError('Événement introuvable');
  }
  return event;
}

/** 404 si l'événement n'existe pas, 403 s'il appartient à un autre organisateur. */
function assertOwner(event, organisateurId) {
  if (!event) {
    throw new NotFoundError('Événement introuvable');
  }
  if (event.organisateur_id !== organisateurId) {
    throw new ForbiddenError("Cet événement ne vous appartient pas");
  }
}

async function getOwned(organisateurId, eventId) {
  const event = await eventRepository.findById(eventId);
  assertOwner(event, organisateurId);
  return event;
}

async function listByOrganisateur(organisateurId, { page, limit }) {
  const { rows, total } = await eventRepository.findByOrganisateur(
    organisateurId,
    toLimitOffset({ page, limit }),
  );
  return paginated(rows, total, { page, limit });
}

function create(organisateurId, data) {
  return eventRepository.create(organisateurId, data);
}

/**
 * Remplacement complet d'un événement (PUT).
 * Le nombre de places restantes dépend du nombre de billets déjà vendus :
 * on verrouille la ligne (SELECT ... FOR UPDATE) pour qu'aucune réservation ne se glisse
 * entre la lecture de places_restantes et l'écriture de la nouvelle valeur.
 */
async function update(organisateurId, eventId, data) {
  return withTransaction(async (client) => {
    const event = await eventRepository.findByIdForUpdate(eventId, client);
    assertOwner(event, organisateurId);
    if (event.statut !== 'PUBLIE') {
      throw new ConflictError("Un événement annulé ou terminé ne peut plus être modifié", 'EVENEMENT_NON_MODIFIABLE');
    }

    const billetsVendus = event.capacite - event.places_restantes;
    if (data.capacite < billetsVendus) {
      throw new ConflictError(
        `La capacité ne peut pas être inférieure au nombre de billets déjà vendus (${billetsVendus})`,
        'CAPACITE_INSUFFISANTE',
        { billets_vendus: billetsVendus },
      );
    }

    return eventRepository.update(eventId, data, data.capacite - billetsVendus, client);
  });
}

/** Annule l'événement et tous ses billets valides, dans la même transaction. */
async function cancel(organisateurId, eventId) {
  return withTransaction(async (client) => {
    const event = await eventRepository.findByIdForUpdate(eventId, client);
    assertOwner(event, organisateurId);
    if (event.statut !== 'PUBLIE') {
      throw new ConflictError("Cet événement n'est plus actif", 'EVENEMENT_NON_MODIFIABLE');
    }

    const updated = await eventRepository.updateStatut(eventId, 'ANNULE', client);
    const billetsAnnules = await ticketRepository.cancelAllValidForEvent(eventId, client);
    return { ...updated, billets_annules: billetsAnnules };
  });
}

async function listReservations(organisateurId, eventId, { page, limit }) {
  await getOwned(organisateurId, eventId);
  const { rows, total } = await ticketRepository.findByEvent(eventId, toLimitOffset({ page, limit }));
  return paginated(rows, total, { page, limit });
}

async function getStats(organisateurId, eventId) {
  await getOwned(organisateurId, eventId);
  const stats = await eventRepository.getStats(eventId);
  return {
    ...stats,
    taux_remplissage: Math.round((stats.billets_vendus / stats.capacite) * 1000) / 10, // en %, 1 décimale
    chiffre_affaires: Math.round(stats.billets_vendus * stats.prix * 100) / 100,
  };
}

module.exports = {
  listPublic,
  getById,
  getOwned,
  listByOrganisateur,
  create,
  update,
  cancel,
  listReservations,
  getStats,
};
