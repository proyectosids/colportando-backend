# Colportando backend

Backend SaaS con Node.js, TypeScript, Express, SQL Server y `mssql`. La línea base de negocio está aprobada y el incremento I0 ofrece bootstrap HTTP, OpenAPI y migraciones fundacionales.

## Requisitos

- Node.js 22 o posterior.
- npm.
- SQL Server disponible para iniciar la API y operar autenticación; el endpoint de health no ejecuta una consulta por solicitud.

## Instalación y ejecución

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Con `PORT=3000`:

- Health: `http://localhost:3000/api/v1/health`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/openapi.json`

`SWAGGER_ENABLED` controla tanto UI como JSON. En producción queda deshabilitado si no se establece explícitamente.

## Autenticación

I1-001 expone bajo `/api/v1/auth`: login, refresh rotativo, logout, verificación de correo, recuperación de contraseña y `/me`. Los access tokens son JWT cortos y los refresh/action tokens sólo se guardan como HMAC. La reutilización de un refresh token revoca su familia y sesión.

I1-002 añade creación, consulta y aceptación de invitaciones bajo `/api/v1/auth/invitations`. Crear y aceptar exige `Idempotency-Key`; sólo un actor con `membership.invitation.create` en el alcance correspondiente puede invitar. El cliente público no envía tenant, rol, cargo ni condición: el resultado está cerrado a membresía `PENDING` y condición `ASPIRANT`.

Los secretos y TTL se configuran con `JWT_*`, `ACTION_TOKEN_PEPPER` y `AUTH_*`; en producción no se aceptan secretos de desarrollo.

### Correo de autenticación

El adaptador Gmail envía correo HTML y texto alternativo con identidad `Colportando App <AUTH_EMAIL>`. Usa `AUTH_PASS_APP` con prioridad sobre `AUTH_PASS`; Google requiere una contraseña de aplicación cuando la cuenta tiene verificación en dos pasos. `AUTH_ACTION_BASE_URL` define el destino fijo de los botones y evita aceptar redirecciones proporcionadas por el cliente.

```powershell
npm run mail:verify   # valida SMTP, no envía correo
npm run mail:preview  # genera HTML local en tmp/email-previews
```

En desarrollo la URL de acciones puede apuntar a localhost. Antes de producción debe cambiarse por HTTPS o por el esquema de enlace profundo aprobado para Flutter.

## Migraciones

Configura las variables `SQL_*` de `.env` sobre una base vacía y ejecuta:

```powershell
npm run migrate
npm run database:verify-foundation
npm run database:verify-auth
npm run database:verify-invitations
```

El runner usa pool `mssql`, bloqueo de aplicación, transacción serializable, checksum SHA-256 e historial en `[C_infra].schema_migration`. Todos los objetos de Colportando viven en esquemas con prefijo `C_` para poder compartir la base sin mezclarse con otras aplicaciones. Los archivos `down` son sólo para desarrollo/ensayo y se ejecutan manualmente de forma consciente.

La verificación prueba restricciones multitenant y valores predeterminados dentro de una transacción que siempre se revierte.

## Verificación

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run openapi:validate
npm run build
```

Las pruebas HTTP de Supertest abren un puerto local efímero. Consulta [PROJECT_STATE.md](docs/PROJECT_STATE.md) para evidencia, límites y siguiente tarea.

## Documentación

- Instrucciones: [AGENTS.md](AGENTS.md)
- Estado: [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md)
- Plan: [docs/PLAN.md](docs/PLAN.md)
- Especificaciones: [docs/specs/README.md](docs/specs/README.md)
- Decisiones: [docs/decisions](docs/decisions)
