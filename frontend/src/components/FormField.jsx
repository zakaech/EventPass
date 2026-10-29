import { useId } from 'react';
import styles from './ui.module.css';

/**
 * Champ de formulaire accessible : le label est relié à l'input (htmlFor/id) et le
 * message d'erreur est annoncé par les lecteurs d'écran (aria-describedby).
 * `children` reçoit l'id à poser sur l'input : <FormField>{(id, props) => <input id={id} {...props} />}</FormField>
 */
export function FormField({ label, error, hint, children }) {
  const id = useId();
  const messageId = `${id}-message`;
  const fieldProps = {
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error || hint ? messageId : undefined,
  };

  return (
    <div className={styles.field}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children(id, fieldProps)}
      {(error || hint) && (
        <p id={messageId} className={error ? styles.fieldError : styles.fieldHint}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
