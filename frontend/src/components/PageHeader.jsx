import styles from './ui.module.css';

export function PageHeader({ eyebrow, title, children, actions }) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {children && <p className={styles.pageHeaderLead}>{children}</p>}
      </div>
      {actions && <div className={styles.pageHeaderActions}>{actions}</div>}
    </div>
  );
}
