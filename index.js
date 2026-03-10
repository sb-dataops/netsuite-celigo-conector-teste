const crypto = require("crypto");
const express = require("express");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/webhook/celigo", async (req, res) => {
  const { CELIGO_WEBHOOK_URL, HMAC_SECRET } = process.env;

  if (!CELIGO_WEBHOOK_URL || !HMAC_SECRET) {
    const msg = "Missing required env vars: CELIGO_WEBHOOK_URL and/or HMAC_SECRET";
    console.error(msg);
    return res.status(500).json({ success: false, error: msg });
  }

  const payload = req.body;

  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({
      success: false,
      error: "Request body is empty. Send a JSON payload via POST.",
    });
  }

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`celigo-receiver listening on port ${PORT}`);
});
