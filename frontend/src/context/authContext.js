import { createContext } from 'react';

// Le Context permet de partager une valeur (ici : l'utilisateur connecté et les actions
// login/logout) avec tous les composants, sans la passer de parent en enfant via les props.
// Défini dans un fichier séparé du Provider pour que le rechargement à chaud de Vite
// fonctionne (un fichier de composants ne doit exporter que des composants).
export const AuthContext = createContext(null);
