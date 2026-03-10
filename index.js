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
    sale: {
      id: 1350470,
      createdAt: "2026-01-26",
      statusDesc: "Aberto",

      buyer: {
        id: 1575533,
        name: "Horacio Maximiliano Iervasi",
        docNumber: "20288996653",
        identitydoctype: "CUIT",
        email: null,
        phone: null,
      },

      seller: {
        id: 1307093,
        name: "JUNCAL SA",
        docNumber: "30709876543",
      },

      eventManager: {
        id: 10,
        entityId: 134114,
        countryIso: "AR",
        erpKey: "s4b-erp",
      },

      eventProject: {
        id: 1189437,
        desc: "NARVAEZ BID - 30707001786 INTERDINAMICA S.A.",
        creationDate: "2025-09-17T13:23:18",
        businessUnitNumber: 100,
        businessSegmentNumber: 88,
        businessUnitId: 176,
        businessSegmentId: 105,
        isIntegrated: false,
        platformProject: true,
      },

      event: {
        id: 776656,
        description: "INTERDINAMICA",
        modalityId: 1,
        endDate: "2026-01-15T14:00:00.000+0000",
        auctioneerId: 1570891,
        eventManagerContactEmail: null,
        locale: {
          acronym: "es_AR",
          description: "Espanhol - Argentina",
          currency: "ARS",
          countryIso: "AR",
        },
        city: null,
        state: null,
      },

      offer: {
        lotNumber: 27,
      },

      entries: [
        {
          id: 2894203,
          itemTypeId: 5,
          itemTypeDescription: "Encargos de Administracion",
          itemValue: 41400,
          itemTotalValue: 41400,
        },
        {
          id: 2894204,
          itemTypeId: 8,
          itemTypeDescription: "Comision del Martillero",
          itemValue: 12500,
          itemTotalValue: 12500,
        },
      ],

      entryGroups: [
        {
          id: 2894203,
          paymentDate: "2026-01-29",
          payee: { id: 134114 },
          paymentAccount: {
            methodDescription: "Deposito",
          },
        },
      ],
    },
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
