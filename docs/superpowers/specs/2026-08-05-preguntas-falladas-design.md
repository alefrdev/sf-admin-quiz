# Diseño: Preguntas Falladas (Fase 1 — local, sin cuenta)

## Contexto

`sf_admin_quiz 2.html` es un motor de quiz de preparación para la certificación
Salesforce Administrator: un único archivo HTML/CSS/JS con un banco de 149
preguntas embebido (`const QUESTIONS`) y explicaciones (`const EXPLANATIONS`).
Actualmente tiene dos modos (`Estudio` y `Examen`) y ningún tipo de
persistencia entre sesiones: todo el estado vive en variables JS en memoria
(`userAnswers`, `current`, etc.) y se pierde al recargar la página.

El objetivo final del usuario es más amplio: subir esta app a GitHub Pages y
añadir login con Google para sincronizar el progreso en la nube (vía
Firebase). Ese objetivo se divide en dos fases independientes:

- **Fase 1 (este documento)**: funcionalidad de preguntas falladas +
  persistencia local con `localStorage`, ya lista para desplegar en GitHub
  Pages tal cual (sin backend).
- **Fase 2 (futura, spec aparte)**: login con Google vía Firebase
  Authentication + sincronización de progreso vía Firestore. Requiere pasos
  manuales del usuario en la consola de Firebase (crear proyecto, activar
  login con Google, activar Firestore, obtener credenciales) antes de poder
  diseñarse en detalle.

Este documento cubre **solo la Fase 1**, diseñada para que la Fase 2 pueda
enchufarse después sin reescribir el motor del quiz.

## Objetivo

Cuando el usuario falla una pregunta en Modo Estudio, debe poder volver a
repasarla más tarde en un modo dedicado, y además debe quedar un historial
permanente de qué preguntas ha fallado alguna vez (para detectar sus puntos
débiles), aunque ya las haya aprendido después.

## Modelo de datos

Se añade un único objeto de progreso, persistido en `localStorage` bajo una
clave (p. ej. `sf_quiz_progress_v1`):

```js
{
  "<questionId>": { "failCount": number, "pendingReview": boolean },
  ...
}
```

- `pendingReview: true` → la pregunta está en la lista activa **"Falladas"**
  (pendiente de repasar).
- `failCount > 0` (independientemente de `pendingReview`) → la pregunta
  aparece en el historial permanente **"Revisión"**.

Solo entran en este objeto preguntas que se han fallado alguna vez; las que
nunca se fallaron no tienen entrada.

### Capa de acceso (para aislar Fase 2)

Todo acceso a `localStorage` pasa por dos funciones, únicos puntos de
contacto con el almacenamiento:

```js
function getProgress() { /* lee y parsea localStorage, devuelve {} si no hay nada o hay error de parseo */ }
function saveProgress(progress) { /* serializa y escribe en localStorage */ }
```

En Fase 2, el interior de estas dos funciones se reemplazará por llamadas a
Firestore (posiblemente asíncronas, lo que implicará ajustar sus llamadas a
`await`), sin tocar el resto de la lógica del quiz ni la UI.

## Reglas de actualización del progreso

Se añade una función `updateProgress(questionId, isCorrect)`, invocada desde
`checkAnswer()` únicamente cuando `mode === 'study'` o `mode === 'repaso'`
(nunca en `mode === 'exam'`):

- Si `isCorrect` es `false`: `failCount++` (o `1` si no existía entrada),
  `pendingReview = true`.
- Si `isCorrect` es `true` y la pregunta tenía `pendingReview === true`:
  `pendingReview = false`. `failCount` **no se modifica** (el historial de
  Revisión nunca decrece automáticamente).
- Si `isCorrect` es `true` y la pregunta no tenía entrada previa (nunca
  fallada): no se hace nada.

Después de cualquier cambio, se llama a `saveProgress()` inmediatamente.

## UI — Menú principal

El menú (`#menu`) pasa de 2 a 3 tarjetas, más un enlace de historial:

1. **Modo Estudio** (sin cambios).
2. **Modo Examen** (sin cambios).
3. **🔁 Repasar Falladas** (nueva): muestra el conteo de preguntas con
   `pendingReview: true` (p. ej. "12 pendientes"). Si el conteo es 0, la
   tarjeta se muestra deshabilitada (opacidad reducida, `cursor: default`,
   sin `onclick` funcional).
