import { useEffect, useRef } from 'react';
import styles from './ui.module.css';

/**
 * Boîte de confirmation basée sur l'élément HTML natif <dialog> : le navigateur gère
 * le focus, la touche Échap et le fond assombri. useRef donne accès au nœud DOM
 * pour appeler showModal()/close(), que React ne pilote pas directement.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirmer',
  confirmVariant = 'btn-primary',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault(); // Échap : on laisse le parent décider de fermer
        if (!loading) onCancel();
      }}
    >
      <h2 className={styles.dialogTitle}>{title}</h2>
      <div className={styles.dialogBody}>{children}</div>
      <div className={styles.dialogActions}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
          Retour
        </button>
        <button
          type="button"
          className={`btn ${confirmVariant}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Patientez…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
