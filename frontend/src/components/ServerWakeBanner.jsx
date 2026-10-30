import { useSyncExternalStore } from 'react';
import { serverWake } from '../services/serverWake';
import styles from './ServerWakeBanner.module.css';

/**
 * Bandeau affiché tant qu'une requête vers l'API est anormalement lente (serveur en veille
 * qui redémarre). useSyncExternalStore abonne le composant à un état qui vit hors de React
 * (le module serverWake, alimenté par l'intercepteur axios) : React relit getSnapshot() à
 * chaque notification et ne re-rend que si la valeur a changé.
 */
export function ServerWakeBanner() {
  const slow = useSyncExternalStore(serverWake.subscribe, serverWake.getSnapshot);
  if (!slow) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <div>
        <strong>Le serveur démarre, cela peut prendre une minute.</strong>
        <span className={styles.detail}>
          L’hébergement gratuit met l’API en veille après 15 minutes sans visite.
        </span>
      </div>
    </div>
  );
}
