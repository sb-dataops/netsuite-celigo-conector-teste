# SBW API Reference Guide — Celigo Integration (Phase 1)

> **Technical documentation for the implementation team (BringIT/Celigo)**
> Reference: DT-11853 SuperBid: FINLEY - CELIGO - NETSUITE INTEGRATION SPEC (Phase 1)

---

## 1. Introduction

This document accompanies the **Postman collection `sbws`** and describes the SBW (SuperBid Web) APIs available for the Celigo team to query platform data during the development of integration flows towards NetSuite.

The APIs documented here are **live SBW endpoints** in the staging environment. No mock service is required — all queries are executed directly against the platform.

### Scope of These APIs

These APIs provide the source data that Celigo needs to:

- Resolve **Buyer (Customer)** and **Seller (Vendor)** data — spec Steps 3 & 4
- Query **Commercial Project / Event Project** data — spec Step 5
- Retrieve **identity documents** (Tax ID, docTypeId) for entity classification logic — spec Appendix A
- Query **tax calculation (TAX/VAT)** — spec Step 10

---

## 2. Environments

| Environment | API Base URL | Secure Base URL |
|-------------|-------------|-----------------|
| **Staging (STG)** | `https://stgapi.s4bdigital.net` | `https://stgsecure.s4bdigital.net` |
| **Production (PRD)** | `https://api.s4bdigital.net` | `https://secure.s4bdigital.net` |

For development and testing, use exclusively the **Staging (STG)** environment.

---

## 3. Authentication

All APIs require a JWT token obtained via **OAuth 2.0 Client Credentials**.

### 3.1 Obtain Token — Staging

```
POST https://stgapi.s4bdigital.net/account/oauth/token
Content-Type: application/x-www-form-urlencoded
```

**Body (form-urlencoded):**

| Parameter | Value |
|-----------|-------|
| `grant_type` | `client_credentials` |
| `client_id` | *(provided in the Postman collection)* |
| `client_secret` | *(provided in the Postman collection)* |

**Successful response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 3.2 Using the Token

Include the token in the `Authorization` header of every subsequent request:

```
Authorization: Bearer {access_token}
```

### 3.3 Postman Variables

The collection includes a **test script** that automatically stores the token in the global variable `stg_jwt_token_celigo` (staging) or `prd_jwt_token_celigo` (production). All other requests reference these variables via `{{stg_jwt_token_celigo}}`.

**Recommended workflow:** Always execute the "Create Token" request first before making any other request.

---

## 4. Available Endpoints

### 4.1 User (Buyer / Seller) — Individual (PF) & Company (PJ)

Retrieves full user data from the platform. Depending on the entity type, the user can be an Individual (Persona Fisica) or a Company (Persona Juridica).

```
GET https://stgapi.s4bdigital.net/account/v2/user/
```

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Query Parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Search filter. Format: `userid:{id},exactsearch:true,casesensitive:true` | `userid:696295,exactsearch:true,casesensitive:true` |
| `start` | Pagination offset | `0` |
| `limit` | Maximum number of results | `50` |

> **Note:** Values in the `q` parameter must be URL-encoded. They are already encoded in the Postman collection.

**Mapping to the Integration Spec:**

| SBW Response Field | Finley Tag (Spec) | NetSuite Usage |
|--------------------|-------------------|----------------|
| `id` | `buyer.id` / `seller.id` | `externalId`, `entityId` |
| `name` | `buyer.name` / `seller.name` | `companyName`, `firstName`, `lastName` |
| `email` | `buyer.email` | `email` |
| `phone` | `buyer.phone` | `phone` |
| `docNumber` | `buyer.docNumber` / `seller.docNumber` | BIT – Identity Document Number |
| `docTypeId` | `identitydoctype` | BIT – Identity Document Type |
| `address.*` | `buyer.address.*` | Address1_line1, Address1_city, etc. |

---

### 4.2 Commercial Project (Event Project)

Retrieves commercial project / auction event data.

