// server/src/controllers/support.controller.js
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Get all support tickets raised by current logged in member
 * GET /api/support/my-tickets
 */
const getMyTickets = async (req, res, next) => {
  try {
    const userId = req.userId;
    const tickets = await Ticket.find({ userId }).sort({ createdAt: -1 }).lean();

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'OPEN').length,
      inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: tickets.filter(t => t.status === 'RESOLVED').length
    };

    res.json({
      success: true,
      data: {
        tickets: tickets || [],
        stats
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Raise a new support ticket
 * POST /api/support/create-ticket
 */
const createTicket = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { category, priority, subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message description are required.'
      });
    }

    const ticketCount = await Ticket.countDocuments();
    const ticketId = `TCK-${1000 + ticketCount + 1}`;

    const ticket = await Ticket.create({
      ticketId,
      userId,
      category: category || 'GENERAL',
      priority: priority || 'MEDIUM',
      subject,
      message,
      status: 'OPEN'
    });

    res.status(201).json({
      success: true,
      message: `Support ticket #${ticketId} created successfully! Our team will resolve it shortly.`,
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a response reply to an existing ticket. Shared by both the member's
 * own ticket thread (SupportPage.jsx) and the Admin Support Tickets page
 * (AdminSupportPage.jsx) — the same endpoint, differentiated by the
 * caller's real User.role, not by which UI called it.
 * POST /api/support/tickets/:id/reply
 */
const addReply = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!message) {
      return res.status(400).json({ success: false, message: 'Reply message cannot be empty' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // SUPER_ADMIN accounts were previously falling through to the MEMBER
    // branch below (only the literal 'ADMIN' role was recognized), which
    // silently mis-tagged their replies and never auto-moved a fresh
    // ticket to IN_PROGRESS.
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    // A non-admin can only reply on their OWN ticket — otherwise any
    // authenticated member could post into (and read) a ticket they don't
    // own just by knowing/guessing its id.
    if (!isAdmin && String(ticket.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only reply to your own tickets' });
    }

    const role = isAdmin ? 'ADMIN' : 'MEMBER';

    ticket.replies.push({
      senderId: userId,
      senderRole: role,
      message
    });

    if (isAdmin && ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
    }

    await ticket.save();

    // Let the member know support actually responded — otherwise the only
    // way to find out is to happen to reopen the ticket thread themselves.
    if (isAdmin) {
      try {
        await Notification.create({
          userId: ticket.userId,
          type: 'ADMIN',
          priority: ticket.priority === 'URGENT' ? 'URGENT' : 'MEDIUM',
          title: `New reply on ticket #${ticket.ticketId}`,
          message: `Support replied to "${ticket.subject}": ${message.slice(0, 120)}${message.length > 120 ? '…' : ''}`,
          icon: '🎧',
          color: '#2563eb',
          action: '/member/support',
          actionLabel: 'View Ticket'
        });
      } catch (notifyErr) {
        console.error('[addReply] notification failed:', notifyErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Reply added successfully',
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all tickets submitted across the platform
 * GET /api/support/admin/all-tickets
 */
const getAllTicketsAdmin = async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const tickets = await Ticket.find(query)
      .populate('userId', 'fullName email phoneNumber memberId')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'OPEN').length,
      inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: tickets.filter(t => t.status === 'RESOLVED').length,
      closed: tickets.filter(t => t.status === 'CLOSED').length
    };

    res.json({
      success: true,
      data: { tickets: tickets || [], stats }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update ticket status (e.g. mark RESOLVED or CLOSED)
 * PUT /api/support/admin/tickets/:id/status
 */
const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : null
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Tell the member their ticket was resolved/closed — this is the only
    // signal they get short of reopening the ticket thread themselves.
    if (status === 'RESOLVED' || status === 'CLOSED') {
      try {
        await Notification.create({
          userId: ticket.userId,
          type: 'ADMIN',
          priority: 'MEDIUM',
          title: status === 'RESOLVED'
            ? `Ticket #${ticket.ticketId} resolved`
            : `Ticket #${ticket.ticketId} closed`,
          message: status === 'RESOLVED'
            ? `Your support ticket "${ticket.subject}" has been marked resolved. Reply if you still need help.`
            : `Your support ticket "${ticket.subject}" has been closed.`,
          icon: status === 'RESOLVED' ? '✅' : '🔒',
          color: status === 'RESOLVED' ? '#16a34a' : '#6b7280',
          action: '/member/support',
          actionLabel: 'View Ticket'
        });
      } catch (notifyErr) {
        console.error('[updateTicketStatus] notification failed:', notifyErr.message);
      }
    }

    res.json({
      success: true,
      message: `Ticket status updated to ${status}`,
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyTickets,
  createTicket,
  addReply,
  getAllTicketsAdmin,
  updateTicketStatus
};
