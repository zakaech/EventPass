const env = require('../config/env');

/** Vrai si ce compte est déclaré en lecture seule (variable READ_ONLY_EMAILS). */
function isReadOnlyEmail(email) {
  return env.READ_ONLY_EMAILS.includes(String(email).toLowerCase());
}

module.exports = { isReadOnlyEmail };
