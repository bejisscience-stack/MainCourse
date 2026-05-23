#!/usr/bin/env bash
#
# End-to-end verification that Supabase Auth emails are flowing on swavleba.ge prod.
# Run this AFTER bash scripts/apply-auth-smtp.sh has succeeded.
#
# What it does:
#   1. Reads the production Supabase URL + anon key from .env.local.
#   2. Calls POST /auth/v1/signup with a throwaway test email — this should
#      trigger a real confirmation email through Resend SMTP.
#   3. Calls POST /auth/v1/recover for that same test email — should trigger
#      a password recovery email.
#   4. Sleeps 5s and pings the Resend Emails API to list the most recent
#      messages so you can confirm delivery status.
#
# USAGE:
#   bash scripts/verify-auth-smtp.sh you+test-$(date +%s)@some-real-inbox.com
#
# The first argument MUST be an email address at an inbox you can read — use
# a "+tag" alias if your provider supports it (Gmail, Fastmail, etc.) so each
# run goes to a fresh address. Leave it off to use a random @example.com,
# which won't actually arrive anywhere but still lets us check Resend logs.
#
# Reads from .env.local:
#   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY
#   RESEND_API_KEY (optional, for the Resend status ping)
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")"/.. && pwd)/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

read_env() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/"
}

SUPABASE_URL="$(read_env NEXT_PUBLIC_SUPABASE_URL)"
[[ -z "$SUPABASE_URL" ]] && SUPABASE_URL="$(read_env SUPABASE_URL)"
SUPABASE_ANON="$(read_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"
[[ -z "$SUPABASE_ANON" ]] && SUPABASE_ANON="$(read_env SUPABASE_ANON_KEY)"
RESEND_KEY="$(read_env RESEND_API_KEY)"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON" ]]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing from $ENV_FILE" >&2
  exit 1
fi

# Confirm we're hitting production, not staging
if [[ "$SUPABASE_URL" != *"nbecbsbuerdtakxkrduw"* ]]; then
  echo "WARN: $ENV_FILE points at '$SUPABASE_URL', not production (nbecbsbuerdtakxkrduw)."
  echo "      Continue anyway? [y/N]"
  read -r ans
  [[ "$ans" != "y" && "$ans" != "Y" ]] && exit 1
fi

TEST_EMAIL="${1:-claude-verify-$(date +%s)@example.com}"
TEST_PASSWORD="VerifyTest!$(date +%s)Aa"

echo "=== Verifying Supabase Auth email delivery ==="
echo "URL:   $SUPABASE_URL"
echo "Email: $TEST_EMAIL"
echo ""

echo "[1/3] POST /auth/v1/signup ..."
SIGNUP_HTTP=$(curl -sS -o /tmp/signup-resp.json -w '%{http_code}' \
  -X POST "${SUPABASE_URL}/auth/v1/signup" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
echo "    HTTP $SIGNUP_HTTP"
head -c 400 /tmp/signup-resp.json; echo

echo "[2/3] POST /auth/v1/recover ..."
RECOVER_HTTP=$(curl -sS -o /tmp/recover-resp.json -w '%{http_code}' \
  -X POST "${SUPABASE_URL}/auth/v1/recover" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"${TEST_EMAIL}\"}")
echo "    HTTP $RECOVER_HTTP"
head -c 400 /tmp/recover-resp.json; echo

echo "[3/3] Sleeping 5s then querying Resend Emails API ..."
sleep 5
if [[ -n "$RESEND_KEY" ]]; then
  curl -sS "https://api.resend.com/emails?limit=5" \
    -H "Authorization: Bearer ${RESEND_KEY}" | python3 -m json.tool 2>/dev/null || true
else
  echo "    (RESEND_API_KEY not present in .env.local — skip Resend ping; check https://resend.com/emails manually)"
fi

echo ""
echo "=== Results ==="
echo "  Signup HTTP:    $SIGNUP_HTTP   (expect 200 with no 'unexpected_failure')"
echo "  Recover HTTP:   $RECOVER_HTTP  (expect 200)"
echo ""
echo "PASS criteria:"
echo "  - Both HTTP codes are 200."
echo "  - Resend list shows two recent entries with status='delivered' (or 'sent' if still in flight)."
echo "  - If you used a real inbox, the confirmation email arrives within ~30s."
echo ""
echo "If signup returns 500 'unexpected_failure', SMTP config likely did NOT apply — re-run"
echo "scripts/apply-auth-smtp.sh and check /tmp/auth-config-response.json for the API response body."
