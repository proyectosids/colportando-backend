# ADR-002 Condición por membresía de club

Estado: **aceptada el 2026-11-05**
Fecha: 2026-11-05

## Contexto

El encargo separa persona, cuenta y membresías y prohíbe una condición global sin resolver transferibilidad. El SQL coloca condición en Persona; documentos la mezclan con participación de campaña.

## Decisión propuesta

Persona representa identidad tenant; Cuenta representa acceso; `ClubMembership` representa pertenencia estable. Aspirante/Colportor vive en esa membresía. Participación de campaña, roles y cargos son relaciones separadas. Evidencia previa puede referenciarse, pero cada club reconoce expresamente la condición mediante operación auditada.

## Consecuencias

Una persona puede tener condiciones distintas por club y cuentas administrativas no reciben condición. Se requiere historial por membresía y autorización explícita. Evita filtraciones/automatismos entre clubes a costa de repetir la decisión de reconocimiento.

## Alternativas

- Condición global: simple, pero ignora autoridad de cada club y el encargo.
- Condición por campaña: pierde continuidad del integrante entre campañas.

## Validación requerida

Confirmar transferibilidad, membresías simultáneas y autoridad/evidencia del reconocimiento.
