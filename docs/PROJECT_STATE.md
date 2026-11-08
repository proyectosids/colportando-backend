# Estado del proyecto

Actualizado: 2026-11-08 (America/Mexico_City)

## Fase actual

Etapa 2. I0-001 e I1-001 están completados y verificados. I0-002 ya fue aplicado en SQL Server y sus invariantes multitenant fueron verificadas; sólo falta ensayar `down` en una base temporal aislada.

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
- API `/api/v1/auth`: login, refresh, logout, solicitud/confirmación de verificación, solicitud/confirmación de reset y perfil autenticado `/me`; OpenAPI alineado.

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
- El proveedor de correo sigue sin definirse. El puerto de entrega está implementado y probado; el adaptador activo sólo advierte sin registrar token, correo ni secretos, por lo que los enlaces no se envían todavía a usuarios reales.
- La creación/vinculación pública de cuenta, Persona y membresía pertenece a I1-002; capacitación y módulos operativos siguen pendientes.
- El manual Kerusso describe organización y funciones; no prueba por sí solo todas las reglas del programa institucional.
- La presentación de bonificación aporta ejemplos/reglas de Verano 2026 que deben validarse con Finanzas antes de convertirse en fórmulas del sistema.
- No hay proyectos Flutter o React presentes en la raíz inspeccionada; no se pudieron contrastar contratos de clientes.

## Verificaciones ejecutadas

- Inventario recursivo de `../documentos/` y hashes SHA-256.
- Extracción estructural completa de los ocho DOCX. No contenían comentarios ni cambios controlados; algunos metadatos de páginas estaban desactualizados.
- PDF Kerusso: 41 páginas, texto completo extraído y revisión visual de páginas 25-31 y 37-40.
- Presentación Verano 2026: 11 diapositivas, revisión visual de todas las miniaturas y de las diapositivas 1, 10 y 11 en PowerPoint (Vista protegida).
- Inspección estática del T-SQL y ejecución real de `up` contra SQL Server. Se corrigió el esquema reservado `[identity]` tras una primera ejecución revertida automáticamente.
- `git status` y revisión de estructura del repositorio.
- `codex --version` y ayuda local; consulta de documentación oficial sobre multiagente/configuración.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm test`: 4 archivos, 12 pruebas aprobadas.
- `npm run test:integration`: 2 archivos, 10 pruebas HTTP aprobadas (requirió permitir puerto local efímero).
- `npm run openapi:validate`: aprobado.
- `npm run build`: aprobado.
- `npm audit --omit=dev`: 0 vulnerabilidades de producción. El toolchain de desarrollo conserva 7 avisos moderados transitivos de `minimatch`; forzar la corrección propuesta rompería compatibilidad TypeScript/ESLint.
- Migraciones: pares up/down, transacciones y checksums verificados; `up` e idempotencia ejecutados en SQL Server real. `npm run database:verify-foundation` aprobó seis invariantes y revirtió sus fixtures.
- `npm run database:verify-auth`: verificación de correo, login, rotación, rechazo de reutilización, invalidación de access token, reset, nuevo login y logout aprobados en SQL Server real.

## Siguiente acción concreta

Iniciar I1-002: invitación y alta pública que crea/vincula cuenta, Persona y membresía siempre como `ASPIRANT`, con transacción e idempotencia. Elegir y configurar un proveedor de correo antes de pruebas con usuarios reales.
