const express = require("express");
const db = require("./db");
const sbw = require("./sbw-client");

const subsidiaryRoutes = require("./routes/subsidiary");
const customerRoutes = require("./routes/customer");
const vendorRoutes = require("./routes/vendor");
const projectRoutes = require("./routes/project");
const customrecordsRoutes = require("./routes/customrecords");
const itemsRoutes = require("./routes/items");
const invoiceRoutes = require("./routes/invoice");
const orchestrateRoutes = require("./routes/orchestrate");

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "NetSuiteMock";
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || "9v329yvyw8ZniQKtvX7f0mN9cW8FHe2I5W6EiDhK";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("FATAL: Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars");
  process.exit(1);
}

db.init(SUPABASE_URL, SUPABASE_KEY);

if (process.env.SBW_CLIENT_ID && process.env.SBW_CLIENT_SECRET) {
  sbw.init({
    tokenUrl: process.env.SBW_TOKEN_URL || "https://api.s4bdigital.net/account/oauth/token",
    apiBase: process.env.SBW_API_BASE || "https://api.s4bdigital.net",
    secureBase: process.env.SBW_SECURE_BASE || "https://secure.s4bdigital.net",
    clientId: process.env.SBW_CLIENT_ID,
    clientSecret: process.env.SBW_CLIENT_SECRET,
  });
  console.log("SBW client initialized (enrichment enabled)");
} else {
  console.log("SBW credentials not set, enrichment disabled");
}

const app = express();
app.use(express.json());

function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="NetSuite Mock"');
    return res.status(401).json({ error: "Missing Basic Auth credentials" });
  }

  const decoded = Buffer.from(authHeader.split(" ")[1], "base64").toString();
  const [user, pass] = decoded.split(":");

  if (user !== BASIC_AUTH_USER || pass !== BASIC_AUTH_PASS) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  next();
}

app.get("/health", async (_req, res) => {
  try {
    const { count, error } = await db.getClient()
      .from("subsidiaries")
      .select("*", { count: "exact", head: true });

    res.json({
      status: "ok",
      service: "netsuite-mock",
      database: error ? "error" : "connected",
      subsidiaries: count || 0,
    });
  } catch {
    res.json({ status: "ok", service: "netsuite-mock", database: "unreachable" });
  }
});

app.use("/api", basicAuth);

app.use("/api/subsidiary", subsidiaryRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/customrecord", customrecordsRoutes);
app.use("/api/item", itemsRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/orchestrate", orchestrateRoutes);

app.get("/api/records", async (_req, res) => {
  try {
    const records = await db.getAllRecords();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const client = db.getClient();
    const tables = ["subsidiaries", "customers", "vendors", "projects", "auctions", "lots", "items", "invoices"];
    const stats = {};

    for (const table of tables) {
      const { count } = await client.from(table).select("*", { count: "exact", head: true });
      stats[table] = count || 0;
    }

    stats.total = Object.values(stats).reduce((a, b) => a + b, 0);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reset", async (_req, res) => {
  try {
    await db.resetAndSeed();
    res.json({ status: "ok", message: "All tables cleared. Run seed separately to repopulate." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`netsuite-mock listening on port ${PORT} (Supabase: ${SUPABASE_URL})`);
});
