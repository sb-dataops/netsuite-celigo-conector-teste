const { Router } = require("express");
const { store } = require("../store");

const router = Router();

router.post("/", (req, res) => {
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

  const existing = store.findByExternalId("invoice", data.externalId);
  if (existing) {
    return res.status(409).json({
      error: "DUPLICATE_INVOICE",
      message: `Invoice with externalId=${data.externalId} already exists (internalId=${existing.internalId})`,
    });
  }

  const subsidiary = store.findByField("subsidiary", "internalId", data.subsidiary);
  const countryIso = data.countryIso || (subsidiary ? subsidiary.country : "AR");
  const vatRate = store.VAT_RATES[countryIso] || 0.21;

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

  const invoice = store.add("invoice", {
    externalId: data.externalId,
    recordType: "invoice",
    trandate: data.trandate,
    entity: data.entity,
    subsidiary: data.subsidiary,
    currency: data.currency,
    job: data.job,
    custbody_seller_vendor: data.custbody_seller_vendor,
    custbody_auction_ref: data.custbody_auction_ref,
    custbody_lot_reference: data.custbody_lot_reference,
    custbody_finley_sale_id: data.custbody_finley_sale_id,
    custbody_finley_status: data.custbody_finley_status,
    countryIso,
    lines: processedLines,
    subtotal,
    taxTotal,
    total,
    taxDetails: [
      {
        taxType: "VAT",
        taxCode: `VAT-${countryIso}`,
        taxRate: vatRate * 100,
        taxAmount: taxTotal,
      },
    ],
    status: "open",
  });

  console.log(`Invoice CREATED: ${data.externalId} → internalId=${invoice.internalId} | subtotal=${subtotal} | VAT(${vatRate * 100}%)=${taxTotal} | total=${total}`);

  res.status(201).json({
    internalId: invoice.internalId,
    externalId: invoice.externalId,
    recordType: "invoice",
    operation: "created",
    trandate: invoice.trandate,
    subtotal,
    taxTotal,
    total,
    taxDetails: invoice.taxDetails,
    lines: processedLines,
  });
});

router.get("/search", (req, res) => {
  const { externalId } = req.query;

  if (!externalId) {
    return res.status(400).json({ error: "externalId query param is required" });
  }

  const invoice = store.findByExternalId("invoice", externalId);

  if (!invoice) {
    return res.status(404).json({
      error: "INVOICE_NOT_FOUND",
      message: `Invoice with externalId=${externalId} not found`,
    });
  }

  res.json(invoice);
});

module.exports = router;
