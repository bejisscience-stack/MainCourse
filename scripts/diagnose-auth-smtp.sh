#!/usr/bin/env bash
#
# READ-ONLY: fetch the current Supabase Auth config for production
# (project nbecbsbuerdtakxkrduw) and print the SMTP-related fields with
# the password redacted. Used to diagnose why production isn't sending
# auth emails when staging is.
#
# USAGE:
#   source .env.supabase           # must define SUPABASE_ACCESS_TOKEN (PAT)
#   bash scripts/diagnose-auth-smtp.sh
#
# Does not write anything. Safe to run on production.
set -euo pipefail

PROJECT_REF="${1:-nbecbsbuerdtakxkrduw}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN not set." >&2
  echo "       Run:  source .env.supabase   (or export it yourself)" >&2
  exit 1
fi

echo "Fetching auth config for project ${PROJECT_REF} (READ-ONLY)..."
echo ""

RESP=$(curl -sS -w '\n%{http_code}' \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

if [[ ! "$HTTP_CODE" =~ ^2 ]]; then
  echo "ERROR: HTTP $HTTP_CODE" >&2
  echo "$BODY" >&2
  exit 1
fi

echo "$BODY" | python3 <<'PY'
import json, sys
cfg = json.load(sys.stdin)
fields_to_show = [
    "external_email_enabled",
    "mailer_autoconfirm",
    "mailer_secure_email_change_enabled",
    "mailer_otp_exp",
    "smtp_admin_email",
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",          # will be redacted below
    "smtp_sender_name",
    "smtp_max_frequency",
    "site_url",
    "uri_allow_list",
    "rate_limit_email_sent",
    "external_anonymous_users_enabled",
    "disable_signup",
]
out = {}
for k in fields_to_show:
    v = cfg.get(k, "<not present>")
    if k == "smtp_pass" and v and v != "<not present>":
        out[k] = f"<set, length={len(str(v))}>"
    else:
        out[k] = v
print(json.dumps(out, indent=2))
PY
