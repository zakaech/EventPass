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
import { TicketQr } from '../components/TicketQr';
import { TicketPassDialog } from '../components/TicketPassDialog';
import {
  formatDateTime,
  formatPrice,
  formatShortDate,
  formatTime,
  pluralize,
} from '../utils/format';
import { canCancelTicket, groupTicketsByEvent, isCurrentGroup, shortCode } from '../utils/events';
import { getErrorMessage } from '../utils/errors';
import styles from './MyTicketsPage.module.css';

export function MyTicketsPage() {
  useDocumentTitle('Mes billets');
  const { data, loading, error, reload } = useAsync(() => listMyTickets({ limit: 50 }), []);
  const [toCancel, setToCancel] = useState(null); // billet sélectionné pour l'annulation
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pass, setPass] = useState(null); // billet affiché en grand : { ticket, event, numero }

  if (loading && !data) return <PageLoader />;

  const groups = data ? groupTicketsByEvent(data.data) : [];
  const upcoming = groups.filter(isCurrentGroup);
  const past = groups.filter((g) => !isCurrentGroup(g));

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
            <h2 className={styles.sectionTitle}>À venir et en cours</h2>
            {upcoming.map((group) => (
              <TicketGroup
                key={group.event.id}
                group={group}
                onCancel={setToCancel}
                onShowPass={setPass}
              />
            ))}
          </section>
        )}

        {past.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Historique</h2>
            {past.map((group) => (
              <TicketGroup
                key={group.event.id}
                group={group}
                onCancel={setToCancel}
                onShowPass={setPass}
              />
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

      <TicketPassDialog pass={pass} onClose={() => setPass(null)} />
    </div>
  );
}

/** Un événement et ses billets, présentés comme une souche + des coupons détachables. */
function TicketGroup({ group, onCancel, onShowPass }) {
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
              {ticket.qr_token && (
                <button
                  type="button"
                  className={styles.qrButton}
                  onClick={() => onShowPass({ ticket, event, numero: index + 1 })}
                  aria-label={`Afficher le QR code du billet ${index + 1}`}
                >
                  <TicketQr value={ticket.qr_token} size={56} label="" />
                </button>
              )}
              <div className={styles.ticketMain}>
                <span className={styles.ticketLabel}>Billet {index + 1}</span>
                <span className={styles.code}>{shortCode(ticket.code)}</span>
                <span className={styles.reserved}>
                  {ticket.statut === 'UTILISE' && ticket.checked_in_at
                    ? `Scanné le ${formatShortDate(ticket.checked_in_at)} à ${formatTime(ticket.checked_in_at)}`
                    : `Réservé le ${formatShortDate(ticket.reserved_at)}`}
                </span>
              </div>
              <div className={styles.ticketSide}>
                <StatusBadge statut={ticket.statut} />
                {ticket.qr_token && (
                  <button
                    type="button"
                    className="btn btn-dark btn-sm"
                    onClick={() => onShowPass({ ticket, event, numero: index + 1 })}
                  >
                    Afficher
                  </button>
                )}
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
