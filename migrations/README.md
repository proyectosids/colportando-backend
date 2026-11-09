# Migraciones SQL Server

Estado: migraciones `0001`–`0007` aplicadas y verificadas contra SQL Server. `0007_campaign_operations` se aplicó el 2026-11-09, su segunda ejecución fue idempotente y el verificador real aprobó campañas, alcance de grupos, campos, cambio por apelación e historial de asignaciones. Los scripts `down` permanecen pendientes de ensayo en una base temporal aislada.

## Convención

- Archivos `NNNN_nombre.up.sql` y `NNNN_nombre.down.sql` forman una unidad versionada.
- El runner en `src/shared/infrastructure/database/migrate.ts` calcula SHA-256 del archivo `up`, toma un bloqueo, ejecuta cada migración completa en transacción serializable y registra versión, nombre, checksum y duración en `[C_infra].schema_migration`.
- Una versión aplicada con checksum diferente debe detener el proceso; nunca se reescribe su historial.
- `down` sólo se usa en entornos de desarrollo/ensayo y exige confirmar que no destruye datos valiosos.
- La adopción de una base existente tendrá migraciones de inventario/mapeo propias; estos archivos no se aplican sobre el borrador `.dql`.

## Decisiones físicas

- La base es compartida: todos los esquemas de Colportando llevan prefijo `C_` y ningún objeto se crea en `dbo`.
- IDs UUID con `NEWSEQUENTIALID()` para reducir fragmentación y evitar exponer secuencias.
- Instantes en UTC mediante `datetime2(3)` y `SYSUTCDATETIME()`; fechas civiles usan `date`.
- Toda entidad tenant-owned ofrece una clave única `(tenant_id, id)` para FKs compuestas.
- `Institution` es uno-a-uno con `Tenant`; `Club` pertenece a esa institución.
- `Account` es global. `Person` pertenece al tenant y se vincula a la cuenta explícitamente.
- La condición vive en `club_membership`; el default de una membresía es `ASPIRANT`. Crear cuentas administrativas no crea membresías.
- Los alcances de autorización tienen una forma cerrada: plataforma sin tenant, institución con FK compuesta y club con FK compuesta.
- Tokens guardan únicamente SHA-256/HMAC en `binary(32)`, nunca el valor enviado al usuario.
- Idempotencia separa índices de plataforma y tenant para evitar la semántica de `NULL` en índices únicos. Un `subject_hash` permite acotar tanto cuentas autenticadas como tokens de alta sin guardar el token original.

## Comprobaciones antes de considerar verificado

1. Ejecutar `up` en una instancia temporal de la versión objetivo de SQL Server.
2. Confirmar que todas las tablas y constraints se crean dentro de una transacción.
3. Intentar crear un club con `tenant_id` de A e `institution_id` de B: debe fallar.
4. Intentar crear membresía con club de A y persona de B: debe fallar.
5. Intentar asignación `CLUB` con un club de otro tenant: debe fallar.
6. Crear cuenta administrativa sin `club_membership`: debe ser válido y no producir condición Aspirante.
7. Crear una membresía sin indicar condición: debe quedar `ASPIRANT`.
8. Intentar evento inicial con `COLPORTOR` o reconocimiento/promoción sin evidencia: debe fallar.
9. Intentar consumir/reutilizar una clave idempotente duplicada en el mismo ámbito: debe fallar o devolver el registro existente desde la API.
10. Ejecutar `down` en una base temporal y comprobar que `0001` puede revertirse después.

El runner ya cubrió la aplicación real de `up` y una segunda ejecución idempotente. `npm run database:verify-foundation` cubre las comprobaciones 3 a 7 y el rechazo del alta inicial inválida de la 8; abre una transacción y revierte todos sus datos de verificación. La reutilización de claves idempotentes se probará con la API que las consuma.

## Límites actuales

- La consistencia entre `club_membership.member_condition` y el último `condition_event` se garantiza mediante el caso de uso transaccional; una migración posterior puede añadir procedimientos si se decide imponerla también en SQL.
- No se incluye RLS. Las FKs impiden referencias cruzadas; el filtrado/autorización del backend sigue siendo obligatorio.
- No hay seeds de roles/permisos hasta aprobar una matriz concreta por módulo. La base permite varios titulares de un mismo tipo de cargo; las restricciones de cargos unipersonales se definirán por política de club.
- Planes, facturación y fórmulas financieras pertenecen a incrementos posteriores. Catálogo, inventario y ventas todavía no forman parte de `C_operations`.
