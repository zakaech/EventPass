const bcrypt = require('bcrypt');
const env = require('../config/env');

// bcrypt ajoute un sel aléatoire à chaque mot de passe (deux mots de passe identiques
// donnent deux hash différents) et il est volontairement lent : tester des milliards
// de mots de passe sur une base volée devient très coûteux.

function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };
