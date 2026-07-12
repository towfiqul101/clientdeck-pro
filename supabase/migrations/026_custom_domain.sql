-- Adds the missing half of the "custom portal domain" feature. custom_domain
-- itself already exists (migration 001) but has never been used — it's a
-- bare TEXT column with no verification-status tracking and no uniqueness
-- guarantee. This migration adds both.

ALTER TABLE agencies
  ADD COLUMN custom_domain_verified BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_agencies_custom_domain
  ON agencies (custom_domain)
  WHERE custom_domain IS NOT NULL;
