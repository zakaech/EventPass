const { Router } = require('express');
const controller = require('../controllers/adminController');
const validate = require('../middlewares/validate');
const { authenticate, requireRole } = require('../middlewares/auth');
const { refuseWritesForReadOnly } = require('../middlewares/readOnly');
const schemas = require('../validators/adminValidators');

const router = Router();

// Toutes les routes admin : connecté, rôle ADMIN, et aucune écriture pour un compte en
// lecture seule (admin de la démo publique). Une future route d'écriture sera protégée
// automatiquement.
router.use(authenticate, requireRole('ADMIN'), refuseWritesForReadOnly);

router.get('/organisateurs', validate(schemas.listOrganisateurs), controller.listOrganisateurs);
router.patch(
  '/organisateurs/:id/validation',
  validate(schemas.setValidation),
  controller.setValidation,
);
router.get('/stats', controller.getStats);

module.exports = router;
