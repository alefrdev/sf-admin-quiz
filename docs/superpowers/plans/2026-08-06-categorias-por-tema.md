# Categorías por tema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag all 149 questions with one of the 8 official Salesforce Certified Platform Administrator exam domains, and let the user filter Modo Estudio and Repaso de Falladas (including el Historial) by category.

**Architecture:** Pure data addition (`category` field on each `QUESTIONS` entry) plus a single reusable category-picker modal (same visual pattern as the existing `#block-picker`), wired in front of the three existing entry points (`startMode('study')`, `openBlockPicker('pending')`, `openBlockPicker('historial')`). No new files, no build step — everything lives in `index.html`, consistent with the rest of the app.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework, no build step), Node.js built-in test runner for static/data verification scripts (no formal browser test framework exists in this project — verification of `index.html` changes has always been done via one-off Node scripts that extract and validate the embedded data/script, per the existing pattern in this repo).

## Global Constraints

- Single file `index.html` — no new source files except this plan's temporary verification scripts (which are NOT committed, matching how prior fixes in this session were verified with scratch Node scripts).
- No build step. All JS stays inline or as plain `<script src>` globals.
- Every task must end with: `node --check` on the extracted inline `<script>` passing, and (if `progress.js`/`cloud-sync.js` were touched) `node --test progress.test.js cloud-sync.test.js` passing. Neither file is touched by this feature, so the existing 17 tests must keep passing unmodified as a regression check.
- Category values are the 8 canonical English strings from the spec (`docs/superpowers/specs/2026-08-06-categorias-por-tema-design.md`) — never invent new ones, never translate the stored value (only the displayed label is translated).
- Spanish UI copy throughout (matches the rest of the app).
- Exam mode (`mode === 'exam'`) must NOT be touched by any task — it stays exactly as-is per spec's "Fuera de alcance".

---

### Task 1: Tag all 149 questions with `category`

**Files:**
- Modify: `index.html` (the `const QUESTIONS = [...]` array, currently a single line — search for `"id": 1,` through `"id": 149,` to locate each entry)

**Interfaces:**
- Produces: every object in `QUESTIONS` gains a `category` property whose value is one of the 8 strings below. All later tasks read `q.category`.

The 8 canonical values (from the spec):
```
Configuration and Setup
Object Manager and Lightning App Builder
Sales and Marketing Applications
Service and Support Applications
Productivity and Collaboration
Data and Analytics Management
Automation
Agentforce
```

- [ ] **Step 1: Write a Node script that injects `category` into every question by id**

Create a throwaway script (do not commit it) at the path your tool uses for scratch files, e.g. `apply-categories.js` in the repo root:

