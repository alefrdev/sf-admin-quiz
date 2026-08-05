# Login Google + Firebase Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir login con Google (Firebase Authentication) y sincronización del progreso de preguntas falladas en Cloud Firestore, manteniendo el modo invitado (localStorage) intacto para quien no inicie sesión.

**Architecture:** `progress.js` (Fase 1) sigue siendo la única fuente de verdad síncrona (localStorage); una capa nueva `cloud-sync.js` sincroniza ese mismo objeto de progreso con Firestore cuando hay sesión iniciada, sin reescribir el motor del quiz a código asíncrono.

**Tech Stack:** Firebase Authentication (proveedor Google) + Cloud Firestore, cargados vía CDN (`firebasejs` v10, compat API) en `index.html`. Firebase CLI para aprovisionar el proyecto. Node 18 (`node:test`) para los tests de la capa de sincronización, igual que en Fase 1.

## Global Constraints

- El motor existente (`progress.js`, `checkAnswer()`, etc.) no se toca ni se vuelve asíncrono.
- Firestore: colección `users`, documento por UID con forma `{ progress: {...} }`, misma forma que ya produce `getProgress()`.
- Reglas de Firestore: cada usuario solo puede leer/escribir `users/{su propio uid}`.
- Sin login: la app funciona exactamente igual que en Fase 1 (modo invitado, localStorage).
- Primera vez que una cuenta inicia sesión (documento no existe en Firestore): se sube el progreso local existente. Si ya existe: la nube manda y sobrescribe localStorage.
- El binario de Firebase CLI usado en este plan es el standalone de Windows (`firebase-tools-win.exe`, NO la variante `-instant-`, que falla en este entorno) — ver Tarea 1, Paso 1.
- Node instalado es v18.19.1: `firebase-tools` vía npm requiere Node ≥20 y falla; por eso se usa el binario standalone, que trae su propio Node embebido.

---

### Task 1: Aprovisionar el proyecto de Firebase (CLI)

**Files:**
- Create: `firebase-config.js` (config real generada por el propio CLI)
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.rules`

**Interfaces:**
- Produces: `firebase-config.js` con el objeto `firebaseConfig` real (consumido por la Tarea 2 para añadirle `firebase.initializeApp(...)`), y el ID del proyecto de Firebase (referenciado en pasos posteriores como `<PROJECT_ID>`).

- [ ] **Step 1: Verificar/descargar el binario standalone de Firebase CLI**

Run (PowerShell o Bash):
```bash
if [ ! -f "/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe" ]; then
  mkdir -p "/c/Users/alefr/AppData/Local/firebase-tools"
  curl -sL -o "/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe" \
    https://github.com/firebase/firebase-tools/releases/download/v15.25.1/firebase-tools-win.exe
