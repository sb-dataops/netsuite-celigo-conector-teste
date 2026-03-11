const { Router } = require("express");
const { store } = require("../store");

const router = Router();

router.get("/search", (req, res) => {
  const { externalId } = req.query;

  if (!externalId) {
    return res.status(400).json({ error: "externalId query param is required" });
  }

  const customer = store.findByExternalId("customer", externalId);

  if (!customer) {
    return res.status(404).json({
      error: "CUSTOMER_NOT_FOUND",
      message: `Customer with externalId=${externalId} not found`,
    });
  }

  res.json(customer);
});

router.post("/", (req, res) => {
  const data = req.body;

  if (!data.externalId) {
    return res.status(400).json({ error: "externalId is required" });
  }

  const existing = store.findByExternalId("customer", data.externalId);

  if (existing && data.subsidiary && existing.subsidiary !== data.subsidiary) {
    return res.status(409).json({
      error: "ENTITY_SUBSIDIARY_MISMATCH",
      message: `Customer ${data.externalId} belongs to subsidiary ${existing.subsidiary}, cannot assign to ${data.subsidiary}`,
    });
  }

  const { record, created } = store.upsert("customer", data.externalId, {
    entityId: data.entityId || data.externalId,
    companyName: data.companyName,
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName,
    isPerson: data.isPerson || false,
    subsidiary: data.subsidiary,
    email: data.email,
    phone: data.phone,
    country: data.country,
    currency: data.currency,
    nexus: data.nexus,
    status: data.status || "Active",
    docNumber: data.docNumber,
    identityDocType: data.identityDocType,
    verifiedDigit: data.verifiedDigit,
    address: data.address || null,
  });

  console.log(`Customer ${created ? "CREATED" : "UPDATED"}: ${data.externalId} → internalId=${record.internalId}`);

  res.status(created ? 201 : 200).json({
    internalId: record.internalId,
    externalId: record.externalId,
    recordType: "customer",
    operation: created ? "created" : "updated",
    ...record,
  });
});

module.exports = router;
