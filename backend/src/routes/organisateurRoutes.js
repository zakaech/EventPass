const { Router } = require('express');
const controller = require('../controllers/organisateurController');
const validate = require('../middlewares/validate');
const { authenticate, requireRole, requireOrganisateurValide } = require('../middlewares/auth');
const schemas = require('../validators/eventValidators');

const router = Router();

// Chaîne de middlewares appliquée à toutes les routes de ce routeur :
// connecté → rôle ORGANISATEUR → compte validé par un admin
router.use(authenticate, requireRole('ORGANISATEUR'), requireOrganisateurValide);

router.get('/events', validate(schemas.listOwned), controller.listMyEvents);
router.post('/events', validate(schemas.create), controller.createEvent);
router.get('/events/:id', validate(schemas.byId), controller.getMyEvent);
router.put('/events/:id', validate(schemas.update), controller.updateEvent);
router.patch('/events/:id/annuler', validate(schemas.byId), controller.cancelEvent);
router.get(
  '/events/:id/reservations',
  validate(schemas.byIdPaginated),
  controller.listReservations,
);
router.get('/events/:id/stats', validate(schemas.byId), controller.getStats);

module.exports = router;
