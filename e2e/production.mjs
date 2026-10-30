// Vérification du site DÉPLOYÉ (Vercel + Render + Neon), sans rien supposer de son état :
// le scénario crée ses propres données (compte, événement), les utilise, puis annule
// l'événement. Il respecte les règles de production : 3 connexions seulement (limite de
// 10 par 15 minutes) et compte admin de démo en lecture seule.
//
// Usage :
//   E2E_BASE_URL=https://<projet>.vercel.app \
//   E2E_API_URL=https://<service>.onrender.com/api/v1 \
//   node production.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeQrVideo } from './lib/fakeCamera.mjs';

const BASE = process.env.E2E_BASE_URL;
const API = process.env.E2E_API_URL;
if (!BASE || !API) {
  console.error('Définir E2E_BASE_URL (frontend) et E2E_API_URL (API, se terminant par /api/v1)');
  process.exit(1);
}
const CHANNEL = process.env.E2E_CHANNEL ?? 'msedge';
const SHOTS = fileURLToPath(new URL('./screenshots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const ts = Date.now();
const PASSWORD = 'Password123!';
const spectateur = { nom: 'Visiteur Prod', email: `e2e-prod-${ts}@test.dev` };
const titreEvenement = `Contrôle e2e ${ts}`;

const browser = await chromium.launch({ channel: CHANNEL });
const contexte = () => browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR' });
const user = await (await contexte()).newPage();
const orga = await (await contexte()).newPage();
const consoleErrors = [];
for (const p of [user, orga]) {
  p.on('pageerror', (e) => consoleErrors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
}

let step = 0;
async function check(label, fn) {
  step++;
  try {
    await fn();
    console.log(`✓ ${step}. ${label}`);
  } catch (e) {
    console.log(`✗ ${step}. ${label}\n   ${e.message.split('\n')[0]}`);
    await user.screenshot({ path: `${SHOTS}ECHEC-prod-${step}-spectateur.png`, fullPage: true });
    await orga.screenshot({ path: `${SHOTS}ECHEC-prod-${step}-organisateur.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
}
const visible = (locator, timeout = 15000) => locator.first().waitFor({ state: 'visible', timeout });
const resultat = (page, titre) => page.locator('[role=alert]', { hasText: titre });

/** Appel direct de l'API (domaine Render) avec le jeton de la session de cette page */
const api = (page, path, options = {}) =>
  page.evaluate(
    async ({ url, options }) => {
      const token = localStorage.getItem('eventpass.token');
      const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      return { status: res.status, body: await res.json() };
    },
    { url: API + path, options },
  );

const connexionDemo = async (page, email, accueil) => {
  await page.goto(`${BASE}/connexion`);
  await page.getByRole('button', { name: email }).click();
  await page.waitForURL(BASE + accueil, { timeout: 90000 });
};

// ------------------------------------------------------------------ Visiteur
await check('Accueil : l’API répond (réveil du serveur gratuit si besoin)', async () => {
  const debut = Date.now();
  await user.goto(BASE);
  let bandeau = false;
  // Jusqu'à 2 minutes : le service gratuit peut être en veille
  while (!(await user.locator('article').first().isVisible())) {
    bandeau ||= await user.getByText('Le serveur démarre').isVisible();
    if (Date.now() - debut > 120000) throw new Error('aucun événement affiché après 2 minutes');
    await user.waitForTimeout(500);
  }
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  console.log(`   premier affichage en ${duree} s — bandeau « Le serveur démarre » : ${bandeau ? 'affiché' : 'non (serveur déjà réveillé)'}`);
  await user.screenshot({ path: `${SHOTS}prod-01-accueil.png` });
});

await check('Rafraîchissement sur une route React (réécriture Vercel vers index.html)', async () => {
  await user.goto(`${BASE}/evenements?ville=PARIS`);
  await visible(user.getByRole('heading', { name: 'Nuit Électro' }));
  await user.reload();
  await visible(user.getByRole('heading', { name: 'Nuit Électro' }));
  await user.goto(`${BASE}/mes-billets`); // route protégée, sans session
  await user.waitForURL(`${BASE}/connexion`);
});

// ------------------------------------------------------------------ Spectateur
await check('Spectateur : inscription, réservation de 2 billets, annulation d’un billet', async () => {
  await user.goto(`${BASE}/inscription`);
  await user.getByLabel('Nom complet').fill(spectateur.nom);
  await user.getByLabel('Email').fill(spectateur.email);
  await user.getByLabel('Mot de passe').fill(PASSWORD);
  await user.getByRole('button', { name: 'Créer mon compte' }).click();
  await user.waitForURL(`${BASE}/evenements`);

  await user.goto(`${BASE}/evenements?ville=paris`);
  await user.getByRole('heading', { name: 'Nuit Électro' }).click();
  await user.getByRole('button', { name: 'Ajouter un billet' }).click();
  await user.getByRole('button', { name: 'Réserver' }).click();
  await visible(user.getByText('2 billets réservés !'));

  await user.getByRole('link', { name: 'Mes billets' }).first().click();
  await user.getByRole('button', { name: 'Annuler', exact: true }).first().click();
  await user.getByRole('button', { name: 'Annuler le billet' }).click();
  await visible(user.getByText(/Billet annulé/));
});

// ------------------------------------------------------------------ Organisateur
let eventId;
await check('Organisateur (démo) : création d’un événement dans 3 h, puis modification', async () => {
  await connexionDemo(orga, 'sonora@eventpass.dev', '/organisateur'); // connexion 1/3
  await orga.getByRole('link', { name: '+ Créer un événement' }).click();
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  await orga.getByLabel('Titre').fill(titreEvenement);
  await orga.getByLabel('Ville').fill('Paris');
  await orga.getByLabel('Lieu').fill('Salle de test');
  await orga.getByLabel('Date et heure').fill(local);
  await orga.getByLabel('Capacité').fill('10');
  await orga.getByLabel('Prix (€)').fill('0');
  await orga.getByRole('button', { name: 'Publier l’événement' }).click();
  await orga.waitForURL(/\/organisateur\/evenements\/\d+$/);
  eventId = Number(orga.url().split('/').pop());

  await orga.getByRole('link', { name: 'Modifier' }).click();
  await orga.getByLabel('Capacité').fill('12');
  await orga.getByRole('button', { name: 'Enregistrer' }).click();
  await visible(orga.getByText('sur 12 places'));
});

let billets;
await check('Spectateur : réserve 2 billets sur cet événement et affiche son QR code', async () => {
  await user.goto(`${BASE}/evenements/${eventId}`);
  await user.getByRole('button', { name: 'Ajouter un billet' }).click();
  await user.getByRole('button', { name: 'Réserver' }).click();
  await visible(user.getByText('2 billets réservés !'));

  const { body } = await api(user, '/me/tickets?limit=50');
  billets = body.data.filter((t) => t.event_id === eventId && t.statut === 'VALIDE');
  if (billets.length !== 2 || !billets[0].qr_token) throw new Error('jetons QR absents');

  await user.goto(`${BASE}/mes-billets`);
  await user
    .locator('article', { hasText: titreEvenement })
    .getByRole('button', { name: 'Afficher' })
    .first()
    .click();
  await visible(user.getByRole('img', { name: 'QR code à scanner' }));
  await user.screenshot({ path: `${SHOTS}prod-02-billet.png` });
  await user.getByRole('button', { name: 'Fermer' }).click();
});

await check('Organisateur (téléphone, caméra) : billet valide, puis second scan refusé', async () => {
  const video = join(SHOTS, 'camera-prod.y4m');
  writeQrVideo(billets[0].qr_token, video);
  const phoneBrowser = await chromium.launch({
    channel: CHANNEL,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${video}`,
    ],
  });
  const phone = await (
    await phoneBrowser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  ).newPage();
  try {
    await connexionDemo(phone, 'sonora@eventpass.dev', '/organisateur'); // connexion 2/3
    await phone.goto(`${BASE}/organisateur/scanner?event=${eventId}`);
    await visible(phone.getByRole('heading', { name: titreEvenement }));
    await phone.getByRole('button', { name: 'Activer la caméra' }).click();
    await resultat(phone, 'Entrée validée').waitFor({ timeout: 30000 });
    await phone.screenshot({ path: `${SHOTS}prod-03-scan-valide.png` });
    await phone.getByRole('button', { name: 'Scanner le suivant' }).click();
    await resultat(phone, 'Déjà utilisé').waitFor({ timeout: 30000 });
    await visible(resultat(phone, 'Déjà utilisé').getByText(/Premier scan à \d{2}:\d{2}/));
  } catch (error) {
    await phone.screenshot({ path: `${SHOTS}ECHEC-prod-telephone.png` });
    throw error;
  } finally {
    await phoneBrowser.close();
  }
});

await check('Organisateur : code de secours valide, QR falsifié refusé', async () => {
  await orga.goto(`${BASE}/organisateur/scanner?event=${eventId}`);
  await orga.getByLabel('Saisie manuelle').fill(billets[1].code_secours);
  await orga.getByRole('button', { name: 'Vérifier' }).click();
  await visible(resultat(orga, 'Entrée validée'));
  await orga.getByRole('button', { name: 'Scanner le suivant' }).click();

  const jeton = billets[0].qr_token;
  await orga.getByLabel('Saisie manuelle').fill(jeton.slice(0, -3) + (jeton.endsWith('AAA') ? 'BBB' : 'AAA'));
  await orga.getByRole('button', { name: 'Vérifier' }).click();
  await visible(resultat(orga, 'QR code invalide'));
});

await check('Organisateur : statistiques (2 entrées sur 2), puis annulation de l’événement', async () => {
  await orga.goto(`${BASE}/organisateur/evenements/${eventId}`);
  await visible(orga.getByText(/100 % des billets · dernier à/));
  await orga.screenshot({ path: `${SHOTS}prod-04-stats.png`, fullPage: true });
  await orga.getByRole('button', { name: 'Annuler l’événement' }).click();
  await orga.getByRole('button', { name: 'Oui, annuler l’événement' }).click();
  await visible(orga.getByText(/Événement annulé/));
  await orga.getByRole('button', { name: 'Déconnexion' }).click();
});

// ------------------------------------------------------------------ Admin
await check('Admin de démo : lecture seule (interface ET serveur)', async () => {
  await connexionDemo(orga, 'admin@eventpass.dev', '/admin'); // connexion 3/3
  await visible(orga.getByText('Compte de démonstration en lecture seule'));
  await visible(orga.getByText('Top catégories'));
  const ligne = orga.locator('li', { hasText: 'nouveau@eventpass.dev' });
  await visible(ligne);
  if (!(await ligne.getByRole('button', { name: 'Valider' }).isDisabled())) {
    throw new Error('le bouton Valider devrait être désactivé');
  }
  await orga.screenshot({ path: `${SHOTS}prod-05-admin-lecture-seule.png`, fullPage: true });

  // Même en contournant l'interface, le serveur refuse
  const { body: liste } = await api(orga, '/admin/organisateurs?statut=EN_ATTENTE');
  const cible = liste.data[0];
  const res = await api(orga, `/admin/organisateurs/${cible.id}/validation`, {
    method: 'PATCH',
    body: JSON.stringify({ statut: 'VALIDE' }),
  });
  if (res.status !== 403 || res.body.error.code !== 'LECTURE_SEULE') {
    throw new Error(`réponse inattendue : ${res.status} ${JSON.stringify(res.body)}`);
  }
});

await check('Intercepteur 401 en production : jeton invalide → reconnexion demandée', async () => {
  await user.goto(`${BASE}/evenements`);
  await user.evaluate(() => localStorage.setItem('eventpass.token', 'jeton.invalide'));
  await user.getByRole('link', { name: 'Mes billets' }).click();
  await user.waitForURL(`${BASE}/connexion`);
  await visible(user.getByText('Votre session a expiré'));
});

await check('Mobile (390 px) : pas de défilement horizontal', async () => {
  await user.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/evenements', `/evenements/${eventId}`, '/connexion']) {
    await user.goto(BASE + path);
    await user.waitForLoadState('networkidle');
    const debord = await user.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (debord > 0) throw new Error(`${path} déborde de ${debord} px`);
  }
});

const inattendues = consoleErrors.filter((e) => !/status of (400|401|403|409)/.test(e));
console.log(`\nErreurs console inattendues : ${inattendues.length}`);
inattendues.forEach((e) => console.log('  - ' + e));
await browser.close();
