import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { PageLoader } from './Loader';
import { HOME_BY_ROLE } from '../utils/constants';

/**
 * Route protégée : n'affiche les routes enfants (<Outlet />) que si l'utilisateur est
 * connecté ET possède un des rôles autorisés. Sinon, redirection.
 * C'est un confort d'interface : la vraie sécurité reste côté API (middlewares de rôles).
 */
export function ProtectedRoute({ roles }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <PageLoader />;
  }

  if (!user) {
    // On mémorise la page demandée pour y revenir après la connexion
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace />;
  }

  return <Outlet />;
}
