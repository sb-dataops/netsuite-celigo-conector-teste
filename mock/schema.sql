-- ============================================================
-- NetSuite Mock - Supabase Schema
-- Sequence starts at 1001 to mimic NetSuite internal IDs
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS netsuite_id_seq START WITH 1001;

-- ============================================================
-- SUBSIDIARIES
-- ============================================================
CREATE TABLE IF NOT EXISTS subsidiaries (
  id           BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id  TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id  TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  country      TEXT NOT NULL,
  custrecord_finley_entity_id      BIGINT,
  custrecord_finley_eventmanager_id BIGINT,
  custrecord_finley_country_iso    TEXT,
  status       TEXT NOT NULL DEFAULT 'Active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_entity_id ON subsidiaries (custrecord_finley_entity_id);
CREATE INDEX idx_sub_country ON subsidiaries (country);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id              BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id     TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id     TEXT NOT NULL UNIQUE,
  entity_id       TEXT,
  company_name    TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  is_person       BOOLEAN DEFAULT true,
  subsidiary_id   BIGINT REFERENCES subsidiaries(id),
  country         TEXT,
  currency        TEXT,
  doc_number      TEXT,
  identity_doc_type TEXT,
  email           TEXT,
  phone           TEXT,
  address         JSONB,
  status          TEXT NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cust_subsidiary ON customers (subsidiary_id);
CREATE INDEX idx_cust_country ON customers (country);

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id              BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id     TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id     TEXT NOT NULL UNIQUE,
  company_name    TEXT NOT NULL,
  subsidiary_id   BIGINT REFERENCES subsidiaries(id),
  category        TEXT DEFAULT 'Vendedor',
  country         TEXT,
  doc_number      TEXT,
  identity_doc_type TEXT,
  address         JSONB,
  status          TEXT NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vend_subsidiary ON vendors (subsidiary_id);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id              BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id     TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id     TEXT NOT NULL UNIQUE,
  project_name    TEXT NOT NULL,
  start_date      DATE,
  subsidiary_id   BIGINT REFERENCES subsidiaries(id),
  department      TEXT,
  class           TEXT,
  custentity_finley_country_iso TEXT,
  status          TEXT NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proj_subsidiary ON projects (subsidiary_id);

-- ============================================================
-- AUCTIONS (Custom Record)
-- ============================================================
CREATE TABLE IF NOT EXISTS auctions (
  id              BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id     TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id     TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  custrecord_finley_event_id       TEXT,
  custrecord_auction_description   TEXT,
  custrecord_auction_end_date      TIMESTAMPTZ,
  custrecord_auction_currency_code TEXT,
  custrecord_auction_locale        TEXT,
  custrecord_auction_city          TEXT,
  custrecord_auction_state         TEXT,
  project_id      BIGINT REFERENCES projects(id),
  subsidiary_id   BIGINT REFERENCES subsidiaries(id),
  status          TEXT NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auct_project ON auctions (project_id);
CREATE INDEX idx_auct_subsidiary ON auctions (subsidiary_id);

-- ============================================================
-- LOTS (Custom Record)
-- ============================================================
CREATE TABLE IF NOT EXISTS lots (
  id              BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id     TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id     TEXT NOT NULL UNIQUE,
  lot_number      TEXT,
  auction_id      BIGINT REFERENCES auctions(id),
  project_id      BIGINT REFERENCES projects(id),
  seller_vendor_id  BIGINT REFERENCES vendors(id),
  buyer_customer_id BIGINT REFERENCES customers(id),
  status          TEXT NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lot_auction ON lots (auction_id);
CREATE INDEX idx_lot_project ON lots (project_id);

-- ============================================================
-- ITEMS (Service Items)
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
  id              BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id     TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id     TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  item_type       TEXT NOT NULL DEFAULT 'Service',
  tax_schedule    TEXT DEFAULT 'VAT-Standard',
  revenue_account TEXT,
  status          TEXT NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id              BIGINT PRIMARY KEY DEFAULT nextval('netsuite_id_seq'),
  internal_id     TEXT GENERATED ALWAYS AS (id::text) STORED UNIQUE,
  external_id     TEXT NOT NULL UNIQUE,
  trandate        DATE,
  entity_id       BIGINT REFERENCES customers(id),
  subsidiary_id   BIGINT REFERENCES subsidiaries(id),
  currency        TEXT,
  country_iso     TEXT,
  job_id          BIGINT REFERENCES projects(id),
  custbody_seller_vendor    TEXT,
  custbody_auction_ref      TEXT,
  custbody_lot_reference    TEXT,
  custbody_finley_sale_id   TEXT,
  subtotal        NUMERIC(15,2) DEFAULT 0,
  tax_total       NUMERIC(15,2) DEFAULT 0,
  total           NUMERIC(15,2) DEFAULT 0,
  tax_details     JSONB,
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_entity ON invoices (entity_id);
CREATE INDEX idx_inv_subsidiary ON invoices (subsidiary_id);

-- ============================================================
-- INVOICE LINES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_lines (
  id              BIGSERIAL PRIMARY KEY,
  invoice_id      BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number     INT NOT NULL,
  item_id         BIGINT REFERENCES items(id),
  description     TEXT,
  rate            NUMERIC(15,2),
  quantity        INT DEFAULT 1,
  amount          NUMERIC(15,2),
  tax_amount      NUMERIC(15,2) DEFAULT 0,
  custcol_finley_entry_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invline_invoice ON invoice_lines (invoice_id);

-- ============================================================
-- Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subsidiaries_updated BEFORE UPDATE ON subsidiaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_auctions_updated BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lots_updated BEFORE UPDATE ON lots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RPC to reset sequence (used by /api/reset)
-- ============================================================
CREATE OR REPLACE FUNCTION setval_netsuite_seq(val BIGINT)
RETURNS void AS $$
BEGIN
  PERFORM setval('netsuite_id_seq', val);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