```js
const fs = require('fs');

const CATEGORY_MAP = {
  1: "Service and Support Applications", 2: "Object Manager and Lightning App Builder", 3: "Configuration and Setup",
  4: "Object Manager and Lightning App Builder", 5: "Configuration and Setup", 6: "Data and Analytics Management",
  7: "Productivity and Collaboration", 8: "Configuration and Setup", 9: "Object Manager and Lightning App Builder",
  10: "Sales and Marketing Applications", 11: "Automation", 12: "Object Manager and Lightning App Builder",
  13: "Sales and Marketing Applications", 14: "Service and Support Applications", 15: "Object Manager and Lightning App Builder",
  16: "Configuration and Setup", 17: "Object Manager and Lightning App Builder", 18: "Object Manager and Lightning App Builder",
  19: "Sales and Marketing Applications", 20: "Object Manager and Lightning App Builder", 21: "Automation",
  22: "Automation", 23: "Sales and Marketing Applications", 24: "Configuration and Setup", 25: "Configuration and Setup",
  26: "Object Manager and Lightning App Builder", 27: "Service and Support Applications", 28: "Service and Support Applications",
  29: "Automation", 30: "Configuration and Setup", 31: "Configuration and Setup", 32: "Service and Support Applications",
  33: "Object Manager and Lightning App Builder", 34: "Sales and Marketing Applications", 35: "Service and Support Applications",
  36: "Data and Analytics Management", 37: "Productivity and Collaboration", 38: "Sales and Marketing Applications",
  39: "Object Manager and Lightning App Builder", 40: "Automation", 41: "Sales and Marketing Applications",
  42: "Service and Support Applications", 43: "Automation", 44: "Configuration and Setup", 45: "Automation",
  46: "Sales and Marketing Applications", 47: "Sales and Marketing Applications", 48: "Automation", 49: "Automation",
  50: "Data and Analytics Management", 51: "Automation", 52: "Object Manager and Lightning App Builder",
  53: "Automation", 54: "Service and Support Applications", 55: "Configuration and Setup", 56: "Productivity and Collaboration",
  57: "Service and Support Applications", 58: "Service and Support Applications", 59: "Object Manager and Lightning App Builder",
  60: "Automation", 61: "Automation", 62: "Sales and Marketing Applications", 63: "Sales and Marketing Applications",
  64: "Object Manager and Lightning App Builder", 65: "Object Manager and Lightning App Builder", 66: "Automation",
  67: "Object Manager and Lightning App Builder", 68: "Configuration and Setup", 69: "Automation", 70: "Automation",
  71: "Configuration and Setup", 72: "Object Manager and Lightning App Builder", 73: "Automation",
  74: "Service and Support Applications", 75: "Service and Support Applications", 76: "Automation",
  77: "Object Manager and Lightning App Builder", 78: "Object Manager and Lightning App Builder", 79: "Automation",
  80: "Automation", 81: "Object Manager and Lightning App Builder", 82: "Sales and Marketing Applications",
  83: "Data and Analytics Management", 84: "Automation", 85: "Productivity and Collaboration",
  86: "Automation", 87: "Data and Analytics Management", 88: "Configuration and Setup", 89: "Data and Analytics Management",
  90: "Sales and Marketing Applications", 91: "Configuration and Setup", 92: "Sales and Marketing Applications",
  93: "Service and Support Applications", 94: "Service and Support Applications", 95: "Automation",
  96: "Configuration and Setup", 97: "Object Manager and Lightning App Builder", 98: "Object Manager and Lightning App Builder",
  99: "Automation", 100: "Configuration and Setup", 101: "Configuration and Setup", 102: "Sales and Marketing Applications",
  103: "Productivity and Collaboration", 104: "Configuration and Setup", 105: "Automation", 106: "Configuration and Setup",
  107: "Automation", 108: "Object Manager and Lightning App Builder", 109: "Automation",
  110: "Object Manager and Lightning App Builder", 111: "Service and Support Applications", 112: "Service and Support Applications",
  113: "Data and Analytics Management", 114: "Service and Support Applications", 115: "Sales and Marketing Applications",
  116: "Data and Analytics Management", 117: "Data and Analytics Management", 118: "Sales and Marketing Applications",
  119: "Sales and Marketing Applications", 120: "Sales and Marketing Applications", 121: "Sales and Marketing Applications",
  122: "Automation", 123: "Data and Analytics Management", 124: "Sales and Marketing Applications",
  125: "Data and Analytics Management", 126: "Service and Support Applications", 127: "Data and Analytics Management",
  128: "Data and Analytics Management", 129: "Data and Analytics Management", 130: "Sales and Marketing Applications",
  131: "Data and Analytics Management", 132: "Sales and Marketing Applications", 133: "Data and Analytics Management",
  134: "Data and Analytics Management", 135: "Sales and Marketing Applications", 136: "Configuration and Setup",
  137: "Data and Analytics Management", 138: "Sales and Marketing Applications", 139: "Productivity and Collaboration",
  140: "Configuration and Setup", 141: "Data and Analytics Management", 142: "Sales and Marketing Applications",
  143: "Sales and Marketing Applications", 144: "Sales and Marketing Applications", 145: "Sales and Marketing Applications",
  146: "Productivity and Collaboration", 147: "Object Manager and Lightning App Builder", 148: "Service and Support Applications",
  149: "Productivity and Collaboration"
};

const VALID = new Set([
  "Configuration and Setup", "Object Manager and Lightning App Builder", "Sales and Marketing Applications",
  "Service and Support Applications", "Productivity and Collaboration", "Data and Analytics Management",
  "Automation", "Agentforce"
]);

let html = fs.readFileSync('index.html', 'utf8');
let count = 0;

for (let id = 1; id <= 149; id++) {
  const category = CATEGORY_MAP[id];
  if (!VALID.has(category)) throw new Error(`Invalid category for id ${id}: ${category}`);
  // Match the exact per-question object boundary: `"id": <id>, ... "numAnswers": <n>}`
  const re = new RegExp(`("id":\\s*${id},[\\s\\S]*?"numAnswers":\\s*\\d+)(\\})`);
  const before = html;
  html = html.replace(re, (m, p1, p2) => `${p1}, "category": "${category}"${p2}`);
  if (html === before) throw new Error(`No match / no change for id ${id}`);
  count++;
}

fs.writeFileSync('index.html', html);
console.log(`Tagged ${count} questions.`);
```

