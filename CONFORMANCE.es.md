> Traducción comunitaria (borrador) — Política P2-002 de NTARI, Difusión Multilingüe Global. Fuente: CONFORMANCE.md (original en inglés, instantánea del 2026-10-05). Borrador comunitario asistido por máquina, pendiente de revisión por mantenedores regionales conforme a P2-002 §3.1. Las especificaciones técnicas centrales permanecen en inglés conforme a §2.2.
>
> ¿Encontraste un error en esta traducción? Tu corrección es una contribución
> bienvenida y valorada: haz un fork del repositorio y abre un pull request en
> https://github.com/NTARI-RAND/Agrinet.

> **El original en inglés es normativo.** Esta traducción se ofrece para lectura, no para interpretación: donde difiera de `CONFORMANCE.md`, rige el inglés. Las palabras clave normativas (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY), los nombres de campos, las etiquetas y los identificadores se mantienen en inglés porque constituyen el contrato de conformidad.

# Conformidad — Janus-Facing Architecture

La autodescripción del repositorio en los propios términos de la arquitectura, expuesta **antes** de cualquier cosa específica del producto, según la regla de orden de la arquitectura. Cada afirmación de conformidad está vinculada al mecanismo y a la verificación que la hacen cumplir; de lo contrario, se etiqueta como suplencia o como en revisión. La prosa no vinculada es marketing.

La arquitectura es **Janus-Facing Architecture (JFA)**: el documento de arquitectura unificada de NTARI, documentación libre bajo el bien común AGPL-3.0 del proyecto.

## Declaración de rol

Agrinet es una **economía** de la **capa de Economía y Educación** de JFA — la instancia de economía de referencia: coordinación e intercambio agrícolas, que aplica las cuatro capas inferiores (sustrato, registro, pacto, gobernanza) a una actividad socioeconómica específica. Mantiene su propia instancia de registro por operador y adopta la escala de evaluación del pacto en el nivel económico.

| Término de este repositorio | Rol en la arquitectura |
|---|---|
| Mycelium | la **bitácora de diálogos por operador** — de solo adición, encadenada por hashes, sellada por diálogo |
| Operador | un **operador**: una instancia de plataforma que mantiene su propia bitácora |
| Adopción de LBTAS | el **pacto** en el nivel económico — distribuciones, nunca promedios |
| Liquidación en depósito de garantía (escrow) | la postura de **fase uno** de la economía: depósito de garantía ahora, crédito después, por gobernanza |

## Invariantes y sus vínculos — según el estado de `main`

Honestidad primero: **la maquinaria de economía de miembros de JFA está en revisión, no en `main`.** El alcance de la bitácora por operador, el stub de checkpoint del testigo, el modelo de operador y la contabilidad de intercambio de saldo neto cero viven en ramas de refactorización abiertas; `main` es hoy la aplicación sin ellos. Cada invariante de abajo queda vinculado cuando su rama se integra, y esta tabla se actualiza en el mismo PR (la regla de viajar juntos, *rides-along rule*).

| Invariante (arquitectura) | Estado | Mecanismo comprometido |
|---|---|---|
| La bitácora es **de solo adición**; las correcciones son entradas nuevas; una desestimación anota, nunca borra | En revisión | Mycelium: bitácoras por intercambio encadenadas por hashes; sin actualización, sin borrado |
| La unidad atómica es el **diálogo**, sellado cuando está completo y en reposo | En revisión | Sello del diálogo mantenido abierto por reclamos de daño no resueltos; a quienes no emiten calificación se les asigna un valor por defecto marcado |
| **Ninguna PII en el bien común** | En revisión | La cadena consigna la forma de un intercambio; la narrativa se referencia, es local del miembro y borrable |
| Cada operador mantiene su **propia bitácora**; no hay cadena global | En revisión | Alcance de bitácora por operador; atestiguamiento (no consenso) como modelo de no equivocación |
| Atestiguamiento con independencia; los despliegues de un solo testigo son **suplencias etiquetadas** | En revisión (suplencia) | Stub de checkpoint del testigo; la federación es el problema abierto 2 |
| La reputación se lleva como una **distribución completa**, nunca promediada | En revisión | LBTAS v2 (la versión sin promedios) es el piso de adopción |
| Los saldos son una **función determinista del registro sellado**; los intercambios se compensan a cero | En revisión | Contabilidad de intercambio de saldo neto cero |
| La liquidación es en **depósito de garantía**; el paso a crédito es una decisión de gobernanza, nunca un valor por defecto del código | Postura permanente | Depósito de garantía primero; cualquier paso a crédito emitido por miembros requiere aprobación de la Junta, aviso a la membresía y una revisión regulatoria completada |

## Suplencias y residuos abiertos

- **Suplencia de un solo testigo.** Hasta que testigos independientes contrafirmen los checkpoints del operador, la no equivocación del registro es autoatestiguada y se etiqueta como tal.
- **El crédito no está activado.** El depósito de garantía es lo opuesto al crédito y se describe llanamente como tal; el arranque en tres fases (primero el volumen y la integridad mostrada) rige cuándo cambia eso.
- **La federación entre operadores** existe en forma provisional (pares inscritos en un registro, manejo de conflictos provisional y reconocido como tal); los checkpoints atestiguados son el objetivo declarado para la no equivocación entre operadores.

## Declaración de dependencias

Adopta la escala del pacto (LBTAS, piso v2) y mantiene su propia instancia de registro. Es independiente del coordinador del sustrato de cómputo: una economía depende de las capas inferiores a ella, nunca de una economía hermana ni de un coordinador en particular.

## Notas específicas del producto (al final, según la regla de orden)

La economía de referencia. Su modelo de operador/federación es la referencia declarada para el objetivo de diseño de frontend-como-operador del sustrato.
