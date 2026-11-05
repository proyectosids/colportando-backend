# Estado del proyecto

Actualizado: 2026-11-05 (America/Mexico_City)

## Fase actual

Etapa 1, análisis y propuesta. No existe implementación del backend ni migraciones aprobadas. Todas las especificaciones están **pendientes de validación**.

## Completado y verificado

- Se revisó la carpeta `../documentos/`, incluidos ocho DOCX, un PPTX, un PDF y el SQL preliminar con extensión `.dql`.
- Se verificó que la ubicación solicitada `colportando_backend` no existía y que `colportando_app_Backend` ya existía vacía. Se reutilizó esta última para evitar duplicar proyectos.
- Se inicializó un repositorio Git en esta carpeta; aún no hay commit.
- Se documentaron inventario, procesos, contradicciones, modelo SaaS, acceso, flujo de aspirante, modelo de datos, arquitectura y plan.
- Se contrastó el SQL de 1,746 líneas: 71 tablas y 9 esquemas. No se ejecutó ni modificó.
- Se verificó Codex CLI `0.117.0` y se usaron subagentes de solo lectura. La documentación oficial consultada confirma la orquestación multiagente, pero no estableció un formato compatible de proyecto para `.codex/agents/*.toml`; por eso no se inventaron archivos TOML.

## Decisiones que requieren respuesta

Estas decisiones bloquean el modelo lógico y la implementación:

1. **Tenant:** aprobar que el tenant sea la institución/universidad y que los clubes sean unidades internas. Alternativa: tenant contractual separado con una o más instituciones.
2. **Condición entre clubes:** aprobar que aspirante/colportor pertenezca a cada membresía de club. La experiencia previa puede reutilizarse como evidencia, pero cada club debe reconocerla expresamente; no hay promoción global automática.
3. **Promoción por capacitación:** confirmar si siempre requiere aprobación administrativa después de cumplir criterios, o si puede ser automática para algún programa.
4. **Criterios de capacitación:** definir quién configura los criterios y si incluyen asistencia, evaluaciones u otros requisitos. No se propone porcentaje fijo.
5. **Participación simultánea:** confirmar si una persona puede ser miembro activo de varios clubes y participar en campañas simultáneas.
6. **Alcance del inventario:** confirmar si el sistema sólo registra adquisiciones/material asignado y datos de GEMA o si administrará existencias propias del club con movimientos y ubicaciones.
7. **Finanzas:** validar fórmulas de bonificación de colportor y asociado, base cuando compras y depósitos difieren, esquemas interno/externo, moneda/redondeo, becas, viáticos, diezmo, excepciones, correcciones y reversas.
8. **Planes y suscripciones:** confirmar si la primera versión requiere administración comercial. Precios, prueba, gracia, límites, pasarela y facturación quedan fuera hasta definirse.
9. **Privacidad y retención:** definir conservación y eventual anonimización de datos personales, clientes, documentos, auditoría y registros financieros.
10. **Offline móvil:** definir operaciones Flutter que deben funcionar sin conexión y política de conflictos. La propuesta inicial sólo garantiza reintentos idempotentes; no promete sincronización offline completa.

## Trabajo parcial y limitaciones

- El diagrama y las entidades son conceptuales; no se han traducido a DDL.
- Los contratos HTTP son borradores de capacidades, no OpenAPI operativo.
- El manual Kerusso describe organización y funciones; no prueba por sí solo todas las reglas del programa institucional.
- La presentación de bonificación aporta ejemplos/reglas de Verano 2026 que deben validarse con Finanzas antes de convertirse en fórmulas del sistema.
- No hay proyectos Flutter o React presentes en la raíz inspeccionada; no se pudieron contrastar contratos de clientes.

## Verificaciones ejecutadas

- Inventario recursivo de `../documentos/` y hashes SHA-256.
- Extracción estructural completa de los ocho DOCX. No contenían comentarios ni cambios controlados; algunos metadatos de páginas estaban desactualizados.
- PDF Kerusso: 41 páginas, texto completo extraído y revisión visual de páginas 25-31 y 37-40.
- Presentación Verano 2026: 11 diapositivas, revisión visual de todas las miniaturas y de las diapositivas 1, 10 y 11 en PowerPoint (Vista protegida).
- Inspección estática del T-SQL; sin conexión a SQL Server y sin ejecución de DDL.
- `git status` y revisión de estructura del repositorio.
- `codex --version` y ayuda local; consulta de documentación oficial sobre multiagente/configuración.

## Siguiente acción concreta

Esperar la validación del usuario sobre las diez decisiones anteriores. Después: actualizar ADR y especificaciones a “aprobada”, crear el modelo lógico/migraciones versionadas y comenzar el incremento I0 de `docs/PLAN.md`. No iniciar código antes de esa validación.
