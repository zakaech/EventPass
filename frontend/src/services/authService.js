import { api } from './api';

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials);
  return data; // { user, token }
}

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function registerOrganisateur(payload) {
  const { data } = await api.post('/auth/register/organisateur', payload);
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
