const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

function getAuthorizedClients() {
  const raw = process.env.AUTHORIZED_CLIENTS;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error("AUTHORIZED_CLIENTS is not valid JSON");
    return null;
  }
}

function authenticateToken(req, res, next) {
  const jwtSecret = process.env.JWT_SIGNING_KEY;
  if (!jwtSecret) {
    return res.status(500).json({ success: false, error: "JWT signing key not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing or invalid Authorization header. Use: Bearer <token>" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.clientId = decoded.sub;
    next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ success: false, error: message });
  }
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/auth/token", (req, res) => {
  const { client_id, client_secret } = req.body;

  if (!client_id || !client_secret) {
    return res.status(400).json({ success: false, error: "client_id and client_secret are required" });
  }

  const clients = getAuthorizedClients();
  if (!clients) {
    return res.status(500).json({ success: false, error: "Authorized clients not configured" });
  }

  if (clients[client_id] !== client_secret) {
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }

  const jwtSecret = process.env.JWT_SIGNING_KEY;
  if (!jwtSecret) {
    return res.status(500).json({ success: false, error: "JWT signing key not configured" });
  }

  const expiresIn = 3600;
  const token = jwt.sign({ sub: client_id }, jwtSecret, { expiresIn });

  console.log(`Token issued for client: ${client_id}`);
  return res.status(200).json({ success: true, token, expires_in: expiresIn });
});

app.post("/webhook/celigo", authenticateToken, async (req, res) => {
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
    console.log(`Celigo webhook call succeeded (client: ${req.clientId}):`, data);

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
