-- ============================================
-- ClientDeck Pro — Manual payments (admin only)
-- Records off-platform payments (bank transfer, cash, check, manual card)
-- that the super-admin logs when reconciling accounts that don't pay via
-- Stripe. Read/written only through the service-role client on /admin.
-- ============================================

CREATE TABLE manual_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  notes TEXT,
  recorded_by TEXT, -- admin email
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_manual_payments_agency ON manual_payments(agency_id, created_at DESC);

-- RLS on with no policies = deny all to anon/authenticated. The admin dashboard
-- accesses this exclusively via the service-role client, which bypasses RLS.
ALTER TABLE manual_payments ENABLE ROW LEVEL SECURITY;
