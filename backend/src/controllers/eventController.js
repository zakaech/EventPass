const eventService = require('../services/eventService');

async function list(req, res) {
  res.json(await eventService.listPublic(req.validated.query));
}

async function getById(req, res) {
  const event = await eventService.getById(req.validated.params.id);
  res.json({ event });
}

module.exports = { list, getById };
