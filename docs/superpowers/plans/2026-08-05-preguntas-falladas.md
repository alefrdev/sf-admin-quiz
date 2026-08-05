# Preguntas Falladas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a `sf_admin_quiz 2.html` un modo "Repasar Falladas" (preguntas falladas en Estudio, agrupadas en bloques de tamaño elegible, que se quitan de la lista al acertarlas) y una página "Historial de Falladas" de solo lectura con el conteo histórico de veces falladas, todo persistido en `localStorage`.

**Architecture:** Se extrae la capa de datos pura (lectura/escritura/actualización de progreso) a un archivo nuevo `progress.js`, sin dependencias de DOM, para poder testearlo con el test runner nativo de Node. El resto (UI, motor de preguntas) se mantiene inline en `sf_admin_quiz 2.html`, siguiendo el patrón ya existente del archivo (funciones globales, sin módulos ES ni framework).

**Tech Stack:** HTML/CSS/JS vanilla (sin build ni frameworks). Tests de la capa de datos con el test runner nativo de Node 18+ (`node --test`, `node:assert`) — sin añadir dependencias npm.

## Global Constraints

- Clave de `localStorage`: `sf_quiz_progress_v1`.
- `updateProgress()` solo se invoca cuando `mode === 'study'` o `mode === 'repaso'`; nunca en `mode === 'exam'`.
- `failCount` nunca decrece automáticamente; solo `pendingReview` cambia a `false` al acertar.
- Tamaños de bloque disponibles en Repaso: 10 / 20 / 30 / 40 — solo afectan la etiqueta de bloque mostrada, nunca recortan la cantidad de preguntas pendientes a repasar.
- Sin dependencias nuevas (ni npm, ni CDN, ni frameworks). Node 18+ ya disponible localmente (`node --version` → v18.19.1) para correr los tests de `progress.js`.
- El repositorio no existía como repo git; se inicializa en la Tarea 1 porque el objetivo final del usuario es subir esto a GitHub Pages.

---

### Task 1: Repositorio git + capa de datos (`progress.js`)

**Files:**
- Create: `.gitignore`
- Create: `progress.js`
- Create: `progress.test.js`

**Interfaces:**
- Produces (usado por tareas 2-4, cargado en el HTML vía `<script src="progress.js">`):
  - `getProgress(): { [id: string]: { failCount: number, pendingReview: boolean } }`
  - `saveProgress(progress: object): void`
  - `updateProgress(questionId: number, isCorrect: boolean): object` (devuelve el progreso actualizado)
  - `getPendingReviewIds(progress: object): number[]`
  - `getRevisionEntries(progress: object): { id: number, failCount: number }[]` (ordenado por `failCount` descendente)
  - `PROGRESS_KEY: string` (constante, valor `'sf_quiz_progress_v1'`)

- [ ] **Step 1: Inicializar git y primer commit del estado actual**

```bash
git init
git add "sf_admin_quiz 2.html" "docs/superpowers/specs/2026-08-05-preguntas-falladas-design.md" "docs/superpowers/plans/2026-08-05-preguntas-falladas.md"
git commit -m "chore: initial commit of quiz app, spec and plan"
```

- [ ] **Step 2: Crear `.gitignore`**

```
node_modules/
```

- [ ] **Step 3: Escribir el test que falla primero**

