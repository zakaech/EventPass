const { AppError } = require('../utils/errors');

// Middleware d'erreurs : Express le reconnaît à ses 4 paramètres.
// Avec Express 5, une erreur levée dans un contrôleur async arrive ici automatiquement.
// Toutes les erreurs ressortent au même format : { error: { code, message, details? } }.
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Corps JSON mal formé (erreur levée par express.json())
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'JSON_INVALIDE', message: 'Corps JSON invalide' } });
  }

  // Filet de sécurité : violation d'une contrainte PostgreSQL non anticipée par un service
  if (err.code === '23505') {
    return res
      .status(409)
      .json({ error: { code: 'CONFLIT', message: 'Cette ressource existe déjà' } });
  }
  if (err.code === '23514') {
    return res
      .status(409)
      .json({
        error: { code: 'CONTRAINTE', message: 'Opération contraire aux règles de données' },
      });
  }

  // Erreur inattendue : on la journalise mais on ne renvoie aucun détail interne au client
  console.error(err);
  return res
    .status(500)
    .json({ error: { code: 'ERREUR_INTERNE', message: 'Erreur interne du serveur' } });
}

function notFound(req, res) {
  res.status(404).json({
    error: {
      code: 'ROUTE_INTROUVABLE',
      message: `Route ${req.method} ${req.originalUrl} introuvable`,
    },
  });
}

module.exports = { errorHandler, notFound };
