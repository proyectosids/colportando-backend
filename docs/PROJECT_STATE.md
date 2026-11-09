# Estado del proyecto

Actualizado: 2026-11-09 (America/Mexico_City)

## Fase actual

Etapa 2. I0-001, I1-001, I1-002, I2-001, I2-002 e I3-001 están completados y verificados. El siguiente incremento es I4-001 (catálogo, adquisiciones e inventario aprobado).

## Completado y verificado

- Se revisó la carpeta `../documentos/`, incluidos ocho DOCX, un PPTX, un PDF y el SQL preliminar con extensión `.dql`.
- Se verificó que la ubicación solicitada `colportando_backend` no existía y que `colportando_app_Backend` ya existía vacía. Se reutilizó esta última para evitar duplicar proyectos.
- Se inicializó el repositorio Git y la etapa 1 quedó versionada en el commit `07e2629`.
- Se documentaron inventario, procesos, contradicciones, modelo SaaS, acceso, flujo de aspirante, modelo de datos, arquitectura y plan.
- Se contrastó el SQL de 1,746 líneas: 71 tablas y 9 esquemas. No se ejecutó ni modificó.
- Se verificó Codex CLI `0.117.0` y se usaron subagentes de solo lectura. La documentación oficial consultada confirma la orquestación multiagente, pero no estableció un formato compatible de proyecto para `.codex/agents/*.toml`; por eso no se inventaron archivos TOML.
- Bootstrap Node/TypeScript/Express con configuración validada, logs redactados, correlación, Helmet, CORS allowlist, rate limit, errores seguros y cierre controlado.
- API `/api/v1/health`, OpenAPI `/api/openapi.json` y Swagger `/api/docs`; documentación deshabilitada por defecto en producción.
- Runner `mssql` con pool, checksum, bloqueo de aplicación, transacción serializable e historial.
- Migraciones fresh-install: infraestructura y 18 tablas fundacionales con 32 FKs, condición por membresía, tokens hash, RBAC con alcance, cargos, auditoría e idempotencia.
- Revisión de seguridad integrada: evidencia obligatoria para promoción/reconocimiento, actor vinculado a asignación tenant, exclusión consumir/revocar token y JSON inválido como 400.
- Migraciones `0001` y `0002` aplicadas en SQL Server real: 2 versiones registradas y 19 tablas creadas. Una segunda ejecución no reaplicó versiones.
- Verificación transaccional reproducible: referencias cruzadas de club, membresía y acceso fueron rechazadas; cuenta administrativa sin membresía aceptada; membresía predeterminada `ASPIRANT`; alta inicial `COLPORTOR` rechazada. Los datos de prueba se revirtieron.
- I1-001: autenticación por correo/contraseña con Argon2id, JWT HS256 corto validado contra sesión activa, refresh tokens rotativos por familia y revocación ante reutilización.
- Verificación de correo y recuperación mediante tokens opacos aleatorios guardados como HMAC-SHA-256, expiración, propósito, revocación previa y consumo único con efecto atómico.
- Reset de contraseña revoca sesiones, familias y refresh tokens; logout por refresh token es idempotente y revoca la familia completa.
- Migración `0003_auth_sessions` aplicada en SQL Server; flujo real completo aprobado con fixtures aleatorios eliminados al finalizar.
- La instalación activa está en la base compartida `IDS-APP`. Los nueve esquemas físicos usan el prefijo `C_`: `C_infra`, `C_platform`, `C_organization`, `C_identity`, `C_membership`, `C_authorization`, `C_audit`, `C_training` y `C_operations`.
- Las migraciones `0001`–`0007` se aplicaron allí de forma transaccional e idempotente: 39 tablas de Colportando, separadas de las tablas preexistentes. El historial vive en `C_infra.schema_migration`.
- API `/api/v1/auth`: login, refresh, logout, solicitud/confirmación de verificación, solicitud/confirmación de reset y perfil autenticado `/me`; OpenAPI alineado.
- I1-002 implementa invitaciones autorizadas por `membership.invitation.create`, alcance resuelto en servidor, correo específico del club, consulta pública con correo enmascarado y aceptación transaccional.
- El alta reutiliza la Persona vinculada dentro del tenant o crea cuenta/Persona/vínculo; la membresía sólo puede resultar `PENDING` + `ASPIRANT`. El payload público rechaza condición, rol y cargo.
- Creación y aceptación usan `Idempotency-Key`; el retry no reenvía correo ni vuelve a consumir el token. Ambas operaciones producen auditoría sin guardar el token.
- Migración `0004_club_invitations` aplicada en `IDS-APP`; una segunda ejecución no reaplicó cambios. El historial contiene `0001`–`0004`, la tabla quedó creada y el permiso `membership.invitation.create` existe una sola vez.
- El verificador real de I1-002 aprobó autorización, creación, entrega única, consulta, aceptación como `PENDING` + `ASPIRANT`, reintentos idempotentes y ausencia de acceso elevado. Sus fixtures se eliminaron: `C_membership.club_invitation` quedó con cero filas al finalizar.
- I2-001 incorpora programas y versiones de club, sesiones abiertas/cerradas/canceladas, inscripción exclusiva de membresías aspirantes, asistencia corregible mientras la sesión esté abierta y avance factual ligado a la versión.
- La API `/api/v1/training` crea programas, sesiones e inscripciones, registra asistencia, cierra/cancela sesiones y expone avance propio o autorizado. Todas las escrituras requieren `Idempotency-Key`; permisos y alcance se resuelven en servidor.
- El avance devuelve conteos y porcentaje sobre asistencias registradas con `eligibility: NOT_EVALUATED` y `promotedAutomatically: false`. I2-001 no modifica condición ni crea eventos de promoción.
- Migración `0005_training_core` aplicada e idempotente en `IDS-APP`. Su verificador real aprobó reintentos, consulta propia, rechazo de escritura/lectura no autorizadas, rechazo de asistencia tras cierre y permanencia en `ASPIRANT`; los fixtures se eliminaron.
- I2-002 configura criterios explícitos por versión (`minimumPresentSessions`, `minimumAttendanceRate` y/o códigos de evidencia), sin valor predeterminado global. La promoción toma esos criterios desde el servidor, calcula métricas, conserva snapshot y exige decisión administrativa tenant-bound.
- El reconocimiento por experiencia es una operación y tabla diferentes, exige resumen, motivo y evidencia, y no crea inscripciones ni asistencias. Sólo una aprobación explícita cambia la condición mediante `PRIOR_EXPERIENCE_RECOGNITION`.
- Promoción y reconocimiento son transaccionales, idempotentes y auditados; vinculan actor y asignación de acceso. El historial de condición tiene lectura protegida por `membership.transition-history.read`.
- Migración `0006_member_transitions` aplicada e idempotente en `IDS-APP`. El verificador real rechazó evidencia insuficiente y actores no autorizados, aprobó ambos caminos con reintentos, confirmó eventos distintos, snapshot versionado, cero asistencias ficticias, historial auditable y limpieza de fixtures.
- I3-001 incorpora campañas por club, participación por membresía, grupos, asignaciones históricas, asociado operativo por grupo, campos y asignación de campos. El asociado no se convierte en rol global ni altera la condición de la membresía.
- Solicitudes de cambio y apelaciones son procesos separados y auditables. Una aprobación cierra la asignación vigente y crea una nueva; no se impuso un límite de apelaciones ni reglas financieras no aprobadas.
- La API `/api/v1/operations` cubre administración de campañas, grupos, participaciones, asociados y campos; cambio/apelación; y lectura de grupo protegida por permiso administrativo o asignación activa del asociado.
- Migración `0007_campaign_operations` aplicada e idempotente en `IDS-APP`. El verificador real aprobó reintentos, aislamiento de grupo, rechazo de terceros, campo asignado, apelación aprobada, historial de dos asignaciones y exactamente una asignación activa.

