const { Router } = require("express");
const { store } = require("../store");

const router = Router();

router.get("/search", (req, res) => {
  const { custrecord_finley_entity_id, custrecord_finley_eventmanager_id } =
    req.query;

  let results = [];

  if (custrecord_finley_entity_id) {
    results = store.searchByField(
      "subsidiary",
      "custrecord_finley_entity_id",
      custrecord_finley_entity_id
    );
  } else if (custrecord_finley_eventmanager_id) {
    results = store.searchByField(
      "subsidiary",
      "custrecord_finley_eventmanager_id",
      custrecord_finley_eventmanager_id
    );
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

  res.json(active[0]);
});

module.exports = router;
