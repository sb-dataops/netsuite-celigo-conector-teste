# Celigo Receiver — Cloud Run Service

Servicio Cloud Run (Node.js 20) que recibe payloads JSON via POST, los firma con HMAC SHA-256 y los reenvía al Webhook Listener de Celigo.

## Arquitectura

```
Cliente (Finley / curl / cualquier sistema)
        │
        │  POST /webhook/celigo  { ...payload JSON... }
        ▼
┌──────────────────────────┐
│   Cloud Run              │
│   celigo-receiver        │
│                          │
│  1. Recibe payload       │
│  2. HMAC-SHA256(body)    │
│  3. POST → Celigo        │
│     x-celigo-signature   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│   Celigo Webhook         │
│   Listener               │
│   (valida firma HMAC)    │
└──────────────────────────┘
```

## Endpoints

| Metodo | Ruta               | Descripcion                                         |
|--------|--------------------|-----------------------------------------------------|
| GET    | `/health`          | Health check (retorna `{"status":"ok"}`)             |
| POST   | `/webhook/celigo`  | Recibe JSON, firma con HMAC y reenvía a Celigo       |

## Requisitos previos

- Node.js 20+
- Google Cloud CLI (`gcloud`) autenticada
- Proyecto GCP: `sbc-data-brasil`

## Prueba local

```bash
# 1. Instalar dependencias
npm install

# 2. Exportar variables de entorno
export CELIGO_WEBHOOK_URL="https://hooks.integrator.io/TU_LISTENER_ID"
export HMAC_SECRET="tu-clave-secreta"

# 3. Iniciar servidor (puerto 8080)
npm start

# 4. Enviar un payload de prueba (factura de venta AR)
curl -X POST http://localhost:8080/webhook/celigo \
  -H "Content-Type: application/json" \
  -d '{
    "sale": {
      "id": 1350470,
      "createdAt": "2026-01-26",
      "statusDesc": "Aberto",
      "buyer": {
        "id": 1575533,
        "name": "Horacio Maximiliano Iervasi",
        "docNumber": "20288996653",
        "identitydoctype": "CUIT"
      },
      "seller": {
        "id": 1307093,
        "name": "JUNCAL SA",
        "docNumber": "30709876543"
      },
      "eventManager": {
        "id": 10,
        "entityId": 134114,
        "countryIso": "AR",
        "erpKey": "s4b-erp"
      },
      "eventProject": {
        "id": 1189437,
        "desc": "NARVAEZ BID - 30707001786 INTERDINAMICA S.A.",
        "creationDate": "2025-09-17T13:23:18",
        "businessUnitNumber": 100,
        "businessSegmentNumber": 88
      },
      "event": {
        "id": 776656,
        "description": "INTERDINAMICA",
        "endDate": "2026-01-15T14:00:00.000+0000",
        "locale": {
          "acronym": "es_AR",
          "currency": "ARS",
          "countryIso": "AR"
        }
      },
      "offer": { "lotNumber": 27 },
      "entries": [
        {
          "id": 2894203,
          "itemTypeId": 5,
          "itemTypeDescription": "Encargos de Administracion",
          "itemValue": 41400,
          "itemTotalValue": 41400
        }
      ]
    }
  }'
```

## Secretos (Secret Manager)

Los secretos se gestionan en Google Secret Manager, no como variables de entorno planas.

```bash
# Actualizar la URL del webhook de Celigo
echo -n "https://hooks.integrator.io/TU_LISTENER_REAL" | \
  gcloud secrets versions add celigo-webhook-url --data-file=-

# Actualizar la clave HMAC compartida
echo -n "TU_CLAVE_SECRETA_REAL" | \
  gcloud secrets versions add hmac-secret --data-file=-
```

## Despliegue a Cloud Run

```bash
gcloud run deploy celigo-receiver \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=60 \
  --set-secrets="CELIGO_WEBHOOK_URL=celigo-webhook-url:latest,HMAC_SECRET=hmac-secret:latest" \
  --project=sbc-data-brasil \
  --quiet
```

## Uso en produccion

Una vez desplegado, cualquier sistema puede enviar payloads al servicio:

```bash
# Obtener la URL del servicio
gcloud run services describe celigo-receiver \
  --region=us-central1 --format="value(status.url)"

# Enviar payload (reemplazar URL)
curl -X POST https://celigo-receiver-XXXXX.a.run.app/webhook/celigo \
  -H "Content-Type: application/json" \
  -d '{"sale": { ... }}'
```

## Seguridad

- Las credenciales viven en **Secret Manager**, nunca en codigo ni en variables planas.
- Cada payload se firma con **HMAC SHA-256** usando la clave compartida.
- La firma viaja en el header `x-celigo-signature` (formato hex).
- Celigo valida la firma en el lado receptor.
- `--allow-unauthenticated` permite acceso publico al endpoint; si necesitas restringirlo, usa IAM o un API Gateway.
