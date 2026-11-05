# SPEC-007 Arquitectura y contrato HTTP

Estado: **pendiente de validación**

## Objetivo y alcance

Fijar Clean Architecture modular, composición, transacciones, API versionada, errores, validación, OpenAPI, observabilidad y verificación.

## Fuentes

Requisitos técnicos/arquitectónicos del encargo y `docs/ANALYSIS.md`.

## Requisitos

- ARC-001 `PROMPT`: dominio no importa Express, `mssql`, Swagger ni externos.
- ARC-002 `PROMPT`: aplicación contiene casos de uso/puertos y depende del dominio.
- ARC-003 `PROMPT`: infraestructura implementa SQL/proveedores; presentación adapta HTTP.
- ARC-004 `PROP`: DI manual en `src/composition`; repositorios concretos, no genéricos.
- ARC-005 `PROMPT`: pool/config por entorno, SQL parametrizado y transacciones abstractas.
- API-001 `PROMPT`: base `/api/v1`; respuestas/errores consistentes, paginación/filtros/orden allowlist.
- API-002 `PROMPT`: `/api/docs` y `/api/openapi.json`, protegibles por entorno.
- API-003 `PROMPT`: validación y OpenAPI derivan de Zod en presentación; no dependen del dominio.
- API-004 `PROMPT`: endpoint no terminado sin OpenAPI y pruebas aplicables.

## Actores y permisos

Desarrolladores Flutter/React consumen contratos; operadores configuran entorno; usuarios de negocio acceden según SPEC-001/002. Swagger `Authorize` usa esquema Bearer sin credenciales incluidas.

## Flujos y errores

Express -> validación -> autenticación/contexto -> controlador -> caso de uso -> transacción/repositorio -> respuesta. Middleware central traduce errores conocidos y oculta SQL/credenciales. Correlation ID conecta request, auditoría y logs.

## Datos y transacciones

Puertos de repositorio/transacción en aplicación; contexto abstracto implementado por `mssql.Transaction`. Config validada al arrancar. Migraciones numeradas con checksum/historial; fresh install separado de adopción.

## Contratos API

Envelope de error propuesto: `code`, `message`, `details` seguros, `correlationId`. Listados: `items` y `page` con cursor o página según módulo, nunca orden/campo SQL libre. OpenAPI documenta permisos, alcance, idempotencia, errores y datos previos de prueba.

## Criterios de aceptación

- Prueba de dependencias detecta importaciones prohibidas.
- SQL usa parámetros y pool; error no filtra consulta/secretos.
- OpenAPI valida y Swagger carga; una solicitud protegida puede ejecutarse con token de prueba local.
- Build, typecheck, lint y pruebas pasan antes de cerrar incremento.
- Swagger deshabilitado/protegido según configuración de producción.

## Dependencias, decisiones y exclusiones

No requiere decisión de negocio para la estructura; implementación bloqueada por G-001. Paquetes en `docs/ANALYSIS.md`. Excluye microservicios, event sourcing, ORM y DI container sin necesidad. Tareas: I0-001, I8-001, I8-002. ADR-003.
