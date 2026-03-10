# Celigo Receiver — Cloud Run Service

Servicio Cloud Run (Node.js 20) que recibe payloads JSON via POST, los firma con HMAC SHA-256 y los reenvía al Webhook Listener de Celigo. Incluye autenticacion JWT con tokens de expiracion corta (1 hora).

## Arquitectura

```
Cliente (Finley / SuperBid / cualquier sistema)
        │
        │  1. POST /auth/token  { client_id, client_secret }
        │     ← { token: "eyJhb...", expires_in: 3600 }
        │
        │  2. POST /webhook/celigo  { ...payload JSON... }
        │     Header: Authorization: Bearer <token>
        ▼
┌──────────────────────────────┐
│   Cloud Run                  │
│   celigo-receiver            │
│                              │
│  1. Valida JWT (1h expiry)   │
│  2. HMAC-SHA256(body)        │
│  3. POST → Celigo            │
│     x-celigo-signature       │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   Celigo Webhook Listener    │
│   (valida firma HMAC)        │
└──────────────────────────────┘
```

## Endpoints

| Metodo | Ruta               | Auth     | Descripcion                                         |
|--------|--------------------|----------|-----------------------------------------------------|
| GET    | `/health`          | Publica  | Health check (retorna `{"status":"ok"}`)             |
| POST   | `/auth/token`      | Publica  | Genera JWT (1h) a partir de client_id + client_secret |
| POST   | `/webhook/celigo`  | JWT      | Recibe JSON, firma con HMAC y reenvía a Celigo       |

## Requisitos previos

- Node.js 20+
- Google Cloud CLI (`gcloud`) autenticada
- Proyecto GCP: `sbc-data-brasil`

## Prueba local

```bash
# 1. Instalar dependencias
npm install

# 2. Exportar variables de entorno
export CELIGO_WEBHOOK_URL="https://api.integrator.io/v1/exports/TU_EXPORT_ID/data"
export HMAC_SECRET="tu-clave-hmac"
export JWT_SIGNING_KEY="tu-clave-jwt-signing"
export AUTHORIZED_CLIENTS='{"finley":"secret-de-finley"}'

# 3. Iniciar servidor (puerto 8080)
npm start

# 4. Obtener token
curl -s -X POST http://localhost:8080/auth/token \
  -H "Content-Type: application/json" \
  -d '{"client_id": "finley", "client_secret": "secret-de-finley"}'

# 5. Enviar payload con el token obtenido
curl -X POST http://localhost:8080/webhook/celigo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_DEL_PASO_4>" \
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

Todos los secretos se gestionan en Google Secret Manager, nunca como variables de entorno planas.

| Secreto              | Descripcion                                           |
|----------------------|-------------------------------------------------------|
| `celigo-webhook-url` | URL del Webhook Listener de Celigo                    |
| `hmac-secret`        | Clave compartida para firmar payloads (HMAC SHA-256)  |
| `jwt-signing-key`    | Clave para firmar/verificar tokens JWT                |
| `authorized-clients` | JSON con pares `{ "client_id": "client_secret", ... }`|

```bash
# Actualizar la URL del webhook de Celigo
echo -n "https://api.integrator.io/v1/exports/TU_EXPORT_ID/data" | \
  gcloud secrets versions add celigo-webhook-url --data-file=- --project=sbc-data-brasil

# Actualizar la clave HMAC compartida
echo -n "TU_CLAVE_HMAC" | \
  gcloud secrets versions add hmac-secret --data-file=- --project=sbc-data-brasil

# Actualizar la clave JWT
echo -n "TU_CLAVE_JWT" | \
  gcloud secrets versions add jwt-signing-key --data-file=- --project=sbc-data-brasil

# Agregar o actualizar clientes autorizados
echo -n '{"finley":"secret-finley","superbid":"secret-superbid"}' | \
  gcloud secrets versions add authorized-clients --data-file=- --project=sbc-data-brasil
```

## Gestion de clientes

Para **agregar un nuevo cliente** autorizado:

```bash
# 1. Generar un secret aleatorio
NEW_SECRET=$(openssl rand -base64 24)
echo "client_secret: $NEW_SECRET"

# 2. Obtener el JSON actual de clientes
gcloud secrets versions access latest --secret=authorized-clients --project=sbc-data-brasil

# 3. Actualizar el JSON agregando el nuevo cliente
echo -n '{"finley":"secret-existente","nuevo_cliente":"'"$NEW_SECRET"'"}' | \
  gcloud secrets versions add authorized-clients --data-file=- --project=sbc-data-brasil

# 4. Redesplegar para que tome la nueva version del secreto
gcloud run services update celigo-receiver \
  --region=us-central1 \
  --set-secrets="CELIGO_WEBHOOK_URL=celigo-webhook-url:latest,HMAC_SECRET=hmac-secret:latest,JWT_SIGNING_KEY=jwt-signing-key:latest,AUTHORIZED_CLIENTS=authorized-clients:latest" \
  --project=sbc-data-brasil
```

Para **revocar un cliente**, elimina su entrada del JSON y redesplega. Los tokens ya emitidos seguiran activos hasta que expiren (max 1 hora).

## Despliegue a Cloud Run

```bash
gcloud run deploy celigo-receiver \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=256Mi \
  --timeout=60 \
  --set-secrets="CELIGO_WEBHOOK_URL=celigo-webhook-url:latest,HMAC_SECRET=hmac-secret:latest,JWT_SIGNING_KEY=jwt-signing-key:latest,AUTHORIZED_CLIENTS=authorized-clients:latest" \
  --project=sbc-data-brasil \
  --quiet
```

## Uso en produccion

```bash
SERVICE_URL=$(gcloud run services describe celigo-receiver \
  --region=us-central1 --format="value(status.url)" --project=sbc-data-brasil)

# Paso 1: Obtener token (valido 1 hora)
TOKEN=$(curl -s -X POST "$SERVICE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "finley", "client_secret": "TU_SECRET"}' | \
  node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).token)})")

# Paso 2: Enviar payload con el token
curl -X POST "$SERVICE_URL/webhook/celigo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sale": { ... }}'
```

## Configuracion en Celigo

El Webhook Listener en Celigo debe configurarse asi:

| Campo                    | Valor                |
|--------------------------|----------------------|
| Verification type        | HMAC                 |
| Algorithm                | SHA-256              |
| Encoding                 | Hexadecimal          |
| Key (secret)             | (mismo valor que `hmac-secret` en Secret Manager) |
| Header (containing hmac) | `x-celigo-signature` |

## Seguridad

- Todas las credenciales viven en **Secret Manager**, nunca en codigo ni en variables planas.
- El endpoint `/webhook/celigo` requiere un **JWT valido** (Bearer token) con expiracion de **1 hora**.
- Los tokens se obtienen via `/auth/token` con credenciales `client_id` + `client_secret`.
- Cada payload se firma con **HMAC SHA-256** antes de enviarse a Celigo.
- La firma viaja en el header `x-celigo-signature` (formato hex).
- Celigo valida la firma en el lado receptor.
- Para revocar acceso a un cliente, se elimina del secreto `authorized-clients` y se redesplega.
