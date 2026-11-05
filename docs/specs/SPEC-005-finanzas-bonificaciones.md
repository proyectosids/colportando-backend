# SPEC-005 Finanzas créditos depósitos y bonificaciones

Estado: **aprobada el 2026-11-05 con cálculo automático bloqueado**

## Objetivo y alcance

Registrar créditos, autorizaciones, depósitos, reglas financieras versionadas, cálculos reproducibles, sanciones/ajustes, aprobación y aplicación institucional.

## Fuentes

Análisis/SRS/modelo/casos, presentación Verano 2026, manual Kerusso, SQL preliminar y reglas históricas del encargo.

## Requisitos

- FIN-001 `DOC`: créditos, compras, ventas, pagos y depósitos son conceptos distintos.
- FIN-002 `DOC/PROMPT`: configuración financiera tiene vigencia/versión y no sobrescribe la usada.
- FIN-003 `PROMPT`: cálculo conserva entradas, fórmula, versión, moneda, redondeo, porcentajes y resultado.
- FIN-004 `DOC`: no calcular automáticamente hasta validar base, orden, interno/externo, becas y excepciones.
- FIN-005 `PROMPT`: correcciones/reversas crean movimientos compensatorios auditados, no borrados.
- FIN-006 `DOC`: acceso de Finanzas es institucional y limitado por permisos.
- FIN-007 `DOC`: sanciones/ajustes requieren autoridad, motivo y evidencia; porcentajes caso a caso no se inventan.

## Actores y permisos

Finanzas configura/conciliará/aprobará según permisos; AdminInstitucional consulta indicadores; AdminClub aporta datos autorizados; miembro consulta sólo su resultado; Asociado sólo detalle aprobado de grupo. Comisión de becas y fuente GEMA requieren definición.

## Flujos y errores

Registrar crédito/autorización -> importar/capturar compras/depósitos -> conciliar -> seleccionar regla vigente -> calcular borrador -> revisar/aprobar -> aplicar a cuenta. Errores: fuente faltante, vigencias solapadas, fórmula sin aprobar, moneda distinta, datos no conciliados, duplicado, conflicto de versión.

## Datos y transacciones

`Credit`, `CreditAuthorization`, `InstitutionalDeposit`, `FinancialSourceRecord`, `FinancialRuleVersion`, `BonusCalculation`, `BonusCalculationLine`, `BonusAdjustment`, `BonusApproval`, `BonusApplication`. Importes `decimal`, moneda y referencias únicas. Aprobación/aplicación y outbox atómicos.

## Contratos API preliminares

Endpoints futuros separados para captura/importación, conciliación, reglas, cálculo, aprobación y consulta. OpenAPI mostrará estados y dependencias; nunca estimará monto con datos faltantes.

## Criterios de aceptación

- Se reproduce un cálculo histórico aunque cambie la regla actual.
- Regla incompleta impide cálculo definitivo.
- Reversa conserva original y actor/motivo.
- Institución A no consulta finanzas B; Asociado no ve detalle fuera de grupo.
- Importación repetida con misma referencia no duplica movimientos.

## Dependencias, decisiones y exclusiones

Bloquean: fórmula/base, nivel medio 10,250, interno/externo, compatibilidad de becas, diezmos, moneda/redondeo, sanciones, fuente autoritativa y aplicación/pago. Excluye banca, contabilidad y pasarela. Tareas: I6-001, I6-002, I7-001. ADR-004.
