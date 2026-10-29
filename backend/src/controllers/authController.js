const authService = require('../services/authService');

// Les contrôleurs ne font que traduire HTTP ↔ service : lire req.validated,
// appeler le service, choisir le code HTTP. Aucune règle métier ici.

async function register(req, res) {
  const result = await authService.register(req.validated.body);
  res.status(201).json(result);
}

async function registerOrganisateur(req, res) {
  const result = await authService.registerOrganisateur(req.validated.body);
  res.status(201).json(result);
}

async function login(req, res) {
  const result = await authService.login(req.validated.body);
  res.json(result);
}

async function me(req, res) {
  const user = await authService.getMe(req.user.id);
  res.json({ user });
}

module.exports = { register, registerOrganisateur, login, me };
