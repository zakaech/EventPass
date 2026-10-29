const checkinService = require('../services/checkinService');

async function checkIn(req, res) {
  const { event_id: eventId, token } = req.validated.body;
  res.json(await checkinService.checkIn(req.user.id, eventId, token));
}

module.exports = { checkIn };
