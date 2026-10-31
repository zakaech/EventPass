// Fabrique docs/screenshots/parcours.gif : le parcours réservation → QR code → scan, filmé
// au format téléphone avec une légende par étape. Prérequis et lancement : voir e2e/README.md.
//
// Chaque étape est une capture PNG ; gifenc (encodeur GIF en JavaScript pur, sans ffmpeg)
// réduit chaque image à une palette de 256 couleurs puis les assemble avec une durée par image.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';
import { writeQrVideo } from './lib/fakeCamera.mjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const CHANNEL = process.env.E2E_CHANNEL ?? 'msedge';
const SHOTS = fileURLToPath(new URL('./screenshots/', import.meta.url));
const OUT = fileURLToPath(new URL('../docs/screenshots/parcours.gif', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const PHONE = { viewport: { width: 390, height: 844 }, locale: 'fr-FR' };
const TITRE = 'Jazz au Sunset';
const frames = [];

/** Capture la page avec une légende incrustée en bas de l'écran. */
async function frame(page, caption, delay = 2400) {
  await page.waitForTimeout(400); // fin des transitions (ouverture du dialogue, défilement)
  await page.evaluate((text) => {
    // popover : la légende entre dans la « top layer » du navigateur, au-dessus même d'un
    // <dialog> modal ouvert (un simple z-index resterait sous son fond assombri)
    const el = document.createElement('div');
    el.id = 'demo-caption';
    el.popover = 'manual';
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed',
      inset: 'auto 12px 12px 12px',
      width: 'auto',
      height: 'auto',
      margin: '0',
      border: 'none',
      padding: '10px 14px',
      borderRadius: '10px',
      background: 'rgba(28, 25, 20, 0.92)',
      color: '#fff',
      font: '600 15px/1.35 system-ui, sans-serif',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
      pointerEvents: 'none',
    });
    document.body.append(el);
    el.showPopover();
  }, `${frames.length + 1}. ${caption}`);
  // Chaque image est aussi gardée en PNG (dossier non versionné) pour la relire facilement
  const path = join(SHOTS, `gif-${String(frames.length + 1).padStart(2, '0')}.png`);
  frames.push({ png: await page.screenshot({ path, animations: 'disabled' }), delay });
  await page.evaluate(() => document.getElementById('demo-caption')?.remove());
  console.log(`✓ image ${frames.length} : ${caption}`);
}

const visible = (locator) => locator.first().waitFor({ state: 'visible', timeout: 15000 });

/** Appel direct de l'API depuis la page, avec le jeton de sa session. */
const api = (page, path, options = {}) =>
  page.evaluate(
    async ({ path, options }) => {
      const res = await fetch(`/api/v1${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('eventpass.token')}`,
        },
      });
      return { status: res.status, body: await res.json() };
    },
    { path, options },
  );

async function loginDemo(page, email, home) {
  await page.goto(`${BASE}/connexion`);
  await page.getByRole('button', { name: email }).click();
  await page.waitForURL(BASE + home);
}

async function logout(page) {
  await page.evaluate(() => localStorage.removeItem('eventpass.token'));
  await page.goto(BASE);
}

const browser = await chromium.launch({ channel: CHANNEL });
const page = await (await browser.newContext(PHONE)).newPage();

// Préparation (hors GIF) : Sonora publie un événement qui commence dans 3 h, pour que le
// contrôle à l'entrée soit déjà ouvert au moment du scan.
await loginDemo(page, 'sonora@eventpass.dev', '/organisateur');
const created = await api(page, '/organisateur/events', {
  method: 'POST',
  body: JSON.stringify({
    titre: TITRE,
    categorie: 'CONCERT',
    description: 'Quartet de jazz en plein air, sur le rooftop.',
    ville: 'Paris',
    lieu: 'Le Sunset',
    date_debut: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    capacite: 120,
    prix: 25,
  }),
});
if (created.status !== 201) throw new Error(`Création de l'événement : ${created.status}`);
const eventId = created.body.event.id;
await logout(page);

