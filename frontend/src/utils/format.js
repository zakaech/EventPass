// Formatage français via l'API Intl du navigateur (dates, prix) : pas de librairie nécessaire.

const dateLongue = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dateCourte = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const nombre = new Intl.NumberFormat('fr-FR');

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Samedi 14 novembre 2026" */
export const formatDate = (value) => capitalize(dateLongue.format(new Date(value)));

/** "20:00" */
export const formatTime = (value) => heure.format(new Date(value));

/** "Samedi 14 novembre 2026 · 20:00" */
export const formatDateTime = (value) => `${formatDate(value)} · ${formatTime(value)}`;

/** "14 nov. 2026" */
export const formatShortDate = (value) => dateCourte.format(new Date(value));

/** Morceaux de date pour le « tampon » des cartes : { day: "14", month: "NOV", weekday: "SAM" } */
export function dateStamp(value) {
  const date = new Date(value);
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase(),
  };
}

export const formatPrice = (value) => (Number(value) === 0 ? 'Gratuit' : euros.format(value));

export const formatNumber = (value) => nombre.format(value);

/** Valeur ISO → valeur d'un <input type="datetime-local"> ("2026-11-14T20:00"), en heure locale */
export function toDateTimeLocal(value) {
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count > 1 ? plural : singular}`;
}
