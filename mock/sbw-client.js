const https = require("https");

let cachedToken = null;
let tokenExpiresAt = 0;

const config = {
  tokenUrl: null,
  apiBase: null,
  secureBase: null,
  clientId: null,
  clientSecret: null,
};

function init(opts) {
  config.tokenUrl = opts.tokenUrl || "https://api.s4bdigital.net/account/oauth/token";
  config.apiBase = opts.apiBase || "https://api.s4bdigital.net";
  config.secureBase = opts.secureBase || "https://secure.s4bdigital.net";
  config.clientId = opts.clientId;
  config.clientSecret = opts.clientSecret;
}

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOpts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = https.request(reqOpts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Request timeout")); });

    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getToken() {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("SBW not configured: missing clientId/clientSecret");
  }

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }).toString();

  const res = await httpRequest(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (res.data.error) {
    throw new Error(`SBW token error: ${res.data.error}`);
  }

  cachedToken = res.data.access_token;
  tokenExpiresAt = Date.now() + (res.data.expires_in - 60) * 1000;
  console.log(`SBW token obtained, expires in ${res.data.expires_in}s`);
  return cachedToken;
}

async function apiGet(url) {
  const token = await getToken();
  const res = await httpRequest(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  return res;
}

async function getUser(userId) {
  const q = encodeURIComponent(`userid:${userId},exactsearch:true,casesensitive:true`);
  const url = `${config.apiBase}/account/v2/user/?q=${q}&start=0&limit=1`;
  const res = await apiGet(url);

  if (res.status !== 200 || !res.data.userAccounts?.length) {
    return null;
  }
  return res.data.userAccounts[0];
}

async function getDocument(entityId, categoryId = 2) {
  const url = `${config.secureBase}/account/v2/document/?entityId=${entityId}&categoryId=${categoryId}`;
  const res = await apiGet(url);
  if (res.status !== 200) return null;
  return res.data;
}

async function getCommercialProject(projectId) {
  const q = encodeURIComponent(`id:${projectId}`);
  const url = `${config.apiBase}/auction-lotting/commercial-project/?q=${q}`;
  const res = await apiGet(url);

  if (res.status !== 200 || !res.data.elements?.length) {
    return null;
  }
  return res.data.elements[0];
}

async function getTax(offerId, lotNumber, gestorId) {
  const url = `${config.secureBase}/tax/offer/${offerId}/lot/${lotNumber}/gestor/${gestorId}`;
  const res = await apiGet(url);
  if (res.status !== 200) return null;
  return res.data;
}

function extractUserData(user) {
  if (!user) return null;

  const info = user.basicInfo || {};
  const addr = user.addresses?.[0] || {};
  const phone = user.phones?.find((p) => p.type === 3) || user.phones?.[0];
  const cpfDoc = user.documents?.find((d) => ["cpf", "cuit", "rut", "nit", "ruc"].includes(d.typeName?.toLowerCase()));

  return {
    fullName: info.fullName,
    firstName: info.firstName,
    lastName: info.lastName,
    email: info.email?.address,
    phone: phone?.fullPhoneNumber || null,
    countryCode: info.countryCode,
    currency: user.profile?.currency,
    isPerson: user.type === "F",
    docNumber: cpfDoc?.number || null,
    docType: cpfDoc?.typeName?.toUpperCase() || null,
    address: addr.addressLine1
      ? {
          line1: [addr.addressLine1, addr.number].filter(Boolean).join(" "),
          line2: addr.addressLine2 || null,
          city: addr.city,
          state: addr.stateAcronyms || addr.state,
          zip: addr.zipCode,
          country: addr.countryIsoKey,
          district: addr.district,
        }
      : null,
  };
}

module.exports = { init, getToken, getUser, getDocument, getCommercialProject, getTax, extractUserData };
