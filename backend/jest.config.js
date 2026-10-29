// Deux « projets » Jest :
//  - unit        : services testés isolément, dépendances remplacées par des mocks (jest.mock),
//                  aucune base de données nécessaire → rapides ;
//  - integration : vraies requêtes HTTP (Supertest) sur une vraie base PostgreSQL de test.
const common = {
  testEnvironment: 'node',
  // Avant chaque fichier : variables d'environnement propres aux tests
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
};

module.exports = {
  projects: [
    {
      ...common,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
    },
    {
      ...common,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      // Avant toute la suite : schéma de la base de test recréé à partir des migrations
      globalSetup: '<rootDir>/tests/globalSetup.js',
    },
  ],

  // Couverture : `npm run test:coverage`
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageReporters: ['text-summary', 'text', 'lcov', 'json-summary'],
  // En dessous de ces seuils, `npm run test:coverage` échoue (et donc la CI)
  coverageThreshold: {
    global: { statements: 90, branches: 80, functions: 90, lines: 90 },
  },
};
