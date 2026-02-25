import { Resend } from 'resend';

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error(
        'Missing RESEND_API_KEY environment variable. ' +
        'Please add it to your .env.local file.'
      );
    }
    _resend = new Resend(resendApiKey);
  }
  return _resend;
}
