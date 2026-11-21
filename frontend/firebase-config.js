// app.py serves this file dynamically from the root .env values.
// This fallback keeps the page safe if opened without app.py.
window.TRACE_FIREBASE_CONFIG = window.TRACE_FIREBASE_CONFIG || {
  apiKey: 'PASTE_FIREBASE_API_KEY',
  authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'PASTE_MESSAGING_SENDER_ID',
  appId: 'PASTE_FIREBASE_APP_ID'
};
