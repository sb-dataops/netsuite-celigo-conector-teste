const { Router } = require("express");
const db = require("../db");

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const { externalId } = req.query;

    if (!externalId) {
      return res.status(400).json({ error: "externalId query param is required" });
    }

    const item = await db.findByExternalId("item", externalId);

    if (!item) {
      return res.status(404).json({
        error: "ITEM_NOT_FOUND",
        message: `Service item with externalId=${externalId} not found`,
      });
    }

    if (!item.taxSchedule) {
      return res.status(422).json({
        error: "ITEM_NO_TAX_SCHEDULE",
        message: `Item ${externalId} exists but has no tax schedule configured`,
      });
    }

    res.json({ results: [item] });
  } catch (err) {
    console.error("item/search error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

module.exports = router;
