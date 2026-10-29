import { useEffect } from 'react';
import { Link } from 'react-router';
import { listMyEvents } from '../../services/organisateurService';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/PageHeader';
import { EventArt } from '../../components/EventArt';
import { StatusBadge } from '../../components/StatusBadge';
import { StatCard, ProgressBar } from '../../components/StatCard';
import { PageLoader } from '../../components/Loader';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { formatDateTime, formatNumber, formatPrice } from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';
import styles from './organisateur.module.css';

export function DashboardPage() {
  useDocumentTitle('Espace organisateur');
  const { user, refreshUser } = useAuth();

  // Le statut de validation peut avoir changé depuis la connexion (action de l'admin)
  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  const statut = user.organisateur?.statut_validation;

  if (statut !== 'VALIDE') {
    return (
      <div className="container page">
        <PageHeader eyebrow={user.organisateur?.nom_organisation} title="Espace organisateur" />
        {statut === 'REFUSE' ? (
          <Alert variant="error" title="Demande refusée">
            Votre compte organisateur n’a pas été validé. Contactez le support pour en savoir plus.
          </Alert>
        ) : (
          <EmptyState title="Votre compte est en cours de vérification">
            Un administrateur doit valider votre compte avant que vous puissiez publier des
            événements. Revenez un peu plus tard : cette page se mettra à jour automatiquement.
          </EmptyState>
        )}
      </div>
    );
  }

  return <ValidatedDashboard organisation={user.organisateur.nom_organisation} />;
}

function ValidatedDashboard({ organisation }) {
  const { data, loading, error } = useAsync(() => listMyEvents({ limit: 50 }), []);

  if (loading && !data) return <PageLoader />;

  const events = data?.data ?? [];
  const actifs = events.filter((e) => e.statut === 'PUBLIE');
  const vendus = (e) => e.capacite - e.places_restantes;
  const totalVendus = events
    .filter((e) => e.statut !== 'ANNULE')
    .reduce((s, e) => s + vendus(e), 0);
  const capaciteActive = actifs.reduce((s, e) => s + e.capacite, 0);
  const vendusActifs = actifs.reduce((s, e) => s + vendus(e), 0);

  return (
    <div className="container page">
      <PageHeader
        eyebrow={organisation}
        title="Mes événements"
        actions={
          <>
            <Link to="/organisateur/scanner" className="btn btn-outline">
              Scanner les billets
            </Link>
            <Link to="/organisateur/evenements/nouveau" className="btn btn-primary">
              + Créer un événement
            </Link>
          </>
        }
      />

      {error && <Alert variant="error">{getErrorMessage(error)}</Alert>}

      <div className={`${styles.stats} ${styles.statsSpaced}`}>
        <StatCard label="Événements en vente" value={actifs.length} accent />
        <StatCard label="Billets vendus" value={formatNumber(totalVendus)} hint="Tous événements" />
        <StatCard
          label="Remplissage moyen"
          value={`${capaciteActive ? Math.round((vendusActifs / capaciteActive) * 100) : 0} %`}
          hint="Événements en vente"
        />
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="Aucun événement pour l’instant"
          action={
            <Link to="/organisateur/evenements/nouveau" className="btn btn-primary">
              Créer mon premier événement
            </Link>
          }
        >
          Publiez votre premier événement : il sera immédiatement visible et réservable.
        </EmptyState>
      ) : (
        <ul className={styles.eventList}>
          {events.map((event) => (
            <li key={event.id} className={styles.eventRow}>
              <EventArt event={event} size="sm" />
              <div className={styles.eventRowInfo}>
                <div className="row">
                  <Link
                    to={`/organisateur/evenements/${event.id}`}
                    className={styles.eventRowTitle}
                  >
                    {event.titre}
                  </Link>
                  <StatusBadge statut={event.statut} />
                </div>
                <p className="muted">
                  {formatDateTime(event.date_debut)} · {event.lieu}, {event.ville} ·{' '}
                  {formatPrice(event.prix)}
                </p>
              </div>
              <div className={styles.eventRowProgress}>
                <span className={styles.eventRowSold}>
                  {event.statut === 'ANNULE'
                    ? 'Annulé'
                    : `${formatNumber(vendus(event))} / ${formatNumber(event.capacite)} vendus`}
                </span>
                {event.statut !== 'ANNULE' && (
                  <ProgressBar value={vendus(event)} max={event.capacite} label="Remplissage" />
                )}
              </div>
              <div className={styles.eventRowActions}>
                <Link to={`/organisateur/evenements/${event.id}`} className="btn btn-dark btn-sm">
                  Gérer
                </Link>
                {event.statut === 'PUBLIE' && (
                  <Link
                    to={`/organisateur/evenements/${event.id}/modifier`}
                    className="btn btn-outline btn-sm"
                  >
                    Modifier
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