Crear `progress.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

class FakeLocalStorage {
  constructor() { this.store = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
  setItem(key, value) { this.store[key] = String(value); }
  clear() { this.store = {}; }
}

global.localStorage = new FakeLocalStorage();
const {
  getProgress,
  saveProgress,
  updateProgress,
  getPendingReviewIds,
  getRevisionEntries,
  PROGRESS_KEY
} = require('./progress.js');

test.beforeEach(() => { global.localStorage.clear(); });

test('getProgress returns {} when nothing stored', () => {
  assert.deepEqual(getProgress(), {});
});

test('getProgress returns {} when stored value is corrupt JSON', () => {
  global.localStorage.setItem(PROGRESS_KEY, '{not-json');
  assert.deepEqual(getProgress(), {});
});

test('saveProgress persists and getProgress reads it back', () => {
  saveProgress({ '5': { failCount: 1, pendingReview: true } });
  assert.deepEqual(getProgress(), { '5': { failCount: 1, pendingReview: true } });
});

test('updateProgress on first failure creates entry with failCount 1', () => {
  const progress = updateProgress(3, false);
  assert.deepEqual(progress['3'], { failCount: 1, pendingReview: true });
});

test('updateProgress increments failCount on repeated failure', () => {
  updateProgress(3, false);
  const progress = updateProgress(3, false);
  assert.deepEqual(progress['3'], { failCount: 2, pendingReview: true });
});

test('updateProgress correct answer on pending question clears pendingReview but keeps failCount', () => {
  updateProgress(3, false);
  const progress = updateProgress(3, true);
  assert.deepEqual(progress['3'], { failCount: 1, pendingReview: false });
});

test('updateProgress correct answer on never-failed question creates no entry', () => {
  const progress = updateProgress(9, true);
  assert.equal(progress['9'], undefined);
});

test('updateProgress correct answer on already-cleared question is a no-op', () => {
  updateProgress(3, false);
  updateProgress(3, true);
  const before = JSON.stringify(getProgress());
  updateProgress(3, true);
  assert.equal(JSON.stringify(getProgress()), before);
});

test('getPendingReviewIds returns only ids with pendingReview true', () => {
  const progress = {
    '1': { failCount: 1, pendingReview: true },
    '2': { failCount: 2, pendingReview: false },
    '3': { failCount: 1, pendingReview: true }
  };
  assert.deepEqual(getPendingReviewIds(progress).sort(), [1, 3]);
});

test('getRevisionEntries returns all failed ids sorted by failCount desc', () => {
  const progress = {
    '1': { failCount: 1, pendingReview: false },
    '2': { failCount: 5, pendingReview: true },
    '3': { failCount: 3, pendingReview: false }
  };
  assert.deepEqual(getRevisionEntries(progress), [
    { id: 2, failCount: 5 },
    { id: 3, failCount: 3 },
    { id: 1, failCount: 1 }
  ]);
});
```

- [ ] **Step 4: Ejecutar el test y comprobar que falla**

Run: `node --test progress.test.js`
Expected: FAIL — `Cannot find module './progress.js'`

- [ ] **Step 5: Implementar `progress.js`**

```js
const PROGRESS_KEY = 'sf_quiz_progress_v1';

function getProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function updateProgress(questionId, isCorrect) {
  const progress = getProgress();
  const key = String(questionId);
  const entry = progress[key] || { failCount: 0, pendingReview: false };

  if (!isCorrect) {
    entry.failCount += 1;
    entry.pendingReview = true;
  } else if (entry.pendingReview) {
    entry.pendingReview = false;
  } else {
    return progress;
  }

  progress[key] = entry;
  saveProgress(progress);
  return progress;
}

function getPendingReviewIds(progress) {
  return Object.keys(progress)
    .filter(id => progress[id].pendingReview)
    .map(Number);
}

function getRevisionEntries(progress) {
  return Object.keys(progress)
    .filter(id => progress[id].failCount > 0)
    .map(id => ({ id: Number(id), failCount: progress[id].failCount }))
    .sort((a, b) => b.failCount - a.failCount);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getProgress,
    saveProgress,
    updateProgress,
    getPendingReviewIds,
    getRevisionEntries,
    PROGRESS_KEY
  };
}
```

- [ ] **Step 6: Ejecutar el test y comprobar que pasa**

Run: `node --test progress.test.js`
Expected: PASS — todos los tests en verde (11 tests, 0 fallos)

- [ ] **Step 7: Commit**

```bash
git add .gitignore progress.js progress.test.js
git commit -m "feat: add pure progress data layer with unit tests"
```

---

### Task 2: Cargar `progress.js` en el HTML, enganchar Estudio, y contadores del menú

**Files:**
- Modify: `sf_admin_quiz 2.html`

**Interfaces:**
- Consumes: `getProgress()`, `updateProgress(id, isCorrect)`, `getPendingReviewIds(progress)`, `getRevisionEntries(progress)` de `progress.js` (Task 1).
- Produces: `renderMenuCounts()` — repinta los contadores del menú; usada por Tasks 3 y 4 tras volver al menú.

- [ ] **Step 1: Cargar `progress.js` antes del script inline**

En `sf_admin_quiz 2.html`, justo antes de la etiqueta `<script>` (línea 255), añadir:

```html
<script src="progress.js"></script>
<script>
```

(Sustituir la línea `<script>` sola por las dos líneas de arriba.)

- [ ] **Step 2: Añadir tercera tarjeta "Repasar Falladas" y enlace "Historial" al menú**

