Add defense-in-depth to Keepz callback endpoint. Only touch app/api/payments/keepz/callback/route.ts.

FIX — HIGH — Keepz callback IP validation (PAY-01):
- At the top of the POST handler, before any payload processing:
  - Extract client IP from request headers (x-forwarded-for or x-real-ip)
  - Check against a configurable allowlist from environment variable KEEPZ_ALLOWED_IPS
  - If KEEPZ_ALLOWED_IPS env var is set: validate IP against the list, reject unknown IPs with 200 (return 200 not 403 — payment providers retry on non-2xx)
  - If KEEPZ_ALLOWED_IPS env var is NOT set: log a warning and proceed (graceful degradation)
  - Pattern:
    const allowedIPs = process.env.KEEPZ_ALLOWED_IPS?.split(',').map(ip => ip.trim());
    if (allowedIPs && allowedIPs.length > 0) {
      const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
      if (!allowedIPs.includes(clientIP)) {
        console.error('[Keepz Callback] Rejected unknown IP:', clientIP);
        return NextResponse.json({ received: true }, { status: 200 });
      }
    }
- Also apply the paymentLimiter to this endpoint as an additional layer:
  - Import paymentLimiter from lib/rate-limit.ts
  - Add rate limit check (10 requests per minute per IP should be sufficient for callbacks)
- Remove the existing TODO comment about IP whitelist
- Add .env.example entry: KEEPZ_ALLOWED_IPS=# comma-separated Keepz callback IPs

Run npm run build. Commit with message "security: add Keepz IP whitelist and rate limiting (PAY-01)"
Output <promise>DONE</promise> when build passes.