4. **📋 Revisión (N)** (nuevo enlace/tarjeta secundaria, N = número de
   preguntas con `failCount > 0`): abre la página de historial de solo
   lectura. Si `N = 0`, se puede ocultar o deshabilitar igual que la tarjeta
   de Falladas.

Al cargar la página (o al volver al menú vía `goMenu()`), se llama a
`getProgress()` y se recalculan ambos contadores.

### Selector de tamaño de bloque

Al hacer clic en "Repasar Falladas" con `N > 0`, se muestra un panel modal
(reutilizando el patrón visual ya existente de `#celebration-msg` /
`#fail-msg`: overlay oscuro + blur + caja centrada) con 4 botones: **10 / 20
/ 30 / 40**. Elegir un tamaño arranca `startMode('repaso', tamañoElegido)`
con **todas** las preguntas pendientes (el tamaño de bloque solo cambia la
etiqueta "Bloque X · Y/N" en la cabecera, igual que ya ocurre hoy en Modo
Estudio con bloques fijos de 10 — no limita ni recorta la cantidad de
preguntas a repasar).

## UI — Página "Revisión"

Nueva sección de solo lectura (reutiliza el estilo `.review-item` /
`.review-answers` ya usado en la pantalla de resultados). Por cada pregunta
con `failCount > 0`, ordenada de mayor a menor `failCount`, muestra:

- El enunciado de la pregunta.
- La(s) respuesta(s) correcta(s).
- La explicación (`EXPLANATIONS[q.id]`), si existe.
- Una etiqueta `Fallada N veces`.

No hay opciones, checkboxes ni botones de respuesta — es puramente de
consulta. Un botón "← Volver" regresa al menú.

## Cambios en el motor del quiz

- `mode` gana un tercer valor posible: `'repaso'`.
- `startMode(m, blockSize)`: cuando `m === 'repaso'`, arma `questions`
  filtrando `QUESTIONS` por `getProgress()[q.id]?.pendingReview === true`;
  guarda `blockSize` en una variable de módulo (p. ej. `reviewBlockSize`) en
  vez del `10` fijo que usa hoy Modo Estudio; oculta timer y botón "saltar"
  (mismo comportamiento que Estudio).
- `renderQuestion()`: el cálculo de bloque (`Math.floor(current / 10) + 1`)
  pasa a usar `reviewBlockSize` en vez de `10` cuando `mode === 'repaso'`
  (Estudio sigue usando 10 fijo). El badge de modo muestra "MODO REPASO".
- `checkAnswer()`: además de la lógica actual, si `mode === 'study' || mode
  === 'repaso'`, llama a `updateProgress(q.id, isCorrect)` tras calcular
  `isCorrect`.
- Menú: nuevas funciones `renderMenuCounts()` (pinta contadores de las
  tarjetas), `openReviewPicker()` / `closeReviewPicker()` (modal de tamaño de
  bloque), `showRevisionPage()` / `closeRevisionPage()` (página de
  historial).

## Fuera de alcance (Fase 1)

- Login con Google, sincronización en la nube, multi-dispositivo — Fase 2.
- Botón de "reiniciar todo el progreso" — no se pidió; se puede añadir luego
  si hace falta borrar `localStorage` manualmente vía DevTools mientras
  tanto.
- Cambios al Modo Examen: se mantiene exactamente igual, sin ninguna
  interacción con el progreso de Falladas/Revisión.

## Plan de pruebas (manual)

Sin framework de test (archivo HTML estático); verificación manual abriendo
el archivo en el navegador:

1. Fallar una pregunta en Estudio → aparece en Falladas y en Revisión
   (`failCount = 1`).
2. Entrar a "Repasar Falladas", acertarla → desaparece de Falladas, sigue en
   Revisión con `failCount = 1`.
3. Fallar la misma pregunta de nuevo durante Repaso → vuelve a Falladas,
   `failCount = 2`.
4. Recargar la página (F5) → el progreso persiste (localStorage).
5. Tarjeta "Repasar Falladas" deshabilitada cuando no hay pendientes (`N =
   0`).
6. Fallar y saltar preguntas en Modo Examen → no afecta a Falladas ni a
   Revisión.
7. Elegir distintos tamaños de bloque (10/20/30/40) en Repaso y confirmar que
   la etiqueta de bloque en la cabecera cambia en consecuencia.
8. Página de Revisión lista las preguntas ordenadas por `failCount`
   descendente, con la etiqueta correcta de veces fallada.
