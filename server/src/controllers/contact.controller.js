const EmailService = require('../services/email.service');

const sendContactMessage = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, subject and message'
      });
    }

    // Send email to support
    await EmailService.sendEmail({
      to: process.env.EMAIL_FROM || 'support@kuwifr.com',
      subject: `Contact Form: ${subject}`,
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    });

    // Send auto-reply to user
    await EmailService.sendEmail({
      to: email,
      subject: 'Thank you for contacting KUWIFR',
      html: `
        <h2>Thank You for Contacting Us</h2>
        <p>Dear ${name},</p>
        <p>Thank you for reaching out to KUWIFR. We have received your message and will get back to you within 24 hours.</p>
        <p>Your message: ${message.substring(0, 100)}...</p>
        <p>Best regards,<br>KUWIFR Support Team</p>
      `
    });

    res.json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendContactMessage
};