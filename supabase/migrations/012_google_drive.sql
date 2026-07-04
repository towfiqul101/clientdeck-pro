-- ============================================
-- ClientDeck Pro — Google Drive integration (per-agency OAuth)
-- Each agency connects their own Google Drive; refresh token is stored
-- encrypted-at-rest by Supabase and only read via the service-role client.
-- ============================================

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS
  google_drive_enabled BOOLEAN DEFAULT false;

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS
  google_drive_access_token TEXT;

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS
  google_drive_refresh_token TEXT;

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS
  google_drive_root_folder_id TEXT;

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS
  google_drive_connected_at TIMESTAMPTZ;

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS
  google_drive_email TEXT;