## Decisiones aprobadas

1. Tenant = institución/universidad; clubes como unidades internas. Club independiente usa tenant institucional mínimo.
2. Condición Aspirante/Colportor por membresía de club; evidencia previa no promueve globalmente.
3. Promoción por capacitación requiere aprobación administrativa explícita.
4. Criterios versionados por programa y club, configurados por administración autorizada; sin porcentaje global fijo.
5. Se permiten membresías y campañas simultáneas en varios clubes, sujetas a reglas específicas futuras, sin bloqueo global.
6. V1 registra catálogo, adquisiciones y material asignado; no administra inventario interno de GEMA ni ledger de stock propio.
7. Finanzas conserva evidencia y queda sin cálculo automático hasta aprobar fórmulas concretas.
8. Planes, cobros, pasarela y facturación comercial quedan fuera de V1.
9. Sin borrado físico de evidencia financiera/auditoría; la política temporal de retención/anonimización se añadirá antes de producción.
10. V1 online con idempotencia/reintentos; sin sincronización offline completa.

## Trabajo parcial y limitaciones

- Los scripts `down` aún no se han ejecutado: deben probarse en una base temporal aislada, no sobre la base configurada que acaba de recibir el esquema.
- Gmail quedó integrado mediante Nodemailer con `AUTH_PASS_APP`, remitente `Colportando App`, plantillas HTML/texto específicas para verificación y reset, y respuesta neutral aun si el proveedor falla. La conexión SMTP fue verificada sin enviar correo.
- `AUTH_ACTION_BASE_URL` permanece en localhost para desarrollo; falta definir el dominio HTTPS o deep link Flutter definitivo antes de enviar enlaces a usuarios reales.
- Catálogo, adquisiciones, inventario, ventas y finanzas siguen pendientes de sus incrementos y reglas aprobadas.
- El manual Kerusso describe organización y funciones; no prueba por sí solo todas las reglas del programa institucional.
- La presentación de bonificación aporta ejemplos/reglas de Verano 2026 que deben validarse con Finanzas antes de convertirse en fórmulas del sistema.
- No hay proyectos Flutter o React presentes en la raíz inspeccionada; no se pudieron contrastar contratos de clientes.

