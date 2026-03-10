const crypto = require("crypto");
const functions = require("@google-cloud/functions-framework");

functions.http("celigoReceiver", async (req, res) => {
  const { CELIGO_WEBHOOK_URL, HMAC_SECRET } = process.env;

  if (!CELIGO_WEBHOOK_URL || !HMAC_SECRET) {
    const msg = "Missing required env vars: CELIGO_WEBHOOK_URL and/or HMAC_SECRET";
    console.error(msg);
    return res.status(500).json({ success: false, error: msg });
  }

  const payload = {
    orderId: "PO-2026-00142",
    customerName: "Acme Corp",
    items: [
      { sku: "WIDGET-A", description: "Widget Alpha", quantity: 25, unitPrice: 14.5 },
      { sku: "GADGET-B", description: "Gadget Beta", quantity: 10, unitPrice: 32.0 },
    ],
    total: 682.5,
    currency: "USD",
    createdAt: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);

  const signature = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(body)
    .digest("hex");

  try {
    const response = await fetch(CELIGO_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-celigo-signature": signature,
      },
      body,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `Celigo responded with status ${response.status}: ${responseBody}`
      );
    }

    const data = await response.text();
    console.log("Celigo webhook call succeeded:", data);

    return res.status(200).json({
      success: true,
      message: "Payload sent and accepted by Celigo",
      celigoStatus: response.status,
    });
  } catch (error) {
    console.error("Failed to send payload to Celigo:", error.message || error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error while calling Celigo webhook",
    });
  }
});
