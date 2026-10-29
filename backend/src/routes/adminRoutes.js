const { Router } = require('express');
const controller = require('../controllers/adminController');
const validate = require('../middlewares/validate');
const { authenticate, requireRole } = require('../middlewares/auth');
const schemas = require('../validators/adminValidators');

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/organisateurs', validate(schemas.listOrganisateurs), controller.listOrganisateurs);
router.patch(
  '/organisateurs/:id/validation',
  validate(schemas.setValidation),
  controller.setValidation,
);
router.get('/stats', controller.getStats);

module.exports = router;
