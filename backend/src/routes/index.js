const { Router } = require('express');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', require('./authRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/me', require('./meRoutes'));
router.use('/organisateur', require('./organisateurRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
