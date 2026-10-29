const ticketService = require('../services/ticketService');

async function reserve(req, res) {
  const { params, body } = req.validated;
  const result = await ticketService.reserve(req.user.id, params.id, body.quantite);
  res.status(201).json(result);
}

async function listMine(req, res) {
  res.json(await ticketService.listMine(req.user.id, req.validated.query));
}

async function cancel(req, res) {
  const result = await ticketService.cancel(req.user.id, req.validated.params.id);
  res.json(result);
}

module.exports = { reserve, listMine, cancel };