fi
"/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe" --version
```
Expected: imprime una versión (p. ej. `15.25.1`), sin errores `ERR_REQUIRE_ESM` ni `SyntaxError`. El primer arranque puede tardar 1-3 minutos (descomprime su Node interno); si el proceso no ha respondido a los 30s, es normal, seguirá corriendo en segundo plano hasta terminar.

- [ ] **Step 2: Iniciar sesión en Firebase (en segundo plano, requiere autorización tuya en el navegador)**

Run (segundo plano):
```bash
FB="/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe"
cd "/c/Users/alefr/Desktop/Proyectos/Proyecto certi admin"
"$FB" login
```
Expected: imprime una URL de `accounts.google.com` (y, si hay entorno gráfico, intenta abrir el navegador solo). El usuario debe abrir esa URL (si no se abrió solo) y autorizar con su cuenta de Google. El comando termina con `✔  Success! Logged in as <email>`.

- [ ] **Step 3: Crear el proyecto de Firebase**

Run:
```bash
FB="/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe"
"$FB" projects:create sf-admin-quiz -n "SF Admin Quiz"
```
Expected: `✔ Created project sf-admin-quiz` (o similar), muestra el `Project ID` final (puede llevar un sufijo si `sf-admin-quiz` ya estaba tomado globalmente — anotar el ID real devuelto y usarlo como `<PROJECT_ID>` en el resto de los pasos).

Si falla porque el ID ya existe, reintentar con:
```bash
"$FB" projects:create sf-admin-quiz-$(date +%s | tail -c 5) -n "SF Admin Quiz"
```

- [ ] **Step 4: Registrar la app web dentro del proyecto**

Run:
```bash
FB="/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe"
"$FB" apps:create WEB "SF Admin Quiz Web" --project <PROJECT_ID>
```
Expected: imprime `✔ Created web app` y un `App ID` con formato `1:XXXXXXXXXXXX:web:XXXXXXXXXXXXXXXXXXXXXX` — anotarlo como `<APP_ID>`.

- [ ] **Step 5: Generar `firebase-config.js` con la configuración real**

Run:
```bash
FB="/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe"
cd "/c/Users/alefr/Desktop/Proyectos/Proyecto certi admin"
"$FB" apps:sdkconfig WEB <APP_ID> --project <PROJECT_ID> -o firebase-config.js
cat firebase-config.js
```
Expected: el archivo contiene un bloque `const firebaseConfig = { "apiKey": "...", "authDomain": "...", "projectId": "...", "storageBucket": "...", "messagingSenderId": "...", "appId": "..." };` con valores reales (no placeholders).

- [ ] **Step 6: Ver ubicaciones válidas y crear la base de datos Firestore**

Run:
```bash
FB="/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe"
"$FB" firestore:locations --project <PROJECT_ID>
```
Expected: lista de IDs de ubicación válidos (debe incluir `nam5`).

Run:
```bash
FB="/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe"
"$FB" firestore:databases:create "(default)" --location=nam5 --project <PROJECT_ID>
```
Expected: `✔ Successfully created (default)` (o similar).

- [ ] **Step 7: Escribir `firestore.rules`, `firebase.json` y `.firebaserc`**

Crear `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Crear `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

Crear `.firebaserc` (sustituir `<PROJECT_ID>` por el ID real de la Tarea 1, Paso 3):

```json
{
  "projects": {
    "default": "<PROJECT_ID>"
  }
}
```

- [ ] **Step 8: Desplegar las reglas de Firestore**

Run:
```bash
FB="/c/Users/alefr/AppData/Local/firebase-tools/firebase.exe"
cd "/c/Users/alefr/Desktop/Proyectos/Proyecto certi admin"
"$FB" deploy --only firestore:rules --project <PROJECT_ID>
```
Expected: `✔ Deploy complete!`

- [ ] **Step 9: Paso manual — activar el proveedor Google y autorizar el dominio de GitHub Pages**

Este es el único paso que se hace a mano en la consola (no tiene equivalente estable por CLI):
1. Ir a `https://console.firebase.google.com/project/<PROJECT_ID>/authentication/providers`.
2. Activar el proveedor **Google** (botón "Habilitar", elegir un correo de soporte, Guardar).
3. Ir a la pestaña **Settings → Authorized domains** dentro de Authentication.
4. Añadir `alefrdev.github.io` a la lista de dominios autorizados.

- [ ] **Step 10: Commit**

```bash
git add firebase-config.js firebase.json .firebaserc firestore.rules
git commit -m "chore: provision Firebase project (Auth + Firestore) for cloud sync"
```

---

### Task 2: Capa de sincronización (`cloud-sync.js`)

**Files:**
- Create: `cloud-sync.js`
- Create: `cloud-sync.test.js`
- Modify: `firebase-config.js` (añadir inicialización)

**Interfaces:**
- Consumes: el objeto `firebaseConfig` ya escrito en `firebase-config.js` por la Tarea 1.
- Produces (usado por la Tarea 3): `signIn()`, `signOutUser()`, `onAuthChange(callback)`, `syncOnLogin(db, uid, localProgress): Promise<object>`, `pushCloudProgress(db, uid, progress): Promise<void>`, y los globales `auth`/`db` (de `firebase-config.js`).

- [ ] **Step 1: Añadir la inicialización a `firebase-config.js`**

Al final del archivo generado en la Tarea 1 (después del bloque `const firebaseConfig = {...};`), añadir:

```js
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
```

- [ ] **Step 2: Escribir el test que falla primero**

