import { useState } from 'react';
import { Link } from 'react-router';
import { listMyTickets, cancelTicket } from '../services/ticketService';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { EventArt } from '../components/EventArt';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageLoader } from '../components/Loader';
import { Alert } from '../components/Alert';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime, formatPrice, formatShortDate, pluralize } from '../utils/format';
import { canCancelTicket, groupTicketsByEvent, shortCode } from '../utils/events';
import { getErrorMessage } from '../utils/errors';
import styles from './MyTicketsPage.module.css';

export function MyTicketsPage() {
  useDocumentTitle('Mes billets');
  const { data, loading, error, reload } = useAsync(() => listMyTickets({ limit: 50 }), []);
  const [toCancel, setToCancel] = useState(null); // billet sélectionné pour l'annulation
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (loading && !data) return <PageLoader />;

  const groups = data ? groupTicketsByEvent(data.data) : [];
  const upcoming = groups.filter((g) => g.event.statut === 'PUBLIE');
  const past = groups.filter((g) => g.event.statut !== 'PUBLIE');

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelTicket(toCancel.id);
      setFeedback({ type: 'success', message: 'Billet annulé : la place a été remise en vente.' });
      reload();
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setCancelling(false);
      setToCancel(null);
    }
  };

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Mon espace"
        title="Mes billets"
        actions={
          <Link to="/evenements" className="btn btn-outline">
            Trouver un événement
          </Link>
        }
      >
        Présentez vos billets à l’entrée. Annulation possible jusqu’à 24 h avant l’événement.
      </PageHeader>

      <div className="stack">
        {error && <Alert variant="error">{getErrorMessage(error)}</Alert>}
        {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}

        {data && groups.length === 0 && (
          <EmptyState
            title="Aucun billet pour le moment"
            action={
              <Link to="/evenements" className="btn btn-primary">
                Parcourir les événements
              </Link>
            }
          >
            Vos réservations apparaîtront ici.
          </EmptyState>
        )}

        {upcoming.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>À venir</h2>
            {upcoming.map((group) => (
              <TicketGroup key={group.event.id} group={group} onCancel={setToCancel} />
            ))}
          </section>
        )}

        {past.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Historique</h2>
            {past.map((group) => (
              <TicketGroup key={group.event.id} group={group} onCancel={setToCancel} />
            ))}
          </section>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Annuler ce billet ?"
        confirmLabel="Annuler le billet"
        confirmVariant="btn-danger"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setToCancel(null)}
      >
        {toCancel && (
          <p>
            Le billet <span className="mono">{shortCode(toCancel.code)}</span> pour «{' '}
            {toCancel.titre} » sera annulé et la place remise en vente. Cette action est définitive.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Un événement et ses billets, présentés comme une souche + des coupons détachables. */
function TicketGroup({ group, onCancel }) {
  const { event, tickets } = group;
  const actifs = tickets.filter((t) => t.statut !== 'ANNULE').length;

  return (
    <article className={styles.group}>
      <div className={styles.event}>
        <EventArt event={event} size="sm" />
        <div className={styles.eventInfo}>
          <Link to={`/evenements/${event.id}`} className={styles.eventTitle}>
            {event.titre}
          </Link>
          <p className="muted">{formatDateTime(event.date_debut)}</p>
          <p className="muted">
            {event.lieu} · {event.ville}
          </p>
          <div className="row">
            {event.statut !== 'PUBLIE' && <StatusBadge statut={event.statut} />}
            <span className={styles.count}>
              {pluralize(actifs, 'billet actif', 'billets actifs')} · {formatPrice(event.prix)}{' '}
              l’unité
            </span>
          </div>
        </div>
      </div>

      <ul className={styles.tickets}>
        {tickets.map((ticket, index) => {
          const cancellable = canCancelTicket(ticket);
          return (
            <li
              key={ticket.id}
              className={`${styles.ticket} ${ticket.statut === 'ANNULE' ? styles.cancelled : ''}`}
            >
              <div className={styles.ticketMain}>
                <span className={styles.ticketLabel}>Billet {index + 1}</span>
                <span className={styles.code}>{shortCode(ticket.code)}</span>
                <span className={styles.reserved}>
                  Réservé le {formatShortDate(ticket.reserved_at)}
                </span>
              </div>
              <div className={styles.ticketSide}>
                <StatusBadge statut={ticket.statut} />
                {cancellable && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onCancel({ ...ticket, titre: event.titre })}
                  >
                    Annuler
                  </button>
                )}
                {ticket.statut === 'VALIDE' && !cancellable && event.statut === 'PUBLIE' && (
                  <span className={styles.hint}>Non annulable (moins de 24 h)</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
