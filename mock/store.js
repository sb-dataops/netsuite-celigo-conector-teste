const VAT_RATES = {
  AR: 0.21,
  CL: 0.19,
  CO: 0.19,
  PE: 0.18,
};

const CURRENCIES = ["ARS", "CLP", "COP", "PEN", "USD"];

function createStore() {
  let nextId = 1000;
  const collections = new Map();

  function generateId() {
    return String(++nextId);
  }

  function getCollection(name) {
    if (!collections.has(name)) {
      collections.set(name, []);
    }
    return collections.get(name);
  }

  function findByExternalId(collectionName, externalId) {
    const col = getCollection(collectionName);
    return col.find((r) => r.externalId === String(externalId)) || null;
  }

  function findByField(collectionName, field, value) {
    const col = getCollection(collectionName);
    return col.find((r) => String(r[field]) === String(value)) || null;
  }

  function searchByField(collectionName, field, value) {
    const col = getCollection(collectionName);
    return col.filter((r) => String(r[field]) === String(value));
  }

  function upsert(collectionName, externalId, data) {
    const col = getCollection(collectionName);
    const idx = col.findIndex((r) => r.externalId === String(externalId));

    if (idx >= 0) {
      const existing = col[idx];
      const updated = {
        ...existing,
        ...data,
        internalId: existing.internalId,
        externalId: String(externalId),
        updatedAt: new Date().toISOString(),
      };
      col[idx] = updated;
      return { record: updated, created: false };
    }

    const record = {
      ...data,
      internalId: generateId(),
      externalId: String(externalId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    col.push(record);
    return { record, created: true };
  }

  function add(collectionName, data) {
    const col = getCollection(collectionName);
    const record = {
      ...data,
      internalId: generateId(),
      createdAt: new Date().toISOString(),
    };
    col.push(record);
    return record;
  }

  function seed() {
    collections.clear();
    nextId = 1000;

    upsert("subsidiary", "SUB-AR-134114", {
      name: "SuperBid Argentina SA",
      country: "AR",
      custrecord_finley_entity_id: 134114,
      custrecord_finley_eventmanager_id: 10,
      custrecord_finley_country_iso: "AR",
      status: "Active",
    });

    upsert("subsidiary", "SUB-CL-200001", {
      name: "SuperBid Chile SpA",
      country: "CL",
      custrecord_finley_entity_id: 200001,
      custrecord_finley_eventmanager_id: 20,
      custrecord_finley_country_iso: "CL",
      status: "Active",
    });

    upsert("subsidiary", "SUB-CO-300001", {
      name: "SuperBid Colombia SAS",
      country: "CO",
      custrecord_finley_entity_id: 300001,
      custrecord_finley_eventmanager_id: 30,
      custrecord_finley_country_iso: "CO",
      status: "Active",
    });

    upsert("item", "5", {
      name: "Encargos de Administracion",
      itemType: "Service",
      taxSchedule: "VAT-Standard",
      revenueAccount: "4000",
    });

    upsert("item", "6", {
      name: "Comision de Intermediacion",
      itemType: "Service",
      taxSchedule: "VAT-Standard",
      revenueAccount: "4001",
    });

    upsert("item", "7", {
      name: "Gastos Operativos",
      itemType: "Service",
      taxSchedule: "VAT-Standard",
      revenueAccount: "4002",
    });
  }

  seed();

  return {
    collections,
    generateId,
    getCollection,
    findByExternalId,
    findByField,
    searchByField,
    upsert,
    add,
    seed,
    reset: seed,
    VAT_RATES,
    CURRENCIES,
  };
}

const store = createStore();

module.exports = { store };
