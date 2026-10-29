// Le middleware d'erreurs est une simple fonction (err, req, res, next) : on l'appelle avec
// un faux objet `res` dont les méthodes sont des jest.fn(), pour inspecter la réponse.
const { errorHandler } = require('../../src/middlewares/errorHandler');
const { NotFoundError, ConflictError } = require('../../src/utils/errors');

function fakeResponse() {
  const res = {};
  res.status = jest.fn(() => res); // renvoie res pour permettre res.status(…).json(…)
  res.json = jest.fn(() => res);
  return res;
}

test('erreur métier → son code HTTP et son code lisible', () => {
  const res = fakeResponse();
  errorHandler(new ConflictError('Plus de places', 'PLACES_INSUFFISANTES', { n: 0 }), {}, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith({
    error: { code: 'PLACES_INSUFFISANTES', message: 'Plus de places', details: { n: 0 } },
  });
});

test('NotFoundError → 404 avec le message par défaut', () => {
  const res = fakeResponse();
  errorHandler(new NotFoundError(), {}, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json.mock.calls[0][0].error.code).toBe('INTROUVABLE');
});

test.each([
  ['23505', 'CONFLIT'],
  ['23514', 'CONTRAINTE'],
])('violation de contrainte PostgreSQL %s non anticipée → 409 %s', (pgCode, code) => {
  const res = fakeResponse();
  errorHandler(Object.assign(new Error('pg'), { code: pgCode }), {}, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json.mock.calls[0][0].error.code).toBe(code);
});

test('erreur inattendue → 500 sans aucun détail interne', () => {
  const res = fakeResponse();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  errorHandler(new Error('mot de passe de la base : hunter2'), {}, res);

  expect(res.status).toHaveBeenCalledWith(500);
  const body = JSON.stringify(res.json.mock.calls[0][0]);
  expect(body).not.toContain('hunter2');
  expect(log).toHaveBeenCalled(); // l'erreur complète reste dans les journaux du serveur
  log.mockRestore();
});