```
GET https://stgapi.s4bdigital.net/auction-lotting/commercial-project/
```

**Headers:**

| Header | Value |
|--------|-------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Query Parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Filter by project ID. Format: `id:{projectId}` | `id:700427` |

**Mapping to the Integration Spec:**

| SBW Response Field | Finley Tag (Spec) | NetSuite Usage |
|--------------------|-------------------|----------------|
| `id` | `sale.eventProject.id` | `externalId` (Project) |
| `description` | `sale.eventProject.desc` | `Project Name` |
| `creationDate` | `sale.eventProject.creationDate` | `Start Date` |
| `businessUnitNumber` | `sale.eventProject.businessUnitNumber` | `Department` |
| `businessSegmentNumber` | `sale.eventProject.businessSegmentNumber` | `Class` |
| `businessUnitId` | `sale.eventProject.businessUnitId` | `custentity_finley_business_unit_id` |
| `businessSegmentId` | `sale.eventProject.businessSegmentId` | `custentity_finley_business_segment_id` |
| `isIntegrated` | `sale.eventProject.isIntegrated` | `custentity_finley_integrated_flag` |
| `platformProject` | `sale.eventProject.platformProject` | `custentity_finley_platform_project` |

---

### 4.3 Document (Identity / Tax Documents)

Retrieves documents associated with an entity. Used to obtain tax documents (Tax ID, document type) required for the entity classification logic described in Appendix A of the spec.

```
GET https://stgsecure.s4bdigital.net/account/v2/document/
```

> **Note:** This endpoint uses the `stgsecure` domain (not `stgapi`).

**Headers:**

| Header | Value |
|--------|-------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Query Parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `entityId` | Entity (user) ID | `1100669` |
| `categoryId` | Document category (2 = tax/fiscal documents) | `2` |

**Mapping to the Integration Spec:**

| SBW Response Field | Finley Tag (Spec) | NetSuite Usage |
|--------------------|-------------------|----------------|
| `docNumber` | `buyer.docNumber` / `seller.docNumber` | BIT – Identity Document Number |
| `docTypeId` | `identitydoctype` | BIT – Identity Document Type |
| `docTypeName` | (reference) | Fallback for document type mapping |

**Relevance to Appendix A (Customer Identity & Classification Logic):**

This endpoint provides the data required to:
1. Normalize the `DocNumber` (trim, remove formatting, uppercase)
2. Extract Identity Number and Verified Digit (DV)
3. Determine whether the entity is Individual or Company based on country rules:
   - **AR:** CUIT prefix 20,23,24,25,26,27 = Individual; 30,33,34 = Company
   - **CL:** RUT base < 50,000,000 = Individual; >= 50,000,000 = Company
   - **CO:** CC,CE,TI,PP = Individual; NIT = Company
   - **PE:** DNI = Individual; RUC prefix 20 = Company; RUC prefix 10,15,17 = Individual

---

### 4.4 TAX (Tax Calculation)

Retrieves tax calculation (VAT/IVA) for a specific offer/lot.

```
GET https://stgsecure.s4bdigital.net/tax/offer/{offerId}/lot/{lotNumber}/gestor/{gestorId}
```

> **Note:** The example in the Postman collection points to production (`secure.s4bdigital.net`). For testing, use `stgsecure.s4bdigital.net` with the staging token.

**Headers:**

| Header | Value |
|--------|-------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Path Parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `offerId` | Offer ID | `4567661` |
| `lotNumber` | Lot number | `1` |
| `gestorId` | Event manager / gestor ID | `27` |

**Mapping to the Integration Spec:**

This endpoint corresponds to **Step 10: Tax Calculation** in the spec. In the final integration, NetSuite calculates taxes via SuiteTax, but this endpoint allows validation of tax values from the SBW side.

| SBW Response Field | Integration Usage |
|--------------------|-------------------|
| VAT/IVA amount | Comparison with NetSuite calculation |
| Tax breakdown | Validation of country-specific tax rules |

---

