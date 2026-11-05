# Coordinación de agentes

Codex CLI 0.117.0 está instalado. El entorno actual sí permitió subagentes y se usaron para revisar documentos, SQL y fuentes operativas en paralelo. No se crearon `.codex/agents/*.toml`: ni la ayuda local ni la documentación oficial consultada establecieron un esquema de archivos de agentes de proyecto compatible con esta versión. Inventar claves violaría el encargo.

Hasta disponer de un esquema oficial verificable, las responsabilidades se delegan mediante tareas explícitas:

- Análisis y especificaciones: sólo `docs/specs/` asignados; no cambia reglas aprobadas.
- Datos: migraciones y modelo aprobado; no ejecuta DDL contra una base real.
- Backend: módulo funcional delimitado; respeta puertos y contratos.
- Seguridad: revisión de solo lectura sobre tenant, permisos, tokens e idempotencia.
- Contratos: OpenAPI y ejemplos sin datos reales.
- Verificación: pruebas y evidencia; no corrige código sin encargo separado.

Cada delegación debe incluir objetivo, especificación, archivos permitidos, contratos, dependencias, criterios, comandos de verificación y resultado esperado. El agente principal conserva la integración, resuelve conflictos y actualiza `PLAN.md` y `PROJECT_STATE.md`.
