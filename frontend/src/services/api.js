import axios from 'axios';
import { tokenStorage } from './tokenStorage';

// Instance axios partagée par tous les services : URL de base commune + intercepteurs.
// VITE_API_URL est lue au moment du build (variables préfixées VITE_ uniquement).
// Par défaut, même origine que le frontend (/api/v1) : le proxy de Vite relaie vers l'API.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 15000,
});

// Intercepteur de requête : exécuté avant CHAQUE appel. On y ajoute le JWT,
// ce qui évite de le passer à la main dans chaque service.
api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Le module axios vit en dehors de React : il ne peut pas utiliser useNavigate.
// L'AuthProvider lui donne donc une fonction à appeler en cas de session expirée.
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

// Intercepteur de réponse : exécuté après CHAQUE réponse (ou erreur).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Un 401 sur /auth/login signifie "mauvais mot de passe", pas "session expirée"
    const isLoginRequest = error.config?.url?.startsWith('/auth/login');

    if (status === 401 && !isLoginRequest && tokenStorage.get()) {
      tokenStorage.clear();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);
