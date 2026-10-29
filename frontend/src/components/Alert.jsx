import styles from './ui.module.css';

/** Message contextuel. variant : "info" | "success" | "warning" | "error" */
export function Alert({ variant = 'info', title, children, action }) {
  return (
    <div
      className={`${styles.alert} ${styles[`alert-${variant}`]}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <div className={styles.alertBody}>
        {title && <strong className={styles.alertTitle}>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}
