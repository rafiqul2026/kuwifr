// server/src/routes/support.routes.js
const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');

const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth = authModule.adminAuth || ((req, res, next) => {
  const role = (req.user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
});

router.use(auth);

// Member Routes
router.get('/my-tickets', supportController.getMyTickets);
router.post('/create-ticket', supportController.createTicket);
router.post('/tickets/:id/reply', supportController.addReply);

// Admin Routes — previously protected by basic auth() only, so any
// logged-in member (not just an admin) could call these and read every
// other member's support tickets. adminAuth restricts them to
// ADMIN/SUPER_ADMIN, matching the pattern already used in admin.routes.js.
router.get('/admin/all-tickets', adminAuth, supportController.getAllTicketsAdmin);
router.put('/admin/tickets/:id/status', adminAuth, supportController.updateTicketStatus);

module.exports = router;
