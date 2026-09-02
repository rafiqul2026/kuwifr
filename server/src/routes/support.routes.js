// server/src/routes/support.routes.js
const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');

const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);

router.use(auth);

// Member Routes
router.get('/my-tickets', supportController.getMyTickets);
router.post('/create-ticket', supportController.createTicket);
router.post('/tickets/:id/reply', supportController.addReply);

// Admin Routes
router.get('/admin/all-tickets', supportController.getAllTicketsAdmin);
router.put('/admin/tickets/:id/status', supportController.updateTicketStatus);

module.exports = router;