# SPEC-003 Capacitación y transición de integrante

Estado: **pendiente de validación**

## Objetivo y alcance

Registrar programas, versiones, sesiones, inscripción, asistencias, resultados, avance, promoción y reconocimiento por experiencia.

## Fuentes

Análisis/SRS (capacitaciones y asistencias), manual Kerusso (instituto, evaluación y niveles), presentación Verano 2026 y reglas del encargo.

## Requisitos

- TRN-001 `PROMPT`: aspirantes participan en capacitación registrable.
- TRN-002 `PROMPT`: criterios son versionados/configurables; no se inventa porcentaje global.
- TRN-003 `PROMPT`: avance se expone a Flutter y se autoriza en servidor.
- TRN-004 `PROMPT`: promoción por cumplimiento y reconocimiento previo son operaciones diferentes.
- TRN-005 `PROMPT`: ambas conservan actor, fecha, motivo y evidencia; reconocimiento nunca es público.
- TRN-006 `DOC`: asistencia y evaluaciones se registran; 80% de Verano 2026 es regla de campaña pendiente, no valor global.
- TRN-007 `PROP`: promoción usa snapshot de programa/criterios/evidencias para reproducibilidad.

## Actores y permisos

Aspirante consulta su avance; facilitador registra sesión/asistencia/resultados; AdminClub autorizado decide promoción/reconocimiento; auditor consulta historial. `PEND` autoridad exacta.

## Flujos y errores

Inscribir -> registrar sesiones/asistencias/resultados -> calcular avance -> declarar elegibilidad -> decidir promoción. Alternativa: reconocer experiencia con evidencia. Errores: programa no vigente, duplicado, sesión cerrada, evidencia incompleta, actor sin permiso, transición concurrente.

## Datos y transacciones

`TrainingProgram`, `ProgramVersion`, `TrainingCriterion`, `TrainingSession`, `Enrollment`, `SessionAttendance`, `AssessmentResult`, `PromotionDecision`, `ExperienceRecognition`, `MembershipConditionEvent`. Promoción/reconocimiento actualizan condición y evento en una transacción con idempotencia.

## Contratos API preliminares

Programas/sesiones, inscripción, asistencia, avance, solicitudes/decisiones y reconocimiento. OpenAPI debe indicar permiso/alcance, conflictos y ejemplos sin datos reales.

## Criterios de aceptación

- Se reconstruye asistencia y progreso por versión.
- Cumplir criterios no promueve automáticamente mientras la decisión siga abierta.
- Reconocimiento no crea asistencias ficticias y queda distinguible.
- Dos reintentos con misma clave crean una sola transición.
- Usuario sin club/permiso no registra ni consulta datos.

## Dependencias, decisiones y exclusiones

Pendiente: criterios, autoridad, promoción automática/manual, evidencia previa y vigencia entre clubes. Excluye contenidos multimedia avanzados. Tareas: I2-001, I2-002. ADR-002 y ADR-003.
