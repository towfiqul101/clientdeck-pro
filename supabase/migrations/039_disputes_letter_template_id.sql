-- ============================================
-- 039. DISPUTES: EXPLICIT TEMPLATE SELECTION
-- ============================================
-- Staff can now pick the exact agency_static template to use for a
-- dispute (round-builder template dropdown) instead of always relying on
-- findBestTemplate()'s silent auto-match. NULL means "not picked" —
-- either an AI-sourced dispute, or an agency_template dispute created
-- before this column existed, both of which fall back to auto-match at
-- generation time.

ALTER TABLE disputes
  ADD COLUMN letter_template_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL;
