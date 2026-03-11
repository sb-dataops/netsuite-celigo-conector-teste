const { Router } = require("express");
const db = require("../db");

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const { custrecord_finley_entity_id, custrecord_finley_eventmanager_id } = req.query;

    let results = [];

    if (custrecord_finley_entity_id) {
      results = await db.searchByField("subsidiary", "custrecord_finley_entity_id", custrecord_finley_entity_id);
    } else if (custrecord_finley_eventmanager_id) {
      results = await db.searchByField("subsidiary", "custrecord_finley_eventmanager_id", custrecord_finley_eventmanager_id);
    } else {
      return res.status(400).json({
        error: "Provide custrecord_finley_entity_id or custrecord_finley_eventmanager_id",
      });
    }

    const active = results.filter((r) => r.status === "Active");

    if (active.length === 0) {
      return res.status(404).json({
        error: "SUBSIDIARY_NOT_FOUND",
        message: `No active subsidiary found for query: ${JSON.stringify(req.query)}`,
      });
    }

    if (active.length > 1) {
      return res.status(409).json({
        error: "DUPLICATE_SUBSIDIARY",
        message: `Multiple subsidiaries found (${active.length}). Configuration error.`,
      });
    }

    res.json({ results: [active[0]] });
  } catch (err) {
    console.error("subsidiary/search error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

module.exports = router;
