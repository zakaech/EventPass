// Exécuté une seule fois avant toute la suite de tests :
// on repart d'un schéma vide puis on applique les migrations, comme en production.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  const env = require('../src/config/env'); // DATABASE_URL pointe alors sur la base de test

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();

  try {
    execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'migrate.js'), 'up'], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'pipe',
    });
  } catch (error) {
    console.error(error.stdout?.toString(), error.stderr?.toString());
    throw new Error('Échec des migrations sur la base de test', { cause: error });
  }
};
