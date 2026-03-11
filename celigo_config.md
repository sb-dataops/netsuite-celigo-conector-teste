El mock esta activo. Te doy la guia paso a paso para configurar todo en Celigo con conexiones HTTP apuntando al mock.

---

## Paso 1: Crear la conexion HTTP en Celigo

En Celigo, ve a **Resources -> Connections -> + Create Connection**:

| Campo | Valor |
|---|---|
| **Type** | HTTP |
| **Name** | `NetSuite Mock (Test)` |
| **Base URL** | `https://netsuite-mock-462343978447.us-central1.run.app` |
| **Media Type** | JSON |
| **Auth Type** | None |

Guarda y haz **Test Connection**.

---

## Paso 2: Estructura del flow en Celigo

En Celigo, un flow tiene esta estructura: **Export -> [Lookups] -> Import**. Los lookups enriquecen el record con datos adicionales, y el import es la accion final.

Para nuestro caso, la estructura practica es:

```
Export: Receiver (Listener) ── ya existe
  │
  ├── Lookup 1: POST /api/subsidiary/search  → obtener subsidiary.internalId
  ├── Lookup 2: POST /api/customer           → upsert, obtener customer.internalId
  ├── Lookup 3: POST /api/vendor             → upsert, obtener vendor.internalId
  ├── Lookup 4: POST /api/project            → upsert, obtener project.internalId
  ├── Lookup 5: POST /api/customrecord/auction → upsert, obtener auction.internalId
  ├── Lookup 6: POST /api/customrecord/lot   → upsert, obtener lot.internalId
  ├── Lookup 7: GET /api/item/search         → resolver item.internalId
  │
  └── Import: POST /api/invoice              → crear invoice, recibir VAT
```

Esto se implementa en **un solo flow** con el Receiver como export, 7 lookups HTTP y 1 import HTTP. Cada lookup agrega datos al record que fluye por el pipeline.

---

## Paso 3: Configurar el flow

En tu `test_flow` existente:

**3.1 - Eliminar el destino dummy "Final"** y reemplazarlo por un HTTP Import.

**3.2 - Agregar Lookups** (haz clic en el "+" entre el Receiver y el Import):

### Lookup 1: Resolve Subsidiary

| Campo | Valor |
|---|---|
| **Name** | Resolve Subsidiary |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | GET |
| **Relative URL** | `/api/subsidiary/search` |
| **Query Parameters** | `custrecord_finley_entity_id` = `{{sale.eventManager.entityId}}` |
| **Result Field** | `_subsidiary` |

### Lookup 2: Upsert Customer

| Campo | Valor |
|---|---|
| **Name** | Upsert Customer |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | POST |
| **Relative URL** | `/api/customer` |
| **Body** | (JSON mapping abajo) |
| **Result Field** | `_customer` |

Body mapping:
```json
{
  "externalId": "{{sale.buyer.id}}",
  "entityId": "{{sale.buyer.id}}",
  "companyName": "{{sale.buyer.name}}",
  "isPerson": true,
  "subsidiary": "{{_subsidiary.internalId}}",
  "country": "{{sale.event.locale.countryIso}}",
  "currency": "{{sale.event.locale.currency}}",
  "docNumber": "{{sale.buyer.docNumber}}",
  "identityDocType": "{{sale.buyer.identitydoctype}}",
  "status": "Active"
}
```

### Lookup 3: Upsert Vendor

| Campo | Valor |
|---|---|
| **Name** | Upsert Vendor |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | POST |
| **Relative URL** | `/api/vendor` |
| **Result Field** | `_vendor` |

Body:
```json
{
  "externalId": "vndr_{{sale.seller.id}}",
  "companyName": "{{sale.seller.name}}",
  "subsidiary": "{{_subsidiary.internalId}}",
  "country": "{{sale.event.locale.countryIso}}",
  "docNumber": "{{sale.seller.docNumber}}",
  "category": "Vendedor",
  "status": "Active"
}
```

### Lookup 4: Upsert Project

| Campo | Valor |
|---|---|
| **Name** | Upsert Project |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | POST |
| **Relative URL** | `/api/project` |
| **Result Field** | `_project` |

