-- Migration 107: Add subscription notification types
-- The notifications_type_check constraint was missing subscription_approved/rejected

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'enrollment_approved',
    'enrollment_rejected',
    'bundle_enrollment_approved',
    'bundle_enrollment_rejected',
    'withdrawal_approved',
    'withdrawal_rejected',
    'subscription_approved',
    'subscription_rejected',
    'admin_message',
    'system'
  ])
);
