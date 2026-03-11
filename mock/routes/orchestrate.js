const { Router } = require("express");
const db = require("../db");

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { sale } = req.body;

    if (!sale) {
      return res.status(400).json({ error: "Missing 'sale' object in payload" });
    }

    const steps = [];
    const errors = [];

    // Step 1: Resolve Subsidiary
    const subsidiaryResults = await db.searchByField(
      "subsidiary",
      "custrecord_finley_entity_id",
      sale.eventManager?.entityId
    );
    const subsidiary = subsidiaryResults.find((r) => r.status === "Active");

    if (!subsidiary) {
      return res.status(422).json({
        error: "SUBSIDIARY_NOT_FOUND",
        message: `No active subsidiary for entityId=${sale.eventManager?.entityId}`,
        step: "Resolve Subsidiary",
      });
    }
    steps.push({ step: 1, name: "Resolve Subsidiary", internalId: subsidiary.internalId, status: "resolved" });

    // Step 2: Upsert Customer (Buyer)
    let customer;
    try {
      const result = await db.upsert("customer", String(sale.buyer.id), {
        entityId: String(sale.buyer.id),
        companyName: sale.buyer.name,
        isPerson: true,
        subsidiary: subsidiary.internalId,
        country: sale.event?.locale?.countryIso,
        currency: sale.event?.locale?.currency,
        docNumber: sale.buyer.docNumber,
        identityDocType: sale.buyer.identitydoctype,
        status: "Active",
      });
      customer = result.record;
      steps.push({ step: 2, name: "Upsert Customer", internalId: customer.internalId, operation: result.created ? "created" : "updated" });
    } catch (err) {
      errors.push({ step: 2, name: "Upsert Customer", error: err.message });
    }

    // Step 3: Upsert Vendor (Seller)
    let vendor;
    try {
      const result = await db.upsert("vendor", `vndr_${sale.seller.id}`, {
        companyName: sale.seller.name,
        subsidiary: subsidiary.internalId,
        country: sale.event?.locale?.countryIso,
        docNumber: sale.seller.docNumber,
        category: "Vendedor",
        status: "Active",
      });
      vendor = result.record;
      steps.push({ step: 3, name: "Upsert Vendor", internalId: vendor.internalId, operation: result.created ? "created" : "updated" });
    } catch (err) {
      errors.push({ step: 3, name: "Upsert Vendor", error: err.message });
    }

    // Step 4: Upsert Project
    let project;
    try {
      const result = await db.upsert("project", String(sale.eventProject.id), {
        projectName: sale.eventProject.desc,
        startDate: sale.eventProject.creationDate,
        subsidiary: subsidiary.internalId,
        department: String(sale.eventProject.businessUnitNumber),
        class: String(sale.eventProject.businessSegmentNumber),
        custentity_finley_country_iso: sale.eventManager?.countryIso,
      });
      project = result.record;
      steps.push({ step: 4, name: "Upsert Project", internalId: project.internalId, operation: result.created ? "created" : "updated" });
    } catch (err) {
      errors.push({ step: 4, name: "Upsert Project", error: err.message });
    }

    // Step 5: Upsert Auction
    let auction;
    try {
      const result = await db.upsert("auction", String(sale.event.id), {
        name: sale.event.description,
        custrecord_finley_event_id: String(sale.event.id),
        custrecord_auction_end_date: sale.event.endDate,
        custrecord_auction_currency_code: sale.event?.locale?.currency,
        custrecord_auction_locale: sale.event?.locale?.acronym,
        custrecord_auction_parent_project: project?.internalId,
        custrecord_auction_subsidiary_ref: subsidiary.internalId,
      });
      auction = result.record;
      steps.push({ step: 5, name: "Upsert Auction", internalId: auction.internalId, operation: result.created ? "created" : "updated" });
    } catch (err) {
      errors.push({ step: 5, name: "Upsert Auction", error: err.message });
    }

    // Step 6: Upsert Lot
    let lot;
    try {
      const lotExtId = `LOT-${sale.id}-${sale.offer?.lotNumber || 1}`;
      const result = await db.upsert("lot", lotExtId, {
        custrecord_lot_number: String(sale.offer?.lotNumber || 1),
        custrecord_lot_auction: auction?.internalId,
        custrecord_lot_project: project?.internalId,
        custrecord_lot_seller_vendor: vendor?.internalId,
        custrecord_lot_buyer_customer: customer?.internalId,
      });
      lot = result.record;
      steps.push({ step: 6, name: "Upsert Lot", internalId: lot.internalId, operation: result.created ? "created" : "updated" });
    } catch (err) {
      errors.push({ step: 6, name: "Upsert Lot", error: err.message });
    }

    // Step 7: Resolve Items
    const resolvedItems = [];
    for (const entry of sale.entries || []) {
      const item = await db.findByExternalId("item", String(entry.itemTypeId));
      if (item) {
        resolvedItems.push({ ...item, entryId: entry.id, rate: entry.itemValue, amount: entry.itemTotalValue, description: entry.itemTypeDescription });
      } else {
        errors.push({ step: 7, name: "Resolve Item", error: `Item externalId=${entry.itemTypeId} not found` });
      }
    }
    steps.push({ step: 7, name: "Resolve Items", count: resolvedItems.length, status: "resolved" });

    // Step 8: Create Invoice
    if (!customer || !subsidiary || resolvedItems.length === 0) {
      return res.status(422).json({
        status: "error",
        message: "Cannot create invoice: missing required entities",
        steps,
        errors,
      });
    }

    const countryIso = sale.event?.locale?.countryIso || "AR";
    const vatRate = db.VAT_RATES[countryIso] || 0.21;

    const processedLines = resolvedItems.map((item, idx) => {
      const amount = item.amount || item.rate;
      const lineTax = Math.round(amount * vatRate * 100) / 100;
      return {
        lineNumber: idx + 1,
        item: item.internalId,
        description: item.description,
        rate: item.rate,
        quantity: 1,
        amount,
        taxAmount: lineTax,
        custcol_finley_entry_id: String(item.entryId),
      };
    });

    const subtotal = processedLines.reduce((sum, l) => sum + l.amount, 0);
    const taxTotal = processedLines.reduce((sum, l) => sum + l.taxAmount, 0);
    const total = Math.round((subtotal + taxTotal) * 100) / 100;

    const firstEntry = sale.entries[0];
    const invoiceExtId = `INV-${sale.id}-${firstEntry.id}`;

    const existingInvoice = await db.findByExternalId("invoice", invoiceExtId);
    if (existingInvoice) {
      return res.status(409).json({
        status: "duplicate",
        message: `Invoice ${invoiceExtId} already exists`,
        internalId: existingInvoice.internalId,
        externalId: existingInvoice.externalId,
      });
    }

    const taxDetails = [{
      taxType: "VAT",
      taxCode: `VAT-${countryIso}`,
      taxRate: vatRate * 100,
      taxAmount: taxTotal,
    }];

    const invoice = await db.add("invoice", {
      externalId: invoiceExtId,
      trandate: sale.createdAt,
      entity: customer.internalId,
      subsidiary: subsidiary.internalId,
      currency: sale.event?.locale?.currency,
      countryIso,
      job: project?.internalId,
      custbody_seller_vendor: vendor?.internalId,
      custbody_auction_ref: auction?.internalId,
      custbody_lot_reference: lot?.internalId,
      custbody_finley_sale_id: String(sale.id),
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
      await db.getClient().from("invoice_lines").insert(lineRows);
    }

    steps.push({ step: 8, name: "Create Invoice", internalId: invoice.internalId, externalId: invoiceExtId });

    console.log(`ORCHESTRATE: ${invoiceExtId} → internalId=${invoice.internalId} | ${steps.length} steps | ${errors.length} errors`);

    res.status(201).json({
      status: "success",
      invoice: {
        internalId: invoice.internalId,
        externalId: invoiceExtId,
        subtotal,
        taxTotal,
        total,
        taxDetails,
        lines: processedLines,
      },
      entities: {
        subsidiary: { internalId: subsidiary.internalId, name: subsidiary.name, country: subsidiary.country },
        customer: { internalId: customer.internalId, name: customer.companyName },
        vendor: vendor ? { internalId: vendor.internalId, name: vendor.companyName } : null,
        project: project ? { internalId: project.internalId, name: project.projectName } : null,
        auction: auction ? { internalId: auction.internalId, name: auction.name } : null,
        lot: lot ? { internalId: lot.internalId, externalId: lot.externalId } : null,
      },
      steps,
      errors,
    });
  } catch (err) {
    console.error("orchestrate error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
