# Diseño: Categorías por tema

## Contexto

`index.html` es el motor de quiz de preparación para la certificación
Salesforce Administrator, con 149 preguntas embebidas (`const QUESTIONS`) y
tres modos: Estudio, Examen y Repaso (falladas/historial). Actualmente no
hay ninguna noción de tema/categoría — todas las preguntas son un único
banco plano, tanto para elegir qué estudiar como para el repaso de falladas.

El usuario quiere poder identificar en qué áreas del temario está más
débil, en vez de tratar el fallo como algo global. Esto es la base para dos
mejoras futuras ya priorizadas por separado: repetición espaciada (dar más
peso a lo más fallado) y un dashboard de progreso con desglose por tema —
ninguna de las dos se implementa en este documento, pero ambas dependen de
que las preguntas tengan categoría.

## Fuente de las categorías

Se usan los 8 dominios oficiales del blueprint vigente del examen Salesforce
Certified Platform Administrator (actualizado en diciembre de 2025), en vez
de una agrupación inventada:

| Clave (`category`, en inglés, valor canónico) | Etiqueta mostrada en la UI |
|---|---|
| `Configuration and Setup` | Configuración y Setup |
| `Object Manager and Lightning App Builder` | Object Manager y Lightning App Builder |
| `Sales and Marketing Applications` | Ventas y Marketing |
| `Service and Support Applications` | Servicio y Soporte |
| `Productivity and Collaboration` | Productividad y Colaboración |
| `Data and Analytics Management` | Gestión de Datos y Analítica |
| `Automation` | Automatización |
| `Agentforce` | Agentforce |

Las 149 preguntas existentes son anteriores a la introducción del dominio
Agentforce en el temario, así que es esperable que esa categoría quede sin
preguntas (0) — no es un bug, solo refleja que el banco actual no cubre esa
área todavía.

## Modelo de datos

Cada entrada de `QUESTIONS` gana un campo `category` con uno de los 8
valores canónicos de la tabla anterior:

```js
{ "id": 1, "question": "...", "options": {...}, "answers": [...], "category": "Configuration and Setup" ... }
```

Las 149 preguntas se clasifican manualmente (leyendo el enunciado de cada
una), como trabajo de datos dentro de la fase de implementación — no
requiere heurística ni intervención del usuario.

## UI — Modo Estudio

Al pulsar la tarjeta "Modo Estudio" se abre un selector modal (mismo patrón
visual que el selector de tamaño de bloque ya existente): una lista con las
8 categorías + una opción **"Todas"** (que reproduce el comportamiento
actual, y es la que se resalta/preselecciona por defecto).

- Elegir una categoría filtra `QUESTIONS` a esa categoría antes de aplicar
  la lógica de "solo preguntas nunca vistas hasta agotar todas" ya
  existente (`getSeenIds()`), es decir: dentro de la categoría elegida, se
  priorizan las no vistas y solo se repiten cuando se agoten las de esa
  categoría.
- El contador de la tarjeta "Modo Estudio" en el menú (`#study-new-count`)
  sigue mostrando el total global ("X nuevas de 149") cuando no hay
  selección; esto no cambia — el desglose por categoría no se muestra ahí
  (eso es responsabilidad del futuro dashboard, fuera de alcance aquí).
- Durante Estudio, cada pregunta muestra su categoría como etiqueta junto al
  número (p. ej. "[Q42] Seguridad") usando el mismo estilo que el badge de
  modo (`.mode-badge` o similar, tamaño reducido).

## UI — Repaso de falladas

El mismo selector de categoría (con "Todas" por defecto) se antepone al
flujo existente de Repaso:

- Al pulsar "Repasar Falladas", primero se elige categoría ("Todas" u una
  de las 8), y **después** se aplica la lógica ya existente de
  `openBlockPicker()` (que decide si mostrar el selector de tamaño de
  bloque 10/20/30/40 o saltar directo cuando hay ≤10 pendientes), pero
  contando solo las preguntas pendientes de la categoría elegida.
- El Historial de Falladas (página de solo lectura) también incorpora el
  mismo selector antes de "Practicar estas preguntas", con el mismo
  filtrado.
- Si una categoría no tiene preguntas pendientes/falladas, se muestra igual
  en la lista pero deshabilitada (mismo patrón visual que las tarjetas del
  menú cuando el conteo es 0).

## Fuera de alcance

- Modo Examen: sin cambios. Debe seguir simulando el examen real (60
  preguntas mezcladas de todas las categorías), no tiene sentido filtrar
  por tema ahí.
- Dashboard/desglose de aciertos por categoría — es el siguiente
  sub-proyecto del roadmap, se construye sobre este.
- Repetición espaciada dentro de una categoría — sub-proyecto aparte.
- Traducción/edición de las categorías por el usuario — son fijas, las 8
  del blueprint oficial.

## Plan de pruebas (manual + automatizado donde aplique)

1. Las 149 preguntas tienen un `category` válido (uno de los 8 valores) —
   verificable con un script Node de una línea, igual que se hizo para
   validar `multi`/`numAnswers`.
2. Elegir una categoría en Modo Estudio → todas las preguntas mostradas
   pertenecen a esa categoría.
3. Agotar las preguntas nuevas de una categoría → la siguiente sesión de esa
   categoría empieza a repetir (mismo comportamiento que ya existe a nivel
   global, ahora por categoría).
4. Elegir "Todas" en Estudio → comportamiento idéntico al actual (sin
   regresión).
5. Repasar Falladas filtrando por categoría → solo aparecen falladas de esa
   categoría; el selector de tamaño de bloque sigue respetando el cap
   `Math.min(reviewBlockSize, questions.length)` ya implementado.
6. Historial de Falladas filtrando por categoría → la lista y el botón
   "Practicar estas preguntas" respetan el filtro.
7. Categoría sin preguntas pendientes → aparece deshabilitada en el
   selector de Repaso/Historial, sin romper el resto de categorías.
