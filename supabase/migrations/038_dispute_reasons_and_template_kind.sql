-- ============================================
-- 038. DISPUTE REASONS, INSTRUCTIONS & TEMPLATE KIND
-- ============================================
-- Adds agency-static letter templates (variable-fill, no AI call) as an
-- alternative to AI-prompt templates, plus a standard dispute reason /
-- instruction picker that feeds both letter-generation paths.

-- 1. letter_templates: split AI-prompt vs agency-static templates
ALTER TABLE letter_templates
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'ai_prompt'
    CHECK (kind IN ('ai_prompt', 'agency_static'));

-- 2. Standard dispute reasons (system defaults + agency custom additions)
CREATE TABLE dispute_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dispute_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See system and own dispute reasons" ON dispute_reasons
  FOR SELECT USING (
    is_system = true
    OR agency_id = get_user_agency_id()
  );

CREATE POLICY "Agency manages own dispute reasons" ON dispute_reasons
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_system = false);

CREATE POLICY "Agency deletes own dispute reasons" ON dispute_reasons
  FOR DELETE USING (agency_id = get_user_agency_id() AND is_system = false);

INSERT INTO dispute_reasons (label, is_system, sort_order) VALUES
  ('Inaccurate / Not Mine', true, 1),
  ('Not Mine', true, 2),
  ('Duplicate Account', true, 3),
  ('Obsolete (Past Reporting Period)', true, 4),
  ('Identity Theft / Fraudulent Account', true, 5),
  ('Incorrect Balance', true, 6),
  ('Incorrect Payment History', true, 7);

-- 3. Standard dispute instructions (system defaults + agency custom additions)
CREATE TABLE dispute_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dispute_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See system and own dispute instructions" ON dispute_instructions
  FOR SELECT USING (
    is_system = true
    OR agency_id = get_user_agency_id()
  );

CREATE POLICY "Agency manages own dispute instructions" ON dispute_instructions
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_system = false);

CREATE POLICY "Agency deletes own dispute instructions" ON dispute_instructions
  FOR DELETE USING (agency_id = get_user_agency_id() AND is_system = false);

INSERT INTO dispute_instructions (label, is_system, sort_order) VALUES
  ('Delete', true, 1),
  ('Correct', true, 2),
  ('Verify', true, 3);

-- 4. disputes: record the chosen reason/instruction + which letter path was used
ALTER TABLE disputes
  ADD COLUMN dispute_reason_id UUID REFERENCES dispute_reasons(id) ON DELETE SET NULL,
  ADD COLUMN dispute_instruction_id UUID REFERENCES dispute_instructions(id) ON DELETE SET NULL,
  ADD COLUMN letter_source TEXT NOT NULL DEFAULT 'ai'
    CHECK (letter_source IN ('ai', 'agency_template'));
