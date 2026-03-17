import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;

const createTransporter = () => {
  if (!config.email || !config.email.host || !config.email.port || !config.email.authUser || !config.email.authPass) {
    console.warn('Email config is incomplete. Emails will not be sent. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.authUser,
      pass: config.email.authPass,
    },
  });

  return transporter;
};

export const getTransporter = () => {
  if (transporter) return transporter;
  return createTransporter();
};

export const sendEmail = async ({ to, subject, text, html, from }) => {
  if (!to) {
    throw new Error('Email "to" address is required');
  }

  const transport = getTransporter();
  if (!transport) {
    console.warn('Email transport is not configured. Skipping sendEmail for', to, subject);
    return null;
  }

  const message = {
    from: from || config.email.from,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transport.sendMail(message);
    console.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Failed to send email', error);
    throw error;
  }
};
