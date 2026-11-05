# SPEC-001 SaaS instituciones y aislamiento

Estado: **aprobada el 2026-11-05**

## Objetivo y alcance

Definir plataforma, tenant, institución, clubes, ciclo de servicio y acceso multiclub. Incluye aislamiento lógico y relacional; excluye precios y facturación.

## Fuentes

Análisis consolidado, SRS, manual Kerusso, SQL preliminar y reglas SaaS del encargo. Ver `../SOURCES.md`.

## Requisitos

- SAAS-001 `PROMPT/PROP`: el servidor resuelve tenant desde sesión y asignaciones; un identificador del cliente sólo selecciona contexto.
- SAAS-002 `PROP`: cada tenant representa una institución cliente y contiene clubes.
- SAAS-003 `PROMPT`: administradores institucionales y Finanzas acceden a clubes autorizados dentro del tenant.
- SAAS-004 `PROMPT`: plataforma y tenant tienen administradores separados.
- SAAS-005 `PROMPT`: toda FK tenant-owned impide cruce de tenant; validación de aplicación es adicional.
- SAAS-006 `PROMPT`: servicio contempla ciclo de vida sin borrar históricos financieros.
- SAAS-007 `APROBADO`: planes, cobros, pasarela y facturación comercial quedan fuera de V1.

## Actores y permisos

AdminPlataforma (global), AdminInstitucional y Finanzas (institución), AdminClub/Directiva/Miembro (club). Directiva no hereda administración completa.

## Flujos y errores

Selección de club: autenticar -> resolver asignación -> validar tenant activo y permiso -> ejecutar filtrado. Rechazar tenant inexistente, suspendido, asignación vencida, club de otro tenant o referencia cruzada. Acceso excepcional de plataforma requiere permiso y auditoría.

## Datos y transacciones

`Tenant`, `TenantServiceState`, `Institution`, `Club`, `AccessAssignment`. Claves compuestas `(tenant_id,id)` y FKs con tenant. Cambio de estado y sus efectos se ejecutan transaccionalmente con auditoría/outbox.

## Contratos API preliminares

Referencias futuras bajo `/api/v1/institutions`, `/clubs` y `/platform/tenants`; sólo se publicarán al implementarse. Tenant no se autoriza por cuerpo/encabezado sin asignación.

## Criterios de aceptación

- Un usuario de institución A no lee/escribe registros de B aunque adivine IDs.
- Finanzas con alcance institucional consulta clubes autorizados; un rol club no puede hacerlo.
- Una FK cross-tenant es rechazada por SQL Server.
- Tenant suspendido aplica la política aprobada y conserva históricos.

## Dependencias, decisiones y exclusiones

Tenant = institución fue aprobado; un club independiente usa un tenant institucional mínimo. Excluye facturación, pasarela, precios, límites y RLS definitivo. Tareas: I0-002, I7-001. ADR-001.
