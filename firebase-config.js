const firebaseConfig = {
  "projectId": "sf-admin-quiz",
  "appId": "1:148503702941:web:ee2f8ad87c666044991374",
  "storageBucket": "sf-admin-quiz.firebasestorage.app",
  "apiKey": "AIzaSyAhDI_C75-r8IulugRYxhq1_zY4dJ1ggrY",
  "authDomain": "sf-admin-quiz.firebaseapp.com",
  "messagingSenderId": "148503702941"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
