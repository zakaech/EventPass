const { z } = require('zod');
const { idParams, pagination } = require('./common');

const listOrganisateurs = z.object({
  query: z.object({
    ...pagination,
    statut: z.enum(['EN_ATTENTE', 'VALIDE', 'REFUSE']).optional(),
  }),
});

const setValidation = z.object({
  params: idParams,
  body: z.object({ statut: z.enum(['VALIDE', 'REFUSE']) }),
});

module.exports = { listOrganisateurs, setValidation };
