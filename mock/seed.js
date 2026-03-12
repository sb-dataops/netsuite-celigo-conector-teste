const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDate(yearStart, yearEnd) {
  const y = randInt(yearStart, yearEnd);
  const m = randInt(1, 12);
  const d = randInt(1, 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function randAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function genDoc(country) {
  const r = () => randInt(10, 99);
  const maps = {
    AR: () => `${r()}-${randInt(10000000, 99999999)}-${randInt(0, 9)}`,
    CL: () => `${randInt(10000000, 99999999)}-${randInt(0, 9)}`,
    CO: () => `${randInt(100000000, 999999999)}-${randInt(0, 9)}`,
    PE: () => `${randInt(10000000000, 99999999999)}`,
    BR: () => `${randInt(100, 999)}.${randInt(100, 999)}.${randInt(100, 999)}-${r()}`,
  };
  return (maps[country] || maps.AR)();
}

function docType(country) {
  const m = { AR: "CUIT", CL: "RUT", CO: "NIT", PE: "RUC", BR: "CPF" };
  return m[country] || "DNI";
}

function currency(country) {
  const m = { AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", BR: "BRL" };
  return m[country] || "USD";
}

function locale(country) {
  const m = { AR: "es_AR", CL: "es_CL", CO: "es_CO", PE: "es_PE", BR: "pt_BR" };
  return m[country] || "es";
}

// ── Data pools ───────────────────────────────────────────────

const SUBSIDIARIES = [
  { ext: "SUB-AR-134114", name: "SuperBid Argentina SA", country: "AR", entityId: 134114, mgr: 10 },
  { ext: "SUB-CL-200001", name: "SuperBid Chile SpA", country: "CL", entityId: 200001, mgr: 20 },
  { ext: "SUB-CO-300001", name: "SuperBid Colombia SAS", country: "CO", entityId: 300001, mgr: 30 },
  { ext: "SUB-PE-400001", name: "SuperBid Peru SAC", country: "PE", entityId: 400001, mgr: 40 },
  { ext: "SUB-BR-500001", name: "SuperBid Brasil Ltda", country: "BR", entityId: 500001, mgr: 50 },
];

const FIRST_NAMES_M = [
  "Juan", "Carlos", "Pedro", "Miguel", "Andres", "Diego", "Luis", "Jose", "Fernando", "Pablo",
  "Ricardo", "Alejandro", "Roberto", "Gabriel", "Sergio", "Daniel", "Eduardo", "Guillermo", "Raul", "Oscar",
  "Enrique", "Hector", "Francisco", "Rafael", "Arturo", "Javier", "Manuel", "Martin", "Santiago", "Ignacio",
  "Mateo", "Nicolas", "Sebastian", "Tomas", "Emilio", "Bruno", "Maximiliano", "Gonzalo", "Ivan", "Victor",
];

const FIRST_NAMES_F = [
  "Maria", "Ana", "Laura", "Carmen", "Lucia", "Sofia", "Valentina", "Camila", "Daniela", "Andrea",
  "Gabriela", "Patricia", "Carolina", "Fernanda", "Mariana", "Alejandra", "Paula", "Elena", "Rosa", "Teresa",
  "Isabel", "Marcela", "Victoria", "Natalia", "Catalina", "Diana", "Monica", "Sandra", "Adriana", "Claudia",
  "Florencia", "Agustina", "Julieta", "Milagros", "Rocio", "Cecilia", "Lorena", "Silvia", "Veronica", "Beatriz",
];

const LAST_NAMES = [
  "Garcia", "Rodriguez", "Martinez", "Lopez", "Gonzalez", "Hernandez", "Perez", "Sanchez", "Ramirez", "Torres",
  "Flores", "Rivera", "Gomez", "Diaz", "Cruz", "Morales", "Reyes", "Gutierrez", "Ortiz", "Ramos",
  "Castillo", "Santos", "Romero", "Herrera", "Medina", "Aguilar", "Vargas", "Castro", "Jimenez", "Ruiz",
  "Mendoza", "Vasquez", "Rojas", "Delgado", "Nunez", "Soto", "Pena", "Rios", "Cardenas", "Silva",
  "Acosta", "Montoya", "Beltran", "Navarro", "Vega", "Espinoza", "Salazar", "Guerrero", "Calderon", "Paredes",
];

const VENDOR_PREFIXES = [
  "Subastas", "Remates", "Liquidaciones", "Comercial", "Distribuidora", "Importadora",
  "Inversiones", "Grupo", "Servicios", "Logistica", "Industrial", "Maquinarias",
  "Automotriz", "Inmobiliaria", "Tecnologia", "Construcciones", "Agropecuaria", "Transporte",
  "Metalurgica", "Electronica",
];

const VENDOR_SUFFIXES = [
  "del Sur", "del Norte", "del Pacifico", "Continental", "Internacional", "Nacional",
  "Global", "Regional", "Central", "Andina", "Austral", "Platense",
  "Express", "Premium", "Prime", "Pro", "Plus", "Max",
  "Hermanos", "& Asociados",
];

const PROJECT_CATEGORIES = [
  "Maquinaria Pesada", "Vehiculos Livianos", "Vehiculos Pesados", "Inmuebles Comerciales",
  "Inmuebles Residenciales", "Tecnologia y Equipos IT", "Equipos Medicos", "Mobiliario de Oficina",
  "Electrodomesticos", "Equipos Industriales", "Herramientas y Ferreteria", "Materiales de Construccion",
  "Insumos Agricolas", "Ganado y Semovientes", "Arte y Antiguedades", "Joyas y Relojes",
  "Excedentes Bancarios", "Bienes Fiscales", "Chatarra Industrial", "Stocks de Quiebra",
];

const CITIES = {
  AR: ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "Tucuman", "Mar del Plata", "Salta", "Santa Fe"],
  CL: ["Santiago", "Valparaiso", "Concepcion", "Antofagasta", "Temuco", "Viña del Mar", "Iquique", "Rancagua"],
  CO: ["Bogota", "Medellin", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Cucuta", "Pereira"],
  PE: ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Cusco", "Piura", "Huancayo", "Iquitos"],
  BR: ["Sao Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Salvador", "Brasilia", "Fortaleza"],
};

const STATES = {
  AR: ["CABA", "Buenos Aires", "Cordoba", "Santa Fe", "Mendoza", "Tucuman"],
  CL: ["Region Metropolitana", "Valparaiso", "Biobio", "Antofagasta", "Araucania"],
  CO: ["Cundinamarca", "Antioquia", "Valle del Cauca", "Atlantico", "Bolivar", "Santander"],
  PE: ["Lima", "Arequipa", "La Libertad", "Lambayeque", "Cusco", "Piura"],
  BR: ["Sao Paulo", "Rio de Janeiro", "Minas Gerais", "Parana", "Rio Grande do Sul"],
};

const ITEMS_SEED = [
  { ext: "1", name: "Comision Martillero", account: "4010" },
  { ext: "2", name: "Comision Vendedor", account: "4011" },
  { ext: "3", name: "Comision Comprador", account: "4012" },
  { ext: "4", name: "Gastos de Escrituracion", account: "4013" },
  { ext: "5", name: "Encargos de Administracion", account: "4000" },
  { ext: "6", name: "Comision de Intermediacion", account: "4001" },
  { ext: "7", name: "Gastos Operativos", account: "4002" },
  { ext: "8", name: "Comision por Servicio de Subasta", account: "4003" },
  { ext: "9", name: "Tasa de Registro de Comprador", account: "4004" },
  { ext: "10", name: "Gastos de Retiro y Logistica", account: "4005" },
  { ext: "11", name: "Comision por Venta Directa", account: "4006" },
  { ext: "12", name: "Servicios de Tasacion y Peritaje", account: "4007" },
  { ext: "13", name: "Gastos de Publicidad y Marketing", account: "4008" },
  { ext: "14", name: "Servicio de Custodia y Almacenamiento", account: "4009" },
];

// ── Insert helpers ───────────────────────────────────────────

async function bulkInsert(table, rows) {
  const BATCH = 100;
  const inserted = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase.from(table).insert(batch).select("id, internal_id, external_id");
    if (error) {
      console.error(`  ERROR inserting into ${table} (batch ${i / BATCH + 1}):`, error.message);
      continue;
    }
    inserted.push(...data);
  }
  return inserted;
}

// ── Main seed ────────────────────────────────────────────────

async function seed() {
  console.log("=== NetSuite Mock Seed ===\n");

  // 1) Subsidiaries
  console.log("1. Inserting subsidiaries...");
  const subRows = SUBSIDIARIES.map((s) => ({
    external_id: s.ext,
    name: s.name,
    country: s.country,
    custrecord_finley_entity_id: s.entityId,
    custrecord_finley_eventmanager_id: s.mgr,
    custrecord_finley_country_iso: s.country,
    status: "Active",
  }));
  const subs = await bulkInsert("subsidiaries", subRows);
  console.log(`   ${subs.length} subsidiaries inserted`);

  const subLookup = {};
  subs.forEach((s, i) => { subLookup[SUBSIDIARIES[i].country] = s; });

  // 2) Items
  console.log("2. Inserting items...");
  const itemRows = ITEMS_SEED.map((it) => ({
    external_id: it.ext,
    name: it.name,
    item_type: "Service",
    tax_schedule: "VAT-Standard",
    revenue_account: it.account,
    status: "Active",
  }));
  const items = await bulkInsert("items", itemRows);
  console.log(`   ${items.length} items inserted`);

  // 3) Customers (40 per subsidiary)
  console.log("3. Inserting customers...");
  let custId = 1575000;
  const customerRows = [];
  const customersBySub = {};

  for (const sub of subs) {
    const country = SUBSIDIARIES[subs.indexOf(sub)].country;
    customersBySub[country] = [];

    for (let i = 0; i < 40; i++) {
      custId++;
      const isFemale = i % 3 === 0;
      const first = isFemale ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
      const last1 = pick(LAST_NAMES);
      const last2 = pick(LAST_NAMES);

      customerRows.push({
        external_id: String(custId),
        entity_id: String(custId),
        company_name: `${first} ${last1} ${last2}`,
        first_name: first,
        last_name: `${last1} ${last2}`,
        is_person: true,
        subsidiary_id: sub.id,
        country,
        currency: currency(country),
        doc_number: genDoc(country),
        identity_doc_type: docType(country),
        status: "Active",
      });
    }
  }

  const customers = await bulkInsert("customers", customerRows);
  console.log(`   ${customers.length} customers inserted`);

  let idx = 0;
  for (const country of Object.keys(customersBySub)) {
    for (let i = 0; i < 40; i++) {
      customersBySub[country].push(customers[idx++]);
    }
  }

  // 4) Vendors (20 per subsidiary)
  console.log("4. Inserting vendors...");
  let vendId = 1307000;
  const vendorRows = [];
  const vendorsBySub = {};

  for (const sub of subs) {
    const country = SUBSIDIARIES[subs.indexOf(sub)].country;
    vendorsBySub[country] = [];

    for (let i = 0; i < 20; i++) {
      vendId++;
      const prefix = VENDOR_PREFIXES[i % VENDOR_PREFIXES.length];
      const suffix = VENDOR_SUFFIXES[i % VENDOR_SUFFIXES.length];
      const surname = pick(LAST_NAMES);

      vendorRows.push({
        external_id: `vndr_${vendId}`,
        company_name: `${prefix} ${surname} ${suffix}`,
        subsidiary_id: sub.id,
        category: "Vendedor",
        country,
        doc_number: genDoc(country),
        identity_doc_type: docType(country),
        status: "Active",
      });
    }
  }

  const vendors = await bulkInsert("vendors", vendorRows);
  console.log(`   ${vendors.length} vendors inserted`);

  idx = 0;
  for (const country of Object.keys(vendorsBySub)) {
    for (let i = 0; i < 20; i++) {
      vendorsBySub[country].push(vendors[idx++]);
    }
  }

  // 5) Projects (20 per subsidiary)
  console.log("5. Inserting projects...");
  let projExtId = 1189000;
  const projectRows = [];
  const projectsBySub = {};

  for (const sub of subs) {
    const country = SUBSIDIARIES[subs.indexOf(sub)].country;
    projectsBySub[country] = [];

    for (let i = 0; i < 20; i++) {
      projExtId++;
      const cat = PROJECT_CATEGORIES[i % PROJECT_CATEGORIES.length];

      projectRows.push({
        external_id: String(projExtId),
        project_name: `${cat} - ${pick(CITIES[country])} ${randInt(2025, 2026)}`,
        start_date: randDate(2025, 2026),
        subsidiary_id: sub.id,
        department: `BU-${String(randInt(1, 10)).padStart(3, "0")}`,
        class: `BS-${cat.split(" ")[0].toUpperCase().slice(0, 6)}`,
        custentity_finley_country_iso: country,
        status: "Active",
      });
    }
  }

  const projects = await bulkInsert("projects", projectRows);
  console.log(`   ${projects.length} projects inserted`);

  idx = 0;
  for (const country of Object.keys(projectsBySub)) {
    for (let i = 0; i < 20; i++) {
      projectsBySub[country].push(projects[idx++]);
    }
  }

  // 6) Auctions (1-3 per project)
  console.log("6. Inserting auctions...");
  let eventId = 776000;
  const auctionRows = [];
  const auctionMeta = [];

  for (const sub of subs) {
    const country = SUBSIDIARIES[subs.indexOf(sub)].country;
    const countryProjects = projectsBySub[country];

    for (const proj of countryProjects) {
      const numAuctions = randInt(1, 3);
      for (let a = 0; a < numAuctions; a++) {
        eventId++;
        const cat = pick(PROJECT_CATEGORIES);
        const city = pick(CITIES[country]);
        const state = pick(STATES[country]);

        auctionRows.push({
          external_id: String(eventId),
          name: `${cat} - ${city}`,
          custrecord_finley_event_id: String(eventId),
          custrecord_auction_description: `Subasta de ${cat.toLowerCase()} en ${city}, ${state}`,
          custrecord_auction_end_date: `${randDate(2026, 2026)}T${randInt(14, 20)}:00:00Z`,
          custrecord_auction_currency_code: currency(country),
          custrecord_auction_locale: locale(country),
          custrecord_auction_city: city,
          custrecord_auction_state: state,
          project_id: proj.id,
          subsidiary_id: sub.id,
          status: "Active",
        });
        auctionMeta.push({ country, projId: proj.id });
      }
    }
  }

  const auctions = await bulkInsert("auctions", auctionRows);
  console.log(`   ${auctions.length} auctions inserted`);

  // 7) Lots (2-6 per auction)
  console.log("7. Inserting lots...");
  const lotRows = [];

  for (let ai = 0; ai < auctions.length; ai++) {
    const auction = auctions[ai];
    const meta = auctionMeta[ai];
    const numLots = randInt(2, 6);
    const countryCustomers = customersBySub[meta.country] || [];
    const countryVendors = vendorsBySub[meta.country] || [];

    for (let l = 1; l <= numLots; l++) {
      const buyer = countryCustomers.length > 0 ? pick(countryCustomers) : null;
      const seller = countryVendors.length > 0 ? pick(countryVendors) : null;

      lotRows.push({
        external_id: `LOT-${auction.external_id}-${l}`,
        lot_number: String(l),
        auction_id: auction.id,
        project_id: meta.projId,
        seller_vendor_id: seller ? seller.id : null,
        buyer_customer_id: buyer ? buyer.id : null,
        status: "Active",
      });
    }
  }

  const lots = await bulkInsert("lots", lotRows);
  console.log(`   ${lots.length} lots inserted`);

  // ── Summary ────────────────────────────────────────────────
  console.log("\n=== Seed Complete ===");
  console.log(`  Subsidiaries: ${subs.length}`);
  console.log(`  Items:        ${items.length}`);
  console.log(`  Customers:    ${customers.length}`);
  console.log(`  Vendors:      ${vendors.length}`);
  console.log(`  Projects:     ${projects.length}`);
  console.log(`  Auctions:     ${auctions.length}`);
  console.log(`  Lots:         ${lots.length}`);
  console.log(`  TOTAL:        ${subs.length + items.length + customers.length + vendors.length + projects.length + auctions.length + lots.length}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
