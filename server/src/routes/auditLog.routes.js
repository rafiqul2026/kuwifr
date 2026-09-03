// server/src/routes/auditLog.routes.js
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditLog.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

router.use(auth);
router.use(adminAuth);

router.get('/', auditController.getAuditLogs);
router.get('/all', auditController.getAuditLogs);
router.delete('/clear', auditController.clearAuditLogs);

module.exports = router;