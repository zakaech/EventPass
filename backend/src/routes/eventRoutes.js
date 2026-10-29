const { Router } = require('express');
const eventController = require('../controllers/eventController');
const ticketController = require('../controllers/ticketController');
const validate = require('../middlewares/validate');
const { authenticate, requireRole } = require('../middlewares/auth');
const eventSchemas = require('../validators/eventValidators');
const ticketSchemas = require('../validators/ticketValidators');

const router = Router();

// Routes publiques
router.get('/', validate(eventSchemas.list), eventController.list);
router.get('/:id', validate(eventSchemas.byId), eventController.getById);

// Réservation : réservée aux comptes USER
router.post(
  '/:id/tickets',
  authenticate,
  requireRole('USER'),
  validate(ticketSchemas.reserve),
  ticketController.reserve,
);

module.exports = router;
