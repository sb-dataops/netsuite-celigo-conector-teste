const { Router } = require("express");
const { store } = require("../store");

const router = Router();

router.get("/search", (req, res) => {
  const { externalId } = req.query;

  if (!externalId) {
    return res.status(400).json({ error: "externalId query param is required" });
  }

  const project = store.findByExternalId("project", externalId);

  if (!project) {
    return res.status(404).json({
      error: "PROJECT_NOT_FOUND",
      message: `Project with externalId=${externalId} not found`,
    });
  }

  res.json(project);
});

router.post("/", (req, res) => {
  const data = req.body;

  if (!data.externalId) {
    return res.status(400).json({ error: "externalId is required" });
  }

  const { record, created } = store.upsert("project", data.externalId, {
    projectName: data.projectName,
    startDate: data.startDate,
    subsidiary: data.subsidiary,
    department: data.department,
    class: data.class,
    custentity_finley_business_unit_id: data.custentity_finley_business_unit_id,
    custentity_finley_business_segment_id: data.custentity_finley_business_segment_id,
    custentity_finley_integrated_flag: data.custentity_finley_integrated_flag,
    custentity_finley_platform_project: data.custentity_finley_platform_project,
    custentity_finley_country_iso: data.custentity_finley_country_iso,
  });

  console.log(`Project ${created ? "CREATED" : "UPDATED"}: ${data.externalId} → internalId=${record.internalId}`);

  res.status(created ? 201 : 200).json({
    internalId: record.internalId,
    externalId: record.externalId,
    recordType: "project",
    operation: created ? "created" : "updated",
    ...record,
  });
});

module.exports = router;
