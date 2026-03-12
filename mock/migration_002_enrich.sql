-- ============================================================
-- Migration 002: Add enrichment fields for Superbid data
-- ============================================================

-- Vendors: add contact fields (matching customer structure)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_person BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS currency TEXT;

-- Projects: add close date and SBW owner
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sbw_owner_id BIGINT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sbw_store_id BIGINT;

-- Invoices: add SBW tax data
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sbw_tax_data JSONB;
