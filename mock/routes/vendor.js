const { Router } = require("express");
const { store } = require("../store");

const router = Router();

router.get("/search", (req, res) => {
  const { externalId } = req.query;

  if (!externalId) {
    return res.status(400).json({ error: "externalId query param is required" });
  }

  const vendor = store.findByExternalId("vendor", externalId);

  if (!vendor) {
    return res.status(404).json({
      error: "VENDOR_NOT_FOUND",
      message: `Vendor with externalId=${externalId} not found`,
    });
  }

  res.json(vendor);
});

router.post("/", (req, res) => {
  const data = req.body;

  if (!data.externalId) {
    return res.status(400).json({ error: "externalId is required" });
  }

  const existing = store.findByExternalId("vendor", data.externalId);

  if (existing && data.subsidiary && existing.subsidiary !== data.subsidiary) {
    return res.status(409).json({
      error: "ENTITY_SUBSIDIARY_MISMATCH",
      message: `Vendor ${data.externalId} belongs to subsidiary ${existing.subsidiary}, cannot assign to ${data.subsidiary}`,
    });
  }

  const { record, created } = store.upsert("vendor", data.externalId, {
    companyName: data.companyName,
    subsidiary: data.subsidiary,
    category: data.category || "Vendedor",
    status: data.status || "Active",
    country: data.country,
    docNumber: data.docNumber,
    identityDocType: data.identityDocType,
    address: data.address || null,
  });

  console.log(`Vendor ${created ? "CREATED" : "UPDATED"}: ${data.externalId} → internalId=${record.internalId}`);

  res.status(created ? 201 : 200).json({
    internalId: record.internalId,
    externalId: record.externalId,
    recordType: "vendor",
    operation: created ? "created" : "updated",
    ...record,
  });
});

module.exports = router;