- [ ] **Step 2: Run the script**

Run: `node apply-categories.js`
Expected: `Tagged 149 questions.` with no thrown errors.

- [ ] **Step 3: Verify all 149 questions got a valid category**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/const QUESTIONS = (\[[\s\S]*?\]);/);
const QUESTIONS = eval(m[1]);
const VALID = new Set(['Configuration and Setup','Object Manager and Lightning App Builder','Sales and Marketing Applications','Service and Support Applications','Productivity and Collaboration','Data and Analytics Management','Automation','Agentforce']);
const missing = QUESTIONS.filter(q => !q.category || !VALID.has(q.category));
if (missing.length > 0) { console.log('MISSING/INVALID:', missing.map(q => q.id)); process.exit(1); }
console.log('All', QUESTIONS.length, 'questions have a valid category.');
"
```

Expected: `All 149 questions have a valid category.`

- [ ] **Step 4: Delete the throwaway script and verify JSON/JS is still syntactically valid**

```bash
rm apply-categories.js
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('<script>', html.indexOf('cloud-sync.js'));
const e = html.indexOf('</script>', s);
fs.writeFileSync('scratch_check.js', html.slice(s+8, e));
"
node --check scratch_check.js && echo "SYNTAX OK"
rm scratch_check.js
```

Expected: `SYNTAX OK`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: tag all 149 questions with their exam domain category"
```

---

### Task 2: Category constants, labels, and CSS

**Files:**
- Modify: `index.html` — add `CATEGORIES` / `CATEGORY_LABELS` constants right before the `let mode = '', questions = ...` line (currently line 417); add CSS for the category picker and the in-question category badge inside the existing `<style>` block, near the existing `.picker-*` rules (around line 197).

**Interfaces:**
- Produces: `const CATEGORIES` (array of the 8 canonical values, in blueprint order), `const CATEGORY_LABELS` (object mapping each canonical value to its Spanish display label). Both are read by Tasks 3, 4, 5, 6.
- Produces CSS classes: `.picker-box-wide`, `.category-list`, `.category-btn`, `.category-btn.disabled`, `.q-category-badge`.

- [ ] **Step 1: Add the constants**

Insert immediately before the existing line `let mode = '', questions = [], current = 0, selected = [], userAnswers = [], timerInterval = null, timeLeft = 0, blockStart = 0, reviewBlockSize = 10, reviewSource = 'pending';`:

```js
const CATEGORIES = [
  'Configuration and Setup',
  'Object Manager and Lightning App Builder',
  'Sales and Marketing Applications',
  'Service and Support Applications',
  'Productivity and Collaboration',
  'Data and Analytics Management',
  'Automation',
  'Agentforce'
];

const CATEGORY_LABELS = {
  'Configuration and Setup': 'Configuración y Setup',
  'Object Manager and Lightning App Builder': 'Object Manager y Lightning App Builder',
  'Sales and Marketing Applications': 'Ventas y Marketing',
  'Service and Support Applications': 'Servicio y Soporte',
  'Productivity and Collaboration': 'Productividad y Colaboración',
  'Data and Analytics Management': 'Gestión de Datos y Analítica',
  'Automation': 'Automatización',
  'Agentforce': 'Agentforce'
};
```

- [ ] **Step 2: Add CSS**

Insert after the existing `.picker-cancel { ... }` rule (currently line 197):

