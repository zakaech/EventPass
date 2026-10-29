import { api } from './api';

export async function listMyEvents({ page = 1, limit = 50 } = {}) {
  const { data } = await api.get('/organisateur/events', { params: { page, limit } });
  return data;
}

export async function getMyEvent(id) {
  const { data } = await api.get(`/organisateur/events/${id}`);
  return data.event;
}

export async function createEvent(payload) {
  const { data } = await api.post('/organisateur/events', payload);
  return data.event;
}

export async function updateEvent(id, payload) {
  const { data } = await api.put(`/organisateur/events/${id}`, payload);
  return data.event;
}

export async function cancelEvent(id) {
  const { data } = await api.patch(`/organisateur/events/${id}/annuler`);
  return data.event;
}

export async function getEventStats(id) {
  const { data } = await api.get(`/organisateur/events/${id}/stats`);
  return data.stats;
}

export async function listReservations(id, { page = 1, limit = 20 } = {}) {
  const { data } = await api.get(`/organisateur/events/${id}/reservations`, {
    params: { page, limit },
  });
  return data;
}
