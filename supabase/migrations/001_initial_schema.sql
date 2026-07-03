-- ============================================
-- ClientDeck Pro — Initial Database Schema
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. AGENCIES (your SaaS customers)
-- ============================================
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL UNIQUE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#2563EB',
  custom_domain TEXT,
  -- GHL Integration
  ghl_location_id TEXT,
  ghl_api_key TEXT,
  ghl_webhook_url TEXT,
  -- Billing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'solo' CHECK (plan IN ('solo', 'pro', 'agency', 'enterprise')),
  plan_status TEXT DEFAULT 'trialing' CHECK (plan_status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')),
  license_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  max_clients INTEGER DEFAULT 15,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  -- Flexible settings
  settings JSONB DEFAULT '{
    "timezone": "America/New_York",
    "letter_signature": "",
    "default_monthly_fee": 149,
    "portal_branding_visible": true
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TEAM MEMBERS
-- ============================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, email)
);

-- ============================================
-- 3. CLIENTS (credit repair customers)
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  ghl_contact_id TEXT,
  -- Personal info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  ssn_last4 TEXT,
  dob DATE,
  -- Credit scores (start)
  score_eq_start INTEGER,
  score_exp_start INTEGER,
  score_tu_start INTEGER,
  -- Credit scores (current — updated each round)
  score_eq_current INTEGER,
  score_exp_current INTEGER,
  score_tu_current INTEGER,
  score_goal INTEGER,
  credit_goal TEXT CHECK (credit_goal IN (
    'buy_home', 'car_loan', 'lower_rates', 'get_approved',
    'improve_general', 'business_loan', 'rental', 'other'
  )),
  -- Service tracking
  service_start_date DATE DEFAULT CURRENT_DATE,
  monthly_fee DECIMAL(10,2) DEFAULT 149.00,
  payment_status TEXT DEFAULT 'active' CHECK (payment_status IN (
    'active', 'failed', 'paused', 'cancelled', 'pending'
  )),
  stripe_customer_id TEXT,
  -- Dispute tracking (denormalized for speed)
  status TEXT DEFAULT 'onboarding' CHECK (status IN (
    'onboarding', 'analysis', 'active', 'on_hold', 'completed', 'cancelled'
  )),
  current_round INTEGER DEFAULT 0,
  total_items_start INTEGER DEFAULT 0,
  total_items_current INTEGER DEFAULT 0,
  total_items_deleted INTEGER DEFAULT 0,
  -- Portal access
  portal_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  portal_token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  -- Metadata
  referral_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for GHL lookups
CREATE INDEX idx_clients_ghl ON clients(agency_id, ghl_contact_id);
CREATE INDEX idx_clients_status ON clients(agency_id, status);
CREATE INDEX idx_clients_portal_token ON clients(portal_token);

-- ============================================
-- 4. NEGATIVE ITEMS
-- ============================================
CREATE TABLE negative_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  bureau TEXT NOT NULL CHECK (bureau IN ('equifax', 'experian', 'transunion')),
  creditor_name TEXT NOT NULL,
  account_number_last4 TEXT,
  account_type TEXT CHECK (account_type IN (
    'credit_card', 'auto_loan', 'mortgage', 'personal_loan',
    'student_loan', 'medical', 'collection', 'utility', 'other'
  )),
  negative_type TEXT NOT NULL CHECK (negative_type IN (
    'late_payment', 'collection', 'charge_off', 'repossession',
    'bankruptcy', 'foreclosure', 'tax_lien', 'judgment',
    'inquiry', 'identity_theft', 'other'
  )),
  balance DECIMAL(12,2),
  date_opened DATE,
  date_of_first_delinquency DATE,
  -- Dispute tracking
  dispute_status TEXT DEFAULT 'not_disputed' CHECK (dispute_status IN (
    'not_disputed', 'in_dispute', 'deleted', 'updated', 'verified', 'pending'
  )),
  round_disputed INTEGER,
  round_resolved INTEGER,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_client ON negative_items(client_id);
CREATE INDEX idx_items_status ON negative_items(client_id, dispute_status);

-- ============================================
-- 5. DISPUTE ROUNDS
-- ============================================
CREATE TABLE dispute_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  status TEXT DEFAULT 'preparing' CHECK (status IN (
    'preparing', 'letters_generated', 'sent', 'awaiting_response', 'complete'
  )),
  date_sent DATE,
  response_deadline DATE,
  date_responses_received DATE,
  -- Aggregated results
  total_items_disputed INTEGER DEFAULT 0,
  total_deletions INTEGER DEFAULT 0,
  total_updates INTEGER DEFAULT 0,
  total_verified INTEGER DEFAULT 0,
  total_no_response INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, round_number)
);

CREATE INDEX idx_rounds_client ON dispute_rounds(client_id);
CREATE INDEX idx_rounds_status ON dispute_rounds(agency_id, status);

-- ============================================
-- 6. DISPUTES (individual item per round)
-- ============================================
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES dispute_rounds(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  negative_item_id UUID NOT NULL REFERENCES negative_items(id) ON DELETE CASCADE,
  bureau TEXT NOT NULL CHECK (bureau IN ('equifax', 'experian', 'transunion')),
  letter_type TEXT NOT NULL CHECK (letter_type IN (
    'initial_dispute', 'method_of_verification', 'escalation',
    'goodwill', 'debt_validation', 'cfpb_complaint',
    'identity_theft', 'custom'
  )),
  letter_content TEXT,
  letter_pdf_url TEXT,
  certified_mail_number TEXT,
  -- Result
  result TEXT DEFAULT 'pending' CHECK (result IN (
    'pending', 'deleted', 'updated', 'verified', 'no_response', 'in_progress'
  )),
  result_date DATE,
  result_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_round ON disputes(round_id);
CREATE INDEX idx_disputes_item ON disputes(negative_item_id);

-- ============================================
-- 7. LETTER TEMPLATES (AI prompt templates)
-- ============================================
CREATE TABLE letter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  negative_type TEXT,
  letter_type TEXT NOT NULL CHECK (letter_type IN (
    'initial_dispute', 'method_of_verification', 'escalation',
    'goodwill', 'debt_validation', 'cfpb_complaint',
    'identity_theft', 'custom'
  )),
  round_suggestion INTEGER,
  prompt_template TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. DOCUMENTS
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  uploaded_by TEXT DEFAULT 'staff',
  name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  category TEXT CHECK (category IN (
    'id_document', 'proof_of_address', 'credit_report',
    'dispute_letter', 'bureau_response', 'agreement', 'other'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_client ON documents(client_id);

-- ============================================
-- 9. ACTIVITY LOG
-- ============================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  actor_type TEXT CHECK (actor_type IN ('system', 'staff', 'client', 'ghl', 'stripe')),
  actor_id TEXT,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_client ON activity_log(client_id, created_at DESC);
CREATE INDEX idx_activity_agency ON activity_log(agency_id, created_at DESC);

-- ============================================
-- 10. UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON negative_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON dispute_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
