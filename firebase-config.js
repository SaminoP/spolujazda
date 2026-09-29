// ==============================================================================
// ☁️ FIREBASE CLOUD KONFIGURÁCIA (Spolujazda)
// ==============================================================================

export const defaultFirebaseConfig = {
  apiKey: "AIzaSyA8EA5vn2ThgAaJ6FJKVPFVQkstM1-Slm4",
  authDomain: "spolujazda-ja.firebaseapp.com",
  projectId: "spolujazda-ja",
  storageBucket: "spolujazda-ja.firebasestorage.app",
  messagingSenderId: "370379580596",
  appId: "1:370379580596:web:d89be33e8238a729c9e3e1",
  measurementId: "G-02H9XSQJN8"
};

// Pomocná funkcia na zistenie, či je Firebase nakonfigurovaný
export function isFirebaseConfigured(config) {
  return config && 
         config.apiKey && 
         config.apiKey.trim().length > 10 && 
         config.projectId && 
         config.projectId.trim().length > 2;
}

// Načítanie konfigurácie: priorita má uložená konfigurácia v localStorage,
// inak sa použije predvolená konfigurácia z tohto súboru.
export function getFirebaseConfig() {
  try {
    const saved = localStorage.getItem('spolujazda_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isFirebaseConfigured(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Chyba pri čítaní firebase config z localStorage', e);
  }
  return defaultFirebaseConfig;
}

export function saveFirebaseConfig(config) {
  localStorage.setItem('spolujazda_firebase_config', JSON.stringify(config));
}
