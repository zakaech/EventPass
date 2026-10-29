import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/inter';
import './styles/global.css';
import { AuthProvider } from './context/AuthProvider';
import { App } from './App';

// Ordre des « providers » : le routeur englobe l'AuthProvider, car celui-ci
// utilise useNavigate pour rediriger après une déconnexion forcée (401).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
