const { Router } = require("express");
const db = require("../db");

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const { externalId } = req.query;

    if (!externalId) {
      return res.status(400).json({ error: "externalId query param is required" });
    }

    const customer = await db.findByExternalId("customer", externalId);

    if (!customer) {
      return res.status(404).json({
        error: "CUSTOMER_NOT_FOUND",
        message: `Customer with externalId=${externalId} not found`,
      });
    }

    res.json(customer);
  } catch (err) {
    console.error("customer/search error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;

    if (!data.externalId) {
      return res.status(400).json({ error: "externalId is required" });
    }

    const existing = await db.findByExternalId("customer", data.externalId);

    if (existing && data.subsidiary && existing.subsidiary && existing.subsidiary !== data.subsidiary) {
      return res.status(409).json({
        error: "ENTITY_SUBSIDIARY_MISMATCH",
        message: `Customer ${data.externalId} belongs to subsidiary ${existing.subsidiary}, cannot assign to ${data.subsidiary}`,
      });
    }

    const { record, created } = await db.upsert("customer", data.externalId, {
      entityId: data.entityId || data.externalId,
      companyName: data.companyName,
      firstName: data.firstName,
      lastName: data.lastName,
      isPerson: data.isPerson || false,
      subsidiary: data.subsidiary,
      email: data.email,
      phone: data.phone,
      country: data.country,
      currency: data.currency,
      status: data.status || "Active",
      docNumber: data.docNumber,
      identityDocType: data.identityDocType,
      address: data.address || null,
    });

    console.log(`Customer ${created ? "CREATED" : "UPDATED"}: ${data.externalId} → internalId=${record.internalId}`);

    const result = {
      internalId: record.internalId,
      externalId: record.externalId,
      recordType: "customer",
      operation: created ? "created" : "updated",
      ...record,
    };
    res.status(created ? 201 : 200).json({ results: [result] });
  } catch (err) {
    console.error("customer POST error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

module.exports = router;
