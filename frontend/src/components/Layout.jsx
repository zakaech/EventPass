import { Outlet } from 'react-router';
import { Header } from './Header';
import { Logo } from './Logo';
import { ServerWakeBanner } from './ServerWakeBanner';
import styles from './Layout.module.css';

// Mise en page commune : <Outlet /> est remplacé par la page de la route active.
export function Layout() {
  return (
    <div className={styles.shell}>
      <a href="#contenu" className={styles.skip}>
        Aller au contenu
      </a>
      <Header />
      <main id="contenu" className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <Logo inverted />
          <p>Billetterie d’événements — projet de portfolio.</p>
        </div>
      </footer>
      <ServerWakeBanner />
    </div>
  );
}
