jest.mock('../../src/config/db', () => ({ pool: {}, withTransaction: jest.fn() }));
jest.mock('../../src/repositories/userRepository');
jest.mock('../../src/repositories/organisateurRepository');
jest.mock('../../src/utils/password');
jest.mock('../../src/utils/jwt');

const userRepository = require('../../src/repositories/userRepository');
const { hashPassword, verifyPassword } = require('../../src/utils/password');
const { signToken } = require('../../src/utils/jwt');
const authService = require('../../src/services/authService');

const alice = { id: 1, email: 'alice@test.dev', nom: 'Alice', role: 'USER' };

beforeEach(() => {
  jest.resetAllMocks();
  signToken.mockReturnValue('jeton-signe');
  hashPassword.mockResolvedValue('hash');
});

describe('login', () => {
  test('identifiants corrects → jeton, et jamais le hash dans la réponse', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue({ ...alice, password_hash: 'h' });
    verifyPassword.mockResolvedValue(true);

    const result = await authService.login({ email: alice.email, password: 'secret123' });

    expect(result).toEqual({ user: alice, token: 'jeton-signe' });
    expect(signToken).toHaveBeenCalledWith(alice);
  });

  test('email inconnu → bcrypt est quand même exécuté (même durée de réponse)', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue(null);
    verifyPassword.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'inconnu@test.dev', password: 'x' }),
    ).rejects.toMatchObject({ status: 401, code: 'IDENTIFIANTS_INVALIDES' });
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });

  test('mauvais mot de passe → exactement la même erreur qu’un email inconnu', async () => {
    userRepository.findByEmailWithPassword.mockResolvedValue({ ...alice, password_hash: 'h' });
    verifyPassword.mockResolvedValue(false);
    const mauvaisMdp = await authService
      .login({ email: alice.email, password: 'x' })
      .catch((e) => e);

    userRepository.findByEmailWithPassword.mockResolvedValue(null);
    const inconnu = await authService.login({ email: 'y@test.dev', password: 'x' }).catch((e) => e);

    expect(mauvaisMdp.message).toBe(inconnu.message);
    expect(mauvaisMdp.code).toBe(inconnu.code);
  });
});

describe('register', () => {
  test('le mot de passe est haché avant l’enregistrement, rôle USER imposé', async () => {
    userRepository.create.mockResolvedValue(alice);

    await authService.register({ email: alice.email, password: 'secret123', nom: 'Alice' });

    expect(hashPassword).toHaveBeenCalledWith('secret123');
    expect(userRepository.create).toHaveBeenCalledWith({
      email: alice.email,
      passwordHash: 'hash',
      nom: 'Alice',
      role: 'USER',
    });
  });

  test('violation d’unicité PostgreSQL (23505) → EMAIL_DEJA_UTILISE', async () => {
    userRepository.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: '23505' }),
    );

    await expect(
      authService.register({ email: alice.email, password: 'secret123', nom: 'Alice' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_DEJA_UTILISE' });
  });

  test('autre erreur de base → propagée telle quelle (500 côté API)', async () => {
    const panne = new Error('connexion perdue');
    userRepository.create.mockRejectedValue(panne);

    await expect(
      authService.register({ email: alice.email, password: 'secret123', nom: 'Alice' }),
    ).rejects.toBe(panne);
  });
});
