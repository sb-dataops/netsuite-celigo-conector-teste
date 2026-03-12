# SBW API Reference Guide — Celigo Integration (Phase 1)

> **Documento tecnico para el equipo implementador (BringIT/Celigo)**
> Referencia: DT-11853 SuperBid: FINLEY - CELIGO - NETSUITE INTEGRATION SPEC (Phase 1)

---

## 1. Introduccion

Este documento acompana la **Postman collection `sbws`** y describe las APIs de SBW (SuperBid Web) disponibles para que el equipo de Celigo pueda consultar datos de la plataforma durante el desarrollo de los flows de integracion hacia NetSuite.

Las APIs aqui documentadas son **endpoints reales de SBW** en ambiente de staging. No se requiere servicio mock alguno: las consultas se realizan directamente contra la plataforma.

### Alcance de estas APIs

Estas APIs permiten obtener los datos de origen (source data) que Celigo necesita para:

- Resolver datos de **Buyer (Customer)** y **Seller (Vendor)** — spec Steps 3 y 4
- Consultar datos de **Commercial Project / Event Project** — spec Step 5
- Obtener **documentos de identidad** (Tax ID, docTypeId) para la logica de clasificacion de entidades — spec Appendix A
- Consultar el **calculo de impuestos (TAX/IVA)** — spec Step 10

---

## 2. Ambientes

| Ambiente | Base URL API | Base URL Secure |
|----------|-------------|-----------------|
| **Staging (STG)** | `https://stgapi.s4bdigital.net` | `https://stgsecure.s4bdigital.net` |
| **Produccion (PRD)** | `https://api.s4bdigital.net` | `https://secure.s4bdigital.net` |

Para desarrollo y pruebas, usar exclusivamente el ambiente **Staging (STG)**.

---

## 3. Autenticacion

Todas las APIs requieren un token JWT obtenido via **OAuth 2.0 Client Credentials**.

### 3.1 Obtener Token — Staging

```
POST https://stgapi.s4bdigital.net/account/oauth/token
Content-Type: application/x-www-form-urlencoded
```

**Body (form-urlencoded):**

| Parametro | Valor |
|-----------|-------|
| `grant_type` | `client_credentials` |
| `client_id` | *(proporcionado en la Postman collection)* |
| `client_secret` | *(proporcionado en la Postman collection)* |

**Response exitoso:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 3.2 Uso del Token

Incluir el token en el header `Authorization` de cada request subsecuente:

```
Authorization: Bearer {access_token}
```

### 3.3 Variables en Postman

La collection incluye un **test script** que almacena automaticamente el token en la variable global `stg_jwt_token_celigo` (staging) o `prd_jwt_token_celigo` (produccion). Los demas requests referencian estas variables con `{{stg_jwt_token_celigo}}`.

**Flujo recomendado:** Ejecutar primero el request "Create Token" antes de cualquier otro request.

---

## 4. Endpoints Disponibles

### 4.1 User (Buyer / Seller) — Persona Fisica (PF) y Persona Juridica (PJ)

Consulta datos completos de un usuario de la plataforma. Segun el tipo de entidad, el usuario puede ser Persona Fisica (individual) o Persona Juridica (company).

```
GET https://stgapi.s4bdigital.net/account/v2/user/
```

**Headers:**

| Header | Valor |
|--------|-------|
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Query Parameters:**

| Parametro | Descripcion | Ejemplo |
|-----------|-------------|---------|
| `q` | Filtro de busqueda. Formato: `userid:{id},exactsearch:true,casesensitive:true` | `userid:696295,exactsearch:true,casesensitive:true` |
| `start` | Offset de paginacion | `0` |
| `limit` | Cantidad maxima de resultados | `50` |

> **Nota:** Los valores del parametro `q` deben estar URL-encoded. En Postman ya se encuentran codificados.

**Mapeo con el Integration Spec:**

| Campo SBW Response | Finley Tag (Spec) | Uso en NetSuite |
|---------------------|-------------------|-----------------|
| `id` | `buyer.id` / `seller.id` | `externalId`, `entityId` |
| `name` | `buyer.name` / `seller.name` | `companyName`, `firstName`, `lastName` |
| `email` | `buyer.email` | `email` |
| `phone` | `buyer.phone` | `phone` |
| `docNumber` | `buyer.docNumber` / `seller.docNumber` | BIT - Identity Document Number |
| `docTypeId` | `identitydoctype` | BIT - Identity Document Type |
| `address.*` | `buyer.address.*` | Address1_line1, Address1_city, etc. |

