import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AuthShell } from '../components/AuthShell';
import { FormField } from '../components/FormField';
import { Alert } from '../components/Alert';
import { HOME_BY_ROLE } from '../utils/constants';
import { getErrorMessage } from '../utils/errors';
import styles from './auth.module.css';

// Comptes créés par le script de seed du backend (npm run db:seed)
const DEMO_ACCOUNTS = [
  { email: 'alice@eventpass.dev', role: 'Spectateur', name: 'Alice Martin' },
  { email: 'sonora@eventpass.dev', role: 'Organisateur', name: 'Sonora Productions' },
  { email: 'admin@eventpass.dev', role: 'Admin', name: 'Administration' },
];
const DEMO_PASSWORD = 'Password123!';

export function LoginPage() {
  useDocumentTitle('Connexion');
  const { login, user, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Page d'où vient l'utilisateur (route protégée, bouton « Se connecter pour réserver »)
  const from = location.state?.from;

  // Déjà connecté (ou connexion qui vient de réussir) : même destination que submit()
  if (user) {
    return <Navigate to={from ?? HOME_BY_ROLE[user.role]} replace />;
  }

  const submit = async (credentials) => {
    setSubmitting(true);
    setError(null);
    try {
      const me = await login(credentials);
      navigate(from ?? HOME_BY_ROLE[me.role], { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  return (
    <AuthShell
      title="Bon retour parmi nous"
      subtitle="Connectez-vous pour réserver et retrouver vos billets."
      aside={
        <>
          <h2>Envie de tester ?</h2>
          <p>Connectez-vous en un clic avec un compte de démonstration.</p>
          <div className={styles.demo}>
            <span className={styles.demoTitle}>Comptes de démo</span>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className={styles.demoButton}
                disabled={submitting}
                onClick={() => submit({ email: account.email, password: DEMO_PASSWORD })}
              >
                <span>
                  {account.name}
                  <br />
                  <small>{account.email}</small>
                </span>
                <span className={styles.demoRole}>{account.role}</span>
              </button>
            ))}
          </div>
        </>
      }
    >
      {sessionExpired && (
        <Alert variant="warning">Votre session a expiré. Merci de vous reconnecter.</Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit(form);
        }}
      >
        <FormField label="Email">
          {(id, props) => (
            <input
              id={id}
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={form.email}
              onChange={update}
            />
          )}
        </FormField>
        <FormField label="Mot de passe">
          {(id, props) => (
            <input
              id={id}
              {...props}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={form.password}
              onChange={update}
            />
          )}
        </FormField>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className={styles.switch}>
        Pas encore de compte ? <Link to="/inscription">Créer un compte spectateur</Link> ou{' '}
        <Link to="/inscription/organisateur">devenir organisateur</Link>.
      </p>
    </AuthShell>
  );
}
