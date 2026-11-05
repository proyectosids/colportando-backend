# Colportando backend

Backend SaaS independiente para gestionar instituciones, clubes de colportores y sus procesos. Flutter es el cliente prioritario; React es complementario. El stack obligatorio es Node.js, TypeScript, Express, Microsoft SQL Server y `mssql`.

## Reglas permanentes

- Aplicar Clean Architecture modular. Dominio no depende de Express, `mssql`, OpenAPI ni servicios externos; aplicación depende del dominio; infraestructura implementa puertos; HTTP adapta solicitudes y respuestas.
- Resolver tenant y alcance en el servidor a partir de la sesión y asignaciones autorizadas. Nunca confiar por sí solo en un `tenant_id` enviado por el cliente.
- Separar persona, cuenta, membresía, condición del integrante, rol de acceso y cargo organizacional.
- Toda membresía pública de participante inicia como aspirante. Reconocimiento por experiencia es una operación administrativa distinta y auditada.
- Usar consultas parametrizadas, transacciones en operaciones atómicas, claves idempotentes en escrituras móviles sensibles y FKs compuestas para impedir referencias entre tenants.
- Fechas persistidas en UTC con `datetime2`; importes con `decimal`, moneda y política de redondeo explícitas. No registrar secretos ni datos sensibles innecesarios.
- Un endpoint no está terminado sin validación, autorización, pruebas y OpenAPI alineado.
- No implementar reglas financieras, criterios de promoción, precios, planes o límites que sigan pendientes de validación.

## Documentación y reanudación

- Estado y siguiente acción: `docs/PROJECT_STATE.md`.
- Plan y dependencias: `docs/PLAN.md`.
- Resultado del análisis: `docs/ANALYSIS.md`.
- Especificaciones: `docs/specs/README.md`.
- Decisiones: `docs/decisions/`.
- Fuentes originales, fuera de este repositorio: `../documentos/`.

Al retomar: leer este archivo, `docs/PROJECT_STATE.md`, tareas activas de `docs/PLAN.md`, especificaciones/ADR relacionados y luego contrastar Git, documentos y código real. Si difieren, corregir el estado con evidencia.

## Convenciones y verificaciones

- Código y nombres técnicos en inglés; documentación de negocio en español.
- Dependencias hacia capas internas; sin repositorios genéricos ni clases base sin necesidad concreta.
- Comandos previstos tras el bootstrap: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run openapi:validate` y `npm run build`.
- Preservar cambios ajenos. No ejecutar migraciones ni tocar bases sin autorización explícita.

## Coordinación

El agente principal integra y verifica. Delegar solo tareas acotadas con especificación, archivos permitidos, contratos, dependencias, criterios y verificaciones. Evitar escrituras simultáneas en archivos compartidos; revisores trabajan en solo lectura. Ningún subagente cambia reglas de negocio, dependencias o contratos fuera de su encargo ni marca trabajo como integrado.
