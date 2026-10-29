import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { listEvents } from '../services/eventService';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EventCard } from '../components/EventCard';
import { Loader } from '../components/Loader';
import { Alert } from '../components/Alert';
import { CATEGORIES } from '../utils/constants';
import { formatPrice, dateStamp } from '../utils/format';
import { getErrorMessage } from '../utils/errors';
import styles from './HomePage.module.css';

export function HomePage() {
  useDocumentTitle(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState({ ville: '', categorie: '' });
  const { data, loading, error } = useAsync(() => listEvents({ limit: 6 }), []);

  const onSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.ville.trim()) params.set('ville', search.ville.trim());
    if (search.categorie) params.set('categorie', search.categorie);
    navigate(`/evenements?${params}`);
  };

  const featured = data?.data.slice(0, 3) ?? [];

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <span className="eyebrow">Billetterie en ligne</span>
            <h1 className={styles.heroTitle}>
              Vos prochaines sorties, <em>un billet</em> à la fois.
            </h1>
            <p className={styles.heroLead}>
              Concerts, théâtre, sport, conférences : trouvez un événement près de chez vous et
              réservez jusqu’à 4 places en quelques secondes.
            </p>

            <form className={styles.search} onSubmit={onSearch} role="search">
              <label className="visually-hidden" htmlFor="home-ville">
                Ville
              </label>
              <input
                id="home-ville"
                className={styles.searchInput}
                placeholder="Dans quelle ville ?"
                value={search.ville}
                onChange={(e) => setSearch({ ...search, ville: e.target.value })}
              />
              <label className="visually-hidden" htmlFor="home-categorie">
                Catégorie
              </label>
              <select
                id="home-categorie"
                className={styles.searchSelect}
                value={search.categorie}
                onChange={(e) => setSearch({ ...search, categorie: e.target.value })}
              >
                <option value="">Toutes catégories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary">
                Rechercher
              </button>
            </form>
          </div>

          {/* Pile de billets décorative avec les prochains événements */}
          <div className={styles.stubs} aria-hidden="true">
            {featured.map((event, index) => {
              const stamp = dateStamp(event.date_debut);
              const category = CATEGORIES.find((c) => c.value === event.categorie);
              return (
                <div
                  key={event.id}
                  className={styles.stub}
                  style={{ '--i': index, '--cat-color': category?.color }}
                >
                  <div className={styles.stubDate}>
                    <span>{stamp.day}</span>
                    <small>{stamp.month}</small>
                  </div>
                  <div className={styles.stubInfo}>
                    <strong>{event.titre}</strong>
                    <span>
                      {event.ville} · {formatPrice(event.prix)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.categories}>
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              to={`/evenements?categorie=${c.value}`}
              className={styles.chip}
              style={{ '--cat-color': c.color }}
            >
              <span className={styles.chipDot} />
              {c.label}
            </Link>
          ))}
        </div>

        <div className={styles.sectionHead}>
          <h2>À l’affiche</h2>
          <Link to="/evenements" className="btn btn-outline btn-sm">
            Tous les événements →
          </Link>
        </div>

        {loading && <Loader />}
        {error && <Alert variant="error">{getErrorMessage(error)}</Alert>}
        {data && (
          <div className={styles.grid}>
            {data.data.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {!user && (
        <section className="container">
          <div className={styles.band}>
            <div>
              <span className={styles.bandEyebrow}>Organisateurs</span>
              <h2>Vous organisez des événements ?</h2>
              <p>
                Publiez vos dates, suivez vos ventes en temps réel et scannez les billets à
                l’entrée.
              </p>
            </div>
            <Link to="/inscription/organisateur" className="btn btn-primary">
              Devenir organisateur
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
