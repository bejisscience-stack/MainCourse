# Post-Sync Validation Report — 2026-03-22

Sync: staging → main at commit `b3ca3b1`. 21 migrations (168-193) applied to production. 18 edge functions redeployed.

## Results

| Check                            | Result                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Schema columns (5 key tables)    | IDENTICAL                                                                       |
| RLS policies (all public tables) | IDENTICAL                                                                       |
| Functions                        | Prod has 9 extra legacy DM/friendship fns; staging has 1 stale 2-param overload |
| Triggers                         | Prod has 9 extra legacy DM/friendship triggers                                  |
| Security definer grants          | WARNING — see below                                                             |
| Health endpoint                  | Healthy, 537ms DB latency                                                       |

## ACTION REQUIRED: Security Definer Grant Revocations

### Problem

`CREATE OR REPLACE FUNCTION` restores default PostgreSQL privileges (PUBLIC EXECUTE). Migrations 176/177 revoked PUBLIC/anon from all SECURITY DEFINER functions, but later migrations (178, 179, 182, 188, 190) used `CREATE OR REPLACE` which re-granted them.

### Production (1 function affected)

```sql
REVOKE ALL ON FUNCTION public.update_unread_counts_on_video() FROM PUBLIC, anon;
```

### Staging (19 functions affected)

```sql
-- Run on staging project: bvptqdmhuumjbyfnjxdt
REVOKE ALL ON FUNCTION public.approve_bundle_enrollment_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_project_subscription(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auto_encrypt_pii() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_is_admin(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.create_default_channels_for_course() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encrypt_withdrawal_bank_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_bundle_enrollment_requests_admin(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_enrollment_requests_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pending_lecturers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_withdrawal_requests_admin(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_audit_log() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_payment_event(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_referral(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_signup_referral_on_enrollment() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_bundle_enrollment_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_project_subscription(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_unread_counts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_unread_counts_on_video() FROM PUBLIC, anon;
```

### Prevention

Any future migration that uses `CREATE OR REPLACE` on a SECURITY DEFINER function MUST include a REVOKE statement at the end:

```sql
CREATE OR REPLACE FUNCTION public.my_function() ...;
REVOKE ALL ON FUNCTION public.my_function() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_function() TO authenticated, service_role;
```

## Low Priority: Legacy DM/Friendship Objects (Production Only)

These 9 functions + 9 triggers exist on production but not staging. They support the DM/friendship system. If this feature is deprecated, they can be dropped:

**Functions:** `cleanup_friend_request_on_unfriend`, `create_friendship_on_accept`, `delete_friendship_on_reject`, `get_profiles_for_friends`, `prevent_reverse_friend_request`, `restrict_dm_message_update`, `restrict_friend_request_update`, `search_users_by_email`, `update_dm_conversation_last_message`

**Triggers:** Same names on `friendships`, `friend_requests`, `dm_messages`, `services` tables.

## Staging-Only: Stale 2-Param Overload

`approve_bundle_enrollment_request(UUID, UUID)` still exists on staging (should have been dropped by migration 168a). To clean up:

```sql
-- Run on staging: bvptqdmhuumjbyfnjxdt
DROP FUNCTION IF EXISTS public.approve_bundle_enrollment_request(UUID, UUID);
```
