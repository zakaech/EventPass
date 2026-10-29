const adminService = require('../services/adminService');

async function listOrganisateurs(req, res) {
  res.json(await adminService.listOrganisateurs(req.validated.query));
}

async function setValidation(req, res) {
  const { params, body } = req.validated;
  const organisateur = await adminService.setValidation(params.id, body.statut);
  res.json({ organisateur });
}

async function getStats(req, res) {
  const stats = await adminService.getStats();
  res.json({ stats });
}

module.exports = { listOrganisateurs, setValidation, getStats };
