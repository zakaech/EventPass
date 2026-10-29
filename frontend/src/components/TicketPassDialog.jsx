import { useEffect, useRef } from 'react';
import { TicketQr } from './TicketQr';
import { formatDateTime } from '../utils/format';
import styles from './TicketPassDialog.module.css';

/**
 * Billet affiché en grand, à présenter à l'entrée : QR code + code de secours.
 * `pass` vaut null (fermé) ou { ticket, event, numero }.
 */
export function TicketPassDialog({ pass, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (pass && !dialog.open) dialog.showModal();
    if (!pass && dialog.open) dialog.close();
  }, [pass]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Billet à présenter à l’entrée"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Clic sur le fond assombri (en dehors du billet) : on ferme
      onClick={(event) => event.target === dialogRef.current && onClose()}
    >
      {pass && (
        <div className={styles.pass}>
          <div className={styles.head}>
            <span className={styles.eyebrow}>Billet {pass.numero}</span>
            <h2 className={styles.title}>{pass.event.titre}</h2>
            <p className={styles.meta}>{formatDateTime(pass.event.date_debut)}</p>
            <p className={styles.meta}>
              {pass.event.lieu} · {pass.event.ville}
            </p>
          </div>

          <div className={styles.perforation} aria-hidden="true" />

          <div className={styles.body}>
            <TicketQr value={pass.ticket.qr_token} size={232} label="QR code à scanner" />
            <p className={styles.hint}>Présentez ce QR code à l’entrée (luminosité au maximum).</p>
            <div className={styles.backup}>
              <span>Code de secours</span>
              <strong>{pass.ticket.code_secours}</strong>
            </div>
            <button type="button" className="btn btn-outline btn-block" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
