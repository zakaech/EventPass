import styles from './ui.module.css';

// Un seul composant pour tous les statuts de l'application (événement, billet, organisateur)
const STATUTS = {
  PUBLIE: { label: 'En vente', tone: 'success' },
  ANNULE: { label: 'Annulé', tone: 'danger' },
  TERMINE: { label: 'Terminé', tone: 'neutral' },
  VALIDE: { label: 'Valide', tone: 'success' },
  UTILISE: { label: 'Utilisé', tone: 'info' },
  EN_ATTENTE: { label: 'En attente', tone: 'warning' },
  REFUSE: { label: 'Refusé', tone: 'danger' },
  COMPLET: { label: 'Complet', tone: 'warning' },
};

export function StatusBadge({ statut, label }) {
  const config = STATUTS[statut] ?? { label: statut, tone: 'neutral' };
  return (
    <span className={`${styles.badge} ${styles[`badge-${config.tone}`]}`}>
      {label ?? config.label}
    </span>
  );
}
