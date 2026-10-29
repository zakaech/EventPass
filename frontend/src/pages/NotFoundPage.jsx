import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  useDocumentTitle('Page introuvable');
  return (
    <div className="container page">
      <EmptyState
        title="Ce billet ne mène nulle part"
        action={
          <Link to="/" className="btn btn-dark">
            Retour à l’accueil
          </Link>
        }
      >
        La page demandée n’existe pas ou a été déplacée.
      </EmptyState>
    </div>
  );
}
