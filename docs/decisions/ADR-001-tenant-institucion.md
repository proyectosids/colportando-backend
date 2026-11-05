# ADR-001 Institución como tenant

Estado: **aceptada el 2026-11-05**
Fecha: 2026-11-05

## Contexto

Las fuentes describen ULV, un club, Finanzas institucional y reportes. El SQL fija club = tenant, pero el encargo exige acceso institucional autorizado a varios clubes y aislamiento SaaS.

## Decisión propuesta

Usar institución/universidad como tenant de aislamiento y club como unidad interna. Plataforma es ámbito global separado. Toda entidad tenant-owned incluye `tenant_id`; relaciones internas usan FKs compuestas. El contexto se resuelve desde cuenta/asignaciones, no desde un ID confiado del cliente.

## Consecuencias

Permite reportes y Finanzas multiclub dentro de institución y evita accesos cross-institution. Añade alcance club a muchas operaciones. Clubes independientes requieren tenant de tipo independiente o institución mínima. El SQL preliminar no puede migrarse sin rediseño.

## Alternativas

- Club como tenant: simplifica aislamiento, pero complica acceso institucional y agregación.
- Tenant contractual sobre varias instituciones: más flexible, pero introduce jerarquía no documentada.

## Validación requerida

Confirmar tenant, clubes independientes y si un cliente contractual puede contener varias instituciones.
