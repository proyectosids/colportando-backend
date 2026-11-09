# Plan general

Los estados permitidos son `pendiente`, `en curso`, `bloqueada` y `completada`. Una tarea sólo se completa con evidencia de sus criterios. La validación de negocio de la etapa 1 es una puerta obligatoria.

| ID | Especificación | Resultado esperado | Dependencias | Estado | Responsable | Criterio de terminación y evidencia |
|---|---|---|---|---|---|---|
| A-001 | Todas | Inventario y análisis de fuentes | Ninguna | completada | Agente principal | `docs/ANALYSIS.md` e inventario con hashes |
| A-002 | Todas | Contraste del SQL preliminar | A-001 | completada | Datos/revisión | Matriz de diferencias; SQL no ejecutado |
| A-003 | Todas | Propuesta SaaS, acceso, datos y arquitectura | A-001, A-002 | completada | Agente principal | Especificaciones y ADR en borrador |
| G-001 | Todas | Validación de modelo de negocio y datos | A-003 | completada | Usuario | Aprobación recibida 2026-11-05; specs y ADR aprobados |
| I0-001 | SPEC-006, SPEC-007 | Bootstrap Node/TS/Express/Clean Architecture | G-001 | completada | Backend | Typecheck, lint, 6 unitarias, 6 HTTP, OpenAPI y build aprobados |
| I0-002 | SPEC-001, SPEC-002 | Migraciones base tenant/institución/club/identidad/acceso | G-001, I0-001 | en curso | Datos | `up`, idempotencia y negativas aprobadas en `IDS-APP` bajo esquemas `C_*`; falta `down` en base temporal aislada |
| I1-001 | SPEC-006 | Cuenta, sesión, verificación y recuperación | I0-002 | completada | Backend | Migración 0003 aplicada; Argon2id, JWT corto, refresh rotativo/reuse, acciones de uso único, SQL/HTTP/OpenAPI y pruebas aprobadas |
| I1-002 | SPEC-002, SPEC-006 | Invitación y alta pública como aspirante | I1-001 | completada | Backend | Migración 0004 aplicada e idempotente; autorización, correo único, aceptación `PENDING` + `ASPIRANT`, cero acceso elevado, reintentos y limpieza verificados en `IDS-APP` |
| I2-001 | SPEC-003 | Programas, sesiones, inscripción y asistencias | I1-002 | completada | Backend/datos | Migración 0005 aplicada e idempotente; programas versionados, sesiones, cierre, inscripción aspirante, asistencia, avance propio, alcance, reintentos y no promoción verificados en `IDS-APP` |
| I2-002 | SPEC-003 | Promoción y reconocimiento por experiencia | I2-001 | completada | Backend/seguridad | Migración 0006 aplicada e idempotente; criterios por versión sin umbral global, autorización, evidencia, snapshot, operaciones separadas, reintentos, historial y limpieza verificados en `IDS-APP` |
| I3-001 | SPEC-004 | Campañas, grupos, asociados, campos y apelaciones | I1-002 | pendiente | Backend | Flujo funcional y pruebas de alcance club/grupo |
| I4-001 | SPEC-004 | Catálogo, adquisiciones e inventario aprobado | I3-001, decisión inventario | pendiente | Backend/datos | Snapshots de precio/fuente; alcance de stock validado |
| I5-001 | SPEC-004 | Ventas, pagos, cancelaciones y reembolsos | I4-001 | pendiente | Backend | Idempotencia, importes históricos, reversas y pruebas |
| I6-001 | SPEC-005 | Créditos y depósitos | I3-001 | pendiente | Backend/finanzas | Autorización, vencimientos, correcciones auditadas y pruebas |
| I6-002 | SPEC-005 | Configuración y cálculo de bonificaciones | I5-001, I6-001, fórmulas aprobadas | bloqueada | Finanzas/backend | Cálculo reproducible con snapshots, aprobación y pruebas |
| I7-001 | SPEC-001, SPEC-005 | Reportes institucionales y del club | I6-002 | pendiente | Backend | Permisos por alcance, paginación y pruebas de no filtración |
| I8-001 | Todas | Hardening, observabilidad y auditoría | Incrementos previos | pendiente | Seguridad | Pruebas negativas, secretos/redacción, límites y evidencia |
| I8-002 | Todas | Preparación de entrega | I8-001 | pendiente | Agente principal | README, `.env.example`, migraciones, OpenAPI, pruebas y estado actualizados |

## Dependencias y orden

La identidad y el aislamiento preceden a cualquier módulo. Capacitación puede avanzar en paralelo con campañas después del alta de membresías. Bonificaciones no avanzan hasta que Finanzas apruebe fórmulas. El soporte offline completo es un incremento separado que sólo se añade si se define su alcance; todos los incrementos sensibles sí deben ser idempotentes desde el inicio.

## Protocolo de cada incremento

1. Confirmar especificación aprobada y decisiones relacionadas.
2. Implementar dominio y casos de uso antes de adaptadores HTTP/SQL.
3. Añadir migración versionada sin destruir datos.
4. Documentar OpenAPI desde los mismos esquemas usados para validar HTTP.
5. Ejecutar typecheck, lint, pruebas unitarias/integración, validación OpenAPI y build.
6. Verificar tenant, permisos, transacciones, idempotencia y auditoría afectados.
7. Actualizar esta tabla y `PROJECT_STATE.md` con evidencia real.
