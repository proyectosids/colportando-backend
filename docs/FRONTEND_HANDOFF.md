# Corte Backend V1-A para frontend

Estado: **listo para integración el 2026-11-09**.

## Fuente del contrato

- OpenAPI JSON: `/api/openapi.json` con `SWAGGER_ENABLED=true`.
- Swagger UI: `/api/docs`.
- Prefijo versionado: `/api/v1`.
- Autenticación: `Authorization: Bearer <accessToken>`.
- Toda escritura sensible exige `Idempotency-Key` de 8 a 100 caracteres. Un retry idéntico devuelve `replayed: true`; reutilizar la clave con otro payload devuelve `409`.
- Errores: `{ "error": { "code", "message", "correlationId", "details?" } }`.

## Arranque recomendado del cliente

1. Login con `/auth/login` y almacenamiento seguro del refresh token.
2. Renovación con `/auth/refresh`; logout con `/auth/logout`.
3. Resolver `/workspace/context` después del login y después de cambiar permisos.
4. Mostrar selector de club con `clubs` y construir navegación con `permissions`.
5. No autorizar acciones sólo porque el frontend muestre un botón; el backend vuelve a validar cada permiso y alcance.

## Módulos disponibles

- `/auth`: sesión, verificación, recuperación e invitaciones.
- `/workspace`: contexto, membresías, campañas, programas, roles y asignaciones de acceso.
- `/training`: programas, sesiones, inscripciones, asistencias, avance y transiciones aprobadas.
- `/operations`: campañas, grupos, participaciones, asociados, campos y apelaciones.
- `/inventory`: materiales, catálogos, artículos, adquisiciones y material propio.

## Matriz inicial

| Rol | Alcance | Uso frontend |
|---|---|---|
| `INSTITUTION_ADMIN` | Institución | Todos los clubes autorizados de la institución |
| `CLUB_ADMIN` | Club | Administración completa del club |
| `CAMPAIGN_MANAGER` | Club | Campañas, grupos, catálogo y adquisiciones |
| `TRAINING_COORDINATOR` | Club | Capacitación y decisiones autorizadas |

El frontend debe evaluar los códigos contenidos en `permissions`; los roles explican la asignación, pero no sustituyen permisos efectivos. Asociado sigue siendo una asignación operativa por grupo y aparece en `associateGroupIds`.

## Catálogo y materiales

- El catálogo conserva `sourceType`, `sourceName`, referencia, fecha de corte y moneda.
- Un catálogo se crea `DRAFT`, recibe artículos y pasa a `ACTIVE`; después puede cerrarse.
- El frontend nunca envía precio al registrar una adquisición. Sólo envía `catalogItemId` y `quantity`.
- El backend persiste precio, moneda, material, fuente, corte y bonificable como snapshot.
- `/inventory/me/acquisitions` devuelve exclusivamente material de la participación autenticada, aunque la cuenta también sea administradora.
- No usar en UI las etiquetas “stock GEMA”, “existencia”, “almacén” o “disponible”. La V1 muestra catálogo, adquisición y material asignado.

## Paginación y selección

Los listados del workspace aceptan `page` y `pageSize`; membresías también acepta `search`. El cliente debe obtener IDs desde estos listados y no solicitar que el usuario capture UUID manualmente.

## Desarrollo paralelo

Frontend puede implementar autenticación, selección de contexto, administración inicial, capacitación, campañas y materiales contra V1-A. Backend continuará con ventas y finanzas agregando rutas nuevas; no se cambiarán silenciosamente los contratos estabilizados de V1-A. Los cambios incompatibles requieren una nueva versión o una transición documentada.
