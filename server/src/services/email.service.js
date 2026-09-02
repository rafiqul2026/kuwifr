const nodemailer = require('nodemailer');
const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.useResend = false;
    this.transporter = null;
    this.resendClient = null;
    this.logEmails = true; // Always log in development

    // Try Resend first
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_xxxxxxxxxxxxxxxxxxxx') {
      try {
        this.resendClient = new Resend(process.env.RESEND_API_KEY);
        this.useResend = true;
        console.log('✅ Email service: Using Resend API');
      } catch (error) {
        console.warn('⚠️ Resend initialization failed, falling back to Nodemailer');
        this.useResend = false;
      }
    }

    // Fallback to Nodemailer
    if (!this.useResend && process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        console.log('✅ Email service: Using Nodemailer with SMTP');
      } catch (error) {
        console.error('❌ Email service initialization failed:', error.message);
      }
    }

    // Log emails if no service is configured
    if (!this.useResend && !this.transporter) {
      console.warn('⚠️ No email service configured. Emails will be logged to console only.');
      this.logEmails = true;
    }
  }

  async sendEmail({ to, subject, html, text }) {
  // ALWAYS log the email in development
  console.log('\n📧 ========== EMAIL SENT ==========');
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Link: ${html?.match(/href="([^"]+)"/)?.[1] || 'No link found'}`);
  console.log('  ==================================\n');

    // If no service configured, just log
    if (!this.useResend && !this.transporter) {
      console.log('📧 Email logged (no service configured)');
      return { success: true, simulated: true };
    }

    try {
      // Try Resend first
      if (this.useResend) {
        const { data, error } = await this.resendClient.emails.send({
          from: `${process.env.EMAIL_FROM_NAME || 'KUWIFR'} <${process.env.EMAIL_FROM || 'noreply@resend.dev'}>`,
          to: [to],
          subject: subject,
          html: html,
          text: text || html?.replace(/<[^>]*>/g, '')
        });

        if (error) {
          console.error('Resend error:', error);
          if (this.transporter) {
            return await this.sendWithNodemailer({ to, subject, html, text });
          }
          throw error;
        }

        console.log(`✅ Email sent via Resend to ${to}`);
        return { success: true, data };
      }

      // Use Nodemailer
      if (this.transporter) {
        return await this.sendWithNodemailer({ to, subject, html, text });
      }

      throw new Error('No email service available');
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendWithNodemailer({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME || 'KUWIFR'} <${process.env.EMAIL_FROM || 'noreply@kuwifr.com'}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || html?.replace(/<[^>]*>/g, '')
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent via Nodemailer to ${to}`);
      return { success: true, data: info };
    } catch (error) {
      console.error('Nodemailer error:', error);
      throw error;
    }
  }

  // ============ EMAIL TEMPLATES ============

  getVerificationEmail(name, verificationLink) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f8fafc;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Welcome to KUWIFR!</h1>
          <p>Please verify your email address</p>
        </div>
        <div class="content">
          <h2>Hello ${name}!</h2>
          <p>Thank you for joining KUWIFR. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
          </div>
          <p style="word-break: break-all; background: #e2e8f0; padding: 10px; border-radius: 5px; font-size: 12px;">
            Or copy this link: ${verificationLink}
          </p>
          <p>Best regards,<br><strong>KUWIFR Services Team</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} KUWIFR Services Pvt Ltd. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to KUWIFR!
      
      Hello ${name}!
      
      Thank you for joining KUWIFR. Please verify your email address by clicking this link:
      ${verificationLink}
      
      Best regards,
      KUWIFR Services Team
    `;

    return { html, text };
  }

  getWelcomeEmail(name, verificationLink) {
    return this.getVerificationEmail(name, verificationLink);
  }

  getPasswordResetEmail(name, resetLink) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #f59e0b, #ef4444);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f8fafc;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔐 Reset Your Password</h1>
        </div>
        <div class="content">
          <h2>Hello ${name}!</h2>
          <p>We received a request to reset your password.</p>
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>
          <div class="warning">
            <p><strong>⚠️ Important:</strong> This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <p>Best regards,<br><strong>KUWIFR Services Team</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} KUWIFR Services Pvt Ltd. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Reset Your Password
      
      Hello ${name}!
      
      We received a request to reset your password.
      Click this link to reset: ${resetLink}
      
      This link will expire in 1 hour.
      If you didn't request this, please ignore this email.
      
      Best regards,
      KUWIFR Services Team
    `;

    return { html, text };
  }
}

module.exports = new EmailService();