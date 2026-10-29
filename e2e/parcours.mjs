// Parcours complets des 3 rôles dans un vrai navigateur, piloté par Playwright.
// Prérequis et lancement : voir e2e/README.md.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeQrVideo } from './lib/fakeCamera.mjs';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
// Navigateur : Edge (installé sur Windows) par défaut, ou "chrome", ou "chromium"
// (ce dernier après `npx playwright install chromium`).
const CHANNEL = process.env.E2E_CHANNEL ?? 'msedge';
const SHOTS = fileURLToPath(new URL('./screenshots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });
const ts = Date.now();
const PASSWORD = 'Password123!';
const user = { nom: 'Camille Test', email: `camille-${ts}@test.dev` };
const orga = { nom: 'Yanis Orga', email: `orga-${ts}@test.dev`, org: `Collectif ${ts}` };

const browser = await chromium.launch({ channel: CHANNEL });
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR' });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(e.message));
// Signale les réponses anormales de l'API (429 = limite de connexions atteinte, 5xx = bug)
page.on(
  'response',
  (r) => r.url().includes('/api/v1/') && r.status() >= 429 && console.log('   [api]', r.status(), r.url()),
);

let step = 0;
async function check(label, fn) {
  step++;
  try {
    await fn();
    console.log(`✓ ${step}. ${label}`);
  } catch (e) {
    console.log(`✗ ${step}. ${label}\n   ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: `${SHOTS}ECHEC-${step}.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
}
const expectVisible = (locator) => locator.first().waitFor({ state: 'visible', timeout: 8000 });
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
const logout = async () => {
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL(BASE + '/');
};

// ---------------------------------------------------------------- Visiteur
await check('Accueil : hero, catégories et événements à l’affiche', async () => {
  await page.goto(BASE);
  await expectVisible(page.getByRole('heading', { name: /Vos prochaines sorties/ }));
  await expectVisible(page.locator('article'));
  await shot('01-accueil');
});

await check('Recherche depuis l’accueil → liste filtrée (ville insensible à la casse)', async () => {
  await page.getByLabel('Ville').fill('PARIS');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await page.waitForURL(/\/evenements\?ville=PARIS/);
  await expectVisible(page.getByRole('heading', { name: 'Nuit Électro' }));
  const villes = await page.locator('article p').allInnerTexts();
  if (!villes.filter((t) => t.includes('·')).every((t) => t.includes('Paris'))) throw new Error('Un résultat hors Paris');
  await shot('02-liste-filtree');
});

await check('Filtres prix_min / prix_max depuis le panneau', async () => {
  await page.goto(`${BASE}/evenements`);
  await page.getByLabel('Prix minimum').fill('30');
  await page.getByLabel('Prix maximum').fill('60');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await page.waitForURL(/prix_min=30.*prix_max=60/);
  await expectVisible(page.getByText(/\d+ événements?/));
  const prix = await page.locator('article').allInnerTexts();
  if (prix.length === 0) throw new Error('aucun résultat');
});

await check('Détail public : bouton « Se connecter pour réserver »', async () => {
  await page.goto(`${BASE}/evenements?ville=paris`);
  await page.getByRole('heading', { name: 'Nuit Électro' }).click();
  await expectVisible(page.getByRole('link', { name: 'Se connecter pour réserver' }));
  await shot('03-detail-visiteur');
});

// ---------------------------------------------------------------- Utilisateur
await check('USER : inscription → redirigé vers les événements', async () => {
  await page.goto(`${BASE}/inscription`);
  await page.getByLabel('Nom complet').fill(user.nom);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL(`${BASE}/evenements`);
  await expectVisible(page.getByText(user.nom));
});

await check('USER : réservation de 2 billets', async () => {
  await page.goto(`${BASE}/evenements?ville=paris`);
  await page.getByRole('heading', { name: 'Nuit Électro' }).click();
  await page.getByRole('button', { name: 'Ajouter un billet' }).click();
  await page.getByRole('button', { name: 'Réserver' }).click();
  await expectVisible(page.getByText('2 billets réservés !'));
  await shot('04-reservation-ok');
});

await check('USER : dépassement du quota (2 + 3 > 4) → message de l’API', async () => {
  await page.getByRole('button', { name: 'Ajouter un billet' }).click();
  await page.getByRole('button', { name: 'Ajouter un billet' }).click();
  await page.getByRole('button', { name: 'Réserver' }).click();
  await expectVisible(page.getByText(/Limite de 4 billets par événement/));
});

await check('USER : « Mes billets » puis annulation d’un billet', async () => {
  await page.getByRole('link', { name: 'Mes billets' }).first().click();
  await page.waitForURL(`${BASE}/mes-billets`);
  await expectVisible(page.getByRole('link', { name: 'Nuit Électro' }));
  await shot('05-mes-billets');
  await page.getByRole('button', { name: 'Annuler', exact: true }).first().click();
  await expectVisible(page.getByRole('dialog'));
  await shot('06-dialog-annulation');
  await page.getByRole('button', { name: 'Annuler le billet' }).click();
  await expectVisible(page.getByText(/Billet annulé/));
  await expectVisible(page.locator('text=Annulé'));
});

await check('USER : accès à /admin refusé côté interface → renvoyé vers ses billets', async () => {
  await page.goto(`${BASE}/admin`);
  await page.waitForURL(`${BASE}/mes-billets`);
});

await check('Intercepteur 401 : jeton invalidé en cours de session → déconnexion + redirection', async () => {
  await page.goto(`${BASE}/evenements`);
  await page.evaluate(() => localStorage.setItem('eventpass.token', 'jeton.falsifie.ou.expire'));
  await page.getByRole('link', { name: 'Mes billets' }).click();
  await page.waitForURL(`${BASE}/connexion`);
  await expectVisible(page.getByText('Votre session a expiré'));
  const token = await page.evaluate(() => localStorage.getItem('eventpass.token'));
  if (token !== null) throw new Error('jeton non supprimé');
  await expectVisible(page.getByRole('link', { name: 'Créer un compte' }));
  await shot('07-session-expiree');
});

await check('Route protégée sans session → connexion puis retour à la page demandée', async () => {
  await page.goto(`${BASE}/mes-billets`);
  await page.waitForURL(`${BASE}/connexion`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`${BASE}/mes-billets`);
  await logout();
});

await check('Connexion : mauvais mot de passe → message d’erreur, pas de redirection', async () => {
  await page.goto(`${BASE}/connexion`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mot de passe').fill('mauvais-mdp');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expectVisible(page.getByText('Email ou mot de passe incorrect'));
  if (!page.url().endsWith('/connexion')) throw new Error('redirigé à tort');
});

// ---------------------------------------------------------------- Organisateur (inscription)
await check('ORGANISATEUR : inscription → compte en attente', async () => {
  await page.goto(`${BASE}/inscription/organisateur`);
  await page.getByLabel('Nom de l’organisation').fill(orga.org);
  await page.getByLabel('Ville').fill('Nantes');
  await page.getByLabel('Votre nom').fill(orga.nom);
  await page.getByLabel('Email').fill(orga.email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await page.waitForURL(`${BASE}/organisateur`);
  await expectVisible(page.getByText('Votre compte est en cours de vérification'));
  await shot('08-orga-en-attente');
  await logout();
});

// ---------------------------------------------------------------- Admin
await check('ADMIN : connexion en un clic (compte de démo) → tableau de bord', async () => {
  await page.goto(`${BASE}/connexion`);
  await shot('09-connexion');
  await page.getByRole('button', { name: /admin@eventpass\.dev/ }).click();
  await page.waitForURL(`${BASE}/admin`);
  await expectVisible(page.getByText('Top catégories'));
  await expectVisible(page.getByText(orga.org));
  await shot('10-admin');
});

await check('ADMIN : validation de l’organisateur', async () => {
  const row = page.locator('li', { hasText: orga.org });
  await row.getByRole('button', { name: 'Valider' }).click();
  await expectVisible(page.getByText(`${orga.org} : compte validé.`));
  await page.getByRole('tab', { name: 'Validés' }).click();
  await expectVisible(page.locator('li', { hasText: orga.org }));
  await logout();
});

// ---------------------------------------------------------------- Organisateur (validé)
let eventUrl;
await check('ORGANISATEUR : connexion → tableau de bord validé', async () => {
  await page.goto(`${BASE}/connexion`);
  await page.getByLabel('Email').fill(orga.email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`${BASE}/organisateur`);
  await expectVisible(page.getByText('Aucun événement pour l’instant'));
});

await check('ORGANISATEUR : formulaire vide → erreurs de validation par champ', async () => {
  await page.getByRole('link', { name: '+ Créer un événement' }).click();
  await page.getByRole('button', { name: 'Publier l’événement' }).click();
  await expectVisible(page.getByText('Données invalides'));
  const invalid = await page.locator('[aria-invalid="true"]').count();
  if (invalid < 3) throw new Error(`seulement ${invalid} champs en erreur`);
  await shot('11-form-erreurs');
});

await check('ORGANISATEUR : création d’un événement', async () => {
  const date = new Date(Date.now() + 20 * 86400000);
  const local = `${date.toISOString().slice(0, 10)}T20:30`;
  await page.getByLabel('Titre').fill('Soirée impro test');
  await page.getByLabel('Catégorie').selectOption('THEATRE');
  await page.getByLabel('Description').fill('Un match d’impro pour tester le parcours.');
  await page.getByLabel('Ville').fill('Nantes');
  await page.getByLabel('Lieu').fill('Le Lieu Unique');
  await page.getByLabel('Date et heure').fill(local);
  await page.getByLabel('Capacité').fill('50');
  await page.getByLabel('Prix (€)').fill('15');
  await shot('12-form-rempli');
  await page.getByRole('button', { name: 'Publier l’événement' }).click();
  await page.waitForURL(/\/organisateur\/evenements\/\d+$/);
  await expectVisible(page.getByText('Événement publié !'));
  eventUrl = page.url().replace('/organisateur', '');
});

await check('ORGANISATEUR : modification (capacité 50 → 80)', async () => {
  await page.getByRole('link', { name: 'Modifier' }).click();
  await page.getByLabel('Capacité').fill('80');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expectVisible(page.getByText('Modifications enregistrées.'));
  await expectVisible(page.getByText('sur 80 places'));
  await logout();
});

await check('USER (démo Alice) : réserve sur ce nouvel événement', async () => {
  await page.goto(`${BASE}/connexion`);
  await page.getByRole('button', { name: /alice@eventpass\.dev/ }).click();
  await page.waitForURL(`${BASE}/mes-billets`);
  await page.goto(eventUrl);
  await page.getByRole('button', { name: 'Réserver' }).click();
  await expectVisible(page.getByText('1 billet réservé !'));
  await logout();
});

await check('ORGANISATEUR : statistiques et liste des réservations', async () => {
  await page.goto(`${BASE}/connexion`);
  await page.getByLabel('Email').fill(orga.email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`${BASE}/organisateur`);
  await expectVisible(page.getByRole('link', { name: 'Soirée impro test' }));
  await shot('13-dashboard-orga');
  await page.getByRole('link', { name: 'Gérer' }).click();
  await expectVisible(page.getByRole('cell', { name: /alice@eventpass\.dev/ }));
  await expectVisible(page.getByText('1,3 %').or(page.getByText('1.3 %')));
  await shot('14-gestion-evenement');
});

await check('ORGANISATEUR : annulation de l’événement (dialogue de confirmation)', async () => {
  await page.getByRole('button', { name: 'Annuler l’événement' }).click();
  await page.getByRole('button', { name: 'Oui, annuler l’événement' }).click();
  await expectVisible(page.getByText('Événement annulé. 1 billet(s) annulé(s).'));
  await page.getByRole('link', { name: '← Mes événements' }).click();
  await expectVisible(page.locator('li', { hasText: 'Soirée impro test' }).getByText('Annulé').first());
  await logout();
});

// ---------------------------------------------------------------- Phase 3 : QR code et check-in
// Appel direct de l'API depuis la page, avec le jeton de la session (préparation de données)
const api = (path, options = {}) =>
  page.evaluate(
    async ({ path, options }) => {
      const token = localStorage.getItem('eventpass.token');
      const res = await fetch(`/api/v1${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      return { status: res.status, body: await res.json() };
    },
    { path, options },
  );

const loginDemo = async (email, home) => {
  await page.goto(`${BASE}/connexion`);
  await page.getByRole('button', { name: email }).click();
  await page.waitForURL(BASE + home);
};

let billets;
await check('USER : QR code et code de secours dans « Mes billets »', async () => {
  await loginDemo('alice@eventpass.dev', '/mes-billets');
  // Événement commencé il y a 2 h (statut TERMINE) : toujours dans « À venir et en cours »
  await expectVisible(page.getByRole('heading', { name: 'À venir et en cours' }));
  const groupe = page.locator('article', { hasText: 'Live au Point Éphémère' });
  await groupe.getByRole('button', { name: 'Afficher' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Billet à présenter à l’entrée' });
  await expectVisible(dialog.getByRole('img', { name: 'QR code à scanner' }));
  await expectVisible(dialog.getByText(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/));
  await shot('15-billet-qr');
  await dialog.getByRole('button', { name: 'Fermer' }).click();

  // Préparation : jetons des billets d'Alice, tels que l'interface les affiche
  const { body } = await api('/me/tickets?limit=50');
  const valides = (titre) => body.data.filter((t) => t.titre === titre && t.statut === 'VALIDE');
  const [live1, live2] = valides('Live au Point Éphémère');
  billets = {
    camera: live1,
    manuel: live2,
    autreEvenement: valides('Nuit Électro')[0],
    autreOrganisateur: valides('DevConf Lyon 2026')[0],
  };
  if (Object.values(billets).some((b) => !b?.qr_token)) {
    throw new Error('Données de démo inattendues : relancer npm run db:seed');
  }
  await logout();
});

await check('ORGANISATEUR (téléphone, caméra) : billet valide puis second scan refusé', async () => {
  // Fausse webcam qui filme le QR code du premier billet d'Alice
  const video = join(SHOTS, 'camera-qr.y4m');
  writeQrVideo(billets.camera.qr_token, video);
  const phoneBrowser = await chromium.launch({
    channel: CHANNEL,
    args: [
      '--use-fake-ui-for-media-stream', // accepte la demande d'accès à la caméra
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${video}`,
    ],
  });
  const phone = await (
    await phoneBrowser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  ).newPage();
  phone.on('pageerror', (e) => consoleErrors.push(e.message));
  try {
    await phone.goto(`${BASE}/connexion`);
    await phone.getByRole('button', { name: 'sonora@eventpass.dev' }).click();
    await phone.waitForURL(`${BASE}/organisateur`);
    await phone.goto(`${BASE}/organisateur/scanner`);
    await expectVisible(phone.getByRole('heading', { name: 'Live au Point Éphémère' }));
    await phone.screenshot({ path: `${SHOTS}m-09-scanner.png` });

    await phone.getByRole('button', { name: 'Activer la caméra' }).click();
    // Bloc de résultat (role="alert") ; le même titre figure aussi dans l'historique
    const resultat = (titre) => phone.locator('[role=alert]', { hasText: titre });
    await resultat('Entrée validée').waitFor({ timeout: 15000 });
    await expectVisible(resultat('Entrée validée').getByText('Alice Martin'));
    await phone.screenshot({ path: `${SHOTS}m-10-scan-valide.png` });

    // La caméra filme toujours le même billet : le scan suivant doit être refusé
    await phone.getByRole('button', { name: 'Scanner le suivant' }).click();
    await resultat('Déjà utilisé').waitFor({ timeout: 15000 });
    await expectVisible(resultat('Déjà utilisé').getByText(/Premier scan à \d{2}:\d{2}/));
    await phone.screenshot({ path: `${SHOTS}m-11-scan-deja-utilise.png` });
  } catch (error) {
    await phone.screenshot({ path: `${SHOTS}ECHEC-telephone.png` });
    throw error;
  } finally {
    await phoneBrowser.close();
  }
});

// Saisie dans le champ « Saisie manuelle », puis vérification du résultat affiché
const manualScan = async (value, titre, detail) => {
  await page.getByLabel('Saisie manuelle').fill(value);
  await page.getByRole('button', { name: 'Vérifier' }).click();
  const resultat = page.locator('[role=alert]', { hasText: titre });
  await expectVisible(resultat);
  if (detail) await expectVisible(resultat.getByText(detail));
};
const next = () => page.getByRole('button', { name: 'Scanner le suivant' }).click();

await check('ORGANISATEUR : code de secours saisi à la main (minuscules) → valide', async () => {
  await loginDemo('sonora@eventpass.dev', '/organisateur');
  await page.getByRole('link', { name: 'Scanner', exact: true }).click();
  await manualScan(billets.manuel.code_secours.toLowerCase(), 'Entrée validée', 'Alice Martin');
  await shot('16-scan-saisie-manuelle');
  await next();
});

await check('ORGANISATEUR : QR falsifié et code inventé → « QR code invalide »', async () => {
  const token = billets.autreEvenement.qr_token;
  const falsifie = token.slice(0, -3) + (token.endsWith('AAA') ? 'BBB' : 'AAA');
  await manualScan(falsifie, 'QR code invalide', 'Billet falsifié, modifié ou illisible.');
  await shot('17-scan-qr-invalide');
  await next();
  await manualScan('1234-ABCD-5678-EF90', 'QR code invalide');
  await next();
});

await check('ORGANISATEUR : billet d’un autre événement / d’un autre organisateur', async () => {
  await manualScan(
    billets.autreEvenement.qr_token,
    'Autre événement',
    'Billet valable pour « Nuit Électro »',
  );
  await next();
  // Billet d'Atlas Events : refusé sans révéler de quel événement il s'agit
  await manualScan(
    billets.autreOrganisateur.qr_token,
    'Autre événement',
    'Ce billet n’est pas valable pour cet événement.',
  );
  await next();
});

// Le cas « billet annulé » est couvert par les tests Jest : depuis l'interface, un billet ne
// peut plus être annulé à moins de 24 h, donc jamais pendant que son contrôle est ouvert.
await check('ORGANISATEUR : seuls les événements dont le contrôle est ouvert sont proposés', async () => {
  await page.reload();
  await expectVisible(page.getByRole('heading', { name: 'Live au Point Éphémère' }));
  // « Nuit Électro » commence dans 5 jours : son contrôle ouvrira 6 h avant le début
  const proposes = await page.getByRole('option', { name: /Nuit Électro/ }).count();
  if (proposes !== 0) throw new Error('« Nuit Électro » ne devrait pas être contrôlable');
});

await check('ORGANISATEUR : statistiques de check-in à jour', async () => {
  await page.goto(`${BASE}/organisateur`);
  await page
    .locator('li', { hasText: 'Live au Point Éphémère' })
    .getByRole('link', { name: 'Gérer' })
    .click();
  // 4 billets vendus, 3 scannés : 1 dans le seed + caméra + saisie manuelle
  await expectVisible(page.getByText(/75 % des billets · dernier à/));
  const heures = await page.locator('tbody td').filter({ hasText: /^\d{2}:\d{2}$/ }).count();
  if (heures !== 3) throw new Error(`${heures} heures d'entrée affichées au lieu de 3`);
  await shot('18-stats-checkin');
  await logout();
});

await check('USER : le billet scanné apparaît comme utilisé', async () => {
  await loginDemo('alice@eventpass.dev', '/mes-billets');
  const groupe = page.locator('article', { hasText: 'Live au Point Éphémère' });
  await expectVisible(groupe.getByText(/Scanné le/));
  await logout();
});

// ---------------------------------------------------------------- Responsive
await check('Mobile (390 px) : aucune page ne déborde horizontalement', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/connexion`);
  await page.getByRole('button', { name: /sonora@eventpass\.dev/ }).click();
  await page.waitForURL(`${BASE}/organisateur`);
  // [chemin, nom de la capture]
  const visit = async (path, name) => {
    await page.goto(BASE + path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error(`${path} déborde de ${overflow}px`);
    await shot(name);
  };
  await visit('/', 'm-01-accueil');
  await visit('/evenements', 'm-02-evenements');
  await visit('/evenements/1', 'm-03-detail');
  await visit('/organisateur', 'm-05-dashboard-orga');
  await visit('/organisateur/evenements/1', 'm-06-gestion-evenement');
  await visit('/organisateur/evenements/1/modifier', 'm-07-formulaire');
  await page.getByRole('button', { name: 'Menu' }).click();
  await shot('m-08-menu');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.goto(`${BASE}/connexion`);
  await page.getByRole('button', { name: /alice@eventpass\.dev/ }).click();
  await page.waitForURL(`${BASE}/mes-billets`);
  await visit('/mes-billets', 'm-04-mes-billets');
});

const relevantErrors = consoleErrors.filter((e) => !/status of (401|409|400)/.test(e));
console.log(`\nErreurs console inattendues : ${relevantErrors.length}`);
relevantErrors.forEach((e) => console.log('  - ' + e));
await browser.close();
