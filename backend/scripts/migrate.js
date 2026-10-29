// Lance node-pg-migrate sur la base définie par src/config/env.js.
// Usage : node scripts/migrate.js up|down
// Avec NODE_ENV=test, env.js pointe automatiquement sur la base de test.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const env = require('../src/config/env');

const direction = process.argv[2] === 'down' ? 'down' : 'up';
const cli = path.join(
  __dirname,
  '..',
  'node_modules',
  'node-pg-migrate',
  'bin',
  'node-pg-migrate.js',
);

const result = spawnSync(
  process.execPath,
  [
    cli,
    direction,
    '--migrations-dir',
    path.join(__dirname, '..', 'migrations'),
    '--migration-file-language',
    'sql',
    '--check-order',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
  },
);

process.exit(result.status ?? 1);
