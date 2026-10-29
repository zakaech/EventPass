const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

// Limite les tentatives de connexion par adresse IP : sans cela, un attaquant pourrait
// essayer des milliers de mots de passe par minute sur un compte (force brute).
const loginRateLimit = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8', // en-têtes RateLimit-* standard pour informer le client
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'TROP_DE_TENTATIVES',
        message: 'Trop de tentatives de connexion, réessayez plus tard',
      },
    });
  },
});

module.exports = { loginRateLimit };
