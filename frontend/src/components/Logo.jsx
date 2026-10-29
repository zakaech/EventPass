import { Link } from 'react-router';
import styles from './Logo.module.css';

export function Logo({ inverted = false }) {
  return (
    <Link to="/" className={`${styles.logo} ${inverted ? styles.inverted : ''}`}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4 7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z"
        />
        <path
          stroke="var(--paper)"
          strokeWidth="2"
          strokeDasharray="2 2.5"
          d="M20 6v20"
          fill="none"
        />
      </svg>
      <span>
        Event<strong>Pass</strong>
      </span>
    </Link>
  );
}