---

### 4.2 Commercial Project (Event Project)

Consulta datos de un proyecto comercial / evento de subasta.

```
GET https://stgapi.s4bdigital.net/auction-lotting/commercial-project/
```

**Headers:**

| Header | Valor |
|--------|-------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Query Parameters:**

| Parametro | Descripcion | Ejemplo |
|-----------|-------------|---------|
| `q` | Filtro por ID del proyecto. Formato: `id:{projectId}` | `id:700427` |

**Mapeo con el Integration Spec:**

| Campo SBW Response | Finley Tag (Spec) | Uso en NetSuite |
|---------------------|-------------------|-----------------|
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

### 4.3 Document (Documentos de Identidad / Tax)

Consulta documentos asociados a una entidad. Se utiliza para obtener los documentos fiscales (Tax ID, tipo de documento) necesarios para la logica de clasificacion de entidades descrita en el Appendix A del spec.

```
GET https://stgsecure.s4bdigital.net/account/v2/document/
```

> **Nota:** Este endpoint utiliza el dominio `stgsecure` (no `stgapi`).

**Headers:**

| Header | Valor |
|--------|-------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Query Parameters:**

| Parametro | Descripcion | Ejemplo |
|-----------|-------------|---------|
| `entityId` | ID de la entidad (usuario) | `1100669` |
| `categoryId` | Categoria del documento (2 = documentos fiscales) | `2` |

**Mapeo con el Integration Spec:**

| Campo SBW Response | Finley Tag (Spec) | Uso en NetSuite |
|---------------------|-------------------|-----------------|
| `docNumber` | `buyer.docNumber` / `seller.docNumber` | BIT - Identity Document Number |
| `docTypeId` | `identitydoctype` | BIT - Identity Document Type |
| `docTypeName` | (referencia) | Fallback para mapeo de tipo de documento |

**Relevancia para Appendix A (Customer Identity & Classification Logic):**

Este endpoint provee los datos necesarios para:
1. Normalizar el `DocNumber` (trim, remove formatting, uppercase)
2. Extraer Identity Number y Verified Digit (DV)
3. Determinar si es Individual o Company segun reglas por pais:
   - **AR:** CUIT prefix 20,23,24,25,26,27 = Individual; 30,33,34 = Company
   - **CL:** RUT base < 50,000,000 = Individual; >= 50,000,000 = Company
   - **CO:** CC,CE,TI,PP = Individual; NIT = Company
   - **PE:** DNI = Individual; RUC prefix 20 = Company; RUC prefix 10,15,17 = Individual

---

### 4.4 TAX (Calculo de Impuestos)

Consulta el calculo de impuestos (IVA/VAT) para una oferta/lot especifico.

```
GET https://stgsecure.s4bdigital.net/tax/offer/{offerId}/lot/{lotNumber}/gestor/{gestorId}
```

> **Nota:** En la Postman collection el ejemplo apunta a produccion (`secure.s4bdigital.net`). Para pruebas, usar `stgsecure.s4bdigital.net` con el token de staging.

**Headers:**

