const { Router } = require('express');
const controller = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { loginRateLimit } = require('../middlewares/rateLimit');
const schemas = require('../validators/authValidators');

const router = Router();

router.post('/register', validate(schemas.register), controller.register);
router.post(
  '/register/organisateur',
  validate(schemas.registerOrganisateur),
  controller.registerOrganisateur,
);
router.post('/login', loginRateLimit, validate(schemas.login), controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