Reemplazar el bloque `.cards` + `.stats-bar` actual (dentro de `#menu`, aprox. líneas 189-207):

```html
  <div class="cards">
    <div class="mode-card" onclick="startMode('study')">
      <div class="mode-tag tag-study">ESTUDIO</div>
      <div class="mode-icon">📖</div>
      <div class="mode-name">Modo Estudio</div>
      <div class="mode-desc">10 preguntas por bloque. Respuesta inmediata con explicación al contestar.</div>
    </div>
    <div class="mode-card exam-card" onclick="startMode('exam')">
      <div class="mode-tag tag-exam">EXAMEN</div>
      <div class="mode-icon">⏱️</div>
      <div class="mode-name">Modo Examen</div>
      <div class="mode-desc">60 preguntas aleatorias. 105 minutos. Nota mínima 68%. Sin respuestas hasta el final.</div>
    </div>
    <div class="mode-card repaso-card" id="repaso-card" onclick="openBlockPicker()">
      <div class="mode-tag tag-repaso">REPASO</div>
      <div class="mode-icon">🔁</div>
      <div class="mode-name">Repasar Falladas</div>
      <div class="mode-desc" id="repaso-desc">Aún no tienes preguntas falladas para repasar.</div>
    </div>
  </div>
  <div class="stats-bar">
    <div>Preguntas: <span>149</span></div>
    <div>Tiempo examen: <span>105 min</span></div>
    <div>Nota de corte: <span>68%</span></div>
  </div>
  <div class="stats-bar" style="margin-top:0.75rem">
    <div id="historial-link" onclick="showHistorial()" style="cursor:pointer;">📋 Historial de falladas: <span id="historial-count">0</span></div>
  </div>
```

- [ ] **Step 3: Actualizar el CSS del grid de tarjetas y añadir estilos nuevos**

En el `<style>`, cambiar:

```css
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; width: 100%; max-width: 640px; margin-bottom: 2rem; }
```

por:

```css
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; width: 100%; max-width: 900px; margin-bottom: 2rem; }
```

Y en la media query `@media (max-width: 600px)`, dentro de `.cards { grid-template-columns: 1fr; }` no hace falta ningún cambio (ya fuerza una columna).

Añadir estos estilos nuevos junto a `.tag-exam`/`.tag-study`:

```css
  .tag-repaso { background: rgba(16,185,129,0.15); color: var(--green); }
  .mode-card.disabled { opacity: 0.4; cursor: default; pointer-events: none; }
```

- [ ] **Step 4: Enganchar `updateProgress` a `checkAnswer()` para Modo Estudio**

En `checkAnswer()` (aprox. línea 462-466), después de la línea:

```js
  userAnswers[current] = { selected: [...selected], correct: isCorrect };
```

añadir:

```js
  if (mode === 'study') {
    updateProgress(q.id, isCorrect);
  }
```

- [ ] **Step 5: Añadir `renderMenuCounts()` y llamarla al cargar y al volver al menú**

Añadir esta función nueva antes del cierre `</script>` (línea 651):

```js
function renderMenuCounts() {
  const progress = getProgress();
  const pendingCount = getPendingReviewIds(progress).length;
  const revisionCount = getRevisionEntries(progress).length;

  const card = document.getElementById('repaso-card');
  const desc = document.getElementById('repaso-desc');
  if (pendingCount === 0) {
    card.classList.add('disabled');
    desc.textContent = 'Aún no tienes preguntas falladas para repasar.';
  } else {
    card.classList.remove('disabled');
    desc.textContent = `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'} de repasar.`;
  }

  document.getElementById('historial-count').textContent = revisionCount;
}

renderMenuCounts();
```

Modificar `goMenu()` (aprox. línea 646-650) para que también repinte los contadores al volver:

```js
function goMenu() {
  clearInterval(timerInterval);
  document.getElementById('quiz-wrapper').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  renderMenuCounts();
}
```

- [ ] **Step 6: Verificación manual en navegador**

Abrir `sf_admin_quiz 2.html` directamente en el navegador (doble clic o `file://`).

1. Confirmar que la tarjeta "Repasar Falladas" aparece gris/deshabilitada y dice "Aún no tienes preguntas falladas para repasar." y que "Historial de falladas: 0" se ve en la barra inferior.
2. Entrar a Modo Estudio, fallar la primera pregunta a propósito.
3. Abrir la consola del navegador (F12) y ejecutar `JSON.parse(localStorage.getItem('sf_quiz_progress_v1'))`.
   Expected: objeto con una entrada `{"1": {"failCount": 1, "pendingReview": true}}` (el id real depende de la pregunta fallada).
