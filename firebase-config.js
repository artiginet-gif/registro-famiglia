// Incolla qui la configurazione della Web App Firebase del tuo progetto.
// Questi valori identificano il progetto; la sicurezza dei dati è gestita dalle
// regole Firestore (firestore.rules), non dal nascondere apiKey.
export const firebaseConfig = {
  apiKey: "INCOLLA_API_KEY",
  authDomain: "INCOLLA_PROJECT_ID.firebaseapp.com",
  projectId: "INCOLLA_PROJECT_ID",
  storageBucket: "INCOLLA_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "INCOLLA_MESSAGING_SENDER_ID",
  appId: "INCOLLA_APP_ID"
};
export const isFirebaseConfigured = !Object.values(firebaseConfig).some(value => String(value).startsWith("INCOLLA_"));