```css
.picker-box-wide { max-width: 480px; }
.category-list { display:flex; flex-direction:column; gap:0.6rem; text-align:left; max-height: 50vh; overflow-y:auto; }
.category-btn { padding:12px 16px; border-radius:10px; border:1px solid var(--border); background:var(--surface2); color:var(--text); font-size:0.9rem; font-weight:500; cursor:pointer; transition: all 0.15s; text-align:left; display:flex; justify-content:space-between; align-items:center; }
.category-btn:hover { border-color:var(--accent); color:var(--accent); }
.category-btn.disabled { opacity:0.4; cursor:default; pointer-events:none; }
.category-btn .cat-count { font-family:var(--mono); font-size:0.78rem; color:var(--muted); }
.q-category-badge { font-family:var(--mono); font-size:0.72rem; color:var(--muted); margin-top:2px; }
```

- [ ] **Step 3: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('<script>', html.indexOf('cloud-sync.js'));
const e = html.indexOf('</script>', s);
fs.writeFileSync('scratch_check.js', html.slice(s+8, e));
"
node --check scratch_check.js && echo "SYNTAX OK"
rm scratch_check.js
```

Expected: `SYNTAX OK`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add category constants, labels, and picker CSS"
```

---

### Task 3: Category-picker modal (HTML + open/close logic)

**Files:**
- Modify: `index.html` — add modal markup after the existing `#block-picker` div (currently ends at line 912); add JS functions near `openBlockPicker`/`closeBlockPicker` (currently lines 767–784).

**Interfaces:**
- Consumes: `CATEGORIES`, `CATEGORY_LABELS` (Task 2), `QUESTIONS`, `getProgress`, `getPendingReviewIds`, `getRevisionEntries` (existing globals from `progress.js`).
- Produces: `openCategoryPicker(context)` where `context` is `'study' | 'pending' | 'historial'`; `closeCategoryPicker()`; a module-level `let categoryFilter = 'all';` (added to the existing global state line). Tasks 4, 5, 6 call `openCategoryPicker(...)` and read `categoryFilter`.

- [ ] **Step 1: Add `categoryFilter` to the global state line**

Change (currently line 417):
```js
let mode = '', questions = [], current = 0, selected = [], userAnswers = [], timerInterval = null, timeLeft = 0, blockStart = 0, reviewBlockSize = 10, reviewSource = 'pending';
```
to:
```js
let mode = '', questions = [], current = 0, selected = [], userAnswers = [], timerInterval = null, timeLeft = 0, blockStart = 0, reviewBlockSize = 10, reviewSource = 'pending', categoryFilter = 'all';
```

- [ ] **Step 2: Add the modal markup**

Insert after the closing `</div>` of `#block-picker` (currently line 912):

```html

<div id="category-picker">
  <div class="picker-box picker-box-wide">
    <div class="picker-title" id="category-picker-title">Elige una categoría</div>
    <div class="picker-sub" id="category-picker-sub">Filtra las preguntas por dominio del temario oficial.</div>
    <div class="category-list" id="category-list"></div>
    <button class="picker-cancel" onclick="closeCategoryPicker()">Cancelar</button>
  </div>
</div>
```

- [ ] **Step 3: Add the picker logic**

Insert after `closeBlockPicker()` (currently ends line 784, right before `function startRepaso(blockSize) {`):

```js
let categoryPickerContext = 'study';

function getCategoryCounts(context) {
  const counts = {};
  if (context === 'study') {
    CATEGORIES.forEach(cat => { counts[cat] = QUESTIONS.filter(q => q.category === cat).length; });
  } else {
    const progress = getProgress();
    const ids = context === 'historial'
      ? getRevisionEntries(progress).map(e => e.id)
      : getPendingReviewIds(progress);
    CATEGORIES.forEach(cat => {
      counts[cat] = QUESTIONS.filter(q => ids.includes(q.id) && q.category === cat).length;
    });
  }
  return counts;
}

function openCategoryPicker(context) {
  categoryPickerContext = context;
  const counts = getCategoryCounts(context);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const list = document.getElementById('category-list');
  list.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'category-btn';
  allBtn.innerHTML = `<span>Todas</span><span class="cat-count">${total}</span>`;
  allBtn.onclick = () => selectCategory('all');
  list.appendChild(allBtn);

  CATEGORIES.forEach(cat => {
    const count = counts[cat];
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (count === 0 ? ' disabled' : '');
    btn.innerHTML = `<span>${CATEGORY_LABELS[cat]}</span><span class="cat-count">${count}</span>`;
    if (count > 0) btn.onclick = () => selectCategory(cat);
    list.appendChild(btn);
  });

  document.getElementById('category-picker').classList.add('show');
}

function closeCategoryPicker() {
  document.getElementById('category-picker').classList.remove('show');
}

function selectCategory(category) {
  categoryFilter = category;
  closeCategoryPicker();
  if (categoryPickerContext === 'study') {
    startMode('study');
  } else {
    openBlockPicker(categoryPickerContext);
  }
}
```