4. Pulsar "← Salir", confirmar el diálogo.
   Expected: la tarjeta "Repasar Falladas" ya no está deshabilitada y muestra "1 pendiente de repasar."; "Historial de falladas: 1".

- [ ] **Step 7: Commit**

```bash
git add "sf_admin_quiz 2.html"
git commit -m "feat: track study-mode failures and show pending/history counts on menu"
```

---

### Task 3: Selector de tamaño de bloque + Modo Repaso

**Files:**
- Modify: `sf_admin_quiz 2.html`

**Interfaces:**
- Consumes: `getProgress()`, `getPendingReviewIds()`, `updateProgress()` de `progress.js`; `renderMenuCounts()` de Task 2.
- Produces: `openBlockPicker()`, `closeBlockPicker()`, `startRepaso(blockSize)` — usadas solo desde el menú (Task 2 ya referencia `openBlockPicker()` en el `onclick` de la tarjeta).

- [ ] **Step 1: Añadir la variable global `reviewBlockSize`**

Cambiar la línea (aprox. 355):

```js
let mode = '', questions = [], current = 0, selected = [], userAnswers = [], timerInterval = null, timeLeft = 0, blockStart = 0;
```

por:

```js
let mode = '', questions = [], current = 0, selected = [], userAnswers = [], timerInterval = null, timeLeft = 0, blockStart = 0, reviewBlockSize = 10;
```

- [ ] **Step 2: Añadir el modal del selector de bloque (HTML)**

Justo antes de `</body>` (después del bloque `#fail-msg`, línea 672), añadir:

```html
<div id="block-picker">
  <div class="picker-box">
    <div class="picker-title">Elige el tamaño de bloque</div>
    <div class="picker-sub">Repasarás todas tus preguntas falladas, agrupadas en bloques de este tamaño.</div>
    <div class="picker-options">
      <button class="picker-btn" onclick="startRepaso(10)">10</button>
      <button class="picker-btn" onclick="startRepaso(20)">20</button>
      <button class="picker-btn" onclick="startRepaso(30)">30</button>
      <button class="picker-btn" onclick="startRepaso(40)">40</button>
    </div>
    <button class="picker-cancel" onclick="closeBlockPicker()">Cancelar</button>
  </div>
</div>
```

- [ ] **Step 3: Añadir el CSS del modal**

Añadir junto al bloque de estilos de `#fail-msg` en el `<style>`:

```css
  #block-picker { display:none; position:fixed; inset:0; z-index:1000; align-items:center; justify-content:center; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); }
  #block-picker.show { display:flex; animation: fadeInScale 0.5s ease; }
  .picker-box { background: var(--surface); border:1px solid var(--border); border-radius:16px; padding:2rem; text-align:center; max-width:360px; }
  .picker-title { font-size:1.3rem; font-weight:600; margin-bottom:0.5rem; color:var(--text); }
  .picker-sub { color:var(--muted); font-size:0.85rem; margin-bottom:1.5rem; line-height:1.5; }
  .picker-options { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
  .picker-btn { padding:14px; border-radius:10px; border:1px solid var(--border); background:var(--surface2); color:var(--text); font-family:var(--mono); font-size:1.1rem; font-weight:600; cursor:pointer; transition: all 0.15s; }
  .picker-btn:hover { border-color:var(--accent); color:var(--accent); }
  .picker-cancel { margin-top:1rem; background:none; border:none; color:var(--muted); font-size:0.82rem; cursor:pointer; text-decoration:underline; }
```

- [ ] **Step 4: Añadir `openBlockPicker`, `closeBlockPicker`, `startRepaso`**

Añadir estas funciones antes de `renderMenuCounts()`:

```js
function openBlockPicker() {
  const pending = getPendingReviewIds(getProgress());
  if (pending.length === 0) return;
  document.getElementById('block-picker').classList.add('show');
}

function closeBlockPicker() {
  document.getElementById('block-picker').classList.remove('show');
}

function startRepaso(blockSize) {
  closeBlockPicker();
  reviewBlockSize = blockSize;
  startMode('repaso');
}
```

- [ ] **Step 5: Añadir la rama `'repaso'` en `startMode()`**

