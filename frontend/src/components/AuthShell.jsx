import styles from './AuthShell.module.css';

/** Mise en page des écrans de connexion / inscription : formulaire + panneau visuel. */
export function AuthShell({ title, subtitle, children, aside }) {
  return (
    <div className={`container ${styles.shell}`}>
      <section className={styles.formCard}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </section>
      <aside className={styles.aside}>{aside}</aside>
    </div>
  );
}
