// server/src/models/ContactMessage.js
//
// Messages sent from the public Contact form (homepage + /contact). Stored
// so nothing is lost when email delivery is not configured or fails —
// admins read and resolve them at Admin > Contact Messages.
const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    phone: { type: String, trim: true, default: '', maxlength: 20 },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['NEW', 'READ', 'RESOLVED'],
      default: 'NEW',
      index: true
    },
    // Whether the notification email to support was actually delivered
    // (false when no email provider is configured or sending failed).
    emailDelivered: { type: Boolean, default: false },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 300 }
  },
  { timestamps: true }
);

ContactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
