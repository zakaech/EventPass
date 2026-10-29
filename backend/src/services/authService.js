const { withTransaction } = require('../config/db');
const userRepository = require('../repositories/userRepository');
const organisateurRepository = require('../repositories/organisateurRepository');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { ConflictError, UnauthorizedError, NotFoundError } = require('../utils/errors');

// Hash calculé une fois, utilisé quand l'email n'existe pas (voir login)
const DUMMY_HASH_PROMISE = hashPassword('mot-de-passe-factice');

function isUniqueViolation(error) {
  return error.code === '23505';
}

async function register({ email, password, nom }) {
  const passwordHash = await hashPassword(password);
  try {
    const user = await userRepository.create({ email, passwordHash, nom, role: 'USER' });
    return { user, token: signToken(user) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('Un compte existe déjà avec cet email', 'EMAIL_DEJA_UTILISE');
    }
    throw error;
  }
}

/** Crée l'utilisateur et sa fiche organisateur ensemble : tout ou rien. */
async function registerOrganisateur({ email, password, nom, nom_organisation, ville, description }) {
  const passwordHash = await hashPassword(password);
  try {
    return await withTransaction(async (client) => {
      const user = await userRepository.create(
        { email, passwordHash, nom, role: 'ORGANISATEUR' },
        client,
      );
      const organisateur = await organisateurRepository.create(
        { userId: user.id, nomOrganisation: nom_organisation, ville, description },
        client,
      );
      return { user: { ...user, organisateur }, token: signToken(user) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('Un compte existe déjà avec cet email', 'EMAIL_DEJA_UTILISE');
    }
    throw error;
  }
}

async function login({ email, password }) {
  const user = await userRepository.findByEmailWithPassword(email);

  // Même si l'email n'existe pas, on fait une comparaison bcrypt : la réponse prend
  // le même temps dans les deux cas et on ne révèle pas quels emails sont inscrits.
  const hash = user ? user.password_hash : await DUMMY_HASH_PROMISE;
  const passwordOk = await verifyPassword(password, hash);

  if (!user || !passwordOk) {
    // Message volontairement identique pour "email inconnu" et "mauvais mot de passe"
    throw new UnauthorizedError('Email ou mot de passe incorrect', 'IDENTIFIANTS_INVALIDES');
  }

  // On retire le hash avant de renvoyer l'utilisateur
  const { password_hash, ...publicUser } = user;
  return { user: publicUser, token: signToken(publicUser) };
}

async function getMe(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable');
  }
  if (user.role === 'ORGANISATEUR') {
    user.organisateur = await organisateurRepository.findByUserId(userId);
  }
  return user;
}

module.exports = { register, registerOrganisateur, login, getMe };
