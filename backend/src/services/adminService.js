const organisateurRepository = require('../repositories/organisateurRepository');
const statsRepository = require('../repositories/statsRepository');
const { toLimitOffset, paginated } = require('../utils/pagination');
const { NotFoundError } = require('../utils/errors');

async function listOrganisateurs({ page, limit, statut }) {
  const { rows, total } = await organisateurRepository.findAll({
    statut,
    ...toLimitOffset({ page, limit }),
  });
  return paginated(rows, total, { page, limit });
}

async function setValidation(organisateurId, statut) {
  const organisateur = await organisateurRepository.updateStatut(organisateurId, statut);
  if (!organisateur) {
    throw new NotFoundError('Organisateur introuvable');
  }
  return organisateur;
}

function getStats() {
  return statsRepository.getGlobalStats();
}

module.exports = { listOrganisateurs, setValidation, getStats };
