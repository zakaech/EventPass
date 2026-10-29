import { getCategory } from '../utils/constants';
import { dateStamp } from '../utils/format';
import styles from './EventArt.module.css';

/**
 * Visuel d'un événement : l'image fournie par l'organisateur, ou à défaut un aplat
 * de la couleur de la catégorie. Dans les deux cas, un « tampon » affiche la date.
 */
export function EventArt({ event, size = 'md' }) {
  const category = getCategory(event.categorie);
  const stamp = dateStamp(event.date_debut);

  return (
    <div className={`${styles.art} ${styles[size]}`} style={{ '--cat-color': category.color }}>
      {event.image_url ? (
        <img className={styles.image} src={event.image_url} alt="" loading="lazy" />
      ) : (
        <span className={styles.pattern} aria-hidden="true" />
      )}
      <span className={styles.category}>{category.label}</span>
      <span className={styles.stamp} aria-hidden="true">
        <span className={styles.stampWeekday}>{stamp.weekday}</span>
        <span className={styles.stampDay}>{stamp.day}</span>
        <span className={styles.stampMonth}>{stamp.month}</span>
      </span>
    </div>
  );
}
