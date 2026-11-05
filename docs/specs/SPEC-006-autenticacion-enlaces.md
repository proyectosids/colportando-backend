# SPEC-006 Autenticación y enlaces mobile first

Estado: **aprobada el 2026-11-05**

## Objetivo y alcance

Definir cuenta, contraseña, sesiones, invitación, registro, verificación de correo y recuperación de acceso para Flutter y web sin depender de redirecciones React.

## Fuentes

Estos flujos provienen del encargo actual; las fuentes de negocio sólo documentan enlaces de inscripción sin seguridad técnica.

## Requisitos

- AUTH-001 `PROMPT`: contraseñas con hash resistente y política configurable; nunca logs/ejemplos reales.
- AUTH-002 `PROMPT`: invitación, verificación y reset usan tokens aleatorios, hash persistido, expiración, propósito y consumo único atómico.
- AUTH-003 `PROMPT`: destinos se seleccionan de allowlist; no open redirects.
- AUTH-004 `PROMPT`: Flutter completa acciones por API incluso sin React.
- AUTH-005 `PROP`: access token corto y refresh token rotativo por familia/dispositivo; reutilización revoca familia.
- AUTH-006 `PROMPT`: rate limits y respuestas no revelan existencia de cuenta en recuperación.
- AUTH-007 `PROMPT`: registro público no eleva condición ni permisos.

## Actores y permisos

Visitante con token, cuenta no verificada, cuenta activa, administrador que invita y servicio de correo. Invitación incorpora tenant/club/rol permitido sólo cuando el emisor posee alcance; invitación de participante nunca concede administración.

## Flujos y errores

Invitar -> abrir universal/app/web link -> Flutter consulta acción -> registrar/vincular -> verificar -> iniciar sesión. Recuperación: solicitar respuesta neutral -> abrir enlace -> validar -> cambiar contraseña -> revocar sesiones según política. Errores: expirado, consumido, revocado, propósito/destino incorrecto, correo conflictivo, tenant suspendido.

## Datos y transacciones

`Account`, `Credential`, `Device`, `Session`, `RefreshTokenFamily`, `RefreshToken`, `ActionToken`, `Invitation`. Sólo hash de tokens; consumo y efecto de negocio en misma transacción. Auditoría minimizada, sin token ni contraseña.

## Contratos API preliminares

Futuros endpoints `/api/v1/auth/*` devuelven JSON y códigos consistentes. Configuración externa: Associated Domains/Universal Links iOS, App Links/asset links Android y rutas web verificadas. Backend conserva allowlist y metadatos de acción.

## Criterios de aceptación

- Token consumido no vuelve a usarse ni en carrera concurrente.
- Reset no permite open redirect ni enumera cuentas.
- Flutter completa registro/verificación/reset sin página React.
- Refresh reutilizado revoca familia.
- Ejemplos OpenAPI no contienen secretos/datos reales.

## Dependencias, decisiones y exclusiones

Pendiente: proveedor de correo, dominios/bundle IDs, TTL, política de sesiones/MFA. Excluye social login y SMS salvo aprobación. Tareas: I1-001, I1-002.
