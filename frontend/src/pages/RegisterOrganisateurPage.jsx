import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AuthShell } from '../components/AuthShell';
import { FormField } from '../components/FormField';
import { Alert } from '../components/Alert';
import { HOME_BY_ROLE } from '../utils/constants';
import { getErrorMessage, getFieldErrors } from '../utils/errors';
import styles from './auth.module.css';

const EMPTY = {
  nom: '',
  email: '',
  password: '',
  nom_organisation: '',
  ville: '',
  description: '',
};

export function RegisterOrganisateurPage() {
  useDocumentTitle('Inscription organisateur');
  const { registerOrganisateur, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const payload = { ...form };
    if (!payload.description.trim()) delete payload.description;
    try {
      await registerOrganisateur(payload);
      navigate('/organisateur', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  };

  const field = (name, label, inputProps = {}) => (
    <FormField label={label} error={fieldErrors[name]} hint={inputProps.hint}>
      {(id, props) => (
        <input
          id={id}
          {...props}
          name={name}
          className="input"
          value={form[name]}
          onChange={update}
          type={inputProps.type ?? 'text'}
          autoComplete={inputProps.autoComplete}
        />
      )}
    </FormField>
  );

  return (
    <AuthShell
      title="Devenir organisateur"
      subtitle="Votre compte sera activé après vérification par notre équipe."
      aside={
        <>
          <h2>Remplissez vos salles.</h2>
          <ul className={styles.perks}>
            <li>Publiez vos événements en quelques minutes</li>
            <li>Suivez vos ventes et votre taux de remplissage</li>
            <li>Contrôlez les billets à l’entrée depuis votre téléphone</li>
          </ul>
        </>
      }
    >
      {error && <Alert variant="error">{error}</Alert>}
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.grid2}>
          {field('nom_organisation', 'Nom de l’organisation')}
          {field('ville', 'Ville')}
        </div>
        <FormField label="Présentation (facultatif)" error={fieldErrors.description}>
          {(id, props) => (
            <textarea
              id={id}
              {...props}
              name="description"
              className="textarea"
              value={form.description}
              onChange={update}
            />
          )}
        </FormField>
        <div className={styles.grid2}>
          {field('nom', 'Votre nom', { autoComplete: 'name' })}
          {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        </div>
        {field('password', 'Mot de passe', {
          type: 'password',
          autoComplete: 'new-password',
          hint: '8 caractères minimum',
        })}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Envoi…' : 'Envoyer ma demande'}
        </button>
      </form>
      <p className={styles.switch}>
        Déjà inscrit ? <Link to="/connexion">Se connecter</Link>.
      </p>
    </AuthShell>
  );
}