## Verificaciones ejecutadas

- Inventario recursivo de `../documentos/` y hashes SHA-256.
- Extracción estructural completa de los ocho DOCX. No contenían comentarios ni cambios controlados; algunos metadatos de páginas estaban desactualizados.
- PDF Kerusso: 41 páginas, texto completo extraído y revisión visual de páginas 25-31 y 37-40.
- Presentación Verano 2026: 11 diapositivas, revisión visual de todas las miniaturas y de las diapositivas 1, 10 y 11 en PowerPoint (Vista protegida).
- Inspección estática del T-SQL y ejecución real de `up` contra SQL Server. Los esquemas físicos ahora usan el prefijo `C_` para convivir dentro de una base compartida sin colisiones.
- `git status` y revisión de estructura del repositorio.
- `codex --version` y ayuda local; consulta de documentación oficial sobre multiagente/configuración.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm test`: 9 archivos, 37 pruebas aprobadas; incluye contratos de esquema `C_*`, criterios explícitos, separación promoción/reconocimiento y reglas operativas de campaña.
- `npm run test:integration`: 4 archivos, 20 pruebas HTTP aprobadas; incluye decisión administrativa explícita, validación estricta, separación del reconocimiento y contratos de operaciones.
- `npm run openapi:validate`: aprobado.
- `npm run build`: aprobado.
- `npm audit --omit=dev`: 0 vulnerabilidades de producción. El toolchain de desarrollo conserva 7 avisos moderados transitivos de `minimatch`; forzar la corrección propuesta rompería compatibilidad TypeScript/ESLint.
- Migraciones: pares up/down, transacciones y checksums verificados; `up` e idempotencia ejecutados en SQL Server real. `npm run database:verify-foundation` aprobó seis invariantes y revirtió sus fixtures.
- `npm run database:verify-auth`: verificación de correo, login, rotación, rechazo de reutilización, invalidación de access token, reset, nuevo login y logout aprobados en SQL Server real.
- `npm run database:verify-invitations`: creación y aceptación idempotentes, correo único, membresía aspirante y cero elevación de acceso aprobados en SQL Server real; fixtures eliminados.
- `npm run database:verify-training`: programa/versionado, sesión/cierre, inscripción, asistencia, avance propio, permisos, reintentos y permanencia como aspirante aprobados en SQL Server real; fixtures eliminados.
- `npm run database:verify-member-transitions`: criterios versionados sin umbral global, promoción, reconocimiento, autorización, evidencia, idempotencia, eventos separados, historial, ausencia de asistencias ficticias y limpieza aprobados en SQL Server real.
- `npm run database:verify-campaign-operations`: campañas, participaciones, grupos, asociado, campos, alcance de lectura, cambio por apelación, idempotencia e historial aprobados en SQL Server real.
- `npm run mail:verify`: autenticación SMTP Gmail aprobada sin envío. Plantillas de verificación y recuperación cubiertas por pruebas y vistas HTML locales.

## Siguiente acción concreta

Iniciar I4-001: precisar con SPEC-004 el catálogo, adquisiciones e inventario aprobado, conservando snapshots históricos y sin administrar inventario interno de GEMA.
