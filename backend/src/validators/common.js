const { z } = require('zod');

// Identifiant dans l'URL : "/events/12" → 12 (les paramètres d'URL sont toujours des chaînes)
const id = z.coerce.number().int().positive();

const idParams = z.object({ id });

// ?page=2&limit=20 — valeurs par défaut et plafond pour éviter "limit=1000000"
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

const paginationQuery = z.object(pagination);

module.exports = { id, idParams, pagination, paginationQuery };