Body:
```json
{
  "externalId": "{{sale.eventProject.id}}",
  "projectName": "{{sale.eventProject.desc}}",
  "startDate": "{{sale.eventProject.creationDate}}",
  "subsidiary": "{{_subsidiary.internalId}}",
  "department": "{{sale.eventProject.businessUnitNumber}}",
  "class": "{{sale.eventProject.businessSegmentNumber}}",
  "custentity_finley_country_iso": "{{sale.eventManager.countryIso}}"
}
```

### Lookup 5: Upsert Auction

| Campo | Valor |
|---|---|
| **Name** | Upsert Auction |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | POST |
| **Relative URL** | `/api/customrecord/auction` |
| **Result Field** | `_auction` |

Body:
```json
{
  "externalId": "{{sale.event.id}}",
  "name": "{{sale.event.description}}",
  "custrecord_finley_event_id": "{{sale.event.id}}",
  "custrecord_auction_end_date": "{{sale.event.endDate}}",
  "custrecord_auction_currency_code": "{{sale.event.locale.currency}}",
  "custrecord_auction_locale": "{{sale.event.locale.acronym}}",
  "custrecord_auction_parent_project": "{{_project.internalId}}",
  "custrecord_auction_subsidiary_ref": "{{_subsidiary.internalId}}"
}
```

### Lookup 6: Upsert Lot

| Campo | Valor |
|---|---|
| **Name** | Upsert Lot |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | POST |
| **Relative URL** | `/api/customrecord/lot` |
| **Result Field** | `_lot` |

Body:
```json
{
  "externalId": "LOT-{{sale.id}}-{{sale.offer.lotNumber}}",
  "custrecord_lot_number": "{{sale.offer.lotNumber}}",
  "custrecord_lot_auction": "{{_auction.internalId}}",
  "custrecord_lot_project": "{{_project.internalId}}",
  "custrecord_lot_seller_vendor": "{{_vendor.internalId}}",
  "custrecord_lot_buyer_customer": "{{_customer.internalId}}"
}
```

### Lookup 7: Resolve Item

| Campo | Valor |
|---|---|
| **Name** | Resolve Item |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | GET |
| **Relative URL** | `/api/item/search` |
| **Query Parameters** | `externalId` = `{{sale.entries[0].itemTypeId}}` |
| **Result Field** | `_item` |

---

## Paso 4: Configurar el Import (Invoice)

| Campo | Valor |
|---|---|
| **Name** | Create Invoice |
| **Connection** | NetSuite Mock (Test) |
| **HTTP Method** | POST |
| **Relative URL** | `/api/invoice` |

Body mapping:
```json
{
  "externalId": "INV-{{sale.id}}-{{sale.entries[0].id}}",
  "trandate": "{{sale.createdAt}}",
  "entity": "{{_customer.internalId}}",
  "subsidiary": "{{_subsidiary.internalId}}",
  "currency": "{{sale.event.locale.currency}}",
  "countryIso": "{{sale.event.locale.countryIso}}",
  "job": "{{_project.internalId}}",
  "custbody_seller_vendor": "{{_vendor.internalId}}",
  "custbody_auction_ref": "{{_auction.internalId}}",
  "custbody_lot_reference": "{{_lot.internalId}}",
  "custbody_finley_sale_id": "{{sale.id}}",
  "lines": [
    {
      "item": "{{_item.internalId}}",
      "description": "{{sale.entries[0].itemTypeDescription}}",
      "rate": "{{sale.entries[0].itemValue}}",
      "quantity": 1,
      "amount": "{{sale.entries[0].itemTotalValue}}",
      "custcol_finley_entry_id": "{{sale.entries[0].id}}"
    }
  ]
}
```

---

## Resumen visual en Celigo

```
┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐
│ Receiver │──▶│ 7 Lookups    │──▶│ Create       │──▶│ Response      │
│ Listener │   │ (HTTP calls) │   │ Invoice      │   │ (VAT + status)│
└──────────┘   └──────────────┘   └──────────────┘   └───────────────┘
  YA EXISTE      POR CONFIGURAR    POR CONFIGURAR      EN LA RESPUESTA
```

Los campos `_subsidiary`, `_customer`, `_vendor`, `_project`, `_auction`, `_lot`, `_item` son los **Result Fields** de cada lookup -- Celigo los agrega al record y estan disponibles para los lookups siguientes y para el import final.

Quieres que empecemos a configurar esto en Celigo? Si me muestras la pantalla del flow builder puedo guiarte paso a paso.