const { createClient } = require("@supabase/supabase-js");

const VAT_RATES = {
  AR: 0.21,
  CL: 0.19,
  CO: 0.19,
  PE: 0.18,
  BR: 0.17,
};

const TABLE_MAP = {
  subsidiary: "subsidiaries",
  customer: "customers",
  vendor: "vendors",
  project: "projects",
  auction: "auctions",
  lot: "lots",
  item: "items",
  invoice: "invoices",
};

const COLUMN_MAP = {
  subsidiaries: {
    internalId: "internal_id",
    externalId: "external_id",
    custrecord_finley_entity_id: "custrecord_finley_entity_id",
    custrecord_finley_eventmanager_id: "custrecord_finley_eventmanager_id",
    custrecord_finley_country_iso: "custrecord_finley_country_iso",
  },
  customers: {
    internalId: "internal_id",
    externalId: "external_id",
    entityId: "entity_id",
    companyName: "company_name",
    firstName: "first_name",
    lastName: "last_name",
    isPerson: "is_person",
    subsidiary: "subsidiary_id",
    docNumber: "doc_number",
    identityDocType: "identity_doc_type",
  },
  vendors: {
    internalId: "internal_id",
    externalId: "external_id",
    companyName: "company_name",
    firstName: "first_name",
    lastName: "last_name",
    isPerson: "is_person",
    subsidiary: "subsidiary_id",
    docNumber: "doc_number",
    identityDocType: "identity_doc_type",
  },
  projects: {
    internalId: "internal_id",
    externalId: "external_id",
    projectName: "project_name",
    startDate: "start_date",
    subsidiary: "subsidiary_id",
    custentity_finley_country_iso: "custentity_finley_country_iso",
  },
  auctions: {
    internalId: "internal_id",
    externalId: "external_id",
    custrecord_finley_event_id: "custrecord_finley_event_id",
    custrecord_auction_description: "custrecord_auction_description",
    custrecord_auction_end_date: "custrecord_auction_end_date",
    custrecord_auction_currency_code: "custrecord_auction_currency_code",
    custrecord_auction_locale: "custrecord_auction_locale",
    custrecord_auction_city: "custrecord_auction_city",
    custrecord_auction_state: "custrecord_auction_state",
    custrecord_auction_parent_project: "project_id",
    custrecord_auction_subsidiary_ref: "subsidiary_id",
  },
  lots: {
    internalId: "internal_id",
    externalId: "external_id",
    custrecord_lot_number: "lot_number",
    custrecord_lot_auction: "auction_id",
    custrecord_lot_project: "project_id",
    custrecord_lot_seller_vendor: "seller_vendor_id",
    custrecord_lot_buyer_customer: "buyer_customer_id",
  },
  items: {
    internalId: "internal_id",
    externalId: "external_id",
    itemType: "item_type",
    taxSchedule: "tax_schedule",
    revenueAccount: "revenue_account",
  },
  invoices: {
    internalId: "internal_id",
    externalId: "external_id",
    entity: "entity_id",
    subsidiary: "subsidiary_id",
    countryIso: "country_iso",
    job: "job_id",
    custbody_seller_vendor: "custbody_seller_vendor",
    custbody_auction_ref: "custbody_auction_ref",
    custbody_lot_reference: "custbody_lot_reference",
    custbody_finley_sale_id: "custbody_finley_sale_id",
    taxTotal: "tax_total",
    taxDetails: "tax_details",
  },
};

let supabase = null;

function init(url, key) {
  supabase = createClient(url, key);
  return supabase;
}

function getClient() {
  if (!supabase) throw new Error("Supabase not initialized. Call init() first.");
  return supabase;
}

function tableName(collection) {
  return TABLE_MAP[collection] || collection;
}

function toDbRow(table, data) {
  const map = COLUMN_MAP[table] || {};
  const row = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "internalId" || key === "internal_id") continue;
    const dbCol = map[key] || key;
    row[dbCol] = value === "" ? null : value;
  }
  return row;
}

