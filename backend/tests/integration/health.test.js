const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../helpers/db');

afterAll(() => pool.end());

test('GET /health → 200 quand la base répond', async () => {
  const res = await request(app).get('/api/v1/health');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
});

test('GET /health → 503 quand la base est injoignable', async () => {
  // jest.spyOn remplace temporairement pool.query pour simuler une panne de PostgreSQL
  const spy = jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connexion refusée'));
  const res = await request(app).get('/api/v1/health');
  expect(res.status).toBe(503);
  expect(res.body.database).toBe('injoignable');
  spy.mockRestore();
});
