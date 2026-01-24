/**
 * Bilingual email templates for Wavleba platform
 * Supports English (en) and Georgian (ge)
 */

export type EmailLanguage = 'en' | 'ge';

interface BilingualText {
  en: string;
  ge: string;
}

interface EmailTemplateData {
  username?: string;
  courseName?: string;
  amount?: number;
  reason?: string;
}

interface EmailTemplate {
  subject: BilingualText;
  html: (data: EmailTemplateData) => string;
  text: (data: EmailTemplateData) => string;
}

// Brand colors
const BRAND_COLOR = '#1e3a5f';
const SITE_URL = 'https://wavleba.ge';

// Shared email wrapper
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      ${content}
    </div>
    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
      <p>Wavleba - Online Learning Platform</p>
      <p><a href="${SITE_URL}" style="color: ${BRAND_COLOR};">wavleba.ge</a></p>
    </div>
  </div>
</body>
</html>
`;

const buttonStyle = `background-color: ${BRAND_COLOR}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;`;

export const emailTemplates: Record<string, EmailTemplate> = {
  welcome: {
    subject: {
      en: 'Welcome to Wavleba!',
      ge: 'კეთილი იყოს თქვენი მობრძანება Wavleba-ში!',
    },
    html: (data) => emailWrapper(`
      <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">
        ${data.username ? `Welcome, ${data.username}!` : 'Welcome!'}
      </h1>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Your email has been verified and your account is now active. You can start exploring our courses and begin your learning journey.
      </p>
      <p style="margin: 32px 0;">
        <a href="${SITE_URL}/courses" style="${buttonStyle}">Browse Courses</a>
      </p>
      <p style="color: #666; font-size: 14px;">
        If you have any questions, feel free to reach out to our support team.
      </p>
    `),
    text: (data) => `Welcome${data.username ? `, ${data.username}` : ''}! Your email has been verified. Visit ${SITE_URL}/courses to browse our courses.`,
  },

  enrollmentApproved: {
    subject: {
      en: 'Enrollment Approved - Start Learning!',
      ge: 'რეგისტრაცია დამტკიცებულია - დაიწყეთ სწავლა!',
    },
    html: (data) => emailWrapper(`
      <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">Enrollment Approved!</h1>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Great news! Your enrollment in <strong>${data.courseName || 'the course'}</strong> has been approved.
      </p>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        You now have full access to the course materials. Start learning today!
      </p>
      <p style="margin: 32px 0;">
        <a href="${SITE_URL}/my-courses" style="${buttonStyle}">Go to My Courses</a>
      </p>
    `),
    text: (data) => `Your enrollment in ${data.courseName || 'the course'} has been approved! Visit ${SITE_URL}/my-courses to start learning.`,
  },

  enrollmentRejected: {
    subject: {
      en: 'Enrollment Request Update',
      ge: 'რეგისტრაციის მოთხოვნის განახლება',
    },
    html: (data) => emailWrapper(`
      <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">Enrollment Update</h1>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        We regret to inform you that your enrollment request for <strong>${data.courseName || 'the course'}</strong> could not be approved at this time.
      </p>
      ${data.reason ? `
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #666; font-size: 14px; margin: 0;"><strong>Reason:</strong> ${data.reason}</p>
        </div>
      ` : ''}
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        If you believe this is an error or have questions, please contact our support team.
      </p>
      <p style="margin: 32px 0;">
        <a href="${SITE_URL}/courses" style="${buttonStyle}">Browse Other Courses</a>
      </p>
    `),
    text: (data) => `Your enrollment request for ${data.courseName || 'the course'} was not approved.${data.reason ? ` Reason: ${data.reason}` : ''} Contact support if you have questions.`,
  },

  withdrawalApproved: {
    subject: {
      en: 'Withdrawal Processed Successfully',
      ge: 'თანხის გატანა წარმატებით დასრულდა',
    },
    html: (data) => emailWrapper(`
      <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">Withdrawal Approved!</h1>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Your withdrawal request has been processed successfully.
      </p>
      ${data.amount ? `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center;">
          <p style="color: #2e7d32; font-size: 24px; font-weight: bold; margin: 0;">${data.amount.toFixed(2)} GEL</p>
          <p style="color: #666; font-size: 14px; margin-top: 8px;">Amount Transferred</p>
        </div>
      ` : ''}
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        The funds have been transferred to your registered bank account. Please allow 1-3 business days for the transfer to reflect in your account.
      </p>
      <p style="margin: 32px 0;">
        <a href="${SITE_URL}/profile" style="${buttonStyle}">View Account</a>
      </p>
    `),
    text: (data) => `Your withdrawal of ${data.amount ? `${data.amount.toFixed(2)} GEL` : 'funds'} has been approved and processed. The transfer should arrive within 1-3 business days.`,
  },

  withdrawalRejected: {
    subject: {
      en: 'Withdrawal Request Update',
      ge: 'თანხის გატანის მოთხოვნის განახლება',
    },
    html: (data) => emailWrapper(`
      <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">Withdrawal Update</h1>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        We were unable to process your withdrawal request${data.amount ? ` for <strong>${data.amount.toFixed(2)} GEL</strong>` : ''}.
      </p>
      ${data.reason ? `
        <div style="background-color: #fff3e0; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #e65100; font-size: 14px; margin: 0;"><strong>Reason:</strong> ${data.reason}</p>
        </div>
      ` : ''}
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        The requested amount has been returned to your account balance. Please review the reason and submit a new request if applicable.
      </p>
      <p style="margin: 32px 0;">
        <a href="${SITE_URL}/profile" style="${buttonStyle}">View Account</a>
      </p>
    `),
    text: (data) => `Your withdrawal request${data.amount ? ` for ${data.amount.toFixed(2)} GEL` : ''} was not approved.${data.reason ? ` Reason: ${data.reason}` : ''} The amount has been returned to your balance.`,
  },

  bundleEnrollmentApproved: {
    subject: {
      en: 'Bundle Enrollment Approved!',
      ge: 'პაკეტის რეგისტრაცია დამტკიცებულია!',
    },
    html: (data) => emailWrapper(`
      <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">Bundle Enrollment Approved!</h1>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Great news! Your enrollment in the <strong>${data.courseName || 'course bundle'}</strong> has been approved.
      </p>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        You now have access to all courses included in this bundle. Start learning today!
      </p>
      <p style="margin: 32px 0;">
        <a href="${SITE_URL}/my-courses" style="${buttonStyle}">Go to My Courses</a>
      </p>
    `),
    text: (data) => `Your bundle enrollment for ${data.courseName || 'the course bundle'} has been approved! Visit ${SITE_URL}/my-courses to start learning.`,
  },

  bundleEnrollmentRejected: {
    subject: {
      en: 'Bundle Enrollment Request Update',
      ge: 'პაკეტის რეგისტრაციის მოთხოვნის განახლება',
    },
    html: (data) => emailWrapper(`
      <h1 style="color: ${BRAND_COLOR}; margin-bottom: 24px;">Bundle Enrollment Update</h1>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        We regret to inform you that your enrollment request for the <strong>${data.courseName || 'course bundle'}</strong> could not be approved at this time.
      </p>
      ${data.reason ? `
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #666; font-size: 14px; margin: 0;"><strong>Reason:</strong> ${data.reason}</p>
        </div>
      ` : ''}
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        If you have questions, please contact our support team.
      </p>
      <p style="margin: 32px 0;">
        <a href="${SITE_URL}/courses" style="${buttonStyle}">Browse Courses</a>
      </p>
    `),
    text: (data) => `Your bundle enrollment request for ${data.courseName || 'the course bundle'} was not approved.${data.reason ? ` Reason: ${data.reason}` : ''} Contact support if you have questions.`,
  },
};
