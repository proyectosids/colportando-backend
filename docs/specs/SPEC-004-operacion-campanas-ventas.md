# SPEC-004 Campañas materiales y ventas

Estado: **pendiente de validación**

## Objetivo y alcance

Modelar campañas, participaciones, grupos, asociados, campos, catálogo, adquisiciones, ventas, pagos, cancelaciones e inventario aprobado.

## Fuentes

Análisis consolidado/inicial, SRS, casos de uso, modelo conceptual, manual y SQL preliminar.

## Requisitos

- OPS-001 `DOC`: campaña agrupa participantes, grupos, campos, reglas y operaciones.
- OPS-002 `DOC`: grupos conservan asignaciones/apelaciones históricas; asociado coordina alcance asignado.
- OPS-003 `DOC`: GEMA es fuente externa de catálogo/precios/bonificable; registrar fuente y corte.
- OPS-004 `DOC/PROMPT`: venta conserva precios/condiciones aplicados; pagos, depósitos y adquisiciones son hechos distintos.
- OPS-005 `DOC`: cancelación/reembolso requiere resolución y evidencia; no borrado silencioso.
- OPS-006 `PROMPT`: ventas, pagos y escrituras móviles sensibles son idempotentes.
- OPS-007 `PEND`: stock propio del club sólo se implementa si se aprueba alcance de inventario.

## Actores y permisos

Miembro/Colportor registra operaciones propias; Asociado consulta grupo autorizado; Administración gestiona campaña/grupos/catálogos; Finanzas sólo capacidades asignadas. GEMA no se asume usuario.

## Flujos y errores

Campaña -> participación -> grupo/campo -> catálogo/adquisición -> venta/líneas -> pagos -> cancelación/reembolso. Errores: campaña cerrada, material sin vigencia, precio alterado, pago excedente, referencia duplicada, grupo/tenant incorrecto, crédito no autorizado.

## Datos y transacciones

`Campaign`, `CampaignParticipation`, `Group`, `GroupAssignment`, `AssociateAssignment`, `Field`, `FieldAssignment`, `Appeal`, `Material`, `CampaignCatalogItem`, `Acquisition`, `Customer`, `Sale`, `SaleLine`, `CustomerPayment`, `Cancellation`, `Refund`. Venta/líneas y resolución/reembolso son transacciones. Totales derivados deben validarse contra líneas; snapshots permanecen.

## Contratos API preliminares

Listados paginados con filtros y orden permitidos; mutaciones aceptan `Idempotency-Key`. El servidor obtiene actor/tenant de sesión y valida participación/campaña.

## Criterios de aceptación

- Precio histórico no cambia al actualizar catálogo.
- Venta de otro tenant/grupo no es visible.
- Reintento idéntico devuelve el mismo resultado; mismo key con otro cuerpo falla.
- Cancelación no elimina venta/pagos y conserva resolutor/motivo.
- No se presenta inventario GEMA como stock propio.

## Dependencias, decisiones y exclusiones

Pendiente: estados, apelaciones, datos mínimos cliente, criterios de cancelación y alcance de stock. Excluye inventario interno GEMA, banca, facturación completa y GPS permanente. Tareas: I3-001 a I5-001.
