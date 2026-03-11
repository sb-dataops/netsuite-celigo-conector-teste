const express = require("express");
const { store } = require("./store");

const subsidiaryRoutes = require("./routes/subsidiary");
const customerRoutes = require("./routes/customer");
const vendorRoutes = require("./routes/vendor");
const projectRoutes = require("./routes/project");
const customrecordsRoutes = require("./routes/customrecords");
const itemsRoutes = require("./routes/items");
const invoiceRoutes = require("./routes/invoice");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "netsuite-mock" });
});

app.use("/api/subsidiary", subsidiaryRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/customrecord", customrecordsRoutes);
app.use("/api/item", itemsRoutes);
app.use("/api/invoice", invoiceRoutes);

app.get("/api/records", (_req, res) => {
  const dump = {};
  for (const [collection, records] of store.collections) {
    dump[collection] = records;
  }
  res.json(dump);
});

app.post("/api/reset", (_req, res) => {
  store.reset();
  res.json({ status: "ok", message: "Store reset to seed data" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`netsuite-mock listening on port ${PORT}`);
});
