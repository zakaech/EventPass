const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Un JWT contient des données lisibles par tous (base64), plus une signature HMAC
// calculée avec JWT_SECRET. Sans le secret, impossible de modifier le contenu
// (par ex. passer "role" à ADMIN) sans invalider la signature.

function signToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

function verifyToken(token) {
  // On impose l'algorithme attendu : sans cette option, un jeton forgé pourrait
  // annoncer un autre algorithme (attaque dite "alg confusion").
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  return { id: Number(payload.sub), role: payload.role };
}

module.exports = { signToken, verifyToken };
