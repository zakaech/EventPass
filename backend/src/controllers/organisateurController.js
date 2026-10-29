const eventService = require('../services/eventService');

async function listMyEvents(req, res) {
  res.json(await eventService.listByOrganisateur(req.user.id, req.validated.query));
}

async function getMyEvent(req, res) {
  const { id } = req.validated.params;
  const event = await eventService.getOwned(req.user.id, id);
  res.json({ event });
}

async function createEvent(req, res) {
  const event = await eventService.create(req.user.id, req.validated.body);
  res.status(201).json({ event });
}

async function updateEvent(req, res) {
  const { params, body } = req.validated;
  const event = await eventService.update(req.user.id, params.id, body);
  res.json({ event });
}

async function cancelEvent(req, res) {
  const event = await eventService.cancel(req.user.id, req.validated.params.id);
  res.json({ event });
}

async function listReservations(req, res) {
  const { params, query } = req.validated;
  res.json(await eventService.listReservations(req.user.id, params.id, query));
}

async function getStats(req, res) {
  const stats = await eventService.getStats(req.user.id, req.validated.params.id);
  res.json({ stats });
}

module.exports = {
  listMyEvents,
  getMyEvent,
  createEvent,
  updateEvent,
  cancelEvent,
  listReservations,
  getStats,
};
