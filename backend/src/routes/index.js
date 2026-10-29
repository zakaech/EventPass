const { Router } = require('express');
const { health } = require('../controllers/healthController');

const router = Router();

router.get('/health', health);

router.use('/auth', require('./authRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/me', require('./meRoutes'));
router.use('/organisateur', require('./organisateurRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
