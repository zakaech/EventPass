// Règles d'affichage liées aux événements et aux billets (aucun appel réseau ici).

const HOUR = 60 * 60 * 1000;

/** Indication de disponibilité : { label, tone: 'ok' | 'low' | 'soldout' } */
export function availability(event) {
  const places = event.places_restantes;
  if (places === 0) return { label: 'Complet', tone: 'soldout' };
  if (places <= 10 || places / event.capacite <= 0.1) {
    return { label: `Plus que ${places} place${places > 1 ? 's' : ''}`, tone: 'low' };
  }
  return { label: `${places} places disponibles`, tone: 'ok' };
}

/** Même règle que l'API : billet VALIDE, événement actif, plus de 24 h avant le début. */
export function canCancelTicket(ticket) {
  return (
    ticket.statut === 'VALIDE' &&
    ticket.event_statut === 'PUBLIE' &&
    new Date(ticket.date_debut).getTime() - Date.now() > 24 * HOUR
  );
}

/**
 * Regroupe la liste plate des billets par événement :
 * [{ event: {...}, tickets: [...] }], dans l'ordre d'arrivée.
 */
export function groupTicketsByEvent(tickets) {
  const groups = new Map();
  for (const ticket of tickets) {
    if (!groups.has(ticket.event_id)) {
      groups.set(ticket.event_id, {
        event: {
          id: ticket.event_id,
          titre: ticket.titre,
          categorie: ticket.categorie,
          date_debut: ticket.date_debut,
          ville: ticket.ville,
          lieu: ticket.lieu,
          prix: ticket.prix,
          image_url: ticket.image_url,
          statut: ticket.event_statut,
        },
        tickets: [],
      });
    }
    groups.get(ticket.event_id).tickets.push(ticket);
  }
  return [...groups.values()];
}

/**
 * Groupe à afficher dans « À venir et en cours » : événement en vente, ou événement qui a
 * commencé il y a moins de 24 h et pour lequel il reste un billet à présenter à l'entrée
 * (son statut calculé vaut déjà TERMINE, mais le spectateur a encore besoin du QR code).
 */
export function isCurrentGroup({ event, tickets }) {
  if (event.statut === 'PUBLIE') return true;
  const recent = Date.now() - new Date(event.date_debut).getTime() < 24 * HOUR;
  return event.statut === 'TERMINE' && recent && tickets.some((t) => t.statut === 'VALIDE');
}

/** Code court lisible d'un billet : "7F3A-9C21" */
export const shortCode = (uuid) =>
  uuid
    .slice(0, 8)
    .toUpperCase()
    .replace(/(.{4})/, '$1-');
