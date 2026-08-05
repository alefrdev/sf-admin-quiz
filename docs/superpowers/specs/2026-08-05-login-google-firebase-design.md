# Diseño: Login con Google + Sincronización en la Nube (Fase 2)

## Contexto

Este documento continúa el trabajo descrito en
[2026-08-05-preguntas-falladas-design.md](./2026-08-05-preguntas-falladas-design.md)
(Fase 1), ya implementado y desplegado en
`https://alefrdev.github.io/sf-admin-quiz/` (repo
`github.com/alefrdev/sf-admin-quiz`, rama `main`).

Fase 1 añadió el modelo de progreso (`failCount` / `pendingReview` por
pregunta) persistido en `localStorage` a través de `progress.js`. Ese
documento ya dejó explícitamente fuera de alcance el login y la
sincronización en la nube, remitiéndolo a esta Fase 2.

El objetivo de la Fase 2 es que, si el usuario inicia sesión con su cuenta de
Google, su progreso (Falladas + Historial) le siga entre dispositivos. Si no
inicia sesión, la app sigue funcionando exactamente igual que en Fase 1
(modo invitado, solo `localStorage`).

## Arquitectura

Se usa **Firebase** (Google) con dos servicios:

- **Firebase Authentication**, proveedor Google, para el login.
- **Cloud Firestore**, para guardar el progreso de cada usuario.

El motor del quiz existente (`progress.js`, y las funciones en el `<script>`
inline de `index.html` como `checkAnswer()`, `renderMenuCounts()`, etc.) **no
se reescribe a código asíncrono**. Sigue leyendo y escribiendo
`localStorage` de forma síncrona, exactamente como en Fase 1.

Se añade una capa nueva, `cloud-sync.js`, responsable de mantener
`localStorage` sincronizado con Firestore cuando hay sesión iniciada:

- Al iniciar sesión (o al cargar la página con una sesión ya activa): decide
  si subir el progreso local a Firestore (primera vez de esa cuenta) o
  bajar el progreso de Firestore a `localStorage` (cuenta ya existente).
- Después de cada cambio de progreso (`updateProgress()`), si hay sesión
  iniciada, empuja el `localStorage` actualizado a Firestore en segundo
  plano.

Los SDKs de Firebase se cargan vía CDN (`<script>` tags, sin bundler),
manteniendo el estilo "vanilla, sin build" del resto de la app. Esto añade
la única dependencia de red que tendrá la app — es inherente a pedir login y
sincronización en la nube; antes funcionaba 100% offline.

## Configuración de Firebase

Se crea y configura vía **Firebase CLI** (`firebase-tools`), autenticando por
navegador igual que se hizo con GitHub CLI en la Fase 1:

1. Crear el proyecto de Firebase.
2. Registrar una app web dentro del proyecto y obtener su configuración
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`). Estos valores **no son secretos** — es
   normal y seguro que sean públicos en el cliente; la seguridad real la dan
   las reglas de Firestore, no ocultar esta configuración.
3. Crear la base de datos Firestore en modo nativo.
4. Desplegar las reglas de seguridad (ver más abajo).
5. Añadir `alefrdev.github.io` a los dominios autorizados de Authentication
   (necesario para que `signInWithPopup` funcione desde el sitio en
   producción).

El único paso que puede requerir un clic manual en la consola de Firebase es
activar el proveedor **Google** dentro de Authentication (suele ser
únicamente un toggle en la UI de consola, sin equivalente directo y estable
en la CLI). Si al ejecutar el plan resulta que no se puede automatizar, se
documentará el paso exacto y se le pedirá al usuario que lo haga.

## Modelo de datos y seguridad en Firestore

Colección `users`, un documento por usuario con su UID de Firebase Auth
(que para el proveedor Google es estable por cuenta) como ID del documento:

```
users/{uid} → { progress: { "<questionId>": { failCount, pendingReview }, ... } }
```

El campo `progress` tiene exactamente la misma forma que el objeto que ya
produce `getProgress()` en `progress.js` (Fase 1).

Reglas de seguridad (`firestore.rules`) — cada usuario solo puede leer y
escribir su propio documento:

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

## Flujo de autenticación y sincronización

- **Botón "Iniciar sesión con Google"** (ver sección de UI) dispara
  `signInWithPopup` con el proveedor de Google de Firebase Auth.
- **`onAuthStateChanged`** (se dispara al iniciar sesión y también al cargar
  la página si ya había una sesión activa):
  1. Leer `users/{uid}` de Firestore.
  2. Si el documento **no existe** (primera vez de esta cuenta): subir el
     progreso actual de `localStorage` tal cual a `users/{uid}` — el
     progreso de invitado que hubiera se conserva como punto de partida en
     la nube.
  3. Si el documento **ya existe**: sobrescribir `localStorage` con el
     `progress` de Firestore (la nube manda a partir de este momento) y
     llamar a `renderMenuCounts()` para refrescar la UI.
- **Después de cada `updateProgress()`** en Modo Estudio o Modo Repaso, si
  hay un usuario con sesión iniciada: leer `localStorage` (ya actualizado
  por `updateProgress()`) y escribirlo en `users/{uid}` en Firestore. Es una
  escritura simple por respuesta contestada — sin colas, sin debounce, dado
  el volumen insignificante de escrituras.
- **Al cerrar sesión**: se deja de sincronizar. `localStorage` conserva el
  último estado sincronizado y la app sigue funcionando en modo invitado sin
  perder ese progreso.
- **Sin conexión o error de Firestore**: fallo silencioso (se registra en
  consola con `console.error`), sin bloquear ni interrumpir el uso normal de
  la app en local.

## Cambios de UI

- Nuevo elemento en la esquina superior derecha de `#menu`:
  - Sin sesión: botón **"Iniciar sesión con Google"**.
  - Con sesión: foto de perfil + nombre + botón **"Cerrar sesión"**.
  - Mientras se resuelve el estado de autenticación al cargar la página
    (una fracción de segundo): estado neutro ("Cargando…") antes de decidir
    cuál de los dos pintar.

