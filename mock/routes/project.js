const { Router } = require("express");
const db = require("../db");

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const { externalId } = req.query;

    if (!externalId) {
      return res.status(400).json({ error: "externalId query param is required" });
    }

    const project = await db.findByExternalId("project", externalId);

    if (!project) {
      return res.status(404).json({
        error: "PROJECT_NOT_FOUND",
        message: `Project with externalId=${externalId} not found`,
      });
    }

    res.json(project);
  } catch (err) {
    console.error("project/search error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;

    if (!data.externalId) {
      return res.status(400).json({ error: "externalId is required" });
    }

    const { record, created } = await db.upsert("project", data.externalId, {
      projectName: data.projectName,
      startDate: data.startDate,
      subsidiary: data.subsidiary,
      department: data.department,
      class: data.class,
      custentity_finley_country_iso: data.custentity_finley_country_iso,
    });

    console.log(`Project ${created ? "CREATED" : "UPDATED"}: ${data.externalId} → internalId=${record.internalId}`);

    const result = {
      internalId: record.internalId,
      externalId: record.externalId,
      recordType: "project",
      operation: created ? "created" : "updated",
      ...record,
    };
    res.status(created ? 201 : 200).json({ results: [result] });
  } catch (err) {
    console.error("project POST error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

module.exports = router;
