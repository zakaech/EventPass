import { useContext } from 'react';
import { AuthContext } from '../context/authContext';

/** Accès au contexte d'authentification depuis n'importe quel composant. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>');
  }
  return context;
}
