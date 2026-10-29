// L'API renvoie toujours { error: { code, message, details? } } : on en extrait
// un message lisible, ou un message générique si le serveur est injoignable.

export function getErrorMessage(error, fallback = 'Une erreur est survenue. Réessayez.') {
  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  if (error?.request && !error?.response) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  }
  return fallback;
}

export const getErrorCode = (error) => error?.response?.data?.error?.code;

/** Erreurs de validation par champ : { email: "Adresse email invalide", ... } */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.champ, d.message]));
}
