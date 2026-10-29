const { z } = require('zod');
const { ValidationError } = require('../utils/errors');

// Messages d'erreur de zod en français ("Trop petit : ..." au lieu de "Too small: ...")
z.config(z.locales.fr());

/**
 * Valide req.body / req.query / req.params avec un schéma zod de la forme
 * z.object({ body, query, params }) et place le résultat nettoyé dans req.validated.
 * Les champs inconnus sont supprimés, les types convertis ("2" → 2 pour la query).
 *
 * Avec Express 5, req.query est en lecture seule : on ne peut pas le remplacer,
 * d'où l'objet séparé req.validated.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        champ: issue.path.slice(1).join('.'), // on retire le préfixe body/query/params
        message: issue.message,
      }));
      return next(new ValidationError('Données invalides', details));
    }
    req.validated = result.data;
    next();
  };
}

module.exports = validate;
