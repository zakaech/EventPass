module.exports = {
  testEnvironment: 'node',
  // Avant toute la suite : schéma de la base de test recréé à partir des migrations
  globalSetup: './tests/globalSetup.js',
  // Avant chaque fichier de test : variables d'environnement propres aux tests
  setupFiles: ['./tests/setupEnv.js'],
  testMatch: ['**/tests/**/*.test.js'],
};
