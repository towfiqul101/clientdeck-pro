-- 028_activity_log_api_actor.sql — Agency API (Step 2) writes audit entries for
-- every authenticated /api/v1/* request. Extends activity_log.actor_type with
-- 'api' alongside the existing system/staff/client/ghl/stripe origins.
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_actor_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_actor_type_check
  CHECK (actor_type IN ('system', 'staff', 'client', 'ghl', 'stripe', 'api'));