Cambiar (aprox. líneas 359-385):

```js
function startMode(m) {
  mode = m;
  document.getElementById('menu').style.display = 'none';
  document.getElementById('quiz-wrapper').style.display = 'block';
  document.getElementById('results').style.display = 'none';
  document.getElementById('question-area').style.display = 'block';

  if (mode === 'exam') {
    questions = shuffle(QUESTIONS).slice(0, 60);
    document.getElementById('mode-badge').textContent = 'MODO EXAMEN';
    document.getElementById('mode-badge').className = 'mode-badge badge-exam';
    document.getElementById('btn-skip').style.display = 'inline-block';
    timeLeft = 105 * 60;
    startTimer();
    document.getElementById('timer').style.display = 'block';
  } else {
    questions = [...QUESTIONS];
    document.getElementById('mode-badge').textContent = 'MODO ESTUDIO';
    document.getElementById('mode-badge').className = 'mode-badge badge-study';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('btn-skip').style.display = 'none';
  }
  userAnswers = new Array(questions.length).fill(null);
  current = 0;
  blockStart = 0;
  renderQuestion();
}
```

por:

```js
function startMode(m) {
  mode = m;
  document.getElementById('menu').style.display = 'none';
  document.getElementById('quiz-wrapper').style.display = 'block';
  document.getElementById('results').style.display = 'none';
  document.getElementById('question-area').style.display = 'block';

  if (mode === 'exam') {
    questions = shuffle(QUESTIONS).slice(0, 60);
    document.getElementById('mode-badge').textContent = 'MODO EXAMEN';
    document.getElementById('mode-badge').className = 'mode-badge badge-exam';
    document.getElementById('btn-skip').style.display = 'inline-block';
    timeLeft = 105 * 60;
    startTimer();
    document.getElementById('timer').style.display = 'block';
  } else if (mode === 'repaso') {
    const pendingIds = getPendingReviewIds(getProgress());
    questions = QUESTIONS.filter(q => pendingIds.includes(q.id));
    document.getElementById('mode-badge').textContent = 'MODO REPASO';
    document.getElementById('mode-badge').className = 'mode-badge badge-repaso';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('btn-skip').style.display = 'none';
  } else {
    questions = [...QUESTIONS];
    document.getElementById('mode-badge').textContent = 'MODO ESTUDIO';
    document.getElementById('mode-badge').className = 'mode-badge badge-study';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('btn-skip').style.display = 'none';
  }
  userAnswers = new Array(questions.length).fill(null);
  current = 0;
  blockStart = 0;
  renderQuestion();
}
```

Añadir el estilo del badge nuevo junto a `.badge-exam`/`.badge-study`:

```css
  .badge-repaso { background: rgba(16,185,129,0.15); color: var(--green); }
```

- [ ] **Step 6: Generalizar la etiqueta de bloque en `renderQuestion()`**

Cambiar (aprox. líneas 413-417):

```js
  if (mode === 'study') {
    const block = Math.floor(current / 10) + 1;
    const qInBlock = (current % 10) + 1;
    document.getElementById('block-label').innerHTML = `Bloque <span style="color:var(--accent)">${block}</span> · ${qInBlock}/10`;
  }
```

por:

```js
  if (mode === 'study' || mode === 'repaso') {
    const size = mode === 'repaso' ? reviewBlockSize : 10;
    const block = Math.floor(current / size) + 1;
    const qInBlock = (current % size) + 1;
    document.getElementById('block-label').innerHTML = `Bloque <span style="color:var(--accent)">${block}</span> · ${qInBlock}/${size}`;
  }
```

- [ ] **Step 7: Generalizar `checkAnswer()` para incluir el modo repaso**

Cambiar la llamada a `updateProgress` añadida en Task 2:

```js
  if (mode === 'study') {
    updateProgress(q.id, isCorrect);
  }
```

por:

```js
  if (mode === 'study' || mode === 'repaso') {
    updateProgress(q.id, isCorrect);
  }
```

Cambiar el bloque de feedback (aprox. líneas 480-491):

```js
  if (mode === 'study') {
    const fb = document.getElementById('feedback');
```

por:

```js
  if (mode === 'study' || mode === 'repaso') {
    const fb = document.getElementById('feedback');
```

Cambiar el bloque final de etiqueta de botón (aprox. líneas 497-504):

