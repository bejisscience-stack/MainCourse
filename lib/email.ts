import { resend } from './resend';
import { emailTemplates, EmailLanguage } from './email-templates';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Resend.
 * @param params - Email parameters (to, subject, html, text)
 * @returns The message ID from Resend
 * @throws Error if email sending fails
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<string> {
  const from = process.env.EMAIL_FROM || 'Wavleba <no-reply@wavleba.ge>';
  const replyTo = process.env.EMAIL_REPLY_TO;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
    ...(replyTo && { reply_to: replyTo }),
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data!.id;
}

// ============================================
// Specialized Email Functions
// ============================================

/**
 * Send welcome email after user verifies their email
 */
export async function sendWelcomeEmail(
  to: string,
  username?: string,
  lang: EmailLanguage = 'en'
): Promise<string> {
  const template = emailTemplates.welcome;
  return sendEmail({
    to,
    subject: template.subject[lang],
    html: template.html({ username }),
    text: template.text({ username }),
  });
}

/**
 * Send enrollment approved email
 */
export async function sendEnrollmentApprovedEmail(
  to: string,
  courseName: string,
  lang: EmailLanguage = 'en'
): Promise<string> {
  const template = emailTemplates.enrollmentApproved;
  return sendEmail({
    to,
    subject: template.subject[lang],
    html: template.html({ courseName }),
    text: template.text({ courseName }),
  });
}

/**
 * Send enrollment rejected email
 */
export async function sendEnrollmentRejectedEmail(
  to: string,
  courseName: string,
  reason?: string,
  lang: EmailLanguage = 'en'
): Promise<string> {
  const template = emailTemplates.enrollmentRejected;
  return sendEmail({
    to,
    subject: template.subject[lang],
    html: template.html({ courseName, reason }),
    text: template.text({ courseName, reason }),
  });
}

/**
 * Send withdrawal approved email
 */
export async function sendWithdrawalApprovedEmail(
  to: string,
  amount: number,
  lang: EmailLanguage = 'en'
): Promise<string> {
  const template = emailTemplates.withdrawalApproved;
  return sendEmail({
    to,
    subject: template.subject[lang],
    html: template.html({ amount }),
    text: template.text({ amount }),
  });
}

/**
 * Send withdrawal rejected email
 */
export async function sendWithdrawalRejectedEmail(
  to: string,
  amount: number,
  reason?: string,
  lang: EmailLanguage = 'en'
): Promise<string> {
  const template = emailTemplates.withdrawalRejected;
  return sendEmail({
    to,
    subject: template.subject[lang],
    html: template.html({ amount, reason }),
    text: template.text({ amount, reason }),
  });
}

/**
 * Send bundle enrollment approved email
 */
export async function sendBundleEnrollmentApprovedEmail(
  to: string,
  bundleName: string,
  lang: EmailLanguage = 'en'
): Promise<string> {
  const template = emailTemplates.bundleEnrollmentApproved;
  return sendEmail({
    to,
    subject: template.subject[lang],
    html: template.html({ courseName: bundleName }),
    text: template.text({ courseName: bundleName }),
  });
}

/**
 * Send bundle enrollment rejected email
 */
export async function sendBundleEnrollmentRejectedEmail(
  to: string,
  bundleName: string,
  reason?: string,
  lang: EmailLanguage = 'en'
): Promise<string> {
  const template = emailTemplates.bundleEnrollmentRejected;
  return sendEmail({
    to,
    subject: template.subject[lang],
    html: template.html({ courseName: bundleName, reason }),
    text: template.text({ courseName: bundleName, reason }),
  });
}
