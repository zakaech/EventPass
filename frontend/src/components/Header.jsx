import { useState } from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './Logo';
import styles from './Header.module.css';

const ROLE_LABELS = { USER: 'Spectateur', ORGANISATEUR: 'Organisateur', ADMIN: 'Admin' };

// Liens affichés selon le rôle de l'utilisateur connecté
function navLinksFor(user) {
  const links = [{ to: '/evenements', label: 'Événements' }];
  if (user?.role === 'USER') links.push({ to: '/mes-billets', label: 'Mes billets' });
  if (user?.role === 'ORGANISATEUR')
    links.push({ to: '/organisateur', label: 'Espace organisateur' });
  if (user?.role === 'ADMIN') links.push({ to: '/admin', label: 'Administration' });
  return links;
}

export function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Referme le menu mobile quand on clique sur un lien ou un bouton du menu.
  // (Gestionnaire d'événement plutôt qu'un useEffect sur l'URL : la fermeture est
  // la conséquence directe du clic, pas d'un changement d'état à synchroniser.)
  const closeOnClick = (event) => {
    if (event.target.closest('a, button')) setMenuOpen(false);
  };

  const linkClass = ({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`;

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />

        <button
          type="button"
          className={styles.burger}
          aria-expanded={menuOpen}
          aria-controls="menu-principal"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="visually-hidden">Menu</span>
          <span className={styles.burgerBar} />
          <span className={styles.burgerBar} />
        </button>

        <nav
          id="menu-principal"
          className={`${styles.nav} ${menuOpen ? styles.open : ''}`}
          onClick={closeOnClick}
        >
          <ul className={styles.links}>
            {navLinksFor(user).map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={linkClass}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className={styles.account}>
            {user ? (
              <>
                <div className={styles.user}>
                  <span className={styles.avatar} aria-hidden="true">
                    {user.nom.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.userText}>
                    <span className={styles.userName}>{user.nom}</span>
                    <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
                  </span>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <NavLink to="/connexion" className="btn btn-ghost btn-sm">
                  Connexion
                </NavLink>
                <NavLink to="/inscription" className="btn btn-dark btn-sm">
                  Créer un compte
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
