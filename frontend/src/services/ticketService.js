import { api } from './api';

export async function listMyTickets({ page = 1, limit = 50 } = {}) {
  const { data } = await api.get('/me/tickets', { params: { page, limit } });
  return data;
}

export async function cancelTicket(ticketId) {
  const { data } = await api.patch(`/me/tickets/${ticketId}/annuler`);
  return data;
}
