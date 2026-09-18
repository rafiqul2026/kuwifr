// server/src/controllers/newsletter.controller.js
const NewsletterSubscriber = require('../models/NewsletterSubscriber');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const subscribe = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    // Idempotent: re-subscribing an already-stored email is still a success,
    // never a duplicate-key error surfaced to the visitor.
    await NewsletterSubscriber.findOneAndUpdate(
      { email },
      { email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { subscribe };
