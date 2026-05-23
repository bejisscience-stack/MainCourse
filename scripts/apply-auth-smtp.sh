#!/usr/bin/env bash
#
# Configure Resend as Supabase Auth custom SMTP for swavleba.ge production.
#
# WHY: As of 2026-05, the default Supabase email service silently dropped
# signup verification + password reset emails for swavleba.ge. Routing Auth
# emails through Resend (which the project already uses for transactional
# emails) fixes it. No code/DB changes.
#
# USAGE:
#   1. Create a Supabase Personal Access Token (PAT) with auth:write scope
#      at https://supabase.com/dashboard/account/tokens
#      and export it:    export SUPABASE_PAT="sbp_..."
#   2. Run:              bash scripts/apply-auth-smtp.sh
#
# The script reads RESEND_API_KEY from .env.local automatically. No
# credentials are printed to stdout.
#
# Reversible: re-run with FIX_MODE=disable to turn custom SMTP back off.
set -euo pipefail

PROJECT_REF="nbecbsbuerdtakxkrduw"     # production
ENV_FILE="$(cd "$(dirname "$0")"/.. && pwd)/.env.local"

if [[ -z "${SUPABASE_PAT:-}" ]]; then
  echo "ERROR: export SUPABASE_PAT='sbp_...' first (PAT from https://supabase.com/dashboard/account/tokens)" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

RESEND_KEY=$(grep -E '^RESEND_API_KEY=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
if [[ -z "$RESEND_KEY" ]]; then
  echo "ERROR: RESEND_API_KEY not found in $ENV_FILE" >&2
  exit 1
fi

MODE="${FIX_MODE:-enable}"
case "$MODE" in
  enable)
    PAYLOAD=$(cat <<JSON
{
  "external_email_enabled": true,
  "mailer_autoconfirm": false,
  "smtp_admin_email": "no-reply@swavleba.ge",
  "smtp_host": "smtp.resend.com",
  "smtp_port": "465",
  "smtp_user": "resend",
  "smtp_pass": "${RESEND_KEY}",
  "smtp_sender_name": "Swavleba",
  "smtp_max_frequency": 60
}
JSON
)
    echo "Enabling Resend custom SMTP for project ${PROJECT_REF}..."
    ;;
  disable)
    PAYLOAD='{"smtp_host":null,"smtp_port":null,"smtp_user":null,"smtp_pass":null,"smtp_admin_email":null,"smtp_sender_name":null}'
    echo "Disabling custom SMTP (reverting to default) for project ${PROJECT_REF}..."
    ;;
  *)
    echo "ERROR: FIX_MODE must be 'enable' or 'disable' (got: $MODE)" >&2
    exit 1
    ;;
esac

HTTP_CODE=$(curl -sS -o /tmp/auth-config-response.json -w '%{http_code}' \
  -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_PAT}" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD")

if [[ "$HTTP_CODE" =~ ^2 ]]; then
  echo "OK: Supabase auth config updated (HTTP $HTTP_CODE)."
  echo "Response saved to /tmp/auth-config-response.json (sensitive fields may be present; delete after review)."
  echo ""
  echo "Next steps:"
  echo "  1. Verify in https://supabase.com/dashboard/project/${PROJECT_REF}/auth/providers that Custom SMTP is enabled."
  echo "  2. Confirm URL allow-list at https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration includes https://swavleba.ge/auth/callback"
  echo "  3. Test a signup + a forgot-password against swavleba.ge — emails should arrive within 30s."
else
  echo "ERROR: HTTP $HTTP_CODE — see /tmp/auth-config-response.json for details" >&2
  cat /tmp/auth-config-response.json >&2 || true
  exit 1
fi
