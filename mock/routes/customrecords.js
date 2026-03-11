const { Router } = require("express");
const db = require("../db");

const router = Router();

// ── Auction ──────────────────────────────────────────────────

router.get("/auction/search", async (req, res) => {
  try {
    const { externalId } = req.query;

    if (!externalId) {
      return res.status(400).json({ error: "externalId query param is required" });
    }

    const auction = await db.findByExternalId("auction", externalId);

    if (!auction) {
      return res.status(404).json({
        error: "AUCTION_NOT_FOUND",
        message: `Auction with externalId=${externalId} not found`,
      });
    }

    res.json(auction);
  } catch (err) {
    console.error("auction/search error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

router.post("/auction", async (req, res) => {
  try {
    const data = req.body;

    if (!data.externalId) {
      return res.status(400).json({ error: "externalId is required" });
    }

    const { record, created } = await db.upsert("auction", data.externalId, {
      name: data.name,
      custrecord_finley_event_id: data.custrecord_finley_event_id,
      custrecord_auction_description: data.custrecord_auction_description,
      custrecord_auction_end_date: data.custrecord_auction_end_date,
      custrecord_auction_currency_code: data.custrecord_auction_currency_code,
      custrecord_auction_locale: data.custrecord_auction_locale,
      custrecord_auction_city: data.custrecord_auction_city,
      custrecord_auction_state: data.custrecord_auction_state,
      custrecord_auction_parent_project: data.custrecord_auction_parent_project,
      custrecord_auction_subsidiary_ref: data.custrecord_auction_subsidiary_ref,
    });

    console.log(`Auction ${created ? "CREATED" : "UPDATED"}: ${data.externalId} → internalId=${record.internalId}`);

    res.status(created ? 201 : 200).json({
      internalId: record.internalId,
      externalId: record.externalId,
      recordType: "customrecord_auction",
      operation: created ? "created" : "updated",
      ...record,
    });
  } catch (err) {
    console.error("auction POST error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

// ── Lot ──────────────────────────────────────────────────────

router.get("/lot/search", async (req, res) => {
  try {
    const { externalId } = req.query;

    if (!externalId) {
      return res.status(400).json({ error: "externalId query param is required" });
    }

    const lot = await db.findByExternalId("lot", externalId);

    if (!lot) {
      return res.status(404).json({
        error: "LOT_NOT_FOUND",
        message: `Lot with externalId=${externalId} not found`,
      });
    }

    res.json(lot);
  } catch (err) {
    console.error("lot/search error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

router.post("/lot", async (req, res) => {
  try {
    const data = req.body;

    if (!data.externalId) {
      return res.status(400).json({ error: "externalId is required" });
    }

    const { record, created } = await db.upsert("lot", data.externalId, {
      custrecord_lot_number: data.custrecord_lot_number,
      custrecord_lot_auction: data.custrecord_lot_auction,
      custrecord_lot_project: data.custrecord_lot_project,
      custrecord_lot_seller_vendor: data.custrecord_lot_seller_vendor,
      custrecord_lot_buyer_customer: data.custrecord_lot_buyer_customer,
    });

    console.log(`Lot ${created ? "CREATED" : "UPDATED"}: ${data.externalId} → internalId=${record.internalId}`);

    res.status(created ? 201 : 200).json({
      internalId: record.internalId,
      externalId: record.externalId,
      recordType: "customrecord_lot",
      operation: created ? "created" : "updated",
      ...record,
    });
  } catch (err) {
    console.error("lot POST error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

module.exports = router;
