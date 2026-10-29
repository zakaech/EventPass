import { Link } from 'react-router';
import { EventArt } from './EventArt';
import { formatPrice, formatTime, formatShortDate } from '../utils/format';
import { availability } from '../utils/events';
import styles from './EventCard.module.css';

/** Carte en forme de billet : visuel, perforation, puis informations. */
export function EventCard({ event }) {
  const dispo = availability(event);

  return (
    <article className={styles.card}>
      <Link to={`/evenements/${event.id}`} className={styles.link}>
        <EventArt event={event} />
        <div className={styles.perforation} aria-hidden="true" />
        <div className={styles.body}>
          <h3 className={styles.title}>{event.titre}</h3>
          <p className={styles.meta}>
            {event.lieu} · {event.ville}
          </p>
          <p className={styles.meta}>
            {formatShortDate(event.date_debut)} à {formatTime(event.date_debut)}
          </p>
          <div className={styles.footer}>
            <span className={styles.price}>{formatPrice(event.prix)}</span>
            <span className={`${styles.dispo} ${styles[dispo.tone]}`}>{dispo.label}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
