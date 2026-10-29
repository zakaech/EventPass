const crypto = require('node:crypto');
const env = require('../config/env');

// Jetons des billets, signés en HMAC-SHA256 avec QR_SECRET.
//
// HMAC = empreinte calculée à partir du message ET d'une clé secrète. Sans la clé, impossible
// de produire l'empreinte d'un autre message : modifier le code du billet (ou en inventer un)
// donne une signature qui ne correspond plus, et le jeton est rejeté.
//
// Deux formats, pour le même billet :
//  - le QR code  : "EP1.<uuid du billet>.<signature complète en base64url>"
//  - le code de secours, à saisir à la main si la caméra ne marche pas :
//    "939B-184C-7F3A-2B1C" = 8 premiers caractères de l'uuid + 8 caractères de signature.
//
// Chaque usage a son propre « contexte » dans le message signé ("qr:" / "secours:") :
// la signature d'un format ne peut jamais servir pour l'autre.

const VERSION = 'EP1';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const QR_PATTERN = new RegExp(`^${VERSION}\\.(${UUID})\\.([A-Za-z0-9_-]{43})$`);

function hmac(usage, code) {
  return crypto.createHmac('sha256', env.QR_SECRET).update(`${usage}:${code}`).digest();
}

/**
 * Comparaison en temps constant : une comparaison classique (===) s'arrête au premier
 * caractère différent, et le temps de réponse révélerait combien de caractères sont justes.
 */
function safeEqual(a, b) {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signQrToken(code) {
  return `${VERSION}.${code}.${hmac('qr', code).toString('base64url')}`;
}

/** Renvoie le code (uuid) du billet si la signature est valide, sinon null. */
function verifyQrToken(token) {
  const match = QR_PATTERN.exec(token);
  if (!match) return null;
  const [, code, signature] = match;
  // On compare le texte base64url attendu, et non les octets décodés : 43 caractères
  // portent 258 bits pour 256 utiles, donc plusieurs écritures décoderaient vers la même
  // signature. Seule l'écriture exacte produite par le serveur est acceptée.
  const expected = hmac('qr', code).toString('base64url');
  return safeEqual(Buffer.from(signature), Buffer.from(expected)) ? code : null;
}

function backupMac(code) {
  return hmac('secours', code).toString('hex').slice(0, 8).toUpperCase();
}

/** "939B-184C-7F3A-2B1C" */
function backupCode(code) {
  const raw = code.slice(0, 8).toUpperCase() + backupMac(code);
  return raw.match(/.{4}/g).join('-');
}

/** Découpe une saisie manuelle : { prefix: "939b184c", mac: "7F3A2B1C" } ou null. */
function parseBackupCode(input) {
  const compact = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{16}$/.test(compact)) return null;
  return { prefix: compact.slice(0, 8).toLowerCase(), mac: compact.slice(8) };
}

function verifyBackupMac(code, mac) {
  return safeEqual(Buffer.from(mac), Buffer.from(backupMac(code)));
}

module.exports = { signQrToken, verifyQrToken, backupCode, parseBackupCode, verifyBackupMac };