Crear `cloud-sync.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

class FakeDoc {
  constructor(store, id) { this.store = store; this.id = id; }
  async get() {
    const data = this.store.get(this.id);
    return { exists: data !== undefined, data: () => data };
  }
  async set(data) { this.store.set(this.id, data); }
}

class FakeCollection {
  constructor() { this.docs = new Map(); }
  doc(id) { return new FakeDoc(this.docs, id); }
}

class FakeFirestore {
  constructor() { this.collections = new Map(); }
  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new FakeCollection());
    return this.collections.get(name);
  }
}

const { syncOnLogin, pushCloudProgress } = require('./cloud-sync.js');

test('syncOnLogin uploads local progress when no cloud doc exists yet', async () => {
  const db = new FakeFirestore();
  const local = { '1': { failCount: 1, pendingReview: true } };
  const result = await syncOnLogin(db, 'uid1', local);
  assert.deepEqual(result, local);
  const stored = await db.collection('users').doc('uid1').get();
  assert.deepEqual(stored.data().progress, local);
});

test('syncOnLogin downloads cloud progress when a doc already exists', async () => {
  const db = new FakeFirestore();
  const cloudProgress = { '5': { failCount: 3, pendingReview: false } };
  await db.collection('users').doc('uid1').set({ progress: cloudProgress });
  const local = { '1': { failCount: 1, pendingReview: true } };
  const result = await syncOnLogin(db, 'uid1', local);
  assert.deepEqual(result, cloudProgress);
});

test('pushCloudProgress writes the progress object under the user doc', async () => {
  const db = new FakeFirestore();
  await pushCloudProgress(db, 'uid1', { '2': { failCount: 1, pendingReview: true } });
  const stored = await db.collection('users').doc('uid1').get();
  assert.deepEqual(stored.data().progress, { '2': { failCount: 1, pendingReview: true } });
});
```

- [ ] **Step 3: Ejecutar el test y comprobar que falla**

Run: `node --test cloud-sync.test.js`
Expected: FAIL — `Cannot find module './cloud-sync.js'`

- [ ] **Step 4: Implementar `cloud-sync.js`**

```js
async function syncOnLogin(db, uid, localProgress) {
  const docRef = db.collection('users').doc(uid);
  const snap = await docRef.get();
  if (snap.exists) {
    return snap.data().progress || {};
  }
  await docRef.set({ progress: localProgress });
  return localProgress;
}

async function pushCloudProgress(db, uid, progress) {
  await db.collection('users').doc(uid).set({ progress });
}

function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => console.error('Error al iniciar sesión:', err));
}

function signOutUser() {
  auth.signOut().catch(err => console.error('Error al cerrar sesión:', err));
}

function onAuthChange(callback) {
  auth.onAuthStateChanged(callback);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { syncOnLogin, pushCloudProgress };
}
```

- [ ] **Step 5: Ejecutar el test y comprobar que pasa**

Run: `node --test cloud-sync.test.js`
Expected: PASS — 3 tests, 0 fallos.

- [ ] **Step 6: Commit**

```bash
git add firebase-config.js cloud-sync.js cloud-sync.test.js
git commit -m "feat: add cloud-sync layer with unit tests for login upload/download logic"
```

---

### Task 3: Integrar login y sincronización en `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `signIn()`, `signOutUser()`, `onAuthChange()`, `syncOnLogin()`, `pushCloudProgress()`, `auth`, `db` de la Tarea 2; `getProgress()`, `saveProgress()`, `updateProgress()` de Fase 1.

- [ ] **Step 1: Cargar los SDKs de Firebase y los scripts nuevos**

Sustituir (línea con los `<script>` existentes antes del script inline):

```html
<script src="progress.js"></script>
<script>
```

por:

```html
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="progress.js"></script>
<script src="cloud-sync.js"></script>
<script>
```

- [ ] **Step 2: Añadir el marcado del bloque de login**

Dentro de `#menu`, justo después de la etiqueta de apertura `<div id="menu">`, añadir:

```html
  <div id="auth-bar">
    <button id="login-btn" class="btn btn-ghost" onclick="signIn()">Iniciar sesión con Google</button>
    <div id="user-info">
      <img id="user-photo" src="" alt="">
      <span id="user-name"></span>
      <button class="btn btn-ghost" onclick="signOutUser()">Cerrar sesión</button>
    </div>
  </div>
```

- [ ] **Step 3: CSS del bloque de login**

