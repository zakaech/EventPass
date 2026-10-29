// Stockage du JWT dans localStorage (choix expliqué dans CLAUDE.md) :
// le jeton survit au rechargement de la page et à la fermeture de l'onglet.
const KEY = 'eventpass.token';

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null; // navigation privée stricte : localStorage peut être inaccessible
    }
  },
  set(token) {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* ignoré : l'utilisateur restera connecté jusqu'au rechargement */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* rien à faire */
    }
  },
};
