# ADR-003 Clean Architecture modular y transacciones abstractas

Estado: **propuesta técnica pendiente de validación de etapa**
Fecha: 2026-11-05

## Contexto

El stack exige Express/`mssql` y Clean Architecture. Casos como alta, promoción, ventas y bonificaciones cruzan varias escrituras y requieren atomicidad sin acoplar aplicación a `mssql`.

## Decisión propuesta

Organizar por capacidad con capas `domain`, `application`, `infrastructure` y `presentation`. Interfaces de repositorio/transacción viven en aplicación. Un puerto `TransactionManager` entrega contexto abstracto a repositorios; infraestructura lo implementa con `mssql.Transaction`. Composición e inyección son manuales en un punto explícito.

## Consecuencias

Dominio/casos de uso se prueban sin HTTP/SQL y las dependencias apuntan hacia dentro. El contexto transaccional necesita disciplina para no convertirse en abstracción genérica. No se añaden ORM, DI container o repositorios base.

## Alternativas

- Transacciones directas en casos de uso: viola independencia.
- Unit of Work con catálogo global de repositorios: acopla módulos.
- Microservicios: complejidad sin evidencia de necesidad.

## Validación requerida

No hay pregunta de negocio; se aprobará junto con la puerta G-001 antes del bootstrap.
