const { Router } = require("express");
const db = require("../db");
const sbw = require("../sbw-client");

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { sale } = req.body;

    if (!sale) {
      return res.status(400).json({ error: "Missing 'sale' object in payload" });
    }

    const steps = [];
    const errors = [];
    const enrichment = {};

    // ── Step 0: Enrich from Superbid API ─────────────────────
    let buyerData = null;
    let sellerData = null;
    let projectData = null;
    let taxData = null;
    const sbwEnabled = !!process.env.SBW_CLIENT_ID;

    try {
      if (!sbwEnabled) throw new Error("SBW not configured, skipping enrichment");
      const [buyerUser, sellerUser] = await Promise.all([
        sale.buyer?.id ? sbw.getUser(sale.buyer.id) : null,
        sale.seller?.id ? sbw.getUser(sale.seller.id) : null,
      ]);

      buyerData = sbw.extractUserData(buyerUser);
      sellerData = sbw.extractUserData(sellerUser);

      if (buyerData) enrichment.buyer = buyerData;
      if (sellerData) enrichment.seller = sellerData;

      const [projResult, buyerDoc, sellerDoc] = await Promise.all([
        sale.eventProject?.id ? sbw.getCommercialProject(sale.eventProject.id) : null,
        sale.buyer?.id ? sbw.getDocument(sale.buyer.id, 2) : null,
        sale.seller?.id ? sbw.getDocument(sale.seller.id, 2) : null,
      ]);

      projectData = projResult;
      if (projectData) enrichment.project = projectData;

      if (buyerDoc?.documentNumber && buyerData) {
        buyerData.docNumber = buyerData.docNumber || buyerDoc.documentNumber;
        buyerData.docType = buyerData.docType || buyerDoc.typeName?.toUpperCase();
        enrichment.buyerDocument = buyerDoc;
      }
      if (sellerDoc?.documentNumber && sellerData) {
        sellerData.docNumber = sellerData.docNumber || sellerDoc.documentNumber;
        sellerData.docType = sellerData.docType || sellerDoc.typeName?.toUpperCase();
        enrichment.sellerDocument = sellerDoc;
      }

      if (sale.id && sale.offer?.lotNumber && sale.eventManager?.id) {
        taxData = await sbw.getTax(sale.id, sale.offer.lotNumber, sale.eventManager.id);
        if (taxData && taxData.id !== null) {
          enrichment.tax = taxData;
        } else {
          taxData = null;
        }
      }

      steps.push({
        step: 0,
        name: "Enrich from Superbid",
        status: "completed",
        buyerEnriched: !!buyerData,
        sellerEnriched: !!sellerData,
        projectEnriched: !!projectData,
        taxEnriched: !!taxData,
      });
    } catch (err) {
      errors.push({ step: 0, name: "Enrich from Superbid", error: err.message });
      steps.push({ step: 0, name: "Enrich from Superbid", status: "partial", error: err.message });
    }

    // ── Step 1: Resolve Subsidiary ───────────────────────────
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

    // ── Step 2: Upsert Customer (Buyer) ──────────────────────
    let customer;
    try {
      const custData = {
        entityId: String(sale.buyer.id),
        companyName: buyerData?.fullName || sale.buyer.name,
        firstName: buyerData?.firstName || null,
        lastName: buyerData?.lastName || null,
        isPerson: buyerData?.isPerson ?? true,
        subsidiary: subsidiary.internalId,
        country: buyerData?.countryCode || sale.event?.locale?.countryIso,
        currency: buyerData?.currency || sale.event?.locale?.currency,
        docNumber: buyerData?.docNumber || sale.buyer.docNumber,
        identityDocType: buyerData?.docType || sale.buyer.identitydoctype,
        email: buyerData?.email || null,
        phone: buyerData?.phone || null,
        address: buyerData?.address || null,
        status: "Active",
      };
      const result = await db.upsert("customer", String(sale.buyer.id), custData);
      customer = result.record;
      steps.push({ step: 2, name: "Upsert Customer", internalId: customer.internalId, operation: result.created ? "created" : "updated", enriched: !!buyerData });
    } catch (err) {
      errors.push({ step: 2, name: "Upsert Customer", error: err.message });
    }

    // ── Step 3: Upsert Vendor (Seller) ───────────────────────
    let vendor;
    try {
      const vendData = {
        companyName: sellerData?.fullName || sale.seller.name,
        first_name: sellerData?.firstName || null,
        last_name: sellerData?.lastName || null,
        is_person: sellerData?.isPerson ?? false,
        subsidiary: subsidiary.internalId,
        country: sellerData?.countryCode || sale.event?.locale?.countryIso,
        currency: sellerData?.currency || null,
        docNumber: sellerData?.docNumber || sale.seller.docNumber,
        identityDocType: sellerData?.docType || null,
        email: sellerData?.email || null,
        phone: sellerData?.phone || null,
        address: sellerData?.address || null,
        category: "Vendedor",
        status: "Active",
      };
      const result = await db.upsert("vendor", `vndr_${sale.seller.id}`, vendData);
      vendor = result.record;
      steps.push({ step: 3, name: "Upsert Vendor", internalId: vendor.internalId, operation: result.created ? "created" : "updated", enriched: !!sellerData });
    } catch (err) {
      errors.push({ step: 3, name: "Upsert Vendor", error: err.message });
    }

    // ── Step 4: Upsert Project ───────────────────────────────
    let project;
    try {
      const projData = {
        projectName: projectData?.description || sale.eventProject.desc,
        startDate: sale.eventProject.creationDate,
        end_date: projectData?.closeAt ? projectData.closeAt.split("T")[0] : null,
        subsidiary: subsidiary.internalId,
        department: String(sale.eventProject.businessUnitNumber),
        class: String(sale.eventProject.businessSegmentNumber),
        custentity_finley_country_iso: sale.eventManager?.countryIso,
        sbw_owner_id: projectData?.ownerId || null,
        sbw_store_id: projectData?.storeId || null,
      };
      const result = await db.upsert("project", String(sale.eventProject.id), projData);
      project = result.record;
      steps.push({ step: 4, name: "Upsert Project", internalId: project.internalId, operation: result.created ? "created" : "updated", enriched: !!projectData });
    } catch (err) {
      errors.push({ step: 4, name: "Upsert Project", error: err.message });
    }

    // ── Step 5: Upsert Auction ───────────────────────────────
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

    // ── Step 6: Upsert Lot ───────────────────────────────────
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

    // ── Step 7: Resolve Items ────────────────────────────────
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

    // ── Step 8: Create Invoice ───────────────────────────────
    if (!customer || !subsidiary || resolvedItems.length === 0) {
      return res.status(422).json({
        status: "error",
        message: "Cannot create invoice: missing required entities",
        steps,
        errors,
        enrichment,
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
      sbw_tax_data: taxData || null,
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

    console.log(`ORCHESTRATE: ${invoiceExtId} → internalId=${invoice.internalId} | ${steps.length} steps | ${errors.length} errors | enriched=${!!buyerData}`);

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
        customer: { internalId: customer.internalId, name: customer.companyName, email: customer.email, enriched: !!buyerData },
        vendor: vendor ? { internalId: vendor.internalId, name: vendor.companyName, enriched: !!sellerData } : null,
        project: project ? { internalId: project.internalId, name: project.projectName, enriched: !!projectData } : null,
        auction: auction ? { internalId: auction.internalId, name: auction.name } : null,
        lot: lot ? { internalId: lot.internalId, externalId: lot.externalId } : null,
      },
      enrichment,
      steps,
      errors,
    });
  } catch (err) {
    console.error("orchestrate error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