- [ ] **Step 4: Add `#category-picker` to the existing modal CSS selector**

Find (currently line 189):
```css
#block-picker { display:none; position:fixed; inset:0; z-index:1000; align-items:center; justify-content:center; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); }
#block-picker.show { display:flex; animation: fadeInScale 0.5s ease; }
```
Replace with:
```css
#block-picker, #category-picker { display:none; position:fixed; inset:0; z-index:1000; align-items:center; justify-content:center; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); }
#block-picker.show, #category-picker.show { display:flex; animation: fadeInScale 0.5s ease; }
```

- [ ] **Step 5: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('<script>', html.indexOf('cloud-sync.js'));
const e = html.indexOf('</script>', s);
fs.writeFileSync('scratch_check.js', html.slice(s+8, e));
"
node --check scratch_check.js && echo "SYNTAX OK"
rm scratch_check.js
```

Expected: `SYNTAX OK`. (`openBlockPicker`/`startMode` referenced by `selectCategory` are defined elsewhere in the same script scope — this is a syntax check only; behavioral wiring is verified in Tasks 4–6.)

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add reusable category-picker modal"
```

---

### Task 4: Wire category filter into Modo Estudio

**Files:**
- Modify: `index.html` — `startMode()` study branch (currently lines 447–455), the Modo Estudio card `onclick` (currently line 219), `renderQuestion()` (currently lines 474–534, category badge insertion).

**Interfaces:**
- Consumes: `categoryFilter`, `CATEGORIES`, `CATEGORY_LABELS`, `openCategoryPicker` (Task 3).

- [ ] **Step 1: Change the Modo Estudio card to open the picker instead of starting directly**

Find (currently line 219):
```html
<div class="mode-card" onclick="startMode('study')">
```
Replace with:
```html
<div class="mode-card" onclick="openCategoryPicker('study')">
```

- [ ] **Step 2: Filter the question pool by category in `startMode`**

Find the study branch (currently lines 447–455):
```js
  } else {
    const seenIds = getSeenIds();
    const unseen = QUESTIONS.filter(q => !seenIds.includes(q.id));
    questions = shuffle(unseen.length > 0 ? unseen : QUESTIONS);
    document.getElementById('mode-badge').textContent = 'MODO ESTUDIO';
    document.getElementById('mode-badge').className = 'mode-badge badge-study';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('btn-skip').style.display = 'none';
  }
```
Replace with:
```js
  } else {
    const seenIds = getSeenIds();
    const pool = categoryFilter === 'all' ? QUESTIONS : QUESTIONS.filter(q => q.category === categoryFilter);
    const unseen = pool.filter(q => !seenIds.includes(q.id));
    questions = shuffle(unseen.length > 0 ? unseen : pool);
    document.getElementById('mode-badge').textContent = 'MODO ESTUDIO';
    document.getElementById('mode-badge').className = 'mode-badge badge-study';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('btn-skip').style.display = 'none';
  }
```

- [ ] **Step 3: Show the category badge during Estudio**

Find (currently line 488):
```js
  document.getElementById('q-number').textContent = `PREGUNTA ${current + 1}`;
```
Replace with:
```js
  document.getElementById('q-number').textContent = `PREGUNTA ${current + 1}`;
  document.getElementById('q-category-badge').textContent = mode === 'study' ? (CATEGORY_LABELS[q.category] || '') : '';
```

Add the badge element in the HTML. Find (currently line 261):
```html
    <div class="q-number" id="q-number"></div>
```
Replace with:
```html
    <div class="q-number" id="q-number"></div>
    <div class="q-category-badge" id="q-category-badge"></div>
```

- [ ] **Step 4: Manual verification**