| Header | Valor |
|--------|-------|
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{stg_jwt_token_celigo}}` |

**Path Parameters:**

| Parametro | Descripcion | Ejemplo |
|-----------|-------------|---------|
| `offerId` | ID de la oferta | `4567661` |
| `lotNumber` | Numero de lote | `1` |
| `gestorId` | ID del gestor / event manager | `27` |

**Mapeo con el Integration Spec:**

Este endpoint corresponde al **Step 10: Tax Calculation** del spec. En la integracion final, NetSuite calcula los impuestos via SuiteTax, pero este endpoint permite validar los valores de impuestos desde el lado de SBW.

| Campo SBW Response | Uso en integracion |
|---------------------|-------------------|
| VAT/IVA amount | Comparacion con el calculo de NetSuite |
| Tax breakdown | Validacion de reglas fiscales por pais |

---

## 5. Mapeo General: APIs SBW vs Flujo de Integracion

La siguiente tabla muestra como cada API de SBW se relaciona con los pasos del flujo de integracion definido en el spec:

| Paso del Spec | Descripcion | API SBW |
|---------------|-------------|---------|
| Step 2 | Resolve Subsidiary (Event Manager) | *Dato en el payload — `sale.eventManager.entityId`* |
| Step 3 | Resolve/Create Buyer (Customer) | **User PF/PJ** — `/account/v2/user/` |
| Step 4 | Resolve/Create Seller (Vendor) | **User PF/PJ** — `/account/v2/user/` |
| Step 5 | Resolve/Create Project | **Commercial Project** — `/auction-lotting/commercial-project/` |
| Step 6 | Resolve/Create Auction | *Dato en el payload — `sale.event.*`* |
| Step 7 | Resolve/Create Lot | *Dato en el payload — `sale.offer.lotNumber`* |
| Step 8 | Validate/Resolve Items | *Dato en el payload — `sale.entries[].itemTypeId`* |
| Step 9 | Create Transaction | *Operacion en NetSuite* |
| Step 10 | Tax Calculation | **TAX** — `/tax/offer/{offerId}/lot/{lotNumber}/gestor/{gestorId}` |
| Appendix A | Customer Identity Classification | **Document** — `/account/v2/document/` |

> Los datos marcados como "Dato en el payload" son enviados directamente por Finley en el payload de la transaccion y no requieren consulta adicional a SBW.

---

## 6. Formato de Query Strings

Las APIs de SBW utilizan un formato especifico para filtros en el parametro `q`:

```
q=campo1:valor1,campo2:valor2
```

Ejemplos:
- Buscar usuario por ID exacto: `q=userid:696295,exactsearch:true,casesensitive:true`
- Buscar proyecto por ID: `q=id:700427`

Los valores deben estar **URL-encoded** cuando se envian en la URL:
- `:` → `%3A`
- `,` → `%2C`

---

## 7. Paises Soportados (Phase 1)

| Pais | ISO | Moneda | Tipo de Transaccion |
|------|-----|--------|---------------------|
| Argentina | AR | ARS | Invoice (standalone) |
| Chile | CL | CLP | Sales Order → Invoice |
| Colombia | CO | COP | Sales Order → Invoice |
| Peru | PE | PEN | Invoice (standalone) |

---

## 8. Notas Importantes

1. **Servicio Mock:** No se requiere. Las APIs de staging estan disponibles para consultas directas.

2. **Credenciales:** El `client_id` y `client_secret` para staging estan incluidos en la Postman collection. Estas credenciales son exclusivas para la integracion con Celigo.

3. **Token expiration:** Los tokens tienen un tiempo de vida limitado (`expires_in` en la respuesta). Renovar el token antes de que expire ejecutando nuevamente el request "Create Token".

4. **Rate limiting:** Las APIs tienen limites de tasa. Para desarrollo y pruebas, las consultas individuales no deberian tener problemas.

5. **Dominio `secure` vs `api`:** Algunos endpoints utilizan el subdominio `stgsecure` en lugar de `stgapi`. Verificar la URL base de cada request en la Postman collection.

6. **Paginacion:** Los endpoints de busqueda soportan paginacion via `start` y `limit`.

---

## 9. Como Usar la Postman Collection

1. **Importar** el archivo `sbws.postman_collection.json` en Postman.
2. **Ejecutar "Create Token"** para obtener el JWT de staging. El token se almacena automaticamente en la variable global `stg_jwt_token_celigo`.
3. **Explorar los endpoints** en orden:
   - `user PF` / `user PJ` — Consultar datos de compradores y vendedores
   - `commercial-project` — Consultar datos de proyectos comerciales
   - `document` — Obtener documentos de identidad fiscal
   - `TAX` — Consultar calculos de impuestos
4. **Modificar los parametros** de cada request segun los IDs de prueba que se necesiten validar.

### Requests incluidos en la collection

| # | Nombre | Metodo | Descripcion |
|---|--------|--------|-------------|
| 1 | Create Token | POST | Autenticacion OAuth2 — ambiente STG |
| 2 | Create Token PRD | POST | Autenticacion OAuth2 — ambiente PRD (no usar para desarrollo) |
| 3 | user PF | GET | Consulta de usuario — Persona Fisica (Individual) |
| 4 | user PJ | GET | Consulta de usuario — Persona Juridica (Company) |
| 5 | commercial-project | GET | Consulta de proyecto comercial |
| 6 | document | GET | Consulta de documentos de identidad/fiscal |
| 7 | TAX | GET | Consulta de calculo de impuestos |
