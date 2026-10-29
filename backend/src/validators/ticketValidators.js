const { z } = require('zod');
const { idParams, paginationQuery } = require('./common');

const MAX_BILLETS_PAR_EVENEMENT = 4;

const reserve = z.object({
  params: idParams,
  body: z.object({
    quantite: z.number().int().min(1).max(MAX_BILLETS_PAR_EVENEMENT),
  }),
});

const listMine = z.object({ query: paginationQuery });

const cancel = z.object({ params: idParams });

module.exports = { MAX_BILLETS_PAR_EVENEMENT, reserve, listMine, cancel };
