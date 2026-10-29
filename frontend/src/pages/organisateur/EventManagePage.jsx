import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import {
  cancelEvent,
  getEventStats,
  getMyEvent,
  listReservations,
} from '../../services/organisateurService';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { StatCard, ProgressBar } from '../../components/StatCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Pagination } from '../../components/Pagination';
import { PageLoader, Loader } from '../../components/Loader';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import {
  formatDateTime,
  formatNumber,
  formatPrice,
  formatShortDate,
  formatTime,
} from '../../utils/format';
import { shortCode } from '../../utils/events';
import { getErrorMessage } from '../../utils/errors';
import styles from './organisateur.module.css';

export function EventManagePage() {
  const { id } = useParams();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState(
    location.state?.flash ? { type: 'success', message: location.state.flash } : null,
  );

  // L'événement et ses statistiques sont chargés en parallèle (Promise.all) ;
  // les réservations ont leur propre chargement, relancé à chaque changement de page.
  const overview = useAsync(() => Promise.all([getMyEvent(id), getEventStats(id)]), [id]);
  const reservations = useAsync(() => listReservations(id, { page, limit: 10 }), [id, page]);
  useDocumentTitle(overview.data?.[0].titre ?? 'Gestion de l’événement');

  if (overview.loading && !overview.data) return <PageLoader />;
  if (overview.error) {
    return (
      <div className="container page">
        <Alert variant="error">{getErrorMessage(overview.error)}</Alert>
      </div>
    );
  }

  const [event, stats] = overview.data;

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const result = await cancelEvent(event.id);
      setFeedback({
        type: 'success',
        message: `Événement annulé. ${result.billets_annules} billet(s) annulé(s).`,
      });
      overview.reload();
      reservations.reload();
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="container page">
      <Link to="/organisateur" className={styles.back}>
        ← Mes événements
      </Link>
      <PageHeader
        eyebrow={formatDateTime(event.date_debut)}
        title={event.titre}
        actions={
          <>
            <Link to={`/evenements/${event.id}`} className="btn btn-ghost">
              Page publique
            </Link>
            {event.checkin_ouvert && (
              <Link to={`/organisateur/scanner?event=${event.id}`} className="btn btn-dark">
                Scanner les billets
              </Link>
            )}
            {event.statut === 'PUBLIE' && (
              <>
                <Link
                  to={`/organisateur/evenements/${event.id}/modifier`}
                  className="btn btn-outline"
                >
                  Modifier
                </Link>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setConfirmOpen(true)}
                >
                  Annuler l’événement
                </button>
              </>
            )}
          </>
        }
      >
        {event.lieu}, {event.ville} · {formatPrice(event.prix)} ·{' '}
        <StatusBadge statut={event.statut} />
      </PageHeader>

      <div className="stack">
        {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}

        <div className={styles.stats}>
          <StatCard
            label="Billets vendus"
            value={formatNumber(stats.billets_vendus)}
            hint={`sur ${formatNumber(stats.capacite)} places`}
            accent
          />
          <StatCard
            label="Taux de remplissage"
            value={`${formatNumber(stats.taux_remplissage)} %`}
          />
          <StatCard
            label="Check-ins"
            value={formatNumber(stats.check_ins)}
            hint={
              stats.dernier_check_in
                ? `${formatNumber(stats.taux_presence)} % des billets · dernier à ${formatTime(stats.dernier_check_in)}`
                : 'Aucun billet scanné'
            }
          />
          <StatCard label="Chiffre d’affaires" value={formatPrice(stats.chiffre_affaires)} />
          <StatCard label="Annulations" value={formatNumber(stats.billets_annules)} />
        </div>

        <div className="card card-pad">
          <div className={styles.fillHead}>
            <strong>Remplissage</strong>
            <span className="muted">
              {formatNumber(stats.places_restantes)} place(s) restante(s)
            </span>
          </div>
          <ProgressBar value={stats.billets_vendus} max={stats.capacite} label="Remplissage" />
        </div>

        <section className="card">
          <div className={styles.tableHead}>
            <h2>Réservations</h2>
            {reservations.data && (
              <span className="muted">
                {formatNumber(reservations.data.pagination.total)} billet(s)
              </span>
            )}
          </div>

          {reservations.error && (
            <div className="card-pad">
              <Alert variant="error">{getErrorMessage(reservations.error)}</Alert>
            </div>
          )}
          {reservations.loading && !reservations.data && (
            <div className="card-pad">
              <Loader />
            </div>
          )}
          {reservations.data?.data.length === 0 && (
            <div className="card-pad">
              <EmptyState title="Aucune réservation">
                Les billets réservés apparaîtront ici en temps réel.
              </EmptyState>
            </div>
          )}
          {reservations.data?.data.length > 0 && (
            // Le tableau défile horizontalement dans sa carte sur petit écran
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Spectateur</th>
                    <th>Billet</th>
                    <th>Réservé le</th>
                    <th>Statut</th>
                    <th>Entrée</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.data.data.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <strong>{ticket.nom}</strong>
                        <br />
                        <span className="muted">{ticket.email}</span>
                      </td>
                      <td className="mono">{shortCode(ticket.code)}</td>
                      <td>{formatShortDate(ticket.reserved_at)}</td>
                      <td>
                        <StatusBadge statut={ticket.statut} />
                      </td>
                      <td>
                        {ticket.checked_in_at ? (
                          formatTime(ticket.checked_in_at)
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reservations.data?.pagination.totalPages > 1 && (
            <div className={styles.tableFoot}>
              <Pagination pagination={reservations.data.pagination} onPageChange={setPage} />
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Annuler cet événement ?"
        confirmLabel="Oui, annuler l’événement"
        confirmVariant="btn-danger"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          Les {formatNumber(stats.billets_vendus)} billet(s) vendu(s) seront annulés et l’événement
          ne sera plus réservable. Cette action est définitive.
        </p>
      </ConfirmDialog>
    </div>
  );
}
