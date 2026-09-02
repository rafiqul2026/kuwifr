// server/src/controllers/support.controller.js
const Ticket = require('../models/Ticket');
const User = require('../models/User');

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
 * Add a response reply to an existing ticket
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

    const isAdmin = user?.role === 'ADMIN';
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

    res.json({
      success: true,
      data: { tickets: tickets || [] }
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