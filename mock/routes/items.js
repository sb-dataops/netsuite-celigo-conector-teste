const { Router } = require("express");
const { store } = require("../store");

const router = Router();

router.get("/search", (req, res) => {
  const { externalId } = req.query;

  if (!externalId) {
    return res.status(400).json({ error: "externalId query param is required" });
  }

  const item = store.findByExternalId("item", externalId);

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

  res.json(item);
});

module.exports = router;
