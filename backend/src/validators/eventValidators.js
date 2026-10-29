const { z } = require('zod');
const { idParams, pagination, paginationQuery } = require('./common');

const CATEGORIES = ['CONCERT', 'THEATRE', 'SPORT', 'CONFERENCE', 'FESTIVAL', 'EXPOSITION', 'AUTRE'];

const prix = z.coerce.number().min(0).max(100000).multipleOf(0.01, 'Deux décimales maximum');

const list = z.object({
  query: z
    .object({
      ...pagination,
      ville: z.string().trim().min(1).optional(),
      categorie: z.enum(CATEGORIES).optional(),
      date_min: z.coerce.date().optional(),
      date_max: z.coerce.date().optional(),
      prix_min: prix.optional(),
      prix_max: prix.optional(),
    })
    .refine((q) => !q.date_min || !q.date_max || q.date_min <= q.date_max, {
      message: 'date_min doit être antérieure à date_max',
      path: ['date_min'],
    })
    .refine(
      (q) => q.prix_min === undefined || q.prix_max === undefined || q.prix_min <= q.prix_max,
      {
        message: 'prix_min doit être inférieur ou égal à prix_max',
        path: ['prix_min'],
      },
    ),
});

// Corps complet d'un événement (création et remplacement par PUT)
const eventBody = z.object({
  titre: z.string().trim().min(3).max(150),
  description: z.string().trim().max(5000).optional(),
  categorie: z.enum(CATEGORIES),
  ville: z.string().trim().min(2).max(100),
  lieu: z.string().trim().min(2).max(200),
  date_debut: z.iso
    .datetime({ offset: true, error: 'Date ISO 8601 attendue, ex. 2026-12-31T20:00:00+01:00' })
    .pipe(z.coerce.date())
    .refine((date) => date > new Date(), "La date de l'événement doit être dans le futur"),
  capacite: z.number().int().min(1).max(100000),
  prix,
  image_url: z.url().optional(),
});

const create = z.object({ body: eventBody });

const update = z.object({ params: idParams, body: eventBody });

const byId = z.object({ params: idParams });

const byIdPaginated = z.object({ params: idParams, query: paginationQuery });

const listOwned = z.object({ query: paginationQuery });

module.exports = { CATEGORIES, list, listOwned, create, update, byId, byIdPaginated };