```js
  // En modo estudio, al completar bloque de 10 mostrar mini-result
  if (mode === 'study' && (current + 1) % 10 === 0 && current + 1 < questions.length) {
    document.getElementById('btn-next').textContent = 'Siguiente bloque →';
  } else if (current + 1 >= questions.length) {
    document.getElementById('btn-next').textContent = mode === 'exam' ? 'Ver resultados' : 'Ver resultados del bloque';
  } else {
    document.getElementById('btn-next').textContent = 'Siguiente →';
  }
```

por:

```js
  // En modo estudio/repaso, al completar un bloque mostrar mini-result
  const blockSizeForLabel = mode === 'repaso' ? reviewBlockSize : 10;
  if ((mode === 'study' || mode === 'repaso') && (current + 1) % blockSizeForLabel === 0 && current + 1 < questions.length) {
    document.getElementById('btn-next').textContent = 'Siguiente bloque →';
  } else if (current + 1 >= questions.length) {
    document.getElementById('btn-next').textContent = mode === 'exam' ? 'Ver resultados' : 'Ver resultados del bloque';
  } else {
    document.getElementById('btn-next').textContent = 'Siguiente →';
  }
```

- [ ] **Step 8: Verificación manual en navegador**

Abrir `sf_admin_quiz 2.html`.

1. En Modo Estudio, fallar 2 preguntas distintas (anota sus IDs mostrados en `PREGUNTA N` / contenido).
2. Volver al menú. La tarjeta "Repasar Falladas" debe mostrar "2 pendientes de repasar." y estar habilitada.
3. Pulsar la tarjeta → debe abrirse el modal con las 4 opciones (10/20/30/40).
4. Elegir "10" → debe entrar en modo repaso mostrando solo esas 2 preguntas, badge "MODO REPASO", cabecera "Bloque 1 · 1/10".
5. Acertar la primera → volver al menú (tras terminar) o seguir; comprobar en consola que su `pendingReview` pasó a `false` pero `failCount` sigue en 1.
6. Fallar la segunda de nuevo → comprobar que su `failCount` sube a 2 y sigue con `pendingReview: true`.
7. Volver al menú → "Repasar Falladas" debe mostrar ahora "1 pendiente de repasar."
8. Repetir el flujo eligiendo "20" o "30" y confirmar que la etiqueta de cabecera usa ese tamaño (p. ej. "Bloque 1 · 1/20").

- [ ] **Step 9: Commit**

```bash
git add "sf_admin_quiz 2.html"
git commit -m "feat: add block-size picker and repaso mode for failed questions"
```

---

### Task 4: Página "Historial de Falladas"

**Files:**
- Modify: `sf_admin_quiz 2.html`

**Interfaces:**
- Consumes: `getProgress()`, `getRevisionEntries()` de `progress.js`; `QUESTIONS`, `EXPLANATIONS` ya existentes en el archivo; `renderMenuCounts()` de Task 2.
- Produces: `showHistorial()`, `closeHistorial()` — ya referenciadas desde el `onclick` del enlace añadido en Task 2 (`#historial-link`).

- [ ] **Step 1: Añadir el marcado de la página**

Justo después de cerrar `#quiz-wrapper` (después de la línea 253, antes de `<script src="progress.js">`), añadir:

```html
<div id="historial-page">
  <div class="result-header">
    <div class="review-title">HISTORIAL DE FALLADAS</div>
    <div class="result-sub" id="historial-sub"></div>
  </div>
  <div id="historial-list"></div>
  <div class="btn-row" style="margin-top:2rem">
    <button class="btn btn-primary" onclick="closeHistorial()">← Volver al menú</button>
  </div>
</div>
```

- [ ] **Step 2: Añadir el CSS de la página**

Añadir junto a los estilos de `#results`:

```css
  #historial-page { display:none; max-width:780px; margin:0 auto; padding:2.5rem 1.5rem; }
  .fail-count-badge { font-family: var(--mono); font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(239,68,68,0.15); color: #fca5a5; margin-left: 8px; }
```

- [ ] **Step 3: Añadir `showHistorial()` y `closeHistorial()`**

Añadir estas funciones antes de `renderMenuCounts()`:

