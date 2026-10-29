import styles from './ui.module.css';

export function StatCard({ label, value, hint, accent = false }) {
  return (
    <div className={`${styles.stat} ${accent ? styles.statAccent : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

/** Barre de progression (taux de remplissage) */
export function ProgressBar({ value, max, label }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={styles.progress}>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <span className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.progressLabel}>{percent} %</span>
    </div>
  );
}
