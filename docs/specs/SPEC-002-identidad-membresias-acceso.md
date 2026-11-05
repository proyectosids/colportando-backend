# SPEC-002 Identidad membresías y acceso

Estado: **pendiente de validación**

## Objetivo y alcance

Separar cuenta, persona, membresía de club, condición, estado, rol, cargo y alcance. Incluye alta segura como Aspirante y autorización; no incluye capacitación detallada.

## Fuentes

SRS, modelo conceptual, casos de uso, manual y nuevas reglas del encargo.

## Requisitos

- IAM-001 `PROMPT`: cuenta y Persona son conceptos distintos y vinculables.
- IAM-002 `PROMPT`: una membresía participante creada públicamente inicia `ASPIRANT`.
- IAM-003 `PROMPT`: cuentas administrativas sin membresía participante no reciben condición.
- IAM-004 `PROP`: condición Aspirante/Colportor pertenece a membresía de club; estado de membresía es separado.
- IAM-005 `PROMPT`: el cliente público no asigna condición elevada, roles ni cargos.
- IAM-006 `PROMPT`: roles, permisos, cargos y alcances son independientes.
- IAM-007 `DOC/PROP`: Asociado es asignación operativa por campaña/grupo, no condición global.
- IAM-008 `PROMPT`: toda transición conserva actor, fecha, motivo y método.

## Actores y permisos

Miembro propio, Asociado limitado a grupo, Directiva, AdminClub, AdminInstitucional, Finanzas y AdminPlataforma. Cargos: presidente, vicepresidente, secretario, tesorero, asistente/consejero con vigencia.

## Flujos y errores

Alta: validar token/contexto -> vincular/crear cuenta y Persona -> crear membresía Aspirante -> opcional participación. Rechazar duplicado, elevación de privilegio, cuenta/persona conflictiva o club fuera de alcance. Asignar/revocar rol o cargo exige permiso y auditoría.

## Datos y transacciones

`Account`, `Person`, `AccountPersonLink`, `ClubMembership`, `MembershipConditionEvent`, `Role`, `Permission`, `AccessAssignment`, `ClubPosition`, `PositionAssignment`. Unicidad de membresía activa según decisión de simultaneidad. Alta y asignaciones son atómicas e idempotentes.

## Contratos API preliminares

Capacidades futuras: `/me`, invitaciones/registro, membresías, asignaciones de acceso y cargos. Las respuestas del perfil deben incluir condición, roles, permisos, alcances y resumen de avance autorizado.

## Criterios de aceptación

- Registro público siempre produce Aspirante y no acepta `COLPORTOR`/roles elevados.
- Una cuenta institucional sin membresía no aparece como Aspirante.
- Colportor puede tener cargo Directiva sin perder condición.
- Asociado no consulta grupos ajenos.
- Historial de condición no se sobrescribe.

## Dependencias, decisiones y exclusiones

Pendiente: transferibilidad entre clubes, simultaneidad, permisos por cargo y naturaleza financiera de asociado. Excluye promoción, definida en SPEC-003. Tareas: G-001, I0-002, I1-002, I3-001. ADR-002.
