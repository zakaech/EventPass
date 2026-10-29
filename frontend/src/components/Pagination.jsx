import styles from './ui.module.css';

export function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Précédent
      </button>
      <span className={styles.pageInfo}>
        Page <strong>{page}</strong> sur {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Suivant →
      </button>
    </nav>
  );
}
