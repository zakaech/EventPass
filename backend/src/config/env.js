// Lecture et validation des variables d'environnement au démarrage.
// Si une variable manque ou est invalide, l'application s'arrête tout de suite
// avec un message clair, plutôt que de planter plus tard au milieu d'une requête.
require('dotenv').config({ quiet: true });

const { z } = require('zod');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]?$/, 'JWT_EXPIRES_IN : nombre de secondes ou format 15m, 2h, 7d')
      .default('2h'),
    // Secret dédié à la signature des QR codes des billets (distinct de JWT_SECRET)
    QR_SECRET: z.string().min(32, 'QR_SECRET doit contenir au moins 32 caractères'),
    // Le check-in ouvre N heures avant date_debut (ouverture des portes)…
    CHECKIN_OPENS_HOURS_BEFORE: z.coerce.number().int().min(0).max(72).default(6),
    // … et reste ouvert jusqu'à date_debut + N heures
    CHECKIN_WINDOW_HOURS: z.coerce.number().int().min(1).max(72).default(12),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    // Nombre de proxys de confiance devant l'API (Nginx en Docker).
    // 0 = aucun : l'adresse IP du client est celle de la connexion TCP.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    // Comptes en lecture seule (emails séparés par des virgules) : par exemple l'admin de
    // démo, qui peut tout consulter mais dont aucune action d'écriture n'est acceptée.
    READ_ONLY_EMAILS: z.string().default(''),
  })
  .refine((e) => e.QR_SECRET !== e.JWT_SECRET, {
    message: 'QR_SECRET doit être différent de JWT_SECRET',
    path: ['QR_SECRET'],
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables d'environnement invalides :");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')} : ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

// Jest définit NODE_ENV=test : on bascule alors automatiquement sur la base de test
// pour ne jamais vider la base de développement par erreur.
if (env.NODE_ENV === 'test') {
  if (!env.TEST_DATABASE_URL) {
    console.error('TEST_DATABASE_URL est obligatoire pour lancer les tests');
    process.exit(1);
  }
  env.DATABASE_URL = env.TEST_DATABASE_URL;
}

// "15m" → "15m", "3600" → 3600 (jsonwebtoken interprète un nombre comme des secondes)
if (/^\d+$/.test(env.JWT_EXPIRES_IN)) {
  env.JWT_EXPIRES_IN = Number(env.JWT_EXPIRES_IN);
}

env.CORS_ORIGIN = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

env.READ_ONLY_EMAILS = env.READ_ONLY_EMAILS.split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

module.exports = env;