## 5. General Mapping: SBW APIs vs Integration Flow

The following table shows how each SBW API maps to the integration flow steps defined in the spec:

| Spec Step | Description | SBW API |
|-----------|-------------|---------|
| Step 2 | Resolve Subsidiary (Event Manager) | *Payload data — `sale.eventManager.entityId`* |
| Step 3 | Resolve/Create Buyer (Customer) | **User PF/PJ** — `/account/v2/user/` |
| Step 4 | Resolve/Create Seller (Vendor) | **User PF/PJ** — `/account/v2/user/` |
| Step 5 | Resolve/Create Project | **Commercial Project** — `/auction-lotting/commercial-project/` |
| Step 6 | Resolve/Create Auction | *Payload data — `sale.event.*`* |
| Step 7 | Resolve/Create Lot | *Payload data — `sale.offer.lotNumber`* |
| Step 8 | Validate/Resolve Items | *Payload data — `sale.entries[].itemTypeId`* |
| Step 9 | Create Transaction | *NetSuite operation* |
| Step 10 | Tax Calculation | **TAX** — `/tax/offer/{offerId}/lot/{lotNumber}/gestor/{gestorId}` |
| Appendix A | Customer Identity Classification | **Document** — `/account/v2/document/` |

> Fields marked as "Payload data" are sent directly by Finley in the transaction payload and do not require additional queries to SBW.

---

## 6. Query String Format

SBW APIs use a specific format for filters in the `q` parameter:

```
q=field1:value1,field2:value2
```

Examples:
- Search user by exact ID: `q=userid:696295,exactsearch:true,casesensitive:true`
- Search project by ID: `q=id:700427`

Values must be **URL-encoded** when sent in the URL:
- `:` → `%3A`
- `,` → `%2C`

---

## 7. Supported Countries (Phase 1)

| Country | ISO | Currency | Transaction Type |
|---------|-----|----------|------------------|
| Argentina | AR | ARS | Invoice (standalone) |
| Chile | CL | CLP | Sales Order → Invoice |
| Colombia | CO | COP | Sales Order → Invoice |
| Peru | PE | PEN | Invoice (standalone) |

---

## 8. Important Notes

1. **Mock Service:** Not required. Staging APIs are available for direct queries.

2. **Credentials:** The `client_id` and `client_secret` for staging are included in the Postman collection. These credentials are exclusive to the Celigo integration.

3. **Token expiration:** Tokens have a limited lifetime (`expires_in` in the response). Renew the token before it expires by re-executing the "Create Token" request.

4. **Rate limiting:** APIs have rate limits. For development and testing, individual queries should not encounter issues.

5. **`secure` vs `api` domain:** Some endpoints use the `stgsecure` subdomain instead of `stgapi`. Verify the base URL for each request in the Postman collection.

6. **Pagination:** Search endpoints support pagination via `start` and `limit`.

---

## 9. How to Use the Postman Collection

1. **Import** the file `sbws.postman_collection.json` into Postman.
2. **Execute "Create Token"** to obtain the staging JWT. The token is automatically stored in the global variable `stg_jwt_token_celigo`.
3. **Explore the endpoints** in order:
   - `user PF` / `user PJ` — Query buyer and seller data
   - `commercial-project` — Query commercial project data
   - `document` — Retrieve tax/identity documents
   - `TAX` — Query tax calculations
4. **Modify the parameters** in each request as needed with the test IDs you want to validate.

### Requests Included in the Collection

| # | Name | Method | Description |
|---|------|--------|-------------|
| 1 | Create Token | POST | OAuth2 authentication — STG environment |
| 2 | Create Token PRD | POST | OAuth2 authentication — PRD environment (do not use for development) |
| 3 | user PF | GET | User query — Individual (Persona Fisica) |
| 4 | user PJ | GET | User query — Company (Persona Juridica) |
| 5 | commercial-project | GET | Commercial project query |
| 6 | document | GET | Identity/tax document query |
| 7 | TAX | GET | Tax calculation query |
