import axios from 'axios';
import { tokenStorage } from './tokenStorage';
import { trackRequest } from './serverWake';

// Instance axios partagée par tous les services : URL de base commune + intercepteurs.
// VITE_API_URL est lue au moment du build (variables préfixées VITE_ uniquement).
// Par défaut, même origine que le frontend (/api/v1) : le proxy de Vite ou Nginx relaie
// vers l'API. Si l'API est sur un autre domaine, VITE_API_URL contient l'URL complète.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  // Long délai : un serveur qui démarre (ou sort de veille) peut mettre une minute à répondre
  timeout: 70000,
});

// Intercepteur de requête : exécuté avant CHAQUE appel. On y ajoute le JWT,
// ce qui évite de le passer à la main dans chaque service.
api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Suivi des requêtes lentes pour le message « Le serveur démarre… »
  config.doneTracking = trackRequest({ alreadySlow: config.retryCount > 0 });
  return config;
});

// Le module axios vit en dehors de React : il ne peut pas utiliser useNavigate.
// L'AuthProvider lui donne donc une fonction à appeler en cas de session expirée.
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

const MAX_RETRIES = 3;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pendant son réveil, l'hébergeur peut répondre 502/503/504 ou couper la connexion.
 * On ne relance que les lectures (GET) : relancer une écriture (réservation, check-in…)
 * risquerait de l'exécuter deux fois si la première tentative avait en fait abouti.
 */
function isRetryable(error) {
  const config = error.config;
  if (!config || config.method !== 'get' || (config.retryCount ?? 0) >= MAX_RETRIES) {
    return false;
  }
  const status = error.response?.status;
  return !error.response || [502, 503, 504].includes(status);
}

// Intercepteur de réponse : exécuté après CHAQUE réponse (ou erreur).
api.interceptors.response.use(
  (response) => {
    response.config.doneTracking?.();
    return response;
  },
  async (error) => {
    const config = error.config;

    if (isRetryable(error)) {
      config.retryCount = (config.retryCount ?? 0) + 1;
      // Le message reste affiché pendant l'attente : nouvelle requête « déjà lente »
      const doneWaiting = trackRequest({ alreadySlow: true });
      config.doneTracking?.();
      await wait(2000 * config.retryCount);
      doneWaiting();
      return api.request(config);
    }

    config?.doneTracking?.();

    const status = error.response?.status;
    // Un 401 sur /auth/login signifie "mauvais mot de passe", pas "session expirée"
    const isLoginRequest = config?.url?.startsWith('/auth/login');

    if (status === 401 && !isLoginRequest && tokenStorage.get()) {
      tokenStorage.clear();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);
