import { createTransport } from 'nodemailer';
import { config } from '../config.js';
import { query } from '../db.js';

let transporter;

const createTransporter = () => {
  if (!config.email || !config.email.host || !config.email.port || !config.email.authUser || !config.email.authPass) {
    console.warn('Email config is incomplete. Emails will not be sent. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.');
    return null;
  }

  transporter = createTransport({
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

export const sendEmail = async ({ to, subject, text, html, from, companyId, req } = {}) => {
  if (!to) {
    throw new Error('Email \"to\" address is required');
  }

  let finalText = text;
  let finalHtml = html;
  let emailFrom = from || config.email.from;

  // Dynamic company name in FROM address and footer
  if (companyId || req?.companyId) {
    const effectiveCompanyId = companyId || req.companyId;
    try {
      const companyResult = await query('SELECT company_name, phone FROM companies WHERE id = $1', [effectiveCompanyId]);
      if (companyResult.rows.length > 0) {
        const company = companyResult.rows[0];
        // Dynamic FROM: "Company Name <email@domain>"
        const emailAddr = config.email.from || config.email.authUser;
        emailFrom = from || `"${company.company_name} <${emailAddr}>`;
        
        // Footer
        finalText = `${text}\n\nRegards\n${company.company_name}\n${company.phone || 'N/A'}`;
        finalHtml = `${html}<br><br><div style="margin-top:20px; padding-top:20px; border-top:1px solid #e5e7eb; font-size:14px; color:#6b7280;">
          <strong>Regards</strong><br>
          ${company.company_name}<br>
          ${company.phone || 'N/A'}
        </div>`;
      }
    } catch (dbError) {
      console.error('Company lookup failed for email:', dbError);
    }
  }

  const transport = getTransporter();
  if (!transport) {
    console.warn('Email transport is not configured. Skipping sendEmail for', to, subject);
    return null;
  }

  const message = {
    from: emailFrom,
    to,
    subject,
    text: finalText,
    html: finalHtml,
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