## Estructura de archivos

**Crear:**
- `firebase-config.js` — configuración del proyecto Firebase (`apiKey`,
  etc.) + `firebase.initializeApp(...)`; expone `auth` (Firebase Auth) y
  `db` (Firestore) como globales, siguiendo el patrón de `progress.js` de
  Fase 1 (funciones/objetos globales, sin módulos ES).
- `cloud-sync.js` — capa de sincronización:
  - `signIn()`: llama a `signInWithPopup` con el proveedor Google.
  - `signOutUser()`: llama a `signOut()` de Firebase Auth.
  - `onAuthChange(callback)`: wrapper de `onAuthStateChanged`.
  - `syncOnLogin(db, uid, localProgress)`: función pura respecto a sus
    parámetros (recibe la referencia a Firestore inyectada) que decide
    subir o bajar el progreso; devuelve el progreso final a usar. Testable
    con un Firestore falso en memoria.
  - `pushCloudProgress(db, uid, progress)`: escribe el progreso en
    Firestore.
- `cloud-sync.test.js` — tests con el test runner nativo de Node (como en
  Fase 1), usando un Firestore falso en memoria para probar
  `syncOnLogin()` sin red real.
- `firestore.rules`, `firebase.json`, `.firebaserc` — generados por
  `firebase init` al configurar el proyecto.

**Modificar:**
- `index.html`: añadir los `<script>` de los SDKs de Firebase (CDN) y de
  `firebase-config.js` / `cloud-sync.js`; añadir el marcado y CSS del botón
  de login; enganchar `syncOnLogin`/`pushCloudProgress` en los puntos
  correspondientes (carga de página, tras `updateProgress()`).

## Plan de pruebas

- **Automatizadas (Node)**: `cloud-sync.test.js` cubre la lógica de
  decisión de `syncOnLogin()` (subir si el documento no existe, bajar si ya
  existe) usando un Firestore falso en memoria — mismo patrón que
  `progress.test.js` de Fase 1.
- **Manuales en navegador** (requiere servir el sitio por `http://`, ya que
  `file://` no permite el popup de login de Google — se puede usar un
  servidor local simple o el propio sitio ya desplegado en GitHub Pages):
  1. Sin sesión, usar el quiz normalmente (modo invitado) y fallar alguna
     pregunta — debe comportarse igual que en Fase 1.
  2. Iniciar sesión con Google por primera vez con esa cuenta → el progreso
     de invitado debe aparecer subido en el documento de Firestore
     (verificable desde la consola de Firebase).
  3. Fallar/acertar más preguntas con sesión iniciada → confirmar que
     Firestore se actualiza tras cada respuesta.
  4. Cerrar sesión y volver a iniciar sesión con la misma cuenta desde otro
     navegador (o modo incógnito) → el progreso de Firestore debe bajar a
     `localStorage` y reflejarse en los contadores del menú.
  5. Cerrar sesión → la app sigue funcionando en modo invitado con el
     último progreso sincronizado, sin borrar nada.

## Fuera de alcance

- Resolución de conflictos entre dos dispositivos escribiendo casi a la vez:
  se resuelve con "última escritura gana" (el push de Firestore sobrescribe
  el documento completo); no se implementa merge ni bloqueo — no se pidió y
  añadiría complejidad innecesaria para el volumen de uso esperado.
- Cualquier proveedor de login distinto a Google.
- Cambios al Modo Examen: sigue sin persistir nada, en la nube o local,
  igual que en Fase 1.