Open `index.html` directly in a browser (`file://` path is fine, no server needed). Click "Modo Estudio" → category picker appears with "Todas" + 8 categories, each showing a count, "Agentforce" disabled (0). Pick "Automatización" → only Automation-tagged questions appear, badge under the question number shows "Automatización". Click "← Salir", click "Modo Estudio" → pick "Todas" → behaves exactly as before this feature (regression check per spec item 4).

- [ ] **Step 5: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('<script>', html.indexOf('cloud-sync.js'));
const e = html.indexOf('</script>', s);
fs.writeFileSync('scratch_check.js', html.slice(s+8, e));
"
node --check scratch_check.js && echo "SYNTAX OK"
rm scratch_check.js
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: filter Modo Estudio by category"
```

---

### Task 5: Wire category filter into Repaso de Falladas

**Files:**
- Modify: `index.html` — `startMode()` repaso branch (currently lines 437–446), `openBlockPicker()` (currently lines 767–780), the Repasar Falladas card `onclick` (currently line 232).

**Interfaces:**
- Consumes: `categoryFilter` (Task 3).

- [ ] **Step 1: Change the Repasar Falladas card to open the category picker first**

Find (currently line 232):
```html
<div class="mode-card repaso-card" id="repaso-card" onclick="openBlockPicker()">
```
Replace with:
```html
<div class="mode-card repaso-card" id="repaso-card" onclick="openCategoryPicker('pending')">
```

- [ ] **Step 2: Make `openBlockPicker` category-aware**

Find (currently lines 767–780):
```js
function openBlockPicker(source) {
  source = source || 'pending';
  const progress = getProgress();
  const count = source === 'historial'
    ? getRevisionEntries(progress).length
    : getPendingReviewIds(progress).length;
  if (count === 0) return;
  reviewSource = source;
  if (count <= 10) {
    startRepaso(10);
    return;
  }
  document.getElementById('block-picker').classList.add('show');
}
```
Replace with:
```js
function openBlockPicker(source) {
  source = source || 'pending';
  const progress = getProgress();
  let ids = source === 'historial'
    ? getRevisionEntries(progress).map(e => e.id)
    : getPendingReviewIds(progress);
  if (categoryFilter !== 'all') {
    ids = ids.filter(id => {
      const q = QUESTIONS.find(item => item.id === id);
      return q && q.category === categoryFilter;
    });
  }
  const count = ids.length;
  if (count === 0) return;
  reviewSource = source;
  if (count <= 10) {
    startRepaso(10);
    return;
  }
  document.getElementById('block-picker').classList.add('show');
}
```

- [ ] **Step 3: Filter the question pool by category in the repaso branch of `startMode`**

Find (currently lines 437–446):
```js
  } else if (mode === 'repaso') {
    const progress = getProgress();
    const idsToUse = reviewSource === 'historial'
      ? getRevisionEntries(progress).map(e => e.id)
      : getPendingReviewIds(progress);
    questions = QUESTIONS.filter(q => idsToUse.includes(q.id));
    document.getElementById('mode-badge').textContent = reviewSource === 'historial' ? 'MODO REPASO (HISTORIAL)' : 'MODO REPASO';
    document.getElementById('mode-badge').className = 'mode-badge badge-repaso';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('btn-skip').style.display = 'none';
  }
```
Replace with:
```js
  } else if (mode === 'repaso') {
    const progress = getProgress();
    const idsToUse = reviewSource === 'historial'
      ? getRevisionEntries(progress).map(e => e.id)
      : getPendingReviewIds(progress);
    questions = QUESTIONS.filter(q => idsToUse.includes(q.id) && (categoryFilter === 'all' || q.category === categoryFilter));
    document.getElementById('mode-badge').textContent = reviewSource === 'historial' ? 'MODO REPASO (HISTORIAL)' : 'MODO REPASO';
    document.getElementById('mode-badge').className = 'mode-badge badge-repaso';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('btn-skip').style.display = 'none';
  }
