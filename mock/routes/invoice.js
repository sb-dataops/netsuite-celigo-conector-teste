const { Router } = require("express");
const db = require("../db");

const router = Router();

router.post("/", async (req, res) => {
  try {
    const data = req.body;

    if (!data.externalId) {
      return res.status(400).json({ error: "externalId is required" });
    }
    if (!data.entity) {
      return res.status(400).json({ error: "entity (customer internalId) is required" });
    }
    if (!data.subsidiary) {
      return res.status(400).json({ error: "subsidiary (internalId) is required" });
    }
    if (!data.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
      return res.status(400).json({ error: "lines array is required with at least one entry" });
    }

    const existing = await db.findByExternalId("invoice", data.externalId);
    if (existing) {
      return res.status(409).json({
        error: "DUPLICATE_INVOICE",
        message: `Invoice with externalId=${data.externalId} already exists (internalId=${existing.internalId})`,
      });
    }

    const subsidiary = await db.findByField("subsidiary", "internalId", data.subsidiary);
    const countryIso = data.countryIso || (subsidiary ? subsidiary.country : "AR");
    const vatRate = db.VAT_RATES[countryIso] || 0.21;

    const processedLines = data.lines.map((line, idx) => {
      const amount = line.amount || line.rate * (line.quantity || 1);
      const lineTax = Math.round(amount * vatRate * 100) / 100;
      return {
        lineNumber: idx + 1,
        item: line.item,
        description: line.description || "",
        rate: line.rate,
        quantity: line.quantity || 1,
        amount,
        taxAmount: lineTax,
        custcol_finley_entry_id: line.custcol_finley_entry_id,
      };
    });

    const subtotal = processedLines.reduce((sum, l) => sum + l.amount, 0);
    const taxTotal = processedLines.reduce((sum, l) => sum + l.taxAmount, 0);
    const total = Math.round((subtotal + taxTotal) * 100) / 100;

    const taxDetails = [
      {
        taxType: "VAT",
        taxCode: `VAT-${countryIso}`,
        taxRate: vatRate * 100,
        taxAmount: taxTotal,
      },
    ];

    const invoice = await db.add("invoice", {
      externalId: data.externalId,
      trandate: data.trandate,
      entity: data.entity,
      subsidiary: data.subsidiary,
      currency: data.currency,
      countryIso,
      job: data.job,
      custbody_seller_vendor: data.custbody_seller_vendor,
      custbody_auction_ref: data.custbody_auction_ref,
      custbody_lot_reference: data.custbody_lot_reference,
      custbody_finley_sale_id: data.custbody_finley_sale_id,
      subtotal,
      taxTotal,
      total,
      taxDetails,
      status: "open",
    });

    if (invoice.internalId) {
      const lineRows = processedLines.map((line) => ({
        invoice_id: parseInt(invoice.internalId),
        line_number: line.lineNumber,
        item_id: line.item ? parseInt(line.item) : null,
        description: line.description,
        rate: line.rate,
        quantity: line.quantity,
        amount: line.amount,
        tax_amount: line.taxAmount,
        custcol_finley_entry_id: line.custcol_finley_entry_id,
      }));

      const client = db.getClient();
      await client.from("invoice_lines").insert(lineRows);
    }

    console.log(`Invoice CREATED: ${data.externalId} → internalId=${invoice.internalId} | subtotal=${subtotal} | VAT(${vatRate * 100}%)=${taxTotal} | total=${total}`);

    res.status(201).json({
      internalId: invoice.internalId,
      externalId: invoice.externalId,
      recordType: "invoice",
      operation: "created",
      trandate: data.trandate,
      subtotal,
      taxTotal,
      total,
      taxDetails,
      lines: processedLines,
    });
  } catch (err) {
    console.error("invoice POST error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { externalId } = req.query;

    if (!externalId) {
      return res.status(400).json({ error: "externalId query param is required" });
    }

    const invoice = await db.findByExternalId("invoice", externalId);

    if (!invoice) {
      return res.status(404).json({
        error: "INVOICE_NOT_FOUND",
        message: `Invoice with externalId=${externalId} not found`,
      });
    }

    res.json(invoice);
  } catch (err) {
    console.error("invoice/search error:", err.message);
    res.status(500).json({ error: "Internal error", message: err.message });
  }
});

module.exports = router;
