-- ============================================
-- ClientDeck Pro — Row Level Security Policies
-- Multi-tenant isolation: each agency only sees their own data
-- ============================================

-- Helper function: get current user's agency_id
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM team_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user is agency owner
CREATE OR REPLACE FUNCTION is_agency_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = auth.uid()
    AND role = 'owner'
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- AGENCIES
-- ============================================
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own agency" ON agencies
  FOR SELECT USING (
    id IN (SELECT agency_id FROM team_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Owners update their agency" ON agencies
  FOR UPDATE USING (
    id IN (SELECT agency_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true)
  );

-- Allow insert during signup (service role handles this, but just in case)
CREATE POLICY "Allow agency creation" ON agencies
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- ============================================
-- TEAM MEMBERS
-- ============================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See own team" ON team_members
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Owners manage team" ON team_members
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- ============================================
-- CLIENTS
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own clients" ON clients
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency manages own clients" ON clients
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY "Agency updates own clients" ON clients
  FOR UPDATE USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency deletes own clients" ON clients
  FOR DELETE USING (agency_id = get_user_agency_id());

-- Portal access: clients can see their own record via portal_token
-- (Handled at API level with service role, not RLS)

-- ============================================
-- NEGATIVE ITEMS
-- ============================================
ALTER TABLE negative_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own items" ON negative_items
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency manages items" ON negative_items
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY "Agency updates items" ON negative_items
  FOR UPDATE USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency deletes items" ON negative_items
  FOR DELETE USING (agency_id = get_user_agency_id());

-- ============================================
-- DISPUTE ROUNDS
-- ============================================
ALTER TABLE dispute_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own rounds" ON dispute_rounds
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency manages rounds" ON dispute_rounds
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY "Agency updates rounds" ON dispute_rounds
  FOR UPDATE USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency deletes rounds" ON dispute_rounds
  FOR DELETE USING (agency_id = get_user_agency_id());

-- ============================================
-- DISPUTES
-- ============================================
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own disputes" ON disputes
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency manages disputes" ON disputes
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY "Agency updates disputes" ON disputes
  FOR UPDATE USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency deletes disputes" ON disputes
  FOR DELETE USING (agency_id = get_user_agency_id());

-- ============================================
-- LETTER TEMPLATES
-- ============================================
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can see system templates + their own custom ones
CREATE POLICY "See system and own templates" ON letter_templates
  FOR SELECT USING (
    is_system = true
    OR agency_id = get_user_agency_id()
  );

CREATE POLICY "Agency manages own templates" ON letter_templates
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id() AND is_system = false);

CREATE POLICY "Agency updates own templates" ON letter_templates
  FOR UPDATE USING (agency_id = get_user_agency_id() AND is_system = false);

CREATE POLICY "Agency deletes own templates" ON letter_templates
  FOR DELETE USING (agency_id = get_user_agency_id() AND is_system = false);

-- ============================================
-- DOCUMENTS
-- ============================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own docs" ON documents
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency manages docs" ON documents
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY "Agency deletes docs" ON documents
  FOR DELETE USING (agency_id = get_user_agency_id());

-- ============================================
-- ACTIVITY LOG
-- ============================================
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own activity" ON activity_log
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency logs activity" ON activity_log
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
