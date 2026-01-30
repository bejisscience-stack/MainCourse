import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      );
    }

    if (!html && !text) {
      return NextResponse.json(
        { error: 'Either html or text content is required' },
        { status: 400 }
      );
    }

    const messageId = await sendEmail({
      to,
      subject,
      html: html || `<p>${text}</p>`,
      text,
    });

    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