// ---------------------------------------------------------------- Spectatrice (Alice)
await page.goto(BASE);
await visible(page.getByRole('heading', { name: /Vos prochaines sorties/ }));
await frame(page, 'Le visiteur parcourt les prochains événements');

await page.goto(`${BASE}/connexion`);
await visible(page.getByRole('button', { name: 'alice@eventpass.dev' }));
await frame(page, 'Comptes de démo : connexion en un clic');
await page.getByRole('button', { name: 'alice@eventpass.dev' }).click();
await page.waitForURL(`${BASE}/mes-billets`);

await page.goto(`${BASE}/evenements/${eventId}`);
await page.getByRole('button', { name: 'Ajouter un billet' }).click();
await page.getByRole('button', { name: 'Réserver' }).scrollIntoViewIfNeeded();
await frame(page, `Alice choisit 2 billets pour « ${TITRE} »`);

await page.getByRole('button', { name: 'Réserver' }).click();
const confirmation = page.getByText('2 billets réservés !');
await visible(confirmation);
await confirmation.scrollIntoViewIfNeeded();
await frame(page, 'Réservation confirmée : places et quota vérifiés dans une transaction');

await page.goto(`${BASE}/mes-billets`);
const groupe = page.locator('article', { hasText: TITRE });
await visible(groupe);
await groupe.scrollIntoViewIfNeeded();
await frame(page, '« Mes billets » : un QR code par billet');

await groupe.getByRole('button', { name: 'Afficher' }).first().click();
await visible(page.getByRole('dialog').getByRole('img', { name: 'QR code à scanner' }));
await frame(page, 'QR code signé (HMAC) et code de secours à présenter', 3000);

const { body } = await api(page, '/me/tickets?limit=50');
const billet = body.data.find((t) => t.titre === TITRE && t.statut === 'VALIDE');
await logout(page);

// ---------------------------------------------------------------- Organisatrice (Sonora)
// Second navigateur dont la webcam est remplacée par une vidéo du QR code du billet
const video = join(SHOTS, 'demo-camera-qr.y4m');
writeQrVideo(billet.qr_token, video);
const phoneBrowser = await chromium.launch({
  channel: CHANNEL,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${video}`,
  ],
});
const phone = await (await phoneBrowser.newContext(PHONE)).newPage();
await loginDemo(phone, 'sonora@eventpass.dev', '/organisateur');
await phone.goto(`${BASE}/organisateur/scanner?event=${eventId}`);
await visible(phone.getByRole('heading', { name: TITRE }));
await frame(phone, 'Le jour J, l’organisatrice ouvre le scanner sur son téléphone');

const resultat = (titre) => phone.locator('[role=alert]', { hasText: titre });
await phone.getByRole('button', { name: 'Activer la caméra' }).click();
await visible(resultat('Entrée validée'));
await resultat('Entrée validée').scrollIntoViewIfNeeded();
await frame(phone, 'Scan du QR code : entrée validée', 3000);

await phone.getByRole('button', { name: 'Scanner le suivant' }).click();
await visible(resultat('Déjà utilisé'));
await resultat('Déjà utilisé').scrollIntoViewIfNeeded();
await frame(phone, 'Même billet présenté une seconde fois : refusé', 3000);

await phone.goto(`${BASE}/organisateur/evenements/${eventId}`);
const stats = phone.getByText(/50 % des billets · dernier à/);
await visible(stats);
await stats.scrollIntoViewIfNeeded();
await frame(phone, 'Statistiques de l’événement : entrées en temps réel', 3200);
await phoneBrowser.close();
await browser.close();

// ---------------------------------------------------------------- Assemblage du GIF
const gif = GIFEncoder();
for (const { png, delay } of frames) {
  const { data, width, height } = PNG.sync.read(png);
  const palette = quantize(data, 256);
  gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay });
}
gif.finish();
writeFileSync(OUT, gif.bytes());
console.log(`\n${frames.length} images → ${OUT} (${Math.round(gif.bytes().length / 1024)} Ko)`);
