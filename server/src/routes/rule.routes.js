// server/src/routes/rule.routes.js
const express = require('express');
const router = express.Router();
const ruleController = require('../controllers/rule.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// All Business Rules routes are admin-only.
router.use(auth, adminAuth);
router.get('/', ruleController.getRules);
router.post('/', ruleController.createRule);
router.put('/:id', ruleController.updateRule);
router.delete('/:id', ruleController.deleteRule);

module.exports = router;
