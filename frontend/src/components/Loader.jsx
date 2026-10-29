import styles from './ui.module.css';

export function Loader({ label = 'Chargement…' }) {
  return (
    <div className={styles.loader} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className={`container ${styles.pageLoader}`}>
      <Loader />
    </div>
  );
}
