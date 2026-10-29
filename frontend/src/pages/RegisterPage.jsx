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

export function RegisterPage() {
  useDocumentTitle('Créer un compte');
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Déjà connecté (ou inscription qui vient de réussir) : même destination que onSubmit()
  if (user) {
    return <Navigate to={user.role === 'USER' ? '/evenements' : HOME_BY_ROLE[user.role]} replace />;
  }

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await register(form);
      navigate('/evenements', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Gratuit, et prêt en moins d’une minute."
      aside={
        <>
          <h2>Un compte, tous vos billets.</h2>
          <ul className={styles.perks}>
            <li>Réservez jusqu’à 4 places par événement</li>
            <li>Retrouvez vos billets à tout moment</li>
            <li>Annulation gratuite jusqu’à 24 h avant</li>
          </ul>
        </>
      }
    >
      {error && <Alert variant="error">{error}</Alert>}
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <FormField label="Nom complet" error={fieldErrors.nom}>
          {(id, props) => (
            <input
              id={id}
              {...props}
              name="nom"
              autoComplete="name"
              className="input"
              value={form.nom}
              onChange={update}
            />
          )}
        </FormField>
        <FormField label="Email" error={fieldErrors.email}>
          {(id, props) => (
            <input
              id={id}
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              className="input"
              value={form.email}
              onChange={update}
            />
          )}
        </FormField>
        <FormField label="Mot de passe" error={fieldErrors.password} hint="8 caractères minimum">
          {(id, props) => (
            <input
              id={id}
              {...props}
              name="password"
              type="password"
              autoComplete="new-password"
              className="input"
              value={form.password}
              onChange={update}
            />
          )}
        </FormField>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
      <p className={styles.switch}>
        Déjà inscrit ? <Link to="/connexion">Se connecter</Link>. Vous êtes organisateur ?{' '}
        <Link to="/inscription/organisateur">Inscription organisateur</Link>.
      </p>
    </AuthShell>
  );
}
