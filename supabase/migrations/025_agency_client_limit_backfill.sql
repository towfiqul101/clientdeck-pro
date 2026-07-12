-- Agency plan's client cap changed from "unlimited" (stored as the 9999
-- sentinel) to a real 3,000-client limit (src/lib/billing/plans.ts).
-- max_clients is a stored column, only recomputed when a plan is (re)assigned
-- (checkout, subscription renewal, or an admin edit) — so agencies already on
-- the Agency plan are stuck at the old 9999 sentinel until then. Backfill them
-- now. Only touches rows still at the untouched default (9999): agencies an
-- admin has manually overridden to some other value are left alone.

UPDATE agencies
SET max_clients = 3000
WHERE plan = 'agency'
  AND max_clients = 9999;
