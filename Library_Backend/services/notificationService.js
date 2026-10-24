const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');

async function createNotification({ user, title, message, type = 'general' }) {
  if (!user) return null;
  return Notification.create({ user, title, message, type });
}

async function sendEmail({ to, subject, text }) {
  if (!to || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { sent: false, reason: 'SMTP is not configured or recipient email is missing.' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (error) {
    console.error('Email delivery failed:', error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { createNotification, sendEmail };