function toApiRecord(table, row) {
  if (!row) return null;
  const reverseMap = {};
  const map = COLUMN_MAP[table] || {};
  for (const [apiKey, dbCol] of Object.entries(map)) {
    reverseMap[dbCol] = apiKey;
  }

  const record = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id") continue;
    const apiKey = reverseMap[key] || key;
    record[apiKey] = value;
    if (apiKey === "internal_id") record.internalId = value;
    if (apiKey === "external_id") record.externalId = value;
  }

  if (!record.internalId && row.internal_id) record.internalId = row.internal_id;
  if (!record.externalId && row.external_id) record.externalId = row.external_id;
  record.createdAt = row.created_at;
  record.updatedAt = row.updated_at;

  delete record.internal_id;
  delete record.external_id;
  delete record.created_at;
  delete record.updated_at;
  delete record.subsidiary_id;
  delete record.project_id;
  delete record.auction_id;
  delete record.seller_vendor_id;
  delete record.buyer_customer_id;
  delete record.entity_id;
  delete record.job_id;
  delete record.item_id;

  return record;
}

async function findByExternalId(collection, externalId) {
  const table = tableName(collection);
  const { data, error } = await getClient()
    .from(table)
    .select("*")
    .eq("external_id", String(externalId))
    .maybeSingle();

  if (error) {
    console.error(`findByExternalId error (${table}):`, error.message);
    return null;
  }
  return data ? toApiRecord(table, data) : null;
}

async function findByField(collection, field, value) {
  const table = tableName(collection);
  const map = COLUMN_MAP[table] || {};
  const dbCol = map[field] || field;

  const { data, error } = await getClient()
    .from(table)
    .select("*")
    .eq(dbCol, String(value))
    .maybeSingle();

  if (error) {
    console.error(`findByField error (${table}.${dbCol}):`, error.message);
    return null;
  }
  return data ? toApiRecord(table, data) : null;
}

async function searchByField(collection, field, value) {
  const table = tableName(collection);
  const map = COLUMN_MAP[table] || {};
  const dbCol = map[field] || field;

  const { data, error } = await getClient()
    .from(table)
    .select("*")
    .eq(dbCol, String(value));

  if (error) {
    console.error(`searchByField error (${table}.${dbCol}):`, error.message);
    return [];
  }
  return (data || []).map((row) => toApiRecord(table, row));
}

async function upsert(collection, externalId, apiData) {
  const table = tableName(collection);
  const db = getClient();

  const { data: existing } = await db
    .from(table)
    .select("*")
    .eq("external_id", String(externalId))
    .maybeSingle();

  if (existing) {
    const updateRow = toDbRow(table, apiData);
    delete updateRow.external_id;

    const { data: updated, error } = await db
      .from(table)
      .update(updateRow)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      console.error(`upsert UPDATE error (${table}):`, error.message);
      throw error;
    }
    return { record: toApiRecord(table, updated), created: false };
  }

  const insertRow = toDbRow(table, apiData);
  insertRow.external_id = String(externalId);

  const { data: inserted, error } = await db
    .from(table)
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    console.error(`upsert INSERT error (${table}):`, error.message);
    throw error;
  }
  return { record: toApiRecord(table, inserted), created: true };
}

async function add(collection, apiData) {
  const table = tableName(collection);
  const insertRow = toDbRow(table, apiData);
  if (apiData.externalId) insertRow.external_id = String(apiData.externalId);

  const { data: inserted, error } = await getClient()
    .from(table)
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    console.error(`add error (${table}):`, error.message);
    throw error;
  }
  return toApiRecord(table, inserted);
}

async function getAllRecords() {
  const db = getClient();
  const tables = ["subsidiaries", "customers", "vendors", "projects", "auctions", "lots", "items", "invoices"];
  const result = {};

  for (const table of tables) {
    const { data, error } = await db.from(table).select("*").order("id");
    if (error) {
      result[table] = { error: error.message };
    } else {
      result[table] = {
        count: data.length,
        records: data.map((row) => toApiRecord(table, row)),
      };
    }
  }
  return result;
}

async function resetAndSeed(seedFn) {
  const db = getClient();
  const tables = ["invoice_lines", "invoices", "lots", "auctions", "projects", "vendors", "customers", "items", "subsidiaries"];

  for (const table of tables) {
    const { error } = await db.from(table).delete().neq("id", 0);
    if (error) console.error(`truncate ${table}:`, error.message);
  }

  await db.rpc("setval_netsuite_seq", { val: 1000 }).catch(() => {
    console.log("Note: setval_netsuite_seq RPC not found, sequence may not reset");
  });

  if (seedFn) await seedFn(db);
}

module.exports = {
  init,
  getClient,
  findByExternalId,
  findByField,
  searchByField,
  upsert,
  add,
  getAllRecords,
  resetAndSeed,
  VAT_RATES,
  tableName,
  toDbRow,
  toApiRecord,
};
