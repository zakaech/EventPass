const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const { isReadOnlyEmail } = require('../utils/readOnly');
const { ForbiddenError } = require('../utils/errors');

// Méthodes HTTP qui ne modifient rien (lecture)
const LECTURE = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Comptes en lecture seule (démo publique) : toute requête d'écriture (POST, PUT, PATCH,
 * DELETE) est refusée en 403, quelle que soit la route du routeur où il est placé.
 *
 * C'est le SERVEUR qui fait respecter la règle : griser les boutons dans l'interface ne
 * suffit pas, n'importe qui peut envoyer la requête directement avec le jeton du compte.
 * L'email est relu en base (il n'est pas dans le JWT) : modifier READ_ONLY_EMAILS prend
 * effet immédiatement, sans attendre l'expiration des jetons déjà distribués.
 * À placer après authenticate.
 */
async function refuseWritesForReadOnly(req, res, next) {
  if (LECTURE.includes(req.method) || env.READ_ONLY_EMAILS.length === 0) {
    return next();
  }
  const user = await userRepository.findById(req.user.id);
  if (user && isReadOnlyEmail(user.email)) {
    throw new ForbiddenError(
      'Compte de démonstration en lecture seule : consultation uniquement, aucune modification possible',
      'LECTURE_SEULE',
    );
  }
  next();
}

module.exports = { refuseWritesForReadOnly };
