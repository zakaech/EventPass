const { Router } = require('express');
const controller = require('../controllers/ticketController');
const validate = require('../middlewares/validate');
const { authenticate, requireRole } = require('../middlewares/auth');
const schemas = require('../validators/ticketValidators');

const router = Router();

// Toutes les routes /me/... concernent les billets d'un compte USER connecté
router.use(authenticate, requireRole('USER'));

router.get('/tickets', validate(schemas.listMine), controller.listMine);
router.patch('/tickets/:id/annuler', validate(schemas.cancel), controller.cancel);

module.exports = router;
