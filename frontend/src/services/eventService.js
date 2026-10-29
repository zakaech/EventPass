import { api } from './api';

/** Retire les filtres vides pour ne pas envoyer "?ville=&prix_min=". */
function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null),
  );
}

export async function listEvents(filters = {}) {
  const { data } = await api.get('/events', { params: cleanParams(filters) });
  return data; // { data, pagination }
}

export async function getEvent(id) {
  const { data } = await api.get(`/events/${id}`);
  return data.event;
}

export async function reserveTickets(eventId, quantite) {
  const { data } = await api.post(`/events/${eventId}/tickets`, { quantite });
  return data; // { tickets, places_restantes }
}