```js
function showHistorial() {
  const progress = getProgress();
  const entries = getRevisionEntries(progress);
  document.getElementById('menu').style.display = 'none';
  document.getElementById('historial-page').style.display = 'block';
  document.getElementById('historial-sub').textContent =
    `${entries.length} pregunta${entries.length === 1 ? '' : 's'} fallada${entries.length === 1 ? '' : 's'} alguna vez`;

  const list = document.getElementById('historial-list');
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);text-align:center;">Todavía no has fallado ninguna pregunta.</p>';
    return;
  }
  entries.forEach(entry => {
    const q = QUESTIONS.find(item => item.id === entry.id);
    if (!q) return;
    const div = document.createElement('div');
    div.className = 'review-item rev-incorrect';
    const correctText = q.answers.map(l => `${l}. ${q.options[l]}`).join(' / ');
    div.innerHTML = `
      <div class="review-q">[Q${q.id}] ${q.question} <span class="fail-count-badge">Fallada ${entry.failCount} ${entry.failCount === 1 ? 'vez' : 'veces'}</span></div>
      <div class="review-answers"><span class="rev-ans rev-correct-ans">✓ ${correctText}</span></div>
      ${EXPLANATIONS[q.id] ? `<div style="margin-top:8px;font-size:0.78rem;color:var(--muted);line-height:1.5;">${EXPLANATIONS[q.id]}</div>` : ''}
    `;
    list.appendChild(div);
  });
}

function closeHistorial() {
  document.getElementById('historial-page').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  renderMenuCounts();
}
```

- [ ] **Step 4: Verificación manual en navegador**

Abrir `sf_admin_quiz 2.html` (con el progreso ya acumulado de las tareas anteriores).

1. En el menú, pulsar "📋 Historial de falladas: N".
   Expected: aparece la página con el título "HISTORIAL DE FALLADAS", el subtítulo con el conteo correcto, y una tarjeta por cada pregunta alguna vez fallada, ordenadas de más a menos veces fallada, cada una con su badge "Fallada N veces" y su explicación.
2. Pulsar "← Volver al menú".
   Expected: vuelve al menú y los contadores siguen correctos.
3. Con `localStorage` vacío (ejecutar `localStorage.clear()` en consola y recargar), abrir Historial.
   Expected: mensaje "Todavía no has fallado ninguna pregunta." y sin tarjetas.

- [ ] **Step 5: Commit**

```bash
git add "sf_admin_quiz 2.html"
git commit -m "feat: add read-only historial page for failed questions"
```

---

### Task 5: Regresión manual completa

**Files:** Ninguno (solo verificación; no hay cambios de código en esta tarea salvo que se encuentre y corrija un defecto).

- [ ] **Step 1: Ejecutar los tests automatizados de la capa de datos**

Run: `node --test progress.test.js`
Expected: PASS — todos los tests en verde.

- [ ] **Step 2: Repasar el plan de pruebas completo de la spec, con `localStorage.clear()` antes de empezar**

Abrir `sf_admin_quiz 2.html` en el navegador con la consola abierta (F12) y comprobar, en orden:

1. Fallar una pregunta en Estudio → aparece en Falladas (tarjeta "1 pendiente") y en Historial (`failCount: 1`).
2. Entrar a "Repasar Falladas", acertarla → desaparece de Falladas (tarjeta "0 pendientes", deshabilitada), sigue en Historial con `failCount: 1`.
3. Fallar esa misma pregunta de nuevo, esta vez desde Modo Estudio → vuelve a aparecer en Falladas, `failCount: 2`.
4. Recargar la página (F5) → el progreso persiste (la tarjeta sigue mostrando "1 pendiente" y el Historial sigue mostrando la pregunta).
5. Con 0 pendientes (acertarla desde Repaso), la tarjeta "Repasar Falladas" vuelve a quedar deshabilitada.
6. En Modo Examen, fallar y saltar varias preguntas a propósito → comprobar en consola que `localStorage.getItem('sf_quiz_progress_v1')` no cambia durante todo el examen.
7. Elegir bloques de 10, 20, 30 y 40 en Repaso (con varias preguntas falladas de antemano) y confirmar que la etiqueta de cabecera cambia de tamaño en cada caso.
8. En Historial, confirmar que las preguntas están ordenadas por `failCount` descendente.

- [ ] **Step 3: Si algo falla, documentar el defecto y corregirlo antes de continuar**

No hay código de ejemplo aquí porque el resultado depende de lo que se encuentre; si surge un defecto, aplicar la corrección mínima en `sf_admin_quiz 2.html` o `progress.js`, re-ejecutar `node --test progress.test.js` si aplica, y repetir el punto de la lista que había fallado.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "test: complete manual regression pass for failed-questions feature"
```
