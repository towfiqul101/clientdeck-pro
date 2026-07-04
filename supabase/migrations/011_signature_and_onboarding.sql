-- ============================================
-- ClientDeck Pro — Signature + Onboarding fields
-- Supports the GHL-native onboarding flow: form submit + e-signature capture,
-- and a per-agency map of GHL custom-field keys → CDP data.
-- ============================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  signature_status TEXT DEFAULT 'pending'
  CHECK (signature_status IN ('pending', 'signed', 'not_required'));

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  signed_at TIMESTAMPTZ;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  signature_type TEXT CHECK (signature_type IN ('drawn', 'typed', 'electronic'));

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  service_agreement_version TEXT DEFAULT 'v1';

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  onboarding_form_submitted BOOLEAN DEFAULT false;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  onboarding_submitted_at TIMESTAMPTZ;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  ghl_drive_folder_id TEXT;

-- Per-agency map of GHL custom-field keys, e.g.
-- { "ssn_last4": "abc123", "score_eq": "def456", "signature_status": "ghi789" }
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS
  ghl_field_keys JSONB DEFAULT '{}'::jsonb;
