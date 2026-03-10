# Celigo Receiver — Cloud Function Gen 2

Google Cloud Function (Gen 2, HTTP trigger, Node.js 20) que envía un payload mock firmado con HMAC SHA-256 a un Webhook Listener de Celigo.

## Requisitos previos

- Node.js 20+
- Google Cloud CLI (`gcloud`) instalada y autenticada
- Un Webhook Listener configurado en Celigo con verificación HMAC

## Configuración

Edita `.env.yaml` con tus valores reales:

```yaml
CELIGO_WEBHOOK_URL: "https://hooks.integrator.io/TU_LISTENER_ID"
HMAC_SECRET: "TU_CLAVE_SECRETA_COMPARTIDA"
```

## Prueba local

```bash
# 1. Instalar dependencias
npm install

# 2. Exportar variables de entorno
export CELIGO_WEBHOOK_URL="https://hooks.integrator.io/TU_LISTENER_ID"
export HMAC_SECRET="tu-clave-secreta"

# 3. Iniciar el servidor local (puerto 8080)
npm start

# 4. En otra terminal, disparar la función
curl -X POST http://localhost:8080
```

La respuesta exitosa será:

```json
{
  "success": true,
  "message": "Payload sent and accepted by Celigo",
  "celigoStatus": 200
}
```

## Despliegue a Google Cloud

```bash
gcloud functions deploy celigo-receiver \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point=celigoReceiver \
  --env-vars-file=.env.yaml \
  --memory=256MB \
  --timeout=60s
```

### Flags principales

| Flag | Descripción |
|---|---|
| `--gen2` | Despliega como Cloud Function de 2da generación (basada en Cloud Run) |
| `--runtime=nodejs20` | Usa el runtime de Node.js 20 |
| `--trigger-http` | Expone la función mediante un endpoint HTTP |
| `--allow-unauthenticated` | Permite invocación pública (ajustar según seguridad) |
| `--entry-point=celigoReceiver` | Nombre de la función exportada en `index.js` |
| `--env-vars-file=.env.yaml` | Inyecta las variables de entorno desde el archivo |

## Verificar el despliegue

```bash
# Obtener la URL de la función desplegada
gcloud functions describe celigo-receiver --gen2 --region=us-central1 --format="value(serviceConfig.uri)"

# Invocar la función
curl -X POST https://TU-URL-DE-LA-FUNCION
```

## Seguridad

- La firma HMAC SHA-256 se calcula sobre el body (`JSON.stringify(payload)`) usando `HMAC_SECRET`.
- La firma se envía en el header `x-celigo-signature` en formato hexadecimal.
- Celigo valida esta firma en el lado receptor para garantizar integridad y autenticidad.
- **Nunca subas `.env.yaml` al repositorio** — está incluido en `.gitignore`.
