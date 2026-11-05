# ADR-004 Evidencia financiera e idempotencia

Estado: **aceptada el 2026-11-05**
Fecha: 2026-11-05

## Contexto

Las fuentes cambian por campaña y presentan fórmulas ambiguas. Flutter puede reintentar operaciones por conectividad limitada. Recalcular historia con reglas actuales alteraría su significado.

## Decisión propuesta

Versionar políticas por vigencia y preservar en cada cálculo/operación los valores aplicados: moneda, escala/redondeo, precios/costos, entradas, fórmula/version, porcentajes, resultado, fuentes, aprobaciones, ajustes y reversas. Usar idempotencia por tenant/actor/operación con clave, hash del request, estado y resultado. Corregir mediante movimientos/decisiones compensatorias, no borrado.

## Consecuencias

Auditoría y reproducción fiables; mayor almacenamiento y contratos más explícitos. Los valores derivados actuales pueden calcularse, pero la evidencia histórica no se reinterpreta. Reusar clave con payload distinto produce conflicto.

## Alternativas

- Recalcular siempre: rompe historia.
- Guardar sólo total: no explica el resultado.
- UUID sin hash/resultado: no detecta reutilización incorrecta.

## Validación requerida

Fórmulas, moneda, redondeo, autoridad, retención de idempotencia y tratamiento de reversas.
