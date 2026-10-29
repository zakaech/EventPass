// Tests unitaires de la signature des QR codes (aucune base de données nécessaire).
const crypto = require('node:crypto');
const {
  signQrToken,
  verifyQrToken,
  backupCode,
  parseBackupCode,
  verifyBackupMac,
} = require('../src/utils/qrToken');

const CODE = '3f2b8c1e-9d4a-4b7e-8f21-6a5c0d9e7b13';
const AUTRE_CODE = '9a1c2d3e-4f50-4617-8a9b-0c1d2e3f4a5b';

describe('jeton du QR code', () => {
  test('un jeton signé est reconnu et redonne le code du billet', () => {
    const token = signQrToken(CODE);
    expect(token).toMatch(/^EP1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(verifyQrToken(token)).toBe(CODE);
  });

  test('signature modifiée d’un seul caractère → rejeté', () => {
    const token = signQrToken(CODE);
    const last = token.at(-1);
    const altere = token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    expect(verifyQrToken(altere)).toBeNull();
  });

  test('code d’un autre billet avec une signature valide recopiée → rejeté', () => {
    const signature = signQrToken(CODE).split('.')[2];
    expect(verifyQrToken(`EP1.${AUTRE_CODE}.${signature}`)).toBeNull();
  });

  test('jeton fabriqué avec un autre secret → rejeté', () => {
    const fauxSecret = crypto
      .createHmac('sha256', 'un-secret-qui-n-est-pas-celui-du-serveur-123456')
      .update(`qr:${CODE}`)
      .digest('base64url');
    expect(verifyQrToken(`EP1.${CODE}.${fauxSecret}`)).toBeNull();
  });

  test('formats invalides → rejetés', () => {
    expect(verifyQrToken(CODE)).toBeNull(); // uuid seul, sans signature
    expect(verifyQrToken(`EP1.${CODE}.`)).toBeNull();
    expect(verifyQrToken('n’importe quoi')).toBeNull();
    expect(verifyQrToken(`EP2.${CODE}.${signQrToken(CODE).split('.')[2]}`)).toBeNull();
  });
});

describe('code de secours', () => {
  test('format XXXX-XXXX-XXXX-XXXX, préfixe = début du code du billet', () => {
    const secours = backupCode(CODE);
    expect(secours).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(secours.replace(/-/g, '').slice(0, 8)).toBe('3F2B8C1E');
  });

  test('saisie tolérante (minuscules, espaces) puis vérification', () => {
    const saisie = backupCode(CODE).toLowerCase().replace(/-/g, ' ');
    const parsed = parseBackupCode(saisie);
    expect(parsed.prefix).toBe('3f2b8c1e');
    expect(verifyBackupMac(CODE, parsed.mac)).toBe(true);
  });

  test('partie signature modifiée → rejetée', () => {
    const { mac } = parseBackupCode(backupCode(CODE));
    const altere = (mac[0] === '0' ? '1' : '0') + mac.slice(1);
    expect(verifyBackupMac(CODE, altere)).toBe(false);
  });

  test('la signature du QR ne sert pas de code de secours (contextes séparés)', () => {
    const debutSignatureQr = Buffer.from(signQrToken(CODE).split('.')[2], 'base64url')
      .toString('hex')
      .slice(0, 8)
      .toUpperCase();
    expect(verifyBackupMac(CODE, debutSignatureQr)).toBe(false);
  });

  test('saisies mal formées → null', () => {
    expect(parseBackupCode('1234')).toBeNull();
    expect(parseBackupCode('ZZZZ-ZZZZ-ZZZZ-ZZZZ')).toBeNull();
  });
});
