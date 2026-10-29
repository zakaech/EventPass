const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers/db');
const { createUser, PASSWORD, auth } = require('./helpers/factories');

beforeEach(resetDb);
afterAll(() => pool.end());

describe('inscription', () => {
  test('email déjà utilisé (casse différente) → 409', async () => {
    await createUser({ email: 'alice@test.dev' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'ALICE@test.dev', password: 'Password123!', nom: 'Alice' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_DEJA_UTILISE');
  });

  test('ne renvoie jamais le hash du mot de passe', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bob@test.dev', password: 'Password123!', nom: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user.role).toBe('USER');
  });

  test('impossible de choisir son rôle à l’inscription', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'malin@test.dev', password: 'Password123!', nom: 'Malin', role: 'ADMIN' });
    expect(res.body.user.role).toBe('USER');
  });
});

describe('connexion', () => {
  test('identifiants corrects → jeton utilisable sur /auth/me', async () => {
    await createUser({ email: 'alice@test.dev' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@test.dev', password: PASSWORD });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/v1/auth/me').set(auth(login.body.token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('alice@test.dev');
  });

  test('même réponse pour un mauvais mot de passe et un email inconnu', async () => {
    await createUser({ email: 'alice@test.dev' });
    const mauvaisMdp = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@test.dev', password: 'mauvais' });
    const inconnu = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'personne@test.dev', password: 'mauvais' });

    expect(mauvaisMdp.status).toBe(401);
    expect(inconnu.status).toBe(401);
    expect(mauvaisMdp.body).toEqual(inconnu.body);
  });
});

describe('jetons', () => {
  test('sans jeton, jeton falsifié ou expiré → 401', async () => {
    const { user } = await createUser();
    const falsifie = jwt.sign({ role: 'ADMIN' }, 'un-autre-secret-de-plus-de-32-caracteres', {
      subject: String(user.id),
    });
    const expire = jwt.sign({ role: 'USER' }, process.env.JWT_SECRET, {
      subject: String(user.id),
      expiresIn: -10,
    });

    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set(auth(falsifie))).status).toBe(401);
    const res = await request(app).get('/api/v1/auth/me').set(auth(expire));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('JETON_INVALIDE');
  });

  test('un USER ne peut pas accéder à l’espace admin', async () => {
    const { token } = await createUser();
    expect((await request(app).get('/api/v1/admin/stats').set(auth(token))).status).toBe(403);
  });
});
