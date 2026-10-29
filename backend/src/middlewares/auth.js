const { verifyToken } = require('../utils/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const organisateurRepository = require('../repositories/organisateurRepository');

// Un middleware est une fonction (req, res, next) exécutée avant le contrôleur.
// Il peut enrichir la requête (req.user), la laisser passer (next())
// ou l'arrêter en transmettant une erreur (next(err)).

/** Vérifie le JWT de l'en-tête "Authorization: Bearer <jeton>" et remplit req.user. */
function authenticate(req, res, next) {
  const header = req.get('Authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError());
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Jeton invalide ou expiré', 'JETON_INVALIDE'));
  }
}

/** Autorise uniquement les rôles listés. À placer après authenticate. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}

/**
 * Vérifie en base que l'organisateur a été validé par un admin.
 * Ce statut n'est pas mis dans le JWT : il peut changer après la connexion
 * (validation ou refus par l'admin), il faut donc le relire à chaque requête.
 */
async function requireOrganisateurValide(req, res, next) {
  const organisateur = await organisateurRepository.findByUserId(req.user.id);
  if (!organisateur || organisateur.statut_validation !== 'VALIDE') {
    throw new ForbiddenError(
      "Votre compte organisateur n'a pas encore été validé par un administrateur",
      'ORGANISATEUR_NON_VALIDE',
    );
  }
  next();
}

module.exports = { authenticate, requireRole, requireOrganisateurValide };
