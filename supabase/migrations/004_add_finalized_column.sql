-- ============================================
-- ClientDeck Pro — Persist letter finalization state
-- Adds explicit finalize tracking to individual disputes so a page reload
-- (or a different staff member) sees which letters are ready to send.
-- ============================================

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
