// Erreurs métier : chaque classe porte son code HTTP et un code lisible par le frontend.
// Les services lèvent ces erreurs, le middleware errorHandler les transforme en JSON.

class AppError extends Error {
  constructor(message, { status = 500, code = 'ERREUR_INTERNE', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Données invalides', details) {
    super(message, { status: 400, code: 'VALIDATION', details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise', code = 'NON_AUTHENTIFIE') {
    super(message, { status: 401, code });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé', code = 'ACCES_REFUSE') {
    super(message, { status: 403, code });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable', code = 'INTROUVABLE') {
    super(message, { status: 404, code });
  }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLIT', details) {
    super(message, { status: 409, code, details });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
