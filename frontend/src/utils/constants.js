export const CATEGORIES = [
  { value: 'CONCERT', label: 'Concert', color: 'var(--cat-concert)' },
  { value: 'THEATRE', label: 'Théâtre', color: 'var(--cat-theatre)' },
  { value: 'SPORT', label: 'Sport', color: 'var(--cat-sport)' },
  { value: 'CONFERENCE', label: 'Conférence', color: 'var(--cat-conference)' },
  { value: 'FESTIVAL', label: 'Festival', color: 'var(--cat-festival)' },
  { value: 'EXPOSITION', label: 'Exposition', color: 'var(--cat-exposition)' },
  { value: 'AUTRE', label: 'Autre', color: 'var(--cat-autre)' },
];

const byValue = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export const getCategory = (value) => byValue[value] ?? byValue.AUTRE;

export const MAX_BILLETS_PAR_EVENEMENT = 4;

/** Filtres de la recherche d'événements (noms des paramètres de l'API et de l'URL) */
export const FILTER_KEYS = ['ville', 'categorie', 'date_min', 'date_max', 'prix_min', 'prix_max'];

/** Page d'accueil de chaque rôle après connexion */
export const HOME_BY_ROLE = {
  USER: '/mes-billets',
  ORGANISATEUR: '/organisateur',
  ADMIN: '/admin',
};
