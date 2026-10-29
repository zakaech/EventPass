import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { listEvents } from '../services/eventService';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EventCard } from '../components/EventCard';
import { EventFilters } from '../components/EventFilters';
import { Pagination } from '../components/Pagination';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { Alert } from '../components/Alert';
import { EmptyState } from '../components/EmptyState';
import { getErrorMessage } from '../utils/errors';
import { FILTER_KEYS } from '../utils/constants';
import { pluralize } from '../utils/format';
import styles from './EventsPage.module.css';

const PAGE_SIZE = 9;

/**
 * Les filtres vivent dans l'URL (?ville=lyon&page=2) plutôt que dans un état React :
 * la recherche peut être partagée par lien, et les boutons précédent/suivant du
 * navigateur fonctionnent naturellement.
 */
export function EventsPage() {
  useDocumentTitle('Événements');
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? '']));
  const page = Number(searchParams.get('page')) || 1;

  const { data, loading, error } = useAsync(
    () => listEvents({ ...filters, page, limit: PAGE_SIZE }),
    [searchParams.toString()],
  );

  const applyFilters = (values) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== '') params.set(key, value);
    }
    setSearchParams(params); // page remise à 1 : elle n'est pas dans les nouveaux paramètres
    setFiltersOpen(false);
  };

  const goToPage = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage);
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeCount = FILTER_KEYS.filter((key) => filters[key]).length;

  return (
    <div className="container page">
      <PageHeader eyebrow="Programmation" title="Tous les événements">
        Filtrez par ville, catégorie, date ou budget.
      </PageHeader>

      <div className={styles.toolbar}>
        <p className={styles.count}>{data ? pluralize(data.pagination.total, 'événement') : ' '}</p>
        <button
          type="button"
          className={`btn btn-outline btn-sm ${styles.filtersToggle}`}
          aria-expanded={filtersOpen}
          aria-controls="filtres"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filtres{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>

      <div className={styles.layout}>
        <aside
          id="filtres"
          className={`${styles.sidebar} ${filtersOpen ? styles.sidebarOpen : ''}`}
        >
          {/* key : le formulaire est recréé quand l'URL change (ex. lien depuis l'accueil),
              pour que ses champs reflètent toujours les filtres actifs */}
          <EventFilters
            key={searchParams.toString()}
            initialValues={filters}
            onApply={applyFilters}
          />
        </aside>

        <section className={styles.results} aria-live="polite">
          {error && <Alert variant="error">{getErrorMessage(error)}</Alert>}
          {loading && !data && <Loader />}

          {data && data.data.length === 0 && (
            <EmptyState
              title="Aucun événement trouvé"
              action={
                activeCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => applyFilters({})}
                  >
                    Effacer les filtres
                  </button>
                )
              }
            >
              Essayez d’élargir votre recherche : autre ville, autres dates ou budget plus large.
            </EmptyState>
          )}

          {data && data.data.length > 0 && (
            <div className={`${styles.grid} ${loading ? styles.stale : ''}`}>
              {data.data.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          <Pagination pagination={data?.pagination} onPageChange={goToPage} />
        </section>
      </div>
    </div>
  );
}
