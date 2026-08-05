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
