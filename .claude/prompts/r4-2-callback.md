Fix 4 issues in app/api/payments/keepz/callback/route.ts and lib/keepz.ts ONLY. Do not touch any other file.

FIX 1 — CRITICAL — Amount validation bypass (PAY-02):
- At line 123, replace the conditional amount check with a mandatory one
- Current (broken): if (callbackData.amount && Number(callbackData.amount) !== Number(payment.amount))
- Replace with:
  const callbackAmount = callbackData.amount != null ? Number(callbackData.amount) : null;
  if (callbackAmount === null || callbackAmount !== Number(payment.amount)) {
    console.error('[Keepz Callback] Amount mismatch or missing:', { expected: payment.amount, received: callbackData.amount, integratorOrderId });
    return NextResponse.json({ received: true }, { status: 200 });
  }

FIX 2 — HIGH — IP whitelist mandatory in production (PAY-01):
- At lines 14-23, update the IP check to block in production when env var is missing
- Pattern:
  const allowedIPs = process.env.KEEPZ_ALLOWED_IPS;
  if (!allowedIPs) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Keepz Callback] BLOCKED: KEEPZ_ALLOWED_IPS not configured in production');
      return NextResponse.json({ received: true }, { status: 200 });
    }
    console.warn('[Keepz Callback] IP whitelist not configured (development mode)');
  } else {
    const whitelist = allowedIPs.split(',').map(ip => ip.trim());
    if (!whitelist.includes(clientIP)) {
      console.warn('[Keepz Callback] BLOCKED: IP not in allowlist', { ip: clientIP });
      return NextResponse.json({ received: true }, { status: 200 });
    }
  }

FIX 3 — MEDIUM — Remove sensitive data from logs (LOG-01):
- At lines 33-36 where raw body is logged: replace with redacted version
  console.log('[Keepz Callback] Received callback:', { contentLength: rawText.length, hasEncryptedData: rawText.includes('encryptedData') });
- At lines 85-88 where decrypted data is logged: replace with safe fields only
  console.log('[Keepz Callback] Decrypted:', { integratorOrderId: callbackData.integratorOrderId, status: callbackData.status || callbackData.orderStatus, hasAmount: !!callbackData.amount });
- In lib/keepz.ts at line 216 where raw error response is logged: replace with
  console.error('[Keepz] Non-JSON response:', response.status, '(body redacted for security)');

FIX 4 — LOW — Document Keepz retry behavior (INFRA-02):
- At lines 27-29 where rate limit returns 200: add comment
  // Returning 200 so Keepz considers callback received. If this causes missed payments, switch to 429 with Retry-After header.

Run npm run build. Commit with message "security: fix amount validation, IP whitelist, redact logs (PAY-01, PAY-02, LOG-01, INFRA-02)"
Output <promise>DONE</promise> when build passes.
