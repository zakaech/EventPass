import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from './authContext';
import { setUnauthorizedHandler } from '../services/api';
import { tokenStorage } from '../services/tokenStorage';
import * as authService from '../services/authService';

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // "loading" tant qu'on vérifie un jeton déjà présent au chargement de la page
  const [status, setStatus] = useState(() => (tokenStorage.get() ? 'loading' : 'ready'));
  // Vrai quand la session vient d'être coupée par un 401 (affiché sur la page de connexion)
  const [sessionExpired, setSessionExpired] = useState(false);

  // Au démarrage : si un jeton est stocké, on récupère l'utilisateur correspondant.
  useEffect(() => {
    if (!tokenStorage.get()) return;
    let cancelled = false;
    authService
      .getMe()
      .then((me) => !cancelled && setUser(me))
      .catch(() => tokenStorage.clear())
      .finally(() => !cancelled && setStatus('ready'));
    // Nettoyage : si le composant est démonté avant la réponse, on ignore le résultat
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Vide la session ET change de page dans un seul rendu.
   * React Router exécute navigate() dans une « transition » (mise à jour non urgente).
   * Sans startTransition, setUser(null) serait rendu en premier, sur l'ancienne page :
   * si elle est protégée, <ProtectedRoute> redirigerait vers /connexion avant que notre
   * navigate() ne s'applique. Regroupées dans la même transition, les deux mises à jour
   * sont appliquées ensemble.
   */
  const endSession = useCallback(
    (to, options) => {
      tokenStorage.clear();
      startTransition(() => {
        setUser(null);
        navigate(to, options);
      });
    },
    [navigate],
  );

  // Branche l'intercepteur axios : sur un 401, on vide la session et on redirige.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionExpired(true);
      endSession('/connexion', { replace: true, state: { from: window.location.pathname } });
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // Après connexion/inscription : on stocke le jeton puis on charge le profil complet
  // (/auth/me renvoie aussi le statut de validation des organisateurs).
  const startSession = useCallback(async ({ token }) => {
    tokenStorage.set(token);
    const me = await authService.getMe();
    setSessionExpired(false);
    setUser(me);
    return me;
  }, []);

  const login = useCallback(
    async (credentials) => startSession(await authService.login(credentials)),
    [startSession],
  );

  const register = useCallback(
    async (payload) => startSession(await authService.register(payload)),
    [startSession],
  );

  const registerOrganisateur = useCallback(
    async (payload) => startSession(await authService.registerOrganisateur(payload)),
    [startSession],
  );

  const logout = useCallback(() => {
    setSessionExpired(false);
    endSession('/');
  }, [endSession]);

  const refreshUser = useCallback(async () => {
    const me = await authService.getMe();
    setUser(me);
    return me;
  }, []);

  // useMemo : l'objet n'est recréé que si une valeur change, ce qui évite de
  // re-rendre inutilement tous les composants qui lisent ce contexte.
  const value = useMemo(
    () => ({
      user,
      status,
      sessionExpired,
      isAuthenticated: Boolean(user),
      login,
      register,
      registerOrganisateur,
      logout,
      refreshUser,
    }),
    [user, status, sessionExpired, login, register, registerOrganisateur, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
