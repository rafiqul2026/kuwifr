// server/src/controllers/contact.controller.js
//
// Public Contact form (homepage + /contact) and the admin inbox for it.
//
// Every message is saved first, then emailed to support. If email is not
// configured or fails, the message is still in Admin > Contact Messages,
// so a visitor is never told "sent" for a message nobody can read.
//
// No auto-reply is sent to the visitor's address: that would let anyone use
// this form to make our mail server send email to arbitrary inboxes.
const mongoose = require('mongoose');
const ContactMessage = require('../models/ContactMessage');
const EmailService = require('../services/email.service');

const LIMITS = { name: 80, email: 120, phone: 20, subject: 120, message: 2000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Indian mobile, optionally with +91 / 0 prefix and spaces or dashes.
const PHONE_RE = /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const cleanMultiline = (v) =>
  typeof v === 'string' ? v.replace(/\r\n/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';

/**
 * Validates contact form input. Returns { errors } (field -> message) or
 * { data } with normalized values. Exported for tests.
 */
const validateContactInput = (body = {}) => {
  const data = {
    name: clean(body.name),
    email: clean(body.email).toLowerCase(),
    phone: clean(body.phone),
    subject: clean(body.subject),
    message: cleanMultiline(body.message)
  };
  const errors = {};

  if (data.name.length < 2) errors.name = 'Please enter your name.';
  else if (data.name.length > LIMITS.name) errors.name = `Name must be ${LIMITS.name} characters or fewer.`;

  if (!data.email) errors.email = 'Please enter your email address.';
  else if (data.email.length > LIMITS.email || !EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address.';

  if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = 'Please enter a valid 10-digit mobile number.';

  if (data.subject.length < 3) errors.subject = 'Please add a short subject.';
  else if (data.subject.length > LIMITS.subject) errors.subject = `Subject must be ${LIMITS.subject} characters or fewer.`;

  if (data.message.length < 10) errors.message = 'Please write a little more (at least 10 characters).';
  else if (data.message.length > LIMITS.message) errors.message = `Message must be ${LIMITS.message} characters or fewer.`;

  return Object.keys(errors).length ? { errors } : { data };
};

/**
 * Public: POST /api/contact
 * body { name, email, phone?, subject, message, website? }
 * `website` is a honeypot field that real visitors never see or fill in.
 */
const sendContactMessage = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Bots fill every field; pretend success so they don't retry.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return res.json({ success: true, message: 'Thank you! Your message has been received.' });
    }

    const { errors, data } = validateContactInput(body);
    if (errors) {
      return res.status(400).json({
        success: false,
        message: Object.values(errors)[0],
        errors
      });
    }

    const saved = await ContactMessage.create({
      ...data,
      ip: String(req.ip || '').slice(0, 64),
      userAgent: String(req.get('user-agent') || '').slice(0, 300)
    });

    // Best effort: the message is already safely stored above.
    try {
      const result = await EmailService.sendEmail({
        to: process.env.CONTACT_EMAIL_TO || process.env.EMAIL_FROM || 'support@kuwifr.com',
        subject: `Website enquiry: ${data.subject}`.slice(0, 150),
        html: `
          <h2>New message from the KUWIFR website</h2>
          <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(data.phone || 'Not provided')}</p>
          <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>
          <p style="color:#737373;font-size:12px">Also saved in Admin &gt; Contact Messages.</p>
        `,
        text: `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || 'Not provided'}\nSubject: ${data.subject}\n\n${data.message}`
      });
      if (result && !result.simulated) {
        await ContactMessage.updateOne({ _id: saved._id }, { $set: { emailDelivered: true } });
      }
    } catch (emailError) {
      console.error('Contact form email failed (message saved):', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received. Our support team will reply to your email.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: GET /api/contact/admin?status=NEW|READ|RESOLVED&page=1&limit=20&search=
 */
const listContactMessages = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (['NEW', 'READ', 'RESOLVED'].includes(req.query.status)) filter.status = req.query.status;
    const search = clean(req.query.search).slice(0, 80);
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { subject: rx }, { message: rx }];
    }

    const [items, total, counts] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-ip -userAgent')
        .lean(),
      ContactMessage.countDocuments(filter),
      ContactMessage.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
    ]);

    const byStatus = { NEW: 0, READ: 0, RESOLVED: 0 };
    counts.forEach((c) => { if (c._id in byStatus) byStatus[c._id] = c.n; });

    res.json({
      success: true,
      data: { messages: items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts: byStatus }
    });
  } catch (error) {
    next(error);
  }
};

/** Admin: PATCH /api/contact/admin/:id  body { status } */
const updateContactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id.' });
    }
    if (!['NEW', 'READ', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be NEW, READ or RESOLVED.' });
    }
    const msg = await ContactMessage.findByIdAndUpdate(id, { $set: { status } }, { new: true }).select('-ip -userAgent');
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });
    res.json({ success: true, message: `Marked as ${status.toLowerCase()}.`, data: { message: msg } });
  } catch (error) {
    next(error);
  }
};

/** Admin: DELETE /api/contact/admin/:id */
const deleteContactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id.' });
    }
    const msg = await ContactMessage.findByIdAndDelete(id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });
    res.json({ success: true, message: 'Message deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendContactMessage,
  listContactMessages,
  updateContactMessage,
  deleteContactMessage,
  validateContactInput
};
