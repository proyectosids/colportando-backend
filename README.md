# Colportando backend

Backend SaaS con Node.js, TypeScript, Express, SQL Server y `mssql`. La línea base de negocio está aprobada y el incremento I0 ofrece bootstrap HTTP, OpenAPI y migraciones fundacionales.

## Requisitos

- Node.js 22 o posterior.
- npm.
- SQL Server sólo para aplicar/verificar migraciones; el health check no abre conexión.

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

`SWAGGER_ENABLED` controla tanto UI como JSON. En producción queda deshabilitado si no se establece explícitamente. No hay credenciales de prueba ni autenticación implementada todavía.

## Migraciones

Configura las variables `SQL_*` de `.env` sobre una base vacía y ejecuta:

```powershell
npm run migrate
```

El runner usa pool `mssql`, bloqueo de aplicación, transacción serializable, checksum SHA-256 e historial en `infra.schema_migration`. No lo ejecutes sobre el SQL preliminar ni una base con datos sin estrategia de adopción y respaldo. Los archivos `down` son sólo para desarrollo/ensayo y se ejecutan manualmente de forma consciente.

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
