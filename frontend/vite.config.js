import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// `npm run dev`       → http://localhost:5173 (la caméra fonctionne : localhost est « sûr »)
// `npm run dev:phone` → https://<ip-du-pc>:5173, accessible depuis un téléphone du même
//                       réseau Wi-Fi. HTTPS est obligatoire pour accéder à la caméra hors
//                       localhost ; basicSsl génère un certificat auto-signé.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: {
    host: mode === 'phone' ? true : 'localhost',
    // En développement, le frontend appelle /api/v1 sur sa propre origine et Vite relaie
    // vers l'API. Indispensable en HTTPS : une page https ne peut pas appeler une API en
    // http (« contenu mixte » bloqué par le navigateur). Évite aussi CORS en local.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}));