Cambiar:

```css
  #menu { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
```

por:

```css
  #menu { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; position: relative; }
```

Y añadir estos estilos nuevos junto a `.stats-bar`:

```css
  #auth-bar { position: absolute; top: 1rem; right: 1.5rem; font-size: 0.85rem; }
  #user-info { display: none; align-items: center; gap: 0.5rem; }
  #user-photo { width: 28px; height: 28px; border-radius: 50%; }
  #user-name { color: var(--text); }
```

- [ ] **Step 4: Función `updateAuthUI` y enganche de `onAuthChange`**

Añadir antes de `renderMenuCounts()`:

```js
function updateAuthUI(user) {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  if (user) {
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    document.getElementById('user-photo').src = user.photoURL || '';
    document.getElementById('user-name').textContent = user.displayName || user.email;
  } else {
    loginBtn.style.display = 'inline-block';
    userInfo.style.display = 'none';
  }
}

onAuthChange(async (user) => {
  updateAuthUI(user);
  if (user) {
    const merged = await syncOnLogin(db, user.uid, getProgress());
    saveProgress(merged);
    renderMenuCounts();
  }
});
```

- [ ] **Step 5: Empujar a la nube tras cada `updateProgress()`**

Cambiar:

```js
  if (mode === 'study' || mode === 'repaso') {
    updateProgress(q.id, isCorrect);
  }
```

por:

```js
  if (mode === 'study' || mode === 'repaso') {
    updateProgress(q.id, isCorrect);
    if (auth.currentUser) {
      pushCloudProgress(db, auth.currentUser.uid, getProgress());
    }
  }
```

- [ ] **Step 6: Verificación estática (sin navegador)**

Run:
```bash
cd "/c/Users/alefr/Desktop/Proyectos/Proyecto certi admin"
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const m = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('.check.js', m.map(x => x[1]).join('\n'));
"
node --check .check.js && echo "SYNTAX OK"
rm .check.js
```
Expected: `SYNTAX OK`

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: wire Google sign-in and Firestore sync into the quiz UI"
```

---

### Task 4: Regresión manual y despliegue

**Files:** Ninguno (verificación + push).

- [ ] **Step 1: Ejecutar todos los tests automatizados**

Run: `node --test progress.test.js cloud-sync.test.js`
Expected: PASS — 13 tests en total (10 de `progress.test.js` + 3 de `cloud-sync.test.js`), 0 fallos.

- [ ] **Step 2: Servir la app localmente para poder probar el login (file:// no permite el popup)**

Run (segundo plano):
```bash
cd "/c/Users/alefr/Desktop/Proyectos/Proyecto certi admin"
python -m http.server 8080
```
Abrir `http://localhost:8080/` en el navegador (localhost ya está autorizado por defecto en Firebase Auth).

- [ ] **Step 3: Regresión manual siguiendo el plan de pruebas de la spec**

1. Sin sesión, fallar una pregunta en Estudio → debe comportarse igual que en Fase 1 (aparece en Falladas/Historial vía localStorage).
2. Pulsar "Iniciar sesión con Google", autorizar → el botón cambia a foto+nombre+"Cerrar sesión".
3. Abrir la consola de Firebase → Firestore → confirmar que existe `users/<uid>` con el progreso que tenías en local.
4. Fallar/acertar más preguntas con sesión iniciada → confirmar en la consola de Firestore que el documento se actualiza.
5. Cerrar sesión → la app sigue funcionando en modo invitado con el último progreso sincronizado.
6. Volver a iniciar sesión con la misma cuenta desde una ventana de incógnito → el progreso de Firestore debe bajar y reflejarse en los contadores del menú.

- [ ] **Step 4: Desplegar a GitHub Pages**

```bash
git push
```
Expected: GitHub Pages reconstruye automáticamente desde `main` (verificar con `gh api repos/alefrdev/sf-admin-quiz/pages/builds/latest --jq .status` hasta que devuelva `built`).

- [ ] **Step 5: Verificación final en producción**

Repetir el punto 2-3 del Step 3 pero contra `https://alefrdev.github.io/sf-admin-quiz/` en vez de localhost, confirmando que `alefrdev.github.io` quedó bien autorizado en la Tarea 1, Paso 9.
