import { api } from './api';

export async function listOrganisateurs({ statut, page = 1, limit = 20 } = {}) {
  const params = { page, limit };
  if (statut) params.statut = statut;
  const { data } = await api.get('/admin/organisateurs', { params });
  return data;
}

export async function setValidation(organisateurId, statut) {
  const { data } = await api.patch(`/admin/organisateurs/${organisateurId}/validation`, {
    statut,
  });
  return data.organisateur;
}

export async function getGlobalStats() {
  const { data } = await api.get('/admin/stats');
  return data.stats;
}
