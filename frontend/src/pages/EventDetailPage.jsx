import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { getEvent, reserveTickets } from '../services/eventService';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EventArt } from '../components/EventArt';
import { StatusBadge } from '../components/StatusBadge';
import { ProgressBar } from '../components/StatCard';
import { PageLoader } from '../components/Loader';
import { Alert } from '../components/Alert';
import { getCategory, MAX_BILLETS_PAR_EVENEMENT } from '../utils/constants';
import { formatDate, formatTime, formatPrice } from '../utils/format';
import { availability } from '../utils/events';
import { getErrorMessage } from '../utils/errors';
import styles from './EventDetailPage.module.css';

export function EventDetailPage() {
  const { id } = useParams();
  const { data: event, loading, error, setData } = useAsync(() => getEvent(id), [id]);
  useDocumentTitle(event?.titre ?? 'Événement');

  if (loading && !event) return <PageLoader />;

  if (error) {
    return (
      <div className="container page">
        <Alert variant="error" title="Événement introuvable">
          {getErrorMessage(error)} <Link to="/evenements">Retour aux événements</Link>
        </Alert>
      </div>
    );
  }

  const category = getCategory(event.categorie);
  const vendus = event.capacite - event.places_restantes;

  return (
    <div className="container page">
      <Link to="/evenements" className={styles.back}>
        ← Tous les événements
      </Link>

      <div className={styles.layout}>
        <article className={styles.main}>
          <EventArt event={event} size="lg" />

          <header className={styles.header}>
            <div className="row">
              <span className={styles.category} style={{ '--cat-color': category.color }}>
                {category.label}
              </span>
              {event.statut !== 'PUBLIE' && <StatusBadge statut={event.statut} />}
            </div>
            <h1 className={styles.title}>{event.titre}</h1>
            <p className="muted">Proposé par {event.nom_organisation}</p>
          </header>

          <dl className={styles.facts}>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(event.date_debut)}</dd>
            </div>
            <div>
              <dt>Heure</dt>
              <dd>{formatTime(event.date_debut)}</dd>
            </div>
            <div>
              <dt>Lieu</dt>
              <dd>
                {event.lieu}, {event.ville}
              </dd>
            </div>
          </dl>

          {event.description && (
            <section className={styles.description}>
              <h2>À propos</h2>
              <p>{event.description}</p>
            </section>
          )}
        </article>

        <aside className={styles.aside}>
          <BookingPanel
            event={event}
            vendus={vendus}
            onReserved={(placesRestantes) =>
              setData((current) => ({ ...current, places_restantes: placesRestantes }))
            }
          />
        </aside>
      </div>
    </div>
  );
}

/** Panneau de réservation, en forme de billet à détacher. */
function BookingPanel({ event, vendus, onReserved }) {
  const { user } = useAuth();
  const location = useLocation();
  const [quantite, setQuantite] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success' | 'error', message }

  const dispo = availability(event);
  const maxQuantite = Math.min(MAX_BILLETS_PAR_EVENEMENT, event.places_restantes);
  const quantiteAffichee = Math.min(quantite, Math.max(maxQuantite, 1));
  const ouvert = event.statut === 'PUBLIE' && event.places_restantes > 0;

  const reserve = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const data = await reserveTickets(event.id, quantiteAffichee);
      onReserved(data.places_restantes);
      setResult({
        type: 'success',
        message: `${data.tickets.length} billet${data.tickets.length > 1 ? 's' : ''} réservé${
          data.tickets.length > 1 ? 's' : ''
        } !`,
      });
      setQuantite(1);
    } catch (error) {
      setResult({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelTop}>
        <span className={styles.panelLabel}>Prix par billet</span>
        <span className={styles.price}>{formatPrice(event.prix)}</span>
        <span className={`${styles.dispo} ${styles[dispo.tone]}`}>{dispo.label}</span>
        <ProgressBar value={vendus} max={event.capacite} label="Places vendues" />
      </div>

      <div className={styles.panelPerforation} aria-hidden="true" />

      <div className={styles.panelBottom}>
        {result && (
          <Alert
            variant={result.type}
            action={
              result.type === 'success' && (
                <Link to="/mes-billets" className="btn btn-dark btn-sm">
                  Mes billets
                </Link>
              )
            }
          >
            {result.message}
          </Alert>
        )}

        {event.statut === 'ANNULE' && (
          <Alert variant="error">Cet événement a été annulé par l’organisateur.</Alert>
        )}
        {event.statut === 'TERMINE' && <Alert>Cet événement est terminé.</Alert>}
        {event.statut === 'PUBLIE' && event.places_restantes === 0 && (
          <Alert variant="warning">Toutes les places ont été vendues.</Alert>
        )}

        {ouvert && !user && (
          <Link
            to="/connexion"
            state={{ from: location.pathname }}
            className="btn btn-primary btn-block"
          >
            Se connecter pour réserver
          </Link>
        )}

        {ouvert && user && user.role !== 'USER' && (
          <p className="muted">La réservation est réservée aux comptes spectateurs.</p>
        )}

        {ouvert && user?.role === 'USER' && (
          <>
            <div className={styles.quantity}>
              <span className="label" id="quantite-label">
                Nombre de billets
              </span>
              <div className={styles.stepper} role="group" aria-labelledby="quantite-label">
                <button
                  type="button"
                  aria-label="Retirer un billet"
                  disabled={quantiteAffichee <= 1}
                  onClick={() => setQuantite(quantiteAffichee - 1)}
                >
                  −
                </button>
                <output aria-live="polite">{quantiteAffichee}</output>
                <button
                  type="button"
                  aria-label="Ajouter un billet"
                  disabled={quantiteAffichee >= maxQuantite}
                  onClick={() => setQuantite(quantiteAffichee + 1)}
                >
                  +
                </button>
              </div>
            </div>
            <div className={styles.total}>
              <span>Total</span>
              <strong>{formatPrice(event.prix * quantiteAffichee)}</strong>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={reserve}
              disabled={submitting}
            >
              {submitting ? 'Réservation…' : 'Réserver'}
            </button>
            <p className={styles.note}>
              {MAX_BILLETS_PAR_EVENEMENT} billets maximum par personne. Annulation gratuite jusqu’à
              24 h avant.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