```

- [ ] **Step 4: Manual verification**

Fail a handful of questions from at least two different categories in Modo Estudio. Go to menu, click "Repasar Falladas" → category picker shows only the categories that actually have pending fails enabled (others disabled), with correct counts. Pick one category → only that category's failed questions appear, and the existing ≤10-skips-the-size-picker / capped-label logic (already shipped) still works, now scoped to the filtered count.

- [ ] **Step 5: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('<script>', html.indexOf('cloud-sync.js'));
const e = html.indexOf('</script>', s);
fs.writeFileSync('scratch_check.js', html.slice(s+8, e));
"
node --check scratch_check.js && echo "SYNTAX OK"
rm scratch_check.js
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: filter Repaso de Falladas by category"
```

---

### Task 6: Wire category filter into Historial de Falladas

**Files:**
- Modify: `index.html` — the `#practice-historial-btn` `onclick` (currently line 301).

**Interfaces:**
- Consumes: `openCategoryPicker` (Task 3). No changes needed to `showHistorial()`/`closeHistorial()` — the read-only list itself stays unfiltered per spec (only the "Practicar estas preguntas" action is scoped by category).

- [ ] **Step 1: Change the practice button to open the category picker**

Find (currently line 301):
```html
<button class="btn btn-primary" id="practice-historial-btn" onclick="openBlockPicker('historial')">Practicar estas preguntas</button>
```
Replace with:
```html
<button class="btn btn-primary" id="practice-historial-btn" onclick="openCategoryPicker('historial')">Practicar estas preguntas</button>
```

- [ ] **Step 2: Manual verification**

With at least one historical fail in two different categories, open "Historial de falladas" (link at the bottom of the menu), click "Practicar estas preguntas" → category picker appears (not the old direct block-size picker), categories with 0 historical fails are disabled, selecting one starts a `repaso` session (`reviewSource = 'historial'`) scoped to that category. The read-only list above the button still shows every historical fail regardless of category (unfiltered, per spec).

- [ ] **Step 3: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('<script>', html.indexOf('cloud-sync.js'));
const e = html.indexOf('</script>', s);
fs.writeFileSync('scratch_check.js', html.slice(s+8, e));
"
node --check scratch_check.js && echo "SYNTAX OK"
rm scratch_check.js
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: filter Historial de Falladas practice by category"
```

---

### Task 7: Full regression pass and deploy

**Files:** None (verification only).

- [ ] **Step 1: Run the existing pure-logic test suite (must be untouched by this feature)**

Run: `node --test progress.test.js cloud-sync.test.js`
Expected: `# pass 17`, `# fail 0` (same as before this feature — `progress.js`/`cloud-sync.js` were never modified).

- [ ] **Step 2: Static data/HTML sanity checks**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
// no duplicate ids
const ids = [...html.matchAll(/\bid=\"([^\"]+)\"/g)].map(m => m[1]);
const seen = new Set(); const dupes = [];
ids.forEach(id => { if (seen.has(id)) dupes.push(id); seen.add(id); });
if (dupes.length) { console.log('DUPLICATE IDS:', dupes); process.exit(1); }
console.log('No duplicate element ids among', ids.length, 'ids.');
"
```

Expected: `No duplicate element ids among N ids.` (the new `category-picker`, `category-picker-title`, `category-picker-sub`, `category-list`, `q-category-badge` ids must each appear exactly once).

- [ ] **Step 3: Manual browser walkthrough (full path, all three entry points)**

1. Modo Estudio → "Todas" → identical to pre-feature behavior.
2. Modo Estudio → a specific category → only that category's questions, badge visible, "solo no vistas hasta agotar" logic still respected within the category.
3. Fail questions across ≥2 categories in Estudio.
4. Repasar Falladas → category picker → pick a category → only that category's pending fails, block-size skip logic (≤10) still works.
5. Historial de falladas → view full unfiltered list → "Practicar estas preguntas" → category picker → pick a category → practices only that category.
6. Modo Examen → unaffected, still 60 mixed questions, no category picker appears.

- [ ] **Step 4: Commit any final fixups found during manual walkthrough, then push**

```bash
git push origin main
```

- [ ] **Step 5: Wait for GitHub Pages rebuild and confirm live**

```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
until [ "$(gh api repos/alefrdev/sf-admin-quiz/pages/builds/latest --jq .status 2>/dev/null)" != "building" ]; do sleep 5; done
gh api repos/alefrdev/sf-admin-quiz/pages/builds/latest --jq '.status'
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://alefrdev.github.io/sf-admin-quiz/
```

Expected: `built` and `HTTP 200`.
