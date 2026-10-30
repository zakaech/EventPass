// Détection d'un serveur « endormi ».
// L'API est hébergée sur une offre gratuite qui met le service en veille après 15 minutes
// sans visite ; la première requête suivante attend son redémarrage (jusqu'à une minute).
// On compte les requêtes en cours depuis plus de SLOW_AFTER_MS : tant qu'il y en a au moins
// une, l'interface affiche « Le serveur démarre… » au lieu de laisser croire à une panne.
//
// Ce module est un petit « store » hors de React : les composants s'y abonnent avec
// useSyncExternalStore (voir ServerWakeBanner).

export const SLOW_AFTER_MS = 4000;

let slowRequests = 0;
const listeners = new Set();

function setSlowRequests(value) {
  slowRequests = Math.max(0, value);
  listeners.forEach((listener) => listener());
}

export const serverWake = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** true si au moins une requête est lente */
  getSnapshot() {
    return slowRequests > 0;
  },
};

/**
 * Démarre le suivi d'une requête. `alreadySlow` : une nouvelle tentative après un échec de
 * réveil est considérée comme lente d'emblée (le message reste affiché sans clignoter).
 * Renvoie une fonction à appeler quand la requête est terminée.
 */
export function trackRequest({ alreadySlow = false } = {}) {
  let slow = false;
  const markSlow = () => {
    slow = true;
    setSlowRequests(slowRequests + 1);
  };
  const timer = alreadySlow ? null : setTimeout(markSlow, SLOW_AFTER_MS);
  if (alreadySlow) markSlow();

  return function done() {
    clearTimeout(timer);
    if (slow) {
      slow = false;
      setSlowRequests(slowRequests - 1);
    }
  };
}
