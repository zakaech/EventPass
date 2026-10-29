const { z } = require('zod');
const { id } = require('./common');

// `token` : contenu lu dans le QR code ("EP1.…") ou code de secours saisi à la main.
// Sa validité (signature) est vérifiée par le service, pas ici.
const checkin = z.object({
  body: z.object({
    event_id: id,
    token: z.string().trim().min(1).max(200),
  }),
});

module.exports = { checkin };
