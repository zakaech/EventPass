import styles from './ui.module.css';

export function EmptyState({ title, children, action }) {
  return (
    <div className={styles.empty}>
      <svg className={styles.emptyIcon} viewBox="0 0 64 40" aria-hidden="true">
        <path
          d="M4 6a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v8a6 6 0 0 0 0 12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-8a6 6 0 0 0 0-12z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M42 6v28" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
