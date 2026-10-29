import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RegisterOrganisateurPage } from './pages/RegisterOrganisateurPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { DashboardPage } from './pages/organisateur/DashboardPage';
import { EventFormPage } from './pages/organisateur/EventFormPage';
import { EventManagePage } from './pages/organisateur/EventManagePage';
import { AdminPage } from './pages/admin/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PageLoader } from './components/Loader';

// Chargement à la demande : la page de scan embarque un décodeur de QR code volumineux
// (html5-qrcode). Avec lazy(), Vite la place dans un fichier séparé, téléchargé seulement
// quand un organisateur ouvre le scanner. <Suspense> affiche un chargement en attendant.
const ScanPage = lazy(() =>
  import('./pages/organisateur/ScanPage').then((module) => ({ default: module.ScanPage })),
);

/** Remonte en haut de page à chaque navigation (comme un site classique). */
function ScrollToTop() {
  const { pathname } = useLocation();
  // Accolades obligatoires : un effet ne doit rien renvoyer d'autre qu'une fonction de
  // nettoyage, or scrollTo() renvoie une promesse dans les navigateurs récents.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Route « layout » : toutes les pages partagent l'en-tête et le pied de page */}
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="evenements" element={<EventsPage />} />
          <Route path="evenements/:id" element={<EventDetailPage />} />
          <Route path="connexion" element={<LoginPage />} />
          <Route path="inscription" element={<RegisterPage />} />
          <Route path="inscription/organisateur" element={<RegisterOrganisateurPage />} />

          <Route element={<ProtectedRoute roles={['USER']} />}>
            <Route path="mes-billets" element={<MyTicketsPage />} />
          </Route>

          <Route path="organisateur" element={<ProtectedRoute roles={['ORGANISATEUR']} />}>
            <Route index element={<DashboardPage />} />
            <Route path="evenements/nouveau" element={<EventFormPage />} />
            <Route path="evenements/:id" element={<EventManagePage />} />
            <Route path="evenements/:id/modifier" element={<EventFormPage />} />
            <Route
              path="scanner"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ScanPage />
                </Suspense>
              }
            />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
