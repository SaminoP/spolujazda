import { getFirebaseConfig, isFirebaseConfigured, saveFirebaseConfig } from './firebase-config.js';

// Storage Keys (for Local fallback mode)
const STORAGE_KEY_USERS = 'spolujazda_users';
const STORAGE_KEY_ACTIVE_USER = 'spolujazda_active_user';

// Default Route Distances (in km)
const ROUTES = {
  'pn-brno': { label: 'Piešťany ➔ Brno', km: 150 },
  'brno-pn': { label: 'Brno ➔ Piešťany', km: 150 }
};

// App State
let state = {
  isCloudMode: false,
  firebaseApp: null,
  firebaseAuth: null,
  firebaseDb: null,
  firebaseUser: null,
  firestoreTripsUnsub: null,
  firestoreRefuelsUnsub: null,

  currentUser: null,
  authMode: 'login', // 'login' or 'register'
  currentTab: 'calc',
  historyFilter: 'all',
  
  // Trip State
  routeType: 'pn-brno',
  distanceKm: 150,
  passengers: 3,
  pricePerPerson: 7.50,
  noPassengers: false,
  individualPrices: false,
  passengerPrices: [7.50, 7.50, 7.50],
  hasDiscountPassengers: false,
  discountPassengers: 1,
  discountPrice: 5.00,
  discountNote: '',
  totalPassengerFare: 22.50,

  // In-memory cache for trips and refuels
  trips: [],
  refuels: []
};

// DOM Elements - Auth & Header
const authScreen = document.getElementById('auth-screen');
const appMain = document.getElementById('app-main');
const appNav = document.getElementById('app-nav');
const headerUserSection = document.getElementById('header-user-section');
const currentUserNameEl = document.getElementById('current-user-name');
const btnLogout = document.getElementById('btn-logout');

const authTabLogin = document.getElementById('auth-tab-login');
const authTabRegister = document.getElementById('auth-tab-register');
const authConfirmGroup = document.getElementById('auth-confirm-group');
const authAlert = document.getElementById('auth-alert');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authPasswordConfirmInput = document.getElementById('auth-password-confirm');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const authTestHint = document.getElementById('auth-test-hint');

// Cloud Status & Modal Elements
const btnCloudModal = document.getElementById('btn-cloud-modal');
const cloudModal = document.getElementById('cloud-modal');
const btnCloseCloudModal = document.getElementById('btn-close-cloud-modal');
const cloudConfigInput = document.getElementById('cloud-config-input');
const btnSaveCloudConfig = document.getElementById('btn-save-cloud-config');
const btnResetCloudConfig = document.getElementById('btn-reset-cloud-config');

// Navigation & Forms
const tabBtns = document.querySelectorAll('.nav-tab');
const tabViews = document.querySelectorAll('.tab-view');
const segmentBtns = document.querySelectorAll('.segment-btn[data-route]');
const historyFilterBtns = document.querySelectorAll('.segment-btn[data-history-filter]');

// Trip Inputs
const inputTripDate = document.getElementById('trip-date');
const inputDistance = document.getElementById('trip-distance');
const stepperVal = document.getElementById('stepper-passengers');
const btnMinus = document.getElementById('btn-passenger-minus');
const btnPlus = document.getElementById('btn-passenger-plus');
const toggleNoPassengers = document.getElementById('toggle-no-passengers');
const stepperContainer = document.getElementById('passengers-stepper-container');
const inputPricePerPerson = document.getElementById('price-per-person');
const inputTotalFare = document.getElementById('total-passenger-fare');
const toggleDiscount = document.getElementById('toggle-discount-passengers');
const discountContainer = document.getElementById('discount-passengers-container');
const inputDiscountCount = document.getElementById('discount-passengers-count');
const inputDiscountPrice = document.getElementById('discount-price-per-person');
const inputDiscountNote = document.getElementById('discount-note');

// Trip Displays
const profitBanner = document.getElementById('profit-banner');
const profitStatusText = document.getElementById('profit-status-text');
const profitAmount = document.getElementById('profit-amount');
const displayPricePerson = document.getElementById('display-price-person');
const displayPassengers = document.getElementById('display-passengers');
const displayRouteKm = document.getElementById('display-route-km');

// Trip Buttons
const btnSaveTrip = document.getElementById('btn-save-trip');
const btnResetTrip = document.getElementById('btn-reset-trip');

// Refuel Tab Inputs
const inputRefuelDate = document.getElementById('refuel-date');
const inputRefuelTotalPrice = document.getElementById('refuel-total-price');
const inputRefuelLiters = document.getElementById('refuel-liters');
const inputRefuelPricePerL = document.getElementById('refuel-price-per-l');
const inputRefuelStation = document.getElementById('refuel-station');
const inputRefuelOdometer = document.getElementById('refuel-odometer');
const btnSaveRefuel = document.getElementById('btn-save-refuel');

// Toast
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const today = new Date().toISOString().split('T')[0];
  if (inputTripDate) inputTripDate.value = today;
  if (inputRefuelDate) inputRefuelDate.value = today;

  initCloudModalEvents();
  initAuthEvents();
  initEventListeners();
  initEditModals();

  // Initialize Firebase Cloud if configured, otherwise run in Local Mode
  await setupCloudOrLocal();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((err) => {
        console.log('SW registration failed:', err);
      });
    });
  }
});

function showToast(msg, duration = 2400) {
  if (!toast) return;
  toastMessage.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ================= CLOUD / LOCAL INITIALIZATION =================
async function setupCloudOrLocal() {
  const config = getFirebaseConfig();

  if (isFirebaseConfigured(config)) {
    try {
      // Dynamically load Firebase modules from CDN
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const { getFirestore, enableIndexedDbPersistence } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

      state.firebaseApp = initializeApp(config);
      state.firebaseAuth = getAuth(state.firebaseApp);
      state.firebaseDb = getFirestore(state.firebaseApp);
      state.isCloudMode = true;

      // Enable offline persistence for Firestore if available
      try {
        await enableIndexedDbPersistence(state.firebaseDb);
      } catch (err) {
        console.warn('Firestore offline persistence warning:', err.code);
      }

      // Update Cloud Badge
      btnCloudModal.textContent = '🟢 Cloud aktívny';
      btnCloudModal.className = 'cloud-badge online';
      if (authTestHint) authTestHint.style.display = 'none';

      // Listen to Auth State
      onAuthStateChanged(state.firebaseAuth, (user) => {
        if (user) {
          handleCloudUserLoggedIn(user);
        } else {
          handleCloudUserLoggedOut();
          if (authTestHint) {
            authTestHint.style.display = 'block';
            authTestHint.innerHTML = '🔑 Testovací cloudový účet: <b>admin</b> &bull; Heslo: <b>admin</b>';
          }
          if (authUsernameInput && !authUsernameInput.value) {
            authUsernameInput.value = 'admin';
            authPasswordInput.value = 'admin';
          }
        }
      });
      return;
    } catch (e) {
      console.error('Chyba pri inicializácii Firebase:', e);
      showToast('⚠️ Nepodarilo sa pripojiť Firebase, prepínam na lokálny režim.');
    }
  }

  // Fallback to Local Storage Mode
  state.isCloudMode = false;
  btnCloudModal.textContent = '☁️ Lokálny (Aktivovať Cloud)';
  btnCloudModal.className = 'cloud-badge offline';
  if (authTestHint) authTestHint.style.display = 'block';
  checkLocalActiveSession();
}

function initCloudModalEvents() {
  btnCloudModal.addEventListener('click', () => {
    const curConfig = getFirebaseConfig();
    if (isFirebaseConfigured(curConfig)) {
      cloudConfigInput.value = JSON.stringify(curConfig, null, 2);
    }
    cloudModal.classList.add('open');
  });

  btnCloseCloudModal.addEventListener('click', () => {
    cloudModal.classList.remove('open');
  });

  cloudModal.addEventListener('click', (e) => {
    if (e.target === cloudModal) cloudModal.classList.remove('open');
  });

  btnSaveCloudConfig.addEventListener('click', () => {
    const raw = cloudConfigInput.value.trim();
    if (!raw) {
      alert('Vlož kód firebaseConfig zo stránky Firebase Console.');
      return;
    }

    let configObj = null;

    // 1. Try robust regex extraction (works on JS snippets, const firebaseConfig = {...}, comments, single/double quotes, etc.)
    const extract = (key) => {
      const match = raw.match(new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`, 'i'));
      return match ? match[1].trim() : '';
    };

    const apiKey = extract('apiKey');
    const projectId = extract('projectId');

    if (apiKey && projectId) {
      configObj = {
        apiKey: apiKey,
        authDomain: extract('authDomain') || `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: extract('storageBucket') || `${projectId}.appspot.com`,
        messagingSenderId: extract('messagingSenderId') || '',
        appId: extract('appId') || ''
      };
      const measurementId = extract('measurementId');
      if (measurementId) configObj.measurementId = measurementId;
    } else {
      // 2. Fallback to standard JSON.parse
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') configObj = parsed;
      } catch (e) {}

      // 3. Fallback to JS object evaluation
      if (!configObj) {
        try {
          const bracketMatch = raw.match(/\{[\s\S]*\}/);
          if (bracketMatch) {
            configObj = new Function(`'use strict'; return (${bracketMatch[0]})`)();
          }
        } catch (e) {}
      }
    }

    if (!configObj || !isFirebaseConfigured(configObj)) {
      alert('Vložený text neobsahuje platné "apiKey" a "projectId". Uisti sa, že si skopíroval celý blok s firebaseConfig.');
      return;
    }

    saveFirebaseConfig(configObj);
    alert('✅ Firebase konfigurácia bola úspešne uložená! Aplikácia sa teraz obnoví.');
    window.location.reload();
  });

  btnResetCloudConfig.addEventListener('click', () => {
    if (confirm('Chceš vymazať Firebase konfiguráciu a prepnúť aplikáciu späť do lokálneho režimu?')) {
      localStorage.removeItem('spolujazda_firebase_config');
      alert('Aplikácia bola prepnutá do lokálneho režimu.');
      window.location.reload();
    }
  });
}

// ================= AUTHENTICATION LOGIC =================
function usernameToEmail(username) {
  const clean = username.trim().toLowerCase();
  if (clean.includes('@')) return clean;
  // Map clean username to unique email format
  return `${clean.replace(/[^a-z0-9_]/g, '')}@spolujazda.app`;
}

function initAuthEvents() {
  authTabLogin.addEventListener('click', () => {
    state.authMode = 'login';
    authTabLogin.classList.add('active');
    authTabRegister.classList.remove('active');
    authConfirmGroup.style.display = 'none';
    btnAuthSubmit.textContent = 'Prihlásiť sa';
    setAuthAlert('');
  });

  authTabRegister.addEventListener('click', () => {
    state.authMode = 'register';
    authTabRegister.classList.add('active');
    authTabLogin.classList.remove('active');
    authConfirmGroup.style.display = 'block';
    btnAuthSubmit.textContent = 'Vytvoriť nový účet';
    setAuthAlert('');
  });

  btnAuthSubmit.addEventListener('click', handleAuthSubmit);

  [authUsernameInput, authPasswordInput, authPasswordConfirmInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleAuthSubmit();
      });
    }
  });

  btnLogout.addEventListener('click', handleLogout);
}

function setAuthAlert(msg, type = 'error') {
  if (!msg) {
    authAlert.style.display = 'none';
    authAlert.textContent = '';
    authAlert.className = 'auth-alert';
    return;
  }
  authAlert.textContent = msg;
  authAlert.className = `auth-alert ${type}`;
  authAlert.style.display = 'block';
}

async function handleAuthSubmit() {
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;

  if (!username) {
    setAuthAlert('Zadaj používateľské meno.');
    return;
  }
  if (username.length < 3) {
    setAuthAlert('Meno musí mať aspoň 3 znaky.');
    return;
  }
  if (!password || password.length < 3) {
    setAuthAlert('Heslo musí mať aspoň 3 znaky.');
    return;
  }

  // ---------------- CLOUD MODE (FIREBASE AUTH) ----------------
  if (state.isCloudMode) {
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const email = usernameToEmail(username);
    // Firebase requires min 6 characters for passwords.
    // If password is 'admin', map it to 'admin123456'; if under 6 chars, pad securely.
    const firebasePassword = (username.toLowerCase() === 'admin' && password === 'admin') 
      ? 'admin123456' 
      : (password.length < 6 ? password + '000000'.slice(0, 6 - password.length) : password);

    if (state.authMode === 'register') {
      const confirmPass = authPasswordConfirmInput.value;
      if (password !== confirmPass) {
        setAuthAlert('Heslá sa nezhodujú!');
        return;
      }
      try {
        setAuthAlert('Vytváram cloudový účet...', 'success');
        const userCred = await createUserWithEmailAndPassword(state.firebaseAuth, email, firebasePassword);
        await updateProfile(userCred.user, { displayName: username });
        showToast('✅ Cloudový účet vytvorený!');
      } catch (err) {
        console.error('Firebase Register Error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setAuthAlert('Používateľ s týmto menom už existuje. Zvoľ iné meno alebo sa prihlás.');
        } else if (err.code === 'auth/weak-password') {
          setAuthAlert('Heslo je príliš slabé (zadaj aspoň 6 znakov).');
        } else {
          setAuthAlert('Chyba pri registrácii: ' + (err.message || err.code));
        }
      }
    } else {
      // Login mode
      try {
        setAuthAlert('Prihlasujem do cloudu...', 'success');
        await signInWithEmailAndPassword(state.firebaseAuth, email, firebasePassword);
        showToast('✅ Úspešne prihlásený do Cloudu!');
      } catch (err) {
        console.warn('Firebase Login Error:', err.code, err.message);

        // Auto-create test account 'admin' if it doesn't exist in Firebase Auth yet!
        if (username.toLowerCase() === 'admin' && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials')) {
          try {
            setAuthAlert('Vytváram cloudový testovací účet admin...', 'success');
            const newCred = await createUserWithEmailAndPassword(state.firebaseAuth, email, firebasePassword);
            await updateProfile(newCred.user, { displayName: 'admin' });
            showToast('✅ Testovací účet admin bol vytvorený a prihlásený!');
            return;
          } catch (createErr) {
            console.error('Auto create admin failed:', createErr);
          }
        }

        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          setAuthAlert('Nesprávne používateľské meno alebo heslo.');
        } else {
          setAuthAlert('Chyba prihlásenia: ' + (err.message || err.code));
        }
      }
    }
    return;
  }

  // ---------------- LOCAL MODE (FALLBACK) ----------------
  const users = getLocalUsers();
  const userKey = username.toLowerCase();
  const passHash = await hashPassword(password);

  if (state.authMode === 'register') {
    const confirmPassword = authPasswordConfirmInput.value;
    if (password !== confirmPassword) {
      setAuthAlert('Heslá sa nezhodujú!');
      return;
    }
    if (users[userKey]) {
      setAuthAlert('Používateľ s týmto menom už existuje. Zvoľ iné meno alebo sa prihlás.');
      return;
    }

    users[userKey] = {
      username: username,
      passwordHash: passHash,
      createdAt: new Date().toISOString()
    };
    saveLocalUsers(users);

    setAuthAlert('Účet vytvorený! Prihlasujem...', 'success');
    setTimeout(() => {
      loginLocalUser(users[userKey]);
    }, 400);
  } else {
    const user = users[userKey];
    if (!user || user.passwordHash !== passHash) {
      setAuthAlert('Nesprávne používateľské meno alebo heslo.');
      return;
    }
    loginLocalUser(user);
  }
}

// ================= CLOUD DATA SYNC (FIRESTORE) =================
async function handleCloudUserLoggedIn(user) {
  state.firebaseUser = user;
  state.currentUser = user.displayName || user.email.split('@')[0];

  // Update UI to logged-in state
  authScreen.style.display = 'none';
  appMain.style.display = 'block';
  appNav.style.display = 'flex';
  headerUserSection.style.display = 'flex';
  currentUserNameEl.textContent = `👤 ${state.currentUser}`;

  authUsernameInput.value = '';
  authPasswordInput.value = '';
  authPasswordConfirmInput.value = '';
  setAuthAlert('');

  // Setup Real-time Firestore Listeners for Trips and Refuels
  setupFirestoreListeners(user.uid);
}

function handleCloudUserLoggedOut() {
  state.firebaseUser = null;
  state.currentUser = null;
  state.trips = [];
  state.refuels = [];

  // Unsubscribe listeners
  if (state.firestoreTripsUnsub) state.firestoreTripsUnsub();
  if (state.firestoreRefuelsUnsub) state.firestoreRefuelsUnsub();

  appMain.style.display = 'none';
  appNav.style.display = 'none';
  headerUserSection.style.display = 'none';
  authScreen.style.display = 'block';
  authTabLogin.click();
}

async function setupFirestoreListeners(uid) {
  const { collection, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  // Trips real-time sync
  const tripsRef = collection(state.firebaseDb, 'users', uid, 'trips');
  const tripsQuery = query(tripsRef, orderBy('id', 'desc'));

  state.firestoreTripsUnsub = onSnapshot(tripsQuery, (snapshot) => {
    state.trips = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    renderHistory();
    renderStats();
  }, (err) => {
    console.error('Firestore Trips error:', err);
  });

  // Refuels real-time sync
  const refuelsRef = collection(state.firebaseDb, 'users', uid, 'refuels');
  const refuelsQuery = query(refuelsRef, orderBy('id', 'desc'));

  state.firestoreRefuelsUnsub = onSnapshot(refuelsQuery, (snapshot) => {
    state.refuels = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    renderFuelTab();
    renderHistory();
    renderStats();
  }, (err) => {
    console.error('Firestore Refuels error:', err);
  });
}

async function handleLogout() {
  if (!confirm('Naozaj sa chceš odhlásiť?')) return;

  if (state.isCloudMode && state.firebaseAuth) {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await signOut(state.firebaseAuth);
    showToast('Bol si odhlásený z Cloudu.');
    return;
  }

  // Local logout
  state.currentUser = null;
  localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
  appMain.style.display = 'none';
  appNav.style.display = 'none';
  headerUserSection.style.display = 'none';
  authScreen.style.display = 'block';
  authTabLogin.click();
  showToast('Bol si úspešne odhlásený.');
}

// ================= LOCAL MODE LOGIC =================
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getLocalUsers() {
  let users = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    users = raw ? JSON.parse(raw) : {};
  } catch (e) {
    users = {};
  }

  if (!users['admin']) {
    users['admin'] = {
      username: 'admin',
      passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
      createdAt: new Date().toISOString()
    };
    saveLocalUsers(users);
  }
  return users;
}

function saveLocalUsers(users) {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}

function loginLocalUser(user) {
  state.currentUser = user.username.toLowerCase();
  localStorage.setItem(STORAGE_KEY_ACTIVE_USER, state.currentUser);

  authScreen.style.display = 'none';
  appMain.style.display = 'block';
  appNav.style.display = 'flex';
  headerUserSection.style.display = 'flex';
  currentUserNameEl.textContent = `👤 ${user.username}`;

  authUsernameInput.value = '';
  authPasswordInput.value = '';
  authPasswordConfirmInput.value = '';
  setAuthAlert('');

  showToast(`Vitaj, ${user.username}!`);

  state.trips = getLocalStoredTrips();
  state.refuels = getLocalStoredRefuels();

  recalculateTrip();
  renderFuelTab();
  renderHistory();
  renderStats();
}

function checkLocalActiveSession() {
  getLocalUsers();
  const activeUserKey = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
  if (!activeUserKey) {
    authScreen.style.display = 'block';
    appMain.style.display = 'none';
    appNav.style.display = 'none';
    headerUserSection.style.display = 'none';
    if (authUsernameInput && !authUsernameInput.value) {
      authUsernameInput.value = 'admin';
      authPasswordInput.value = 'admin';
    }
    return;
  }

  const users = getLocalUsers();
  const user = users[activeUserKey];
  if (user) {
    loginLocalUser(user);
  } else {
    authScreen.style.display = 'block';
    appMain.style.display = 'none';
    appNav.style.display = 'none';
    headerUserSection.style.display = 'none';
    if (authUsernameInput && !authUsernameInput.value) {
      authUsernameInput.value = 'admin';
      authPasswordInput.value = 'admin';
    }
  }
}

function getLocalTripsKey() {
  return state.currentUser ? `spolujazda_trips_${state.currentUser}` : 'spolujazda_trips';
}

function getLocalRefuelsKey() {
  return state.currentUser ? `spolujazda_refuels_${state.currentUser}` : 'spolujazda_refuels';
}

function getLocalStoredTrips() {
  try {
    const raw = localStorage.getItem(getLocalTripsKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalStoredTrips(trips) {
  localStorage.setItem(getLocalTripsKey(), JSON.stringify(trips));
}

function getLocalStoredRefuels() {
  try {
    const raw = localStorage.getItem(getLocalRefuelsKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalStoredRefuels(refuels) {
  localStorage.setItem(getLocalRefuelsKey(), JSON.stringify(refuels));
}

// ================= APP LISTENERS =================
function initEventListeners() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  historyFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      historyFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.historyFilter = btn.dataset.historyFilter;
      renderHistory();
    });
  });

  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const routeKey = btn.dataset.route;
      state.routeType = routeKey;
      state.distanceKm = 150;
      inputDistance.value = 150;
      recalculateTrip();
    });
  });

  function renderIndividualPriceRows() {
    const container = document.getElementById('individual-price-rows');
    if (!container) return;
    // Ensure passengerPrices array matches current passenger count
    while (state.passengerPrices.length < state.passengers) {
      state.passengerPrices.push(state.pricePerPerson || 7.50);
    }
    state.passengerPrices = state.passengerPrices.slice(0, state.passengers);

    container.innerHTML = state.passengerPrices.map((price, idx) => `
      <div class="passenger-price-row">
        <label class="passenger-price-label">🧑 Cestujúci ${idx + 1}</label>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div class="input-wrapper" style="max-width: 130px;">
            <input type="number" class="input-field individual-price-input" data-idx="${idx}" value="${price.toFixed(2)}" min="0" step="0.5">
            <span class="input-unit">€</span>
          </div>
          <div class="price-presets">
            <button type="button" class="price-preset-btn indiv-preset-btn" data-idx="${idx}" data-price="7.00">7,00</button>
            <button type="button" class="price-preset-btn indiv-preset-btn" data-idx="${idx}" data-price="7.50">7,50</button>
            <button type="button" class="price-preset-btn indiv-preset-btn" data-idx="${idx}" data-price="8.00">8,00</button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach input listeners
    container.querySelectorAll('.individual-price-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const val = parseFloat(e.target.value) || 0;
        state.passengerPrices[idx] = Math.max(0, val);
        updatePassengerFare();
      });
    });

    // Attach preset button listeners
    container.querySelectorAll('.indiv-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const price = parseFloat(e.target.dataset.price);
        state.passengerPrices[idx] = price;
        const inp = container.querySelector(`.individual-price-input[data-idx="${idx}"]`);
        if (inp) inp.value = price.toFixed(2);
        updatePassengerFare();
      });
    });

    updatePassengerFare();
  }

  // Preset buttons for uniform price field
  document.querySelectorAll('.price-preset-btn[data-price]').forEach(btn => {
    if (btn.classList.contains('indiv-preset-btn')) return; // handled dynamically
    btn.addEventListener('click', () => {
      const price = parseFloat(btn.dataset.price);
      state.pricePerPerson = price;
      if (inputPricePerPerson) inputPricePerPerson.value = price.toFixed(2);
      updatePassengerFare();
    });
  });


  function updatePassengerFare() {
    if (state.noPassengers) {
      state.totalPassengerFare = 0.00;
      inputTotalFare.value = '0.00';
      recalculateTrip();
      return;
    }

    let fare = 0;
    if (state.individualPrices) {
      fare = state.passengerPrices.reduce((sum, p) => sum + (p || 0), 0);
      const totalDisplay = document.getElementById('individual-total-display');
      if (totalDisplay) totalDisplay.textContent = `${fare.toFixed(2)} €`;
    } else {
      fare = (state.passengers || 0) * (state.pricePerPerson || 0);
    }

    if (state.hasDiscountPassengers) {
      fare += (state.discountPassengers || 0) * (state.discountPrice || 0);
    }
    state.totalPassengerFare = parseFloat(fare.toFixed(2));
    inputTotalFare.value = state.totalPassengerFare.toFixed(2);
    recalculateTrip();
  }

  if (toggleNoPassengers) {
    toggleNoPassengers.addEventListener('change', (e) => {
      state.noPassengers = e.target.checked;

      if (state.noPassengers) {
        // Disable stepper and discount controls
        if (stepperContainer) {
          stepperContainer.style.opacity = '0.4';
          stepperContainer.style.pointerEvents = 'none';
        }
        const indivWrapper = document.getElementById('toggle-individual-prices-wrapper');
        if (indivWrapper) { indivWrapper.style.opacity = '0.4'; indivWrapper.style.pointerEvents = 'none'; }
        if (toggleDiscount) {
          toggleDiscount.disabled = true;
          toggleDiscount.parentElement.style.opacity = '0.4';
        }
        if (discountContainer) {
          discountContainer.style.display = 'none';
        }
      } else {
        if (stepperContainer) {
          stepperContainer.style.opacity = '1';
          stepperContainer.style.pointerEvents = 'auto';
        }
        const indivWrapper = document.getElementById('toggle-individual-prices-wrapper');
        if (indivWrapper) { indivWrapper.style.opacity = '1'; indivWrapper.style.pointerEvents = 'auto'; }
        if (toggleDiscount) {
          toggleDiscount.disabled = false;
          toggleDiscount.parentElement.style.opacity = '1';
        }
        if (discountContainer) {
          discountContainer.style.display = state.hasDiscountPassengers ? 'block' : 'none';
        }
      }

      updatePassengerFare();
    });
  }

  // Individual prices toggle
  const toggleIndividualPrices = document.getElementById('toggle-individual-prices');
  const uniformPriceContainer = document.getElementById('uniform-price-container');
  const individualPricesContainer = document.getElementById('individual-prices-container');

  if (toggleIndividualPrices) {
    toggleIndividualPrices.addEventListener('change', (e) => {
      if (state.noPassengers) { e.target.checked = false; return; }
      state.individualPrices = e.target.checked;
      if (uniformPriceContainer) uniformPriceContainer.style.display = state.individualPrices ? 'none' : '';
      if (individualPricesContainer) individualPricesContainer.style.display = state.individualPrices ? 'block' : 'none';
      if (state.individualPrices) {
        renderIndividualPriceRows();
      } else {
        updatePassengerFare();
      }
    });
  }

  btnMinus.addEventListener('click', () => {
    if (state.noPassengers) return;
    if (state.passengers > 1) {
      state.passengers--;
      stepperVal.textContent = state.passengers;
      if (state.individualPrices) {
        renderIndividualPriceRows();
      } else {
        updatePassengerFare();
      }
    }
  });

  btnPlus.addEventListener('click', () => {
    if (state.noPassengers) return;
    if (state.passengers < 8) {
      state.passengers++;
      stepperVal.textContent = state.passengers;
      if (state.individualPrices) {
        renderIndividualPriceRows();
      } else {
        updatePassengerFare();
      }
    }
  });

  inputPricePerPerson.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) || 0;
    state.pricePerPerson = val;
    updatePassengerFare();
  });

  if (toggleDiscount) {
    toggleDiscount.addEventListener('change', (e) => {
      if (state.noPassengers) return;
      state.hasDiscountPassengers = e.target.checked;
      if (discountContainer) {
        discountContainer.style.display = state.hasDiscountPassengers ? 'block' : 'none';
      }
      updatePassengerFare();
    });
  }

  if (inputDiscountCount) {
    inputDiscountCount.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.discountPassengers = isNaN(val) ? 0 : Math.max(0, val);
      updatePassengerFare();
    });
  }

  if (inputDiscountPrice) {
    inputDiscountPrice.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.discountPrice = isNaN(val) ? 0 : Math.max(0, val);
      updatePassengerFare();
    });
  }

  if (inputDiscountNote) {
    inputDiscountNote.addEventListener('input', (e) => {
      state.discountNote = e.target.value.trim();
    });
  }

  btnSaveTrip.addEventListener('click', saveTrip);
  btnResetTrip.addEventListener('click', resetTripForm);

  // Auto-calculate refuel
  inputRefuelTotalPrice.addEventListener('input', () => {
    const total = parseFloat(inputRefuelTotalPrice.value) || 0;
    const liters = parseFloat(inputRefuelLiters.value) || 0;
    const pricePerL = parseFloat(inputRefuelPricePerL.value) || 0;

    if (total > 0 && liters > 0) {
      inputRefuelPricePerL.value = (total / liters).toFixed(3);
    } else if (total > 0 && pricePerL > 0) {
      inputRefuelLiters.value = (total / pricePerL).toFixed(2);
    }
  });

  inputRefuelLiters.addEventListener('input', () => {
    const total = parseFloat(inputRefuelTotalPrice.value) || 0;
    const liters = parseFloat(inputRefuelLiters.value) || 0;
    const pricePerL = parseFloat(inputRefuelPricePerL.value) || 0;

    if (total > 0 && liters > 0) {
      inputRefuelPricePerL.value = (total / liters).toFixed(3);
    } else if (liters > 0 && pricePerL > 0) {
      inputRefuelTotalPrice.value = (liters * pricePerL).toFixed(2);
    }
  });

  inputRefuelPricePerL.addEventListener('input', () => {
    const liters = parseFloat(inputRefuelLiters.value) || 0;
    const pricePerL = parseFloat(inputRefuelPricePerL.value) || 0;

    if (liters > 0 && pricePerL > 0) {
      inputRefuelTotalPrice.value = (liters * pricePerL).toFixed(2);
    }
  });

  btnSaveRefuel.addEventListener('click', saveRefuel);

  const btnExport = document.getElementById('btn-export-data');
  if (btnExport) btnExport.addEventListener('click', exportData);

  const fileImport = document.getElementById('file-import-data');
  if (fileImport) fileImport.addEventListener('change', importData);
}

function recalculateTrip() {
  const total = state.totalPassengerFare || 0;
  if (profitAmount) profitAmount.textContent = `+${total.toFixed(2)} €`;

  if (displayPricePerson) {
    if (state.noPassengers) {
      displayPricePerson.textContent = `0.00 €`;
    } else if (state.hasDiscountPassengers && state.discountPassengers > 0) {
      displayPricePerson.textContent = `${state.pricePerPerson.toFixed(2)} € + zľav.`;
    } else {
      displayPricePerson.textContent = `${state.pricePerPerson.toFixed(2)} €`;
    }
  }

  if (displayPassengers) {
    if (state.noPassengers) {
      displayPassengers.textContent = `0 ľudí (sám)`;
    } else {
      const totalCount = state.passengers + (state.hasDiscountPassengers ? state.discountPassengers : 0);
      const word = totalCount === 1 ? 'človek' : (totalCount < 5 ? 'ľudia' : 'ľudí');
      displayPassengers.textContent = `${totalCount} ${word}`;
    }
  }
  if (displayRouteKm) displayRouteKm.textContent = `${state.distanceKm} km`;
}

function switchTab(tabId) {
  state.currentTab = tabId;
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  tabViews.forEach(v => v.classList.toggle('active', v.id === `tab-${tabId}`));

  if (tabId === 'fuel') renderFuelTab();
  else if (tabId === 'history') renderHistory();
  else if (tabId === 'stats') renderStats();
}

// ================= SAVE & DELETE ACTIONS =================
async function saveTrip() {
  const dateVal = inputTripDate.value || new Date().toISOString().split('T')[0];
  const income = state.totalPassengerFare || 0;
  const routeLabel = ROUTES[state.routeType] ? ROUTES[state.routeType].label : 'Jazda';
  const totalCount = state.noPassengers ? 0 : (state.passengers + (state.hasDiscountPassengers ? state.discountPassengers : 0));

  const trip = {
    id: Date.now(),
    type: 'trip',
    date: dateVal,
    routeType: state.routeType,
    routeLabel: routeLabel,
    distanceKm: state.distanceKm,
    noPassengers: state.noPassengers,
    passengers: state.noPassengers ? 0 : state.passengers,
    pricePerPerson: state.noPassengers ? 0 : state.pricePerPerson,
    hasDiscountPassengers: state.noPassengers ? false : state.hasDiscountPassengers,
    discountPassengers: (state.noPassengers || !state.hasDiscountPassengers) ? 0 : state.discountPassengers,
    discountPrice: (state.noPassengers || !state.hasDiscountPassengers) ? 0 : state.discountPrice,
    discountNote: (state.noPassengers || !state.hasDiscountPassengers) ? '' : state.discountNote,
    individualPrices: state.noPassengers ? false : state.individualPrices,
    passengerPrices: (state.noPassengers || !state.individualPrices) ? [] : [...state.passengerPrices],
    totalPassengers: totalCount,
    totalFare: income
  };

  if (state.isCloudMode && state.firebaseUser) {
    try {
      const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips'), trip);
      showToast('☁️ Jazda bola synchronizovaná do Cloudu!');
    } catch (e) {
      console.error('Chyba pri ukladaní do Cloudu:', e);
      showToast('❌ Chyba pri ukladaní do Cloudu.');
    }
  } else {
    // Local mode
    state.trips.unshift(trip);
    saveLocalStoredTrips(state.trips);
    showToast('✅ Jazda bola uložená lokálne!');
    renderHistory();
    renderStats();
  }
}

function resetTripForm() {
  state.routeType = 'pn-brno';
  segmentBtns.forEach(b => b.classList.toggle('active', b.dataset.route === 'pn-brno'));
  state.distanceKm = 150;
  inputDistance.value = 150;
  state.passengers = 3;
  stepperVal.textContent = 3;
  state.pricePerPerson = 7.50;
  inputPricePerPerson.value = '7.50';

  state.noPassengers = false;
  if (toggleNoPassengers) toggleNoPassengers.checked = false;
  if (stepperContainer) {
    stepperContainer.style.opacity = '1';
    stepperContainer.style.pointerEvents = 'auto';
  }

  // Reset individual prices
  state.individualPrices = false;
  state.passengerPrices = [7.50, 7.50, 7.50];
  const toggleIndiv = document.getElementById('toggle-individual-prices');
  if (toggleIndiv) toggleIndiv.checked = false;
  const uniformCont = document.getElementById('uniform-price-container');
  if (uniformCont) uniformCont.style.display = '';
  const indivCont = document.getElementById('individual-prices-container');
  if (indivCont) indivCont.style.display = 'none';
  const indivWrapper = document.getElementById('toggle-individual-prices-wrapper');
  if (indivWrapper) { indivWrapper.style.opacity = '1'; indivWrapper.style.pointerEvents = 'auto'; }

  state.hasDiscountPassengers = false;
  if (toggleDiscount) {
    toggleDiscount.checked = false;
    toggleDiscount.disabled = false;
    toggleDiscount.parentElement.style.opacity = '1';
  }
  if (discountContainer) discountContainer.style.display = 'none';
  state.discountPassengers = 1;
  if (inputDiscountCount) inputDiscountCount.value = '1';
  state.discountPrice = 5.00;
  if (inputDiscountPrice) inputDiscountPrice.value = '5.00';
  state.discountNote = '';
  if (inputDiscountNote) inputDiscountNote.value = '';

  state.totalPassengerFare = 22.50;
  inputTotalFare.value = '22.50';
  
  const today = new Date().toISOString().split('T')[0];
  inputTripDate.value = today;

  recalculateTrip();
  showToast('🔄 Formulár bol obnovený.');
}

async function saveRefuel() {
  const dateVal = inputRefuelDate.value || new Date().toISOString().split('T')[0];
  const totalPrice = parseFloat(inputRefuelTotalPrice.value) || 0;
  const liters = parseFloat(inputRefuelLiters.value) || 0;
  const pricePerL = parseFloat(inputRefuelPricePerL.value) || 0;
  const station = inputRefuelStation.value.trim() || 'Čerpacia stanica';
  const odometer = parseFloat(inputRefuelOdometer.value) || null;

  if (totalPrice <= 0) {
    showToast('⚠️ Zadaj platnú sumu za tankovanie.');
    return;
  }

  const refuel = {
    id: Date.now(),
    type: 'fuel',
    date: dateVal,
    totalPrice: totalPrice,
    liters: liters,
    pricePerL: pricePerL || (liters > 0 ? parseFloat((totalPrice / liters).toFixed(3)) : 0),
    station: station,
    odometer: odometer
  };

  if (state.isCloudMode && state.firebaseUser) {
    try {
      const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'refuels'), refuel);
      showToast('☁️ Tankovanie bolo synchronizované do Cloudu!');
    } catch (e) {
      console.error('Chyba pri ukladaní do Cloudu:', e);
      showToast('❌ Chyba pri ukladaní do Cloudu.');
    }
  } else {
    // Local mode
    state.refuels.unshift(refuel);
    saveLocalStoredRefuels(state.refuels);
    showToast('⛽ Tankovanie bolo uložené lokálne!');
    renderFuelTab();
    renderHistory();
    renderStats();
  }

  inputRefuelTotalPrice.value = '';
  inputRefuelLiters.value = '';
  inputRefuelPricePerL.value = '';
  inputRefuelStation.value = '';
  inputRefuelOdometer.value = '';
}

async function deleteTrip(tripId, docId) {
  if (!confirm('Naozaj chceš zmazať túto jazdu?')) return;

  if (state.isCloudMode && state.firebaseUser && docId) {
    try {
      const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await deleteDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips', docId));
      showToast('🗑️ Jazda zmazaná z Cloudu.');
    } catch (e) {
      console.error('Chyba pri mazaní z Cloudu:', e);
    }
  } else {
    state.trips = state.trips.filter(t => t.id !== tripId);
    saveLocalStoredTrips(state.trips);
    renderHistory();
    renderStats();
    showToast('🗑️ Jazda zmazaná.');
  }
}

async function deleteRefuel(refuelId, docId) {
  if (!confirm('Naozaj chceš zmazať toto tankovanie?')) return;

  if (state.isCloudMode && state.firebaseUser && docId) {
    try {
      const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await deleteDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'refuels', docId));
      showToast('🗑️ Tankovanie zmazané z Cloudu.');
    } catch (e) {
      console.error('Chyba pri mazaní z Cloudu:', e);
    }
  } else {
    state.refuels = state.refuels.filter(r => r.id !== refuelId);
    saveLocalStoredRefuels(state.refuels);
    renderFuelTab();
    renderHistory();
    renderStats();
    showToast('🗑️ Tankovanie zmazané.');
  }
}

// ================= EDIT ACTIONS =================
function openEditTrip(tripId, docId) {
  const trip = state.trips.find(t => (docId && t.docId === docId) || t.id === tripId);
  if (!trip) {
    showToast('⚠️ Záznam o jazde sa nenašiel.');
    return;
  }

  const modal = document.getElementById('edit-trip-modal');
  const inputId = document.getElementById('edit-trip-id');
  const inputDocId = document.getElementById('edit-trip-docid');
  const inputDate = document.getElementById('edit-trip-date');
  const routeButtons = document.querySelectorAll('#edit-trip-route-group .segment-btn');
  const toggleNoPass = document.getElementById('edit-toggle-no-passengers');
  const passSection = document.getElementById('edit-passengers-section');
  const inputPass = document.getElementById('edit-trip-passengers');
  const inputPrice = document.getElementById('edit-trip-price-person');
  const toggleDisc = document.getElementById('edit-toggle-discount-passengers');
  const discContainer = document.getElementById('edit-discount-container');
  const inputDiscCount = document.getElementById('edit-discount-count');
  const inputDiscPrice = document.getElementById('edit-discount-price');
  const inputDiscNote = document.getElementById('edit-discount-note');
  const inputTotal = document.getElementById('edit-trip-total-fare');
  const toggleIndiv = document.getElementById('edit-toggle-individual-prices');
  const uniformSection = document.getElementById('edit-uniform-price-section');
  const indivSection = document.getElementById('edit-individual-prices-section');
  const editIndivCountInput = document.getElementById('edit-individual-passenger-count');
  const editIndivRows = document.getElementById('edit-individual-price-rows');
  const editIndivTotalDisplay = document.getElementById('edit-individual-total-display');

  if (inputId) inputId.value = trip.id;
  if (inputDocId) inputDocId.value = trip.docId || '';
  if (inputDate) inputDate.value = trip.date || '';

  const routeType = trip.routeType || 'pn-brno';
  routeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.editRoute === routeType);
  });

  const isNoPass = !!trip.noPassengers;
  if (toggleNoPass) toggleNoPass.checked = isNoPass;
  if (passSection) passSection.style.display = isNoPass ? 'none' : 'block';

  // Individual prices
  const hasIndiv = !!trip.individualPrices && Array.isArray(trip.passengerPrices) && trip.passengerPrices.length > 0;
  if (toggleIndiv) toggleIndiv.checked = hasIndiv;
  if (uniformSection) uniformSection.style.display = hasIndiv ? 'none' : '';
  if (indivSection) indivSection.style.display = hasIndiv ? 'block' : 'none';

  if (hasIndiv) {
    const prices = trip.passengerPrices;
    if (editIndivCountInput) editIndivCountInput.value = prices.length;
    if (editIndivRows) {
      editIndivRows.innerHTML = prices.map((p, idx) => `
        <div class="passenger-price-row">
          <label class="passenger-price-label">🧑 Cestujúci ${idx + 1}</label>
          <div class="input-wrapper" style="max-width: 130px;">
            <input type="number" class="input-field edit-individual-price-input" data-idx="${idx}" value="${(p || 0).toFixed(2)}" min="0" step="0.5">
            <span class="input-unit">€</span>
          </div>
        </div>
      `).join('');
    }
    const total = prices.reduce((s, p) => s + (p || 0), 0);
    if (editIndivTotalDisplay) editIndivTotalDisplay.textContent = `${total.toFixed(2)} €`;
    if (inputTotal) inputTotal.value = total.toFixed(2);
  } else {
    if (inputPass) inputPass.value = trip.passengers !== undefined ? trip.passengers : 3;
    if (inputPrice) inputPrice.value = trip.pricePerPerson !== undefined ? trip.pricePerPerson.toFixed(2) : '7.50';
  }

  const hasDisc = !!trip.hasDiscountPassengers;
  if (toggleDisc) toggleDisc.checked = hasDisc;
  if (discContainer) discContainer.style.display = hasDisc ? 'block' : 'none';
  if (inputDiscCount) inputDiscCount.value = trip.discountPassengers || 1;
  if (inputDiscPrice) inputDiscPrice.value = trip.discountPrice !== undefined ? trip.discountPrice.toFixed(2) : '5.00';
  if (inputDiscNote) inputDiscNote.value = trip.discountNote || '';

  function calcEditFare() {
    if (toggleNoPass && toggleNoPass.checked) {
      if (inputTotal) inputTotal.value = '0.00';
      return;
    }
    let sum = 0;
    if (toggleIndiv && toggleIndiv.checked) {
      const inputs = document.querySelectorAll('#edit-individual-price-rows .edit-individual-price-input');
      inputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
      if (editIndivTotalDisplay) editIndivTotalDisplay.textContent = `${sum.toFixed(2)} €`;
    } else {
      const pCount = parseInt(inputPass ? inputPass.value : 0) || 0;
      const pPrice = parseFloat(inputPrice ? inputPrice.value : 0) || 0;
      sum = pCount * pPrice;
    }
    if (toggleDisc && toggleDisc.checked) {
      const dCount = parseInt(inputDiscCount ? inputDiscCount.value : 0) || 0;
      const dPrice = parseFloat(inputDiscPrice ? inputDiscPrice.value : 0) || 0;
      sum += dCount * dPrice;
    }
    if (inputTotal) inputTotal.value = sum.toFixed(2);
  }

  calcEditFare();

  if (modal) modal.classList.add('open');
}

function openEditRefuel(refuelId, docId) {
  const refuel = state.refuels.find(r => (docId && r.docId === docId) || r.id === refuelId);
  if (!refuel) {
    showToast('⚠️ Záznam o tankovaní sa nenašiel.');
    return;
  }

  const modal = document.getElementById('edit-refuel-modal');
  const inputId = document.getElementById('edit-refuel-id');
  const inputDocId = document.getElementById('edit-refuel-docid');
  const inputDate = document.getElementById('edit-refuel-date');
  const inputTotalPrice = document.getElementById('edit-refuel-total-price');
  const inputLiters = document.getElementById('edit-refuel-liters');
  const inputPricePerL = document.getElementById('edit-refuel-price-per-l');
  const inputOdometer = document.getElementById('edit-refuel-odometer');
  const inputStation = document.getElementById('edit-refuel-station');

  if (inputId) inputId.value = refuel.id;
  if (inputDocId) inputDocId.value = refuel.docId || '';
  if (inputDate) inputDate.value = refuel.date || '';
  if (inputTotalPrice) inputTotalPrice.value = refuel.totalPrice !== undefined ? refuel.totalPrice.toFixed(2) : '';
  if (inputLiters) inputLiters.value = refuel.liters !== undefined ? refuel.liters : '';
  if (inputPricePerL) inputPricePerL.value = refuel.pricePerL !== undefined ? refuel.pricePerL : '';
  if (inputOdometer) inputOdometer.value = refuel.odometer || '';
  if (inputStation) inputStation.value = refuel.station || '';

  if (modal) modal.classList.add('open');
}

async function saveEditedTrip() {
  const inputId = document.getElementById('edit-trip-id');
  const inputDocId = document.getElementById('edit-trip-docid');
  const tripId = parseInt(inputId.value);
  const docId = inputDocId.value;

  const activeRouteBtn = document.querySelector('#edit-trip-route-group .segment-btn.active');
  const routeType = activeRouteBtn ? activeRouteBtn.dataset.editRoute : 'pn-brno';
  const routeLabel = ROUTES[routeType] ? ROUTES[routeType].label : 'Jazda';
  const dateVal = document.getElementById('edit-trip-date').value;
  const isNoPass = document.getElementById('edit-toggle-no-passengers').checked;

  let passengers = 0;
  let pricePerPerson = 0;
  let hasDiscountPassengers = false;
  let discountPassengers = 0;
  let discountPrice = 0;
  let discountNote = '';
  let totalFare = 0;
  let totalCount = 0;
  let individualPrices = false;
  let passengerPrices = [];

  if (!isNoPass) {
    const isIndiv = document.getElementById('edit-toggle-individual-prices') &&
                    document.getElementById('edit-toggle-individual-prices').checked;
    individualPrices = !!isIndiv;

    if (isIndiv) {
      const inputs = document.querySelectorAll('#edit-individual-price-rows .edit-individual-price-input');
      inputs.forEach(inp => { passengerPrices.push(Math.max(0, parseFloat(inp.value) || 0)); });
      passengers = passengerPrices.length;
      totalFare = parseFloat(passengerPrices.reduce((s, p) => s + p, 0).toFixed(2));
    } else {
      passengers = Math.max(0, parseInt(document.getElementById('edit-trip-passengers').value) || 0);
      pricePerPerson = Math.max(0, parseFloat(document.getElementById('edit-trip-price-person').value) || 0);
      totalFare = parseFloat((passengers * pricePerPerson).toFixed(2));
    }

    hasDiscountPassengers = document.getElementById('edit-toggle-discount-passengers').checked;
    if (hasDiscountPassengers) {
      discountPassengers = Math.max(0, parseInt(document.getElementById('edit-discount-count').value) || 0);
      discountPrice = Math.max(0, parseFloat(document.getElementById('edit-discount-price').value) || 0);
      discountNote = document.getElementById('edit-discount-note').value.trim();
      totalFare = parseFloat((totalFare + discountPassengers * discountPrice).toFixed(2));
    }
    totalCount = passengers + discountPassengers;
  }

  const updatedTrip = {
    id: tripId,
    type: 'trip',
    date: dateVal,
    routeType: routeType,
    routeLabel: routeLabel,
    distanceKm: 150,
    noPassengers: isNoPass,
    passengers: passengers,
    pricePerPerson: pricePerPerson,
    individualPrices: individualPrices,
    passengerPrices: passengerPrices,
    hasDiscountPassengers: hasDiscountPassengers,
    discountPassengers: discountPassengers,
    discountPrice: discountPrice,
    discountNote: discountNote,
    totalPassengers: totalCount,
    totalFare: totalFare
  };

  if (state.isCloudMode && state.firebaseUser && docId) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await updateDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips', docId), updatedTrip);
      showToast('☁️ Jazda bola aktualizovaná v Cloude!');
    } catch (e) {
      console.error('Chyba pri aktualizácii v Cloude:', e);
      showToast('❌ Chyba pri ukladaní do Cloudu.');
    }
  } else {
    // Local mode update
    const idx = state.trips.findIndex(t => t.id === tripId);
    if (idx !== -1) {
      state.trips[idx] = { ...state.trips[idx], ...updatedTrip };
      saveLocalStoredTrips(state.trips);
      renderHistory();
      renderStats();
      showToast('✅ Jazda úspešne upravená!');
    }
  }

  const modal = document.getElementById('edit-trip-modal');
  if (modal) modal.classList.remove('open');
}

async function saveEditedRefuel() {
  const inputId = document.getElementById('edit-refuel-id');
  const inputDocId = document.getElementById('edit-refuel-docid');
  const refuelId = parseInt(inputId.value);
  const docId = inputDocId.value;

  const dateVal = document.getElementById('edit-refuel-date').value;
  const totalPrice = parseFloat(document.getElementById('edit-refuel-total-price').value) || 0;
  const liters = parseFloat(document.getElementById('edit-refuel-liters').value) || 0;
  const pricePerL = parseFloat(document.getElementById('edit-refuel-price-per-l').value) || 0;
  const odometer = parseFloat(document.getElementById('edit-refuel-odometer').value) || null;
  const station = document.getElementById('edit-refuel-station').value.trim() || 'Čerpacia stanica';

  if (totalPrice <= 0) {
    showToast('⚠️ Zadaj platnú celkovú sumu.');
    return;
  }

  const updatedRefuel = {
    id: refuelId,
    type: 'fuel',
    date: dateVal,
    totalPrice: totalPrice,
    liters: liters,
    pricePerL: pricePerL || (liters > 0 ? parseFloat((totalPrice / liters).toFixed(3)) : 0),
    station: station,
    odometer: odometer
  };

  if (state.isCloudMode && state.firebaseUser && docId) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await updateDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'refuels', docId), updatedRefuel);
      showToast('☁️ Tankovanie aktualizované v Cloude!');
    } catch (e) {
      console.error('Chyba pri aktualizácii v Cloudu:', e);
      showToast('❌ Chyba pri ukladaní do Cloudu.');
    }
  } else {
    // Local mode update
    const idx = state.refuels.findIndex(r => r.id === refuelId);
    if (idx !== -1) {
      state.refuels[idx] = { ...state.refuels[idx], ...updatedRefuel };
      saveLocalStoredRefuels(state.refuels);
      renderFuelTab();
      renderHistory();
      renderStats();
      showToast('✅ Tankovanie úspešne upravené!');
    }
  }

  const modal = document.getElementById('edit-refuel-modal');
  if (modal) modal.classList.remove('open');
}

function initEditModals() {
  const modalTrip = document.getElementById('edit-trip-modal');
  const btnCloseTrip = document.getElementById('btn-close-edit-trip');
  const btnSaveTripEdit = document.getElementById('btn-save-edit-trip');
  const routeBtns = document.querySelectorAll('#edit-trip-route-group .segment-btn');
  const toggleNoPass = document.getElementById('edit-toggle-no-passengers');
  const passSection = document.getElementById('edit-passengers-section');
  const inputPass = document.getElementById('edit-trip-passengers');
  const inputPrice = document.getElementById('edit-trip-price-person');
  const toggleDisc = document.getElementById('edit-toggle-discount-passengers');
  const discContainer = document.getElementById('edit-discount-container');
  const inputDiscCount = document.getElementById('edit-discount-count');
  const inputDiscPrice = document.getElementById('edit-discount-price');
  const inputTotal = document.getElementById('edit-trip-total-fare');

  const toggleIndivEdit = document.getElementById('edit-toggle-individual-prices');
  const uniformEditSection = document.getElementById('edit-uniform-price-section');
  const indivEditSection = document.getElementById('edit-individual-prices-section');
  const editIndivCount = document.getElementById('edit-individual-passenger-count');

  function recalcEditTrip() {
    if (toggleNoPass && toggleNoPass.checked) {
      if (inputTotal) inputTotal.value = '0.00';
      return;
    }
    let sum = 0;
    const editIndivTotalDisplay = document.getElementById('edit-individual-total-display');
    if (toggleIndivEdit && toggleIndivEdit.checked) {
      const inputs = document.querySelectorAll('#edit-individual-price-rows .edit-individual-price-input');
      inputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
      if (editIndivTotalDisplay) editIndivTotalDisplay.textContent = `${sum.toFixed(2)} €`;
    } else {
      const pCount = parseInt(inputPass ? inputPass.value : 0) || 0;
      const pPrice = parseFloat(inputPrice ? inputPrice.value : 0) || 0;
      sum = pCount * pPrice;
    }
    if (toggleDisc && toggleDisc.checked) {
      const dCount = parseInt(inputDiscCount ? inputDiscCount.value : 0) || 0;
      const dPrice = parseFloat(inputDiscPrice ? inputDiscPrice.value : 0) || 0;
      sum += dCount * dPrice;
    }
    if (inputTotal) inputTotal.value = sum.toFixed(2);
  }

  function renderEditIndividualRows(count) {
    const container = document.getElementById('edit-individual-price-rows');
    if (!container) return;
    const existing = container.querySelectorAll('.edit-individual-price-input');
    const prices = Array.from(existing).map(inp => parseFloat(inp.value) || 7.50);
    while (prices.length < count) prices.push(7.50);
    const newPrices = prices.slice(0, count);
    container.innerHTML = newPrices.map((p, idx) => `
      <div class="passenger-price-row">
        <label class="passenger-price-label">🧑 Cestujúci ${idx + 1}</label>
        <div class="input-wrapper" style="max-width: 130px;">
          <input type="number" class="input-field edit-individual-price-input" data-idx="${idx}" value="${p.toFixed(2)}" min="0" step="0.5">
          <span class="input-unit">€</span>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('.edit-individual-price-input').forEach(inp => {
      inp.addEventListener('input', recalcEditTrip);
    });
    recalcEditTrip();
  }

  if (toggleIndivEdit) {
    toggleIndivEdit.addEventListener('change', () => {
      const isOn = toggleIndivEdit.checked;
      if (uniformEditSection) uniformEditSection.style.display = isOn ? 'none' : '';
      if (indivEditSection) indivEditSection.style.display = isOn ? 'block' : 'none';
      if (isOn) {
        const count = parseInt(editIndivCount ? editIndivCount.value : 3) || 3;
        renderEditIndividualRows(count);
      } else {
        recalcEditTrip();
      }
    });
  }

  if (editIndivCount) {
    editIndivCount.addEventListener('change', () => {
      const count = Math.min(8, Math.max(1, parseInt(editIndivCount.value) || 1));
      editIndivCount.value = count;
      renderEditIndividualRows(count);
    });
  }

  if (btnCloseTrip && modalTrip) {
    btnCloseTrip.addEventListener('click', () => modalTrip.classList.remove('open'));
    modalTrip.addEventListener('click', (e) => {
      if (e.target === modalTrip) modalTrip.classList.remove('open');
    });
  }

  routeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      routeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  if (toggleNoPass) {
    toggleNoPass.addEventListener('change', () => {
      if (passSection) passSection.style.display = toggleNoPass.checked ? 'none' : 'block';
      recalcEditTrip();
    });
  }

  if (inputPass) inputPass.addEventListener('input', recalcEditTrip);
  if (inputPrice) inputPrice.addEventListener('input', recalcEditTrip);

  if (toggleDisc) {
    toggleDisc.addEventListener('change', () => {
      if (discContainer) discContainer.style.display = toggleDisc.checked ? 'block' : 'none';
      recalcEditTrip();
    });
  }

  if (inputDiscCount) inputDiscCount.addEventListener('input', recalcEditTrip);
  if (inputDiscPrice) inputDiscPrice.addEventListener('input', recalcEditTrip);

  if (btnSaveTripEdit) {
    btnSaveTripEdit.addEventListener('click', saveEditedTrip);
  }

  // Edit Refuel Modal listeners
  const modalRefuel = document.getElementById('edit-refuel-modal');
  const btnCloseRefuel = document.getElementById('btn-close-edit-refuel');
  const btnSaveRefuelEdit = document.getElementById('btn-save-edit-refuel');
  const inputRefuelTotal = document.getElementById('edit-refuel-total-price');
  const inputRefuelLiters = document.getElementById('edit-refuel-liters');
  const inputRefuelPriceL = document.getElementById('edit-refuel-price-per-l');

  if (btnCloseRefuel && modalRefuel) {
    btnCloseRefuel.addEventListener('click', () => modalRefuel.classList.remove('open'));
    modalRefuel.addEventListener('click', (e) => {
      if (e.target === modalRefuel) modalRefuel.classList.remove('open');
    });
  }

  if (inputRefuelTotal) {
    inputRefuelTotal.addEventListener('input', () => {
      const tot = parseFloat(inputRefuelTotal.value) || 0;
      const lit = parseFloat(inputRefuelLiters.value) || 0;
      const pr = parseFloat(inputRefuelPriceL.value) || 0;
      if (tot > 0 && lit > 0) {
        inputRefuelPriceL.value = (tot / lit).toFixed(3);
      } else if (tot > 0 && pr > 0) {
        inputRefuelLiters.value = (tot / pr).toFixed(2);
      }
    });
  }

  if (inputRefuelLiters) {
    inputRefuelLiters.addEventListener('input', () => {
      const tot = parseFloat(inputRefuelTotal.value) || 0;
      const lit = parseFloat(inputRefuelLiters.value) || 0;
      const pr = parseFloat(inputRefuelPriceL.value) || 0;
      if (tot > 0 && lit > 0) {
        inputRefuelPriceL.value = (tot / lit).toFixed(3);
      } else if (lit > 0 && pr > 0) {
        inputRefuelTotal.value = (lit * pr).toFixed(2);
      }
    });
  }

  if (btnSaveRefuelEdit) {
    btnSaveRefuelEdit.addEventListener('click', saveEditedRefuel);
  }
}

// ================= RENDERING =================
function formatDate(dStr) {
  if (!dStr) return '';
  const parts = dStr.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dStr;
}

function renderFuelTab() {
  const container = document.getElementById('fuel-tab-list');
  const elTotalSpent = document.getElementById('fuel-tab-total-spent');
  const elTotalLiters = document.getElementById('fuel-tab-total-liters');
  const elAvgPrice = document.getElementById('fuel-tab-avg-price');
  const elCount = document.getElementById('fuel-tab-count');

  const refuels = state.refuels || [];

  let totalSpent = 0;
  let totalLiters = 0;

  refuels.forEach(r => {
    totalSpent += r.totalPrice || 0;
    totalLiters += r.liters || 0;
  });

  const avgPrice = totalLiters > 0 ? (totalSpent / totalLiters) : 0;

  if (elTotalSpent) elTotalSpent.textContent = `${totalSpent.toFixed(2)} €`;
  if (elTotalLiters) elTotalLiters.textContent = `${totalLiters.toFixed(1)} l`;
  if (elAvgPrice) elAvgPrice.textContent = `${avgPrice.toFixed(3)} €/l`;
  if (elCount) elCount.textContent = refuels.length;

  if (!container) return;

  if (refuels.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <div class="empty-icon">⛽</div>
        <p>Zatiaľ nemáš zaznamenané žiadne tankovanie.</p>
        <p style="font-size: 12px; margin-top: 6px;">Vyplň formulár vyššie a klikni na "Uložiť tankovanie".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = refuels.map(r => `
    <div class="trip-item">
      <div class="trip-left">
        <div class="trip-route">
          <span class="history-badge fuel">⛽ Tankovanie</span> ${r.station}
        </div>
        <div class="trip-meta">
          <span>📅 ${formatDate(r.date)}</span>
          ${r.liters > 0 ? `<span>💧 ${r.liters.toFixed(1)} l</span>` : ''}
          ${r.pricePerL > 0 ? `<span>💶 ${r.pricePerL.toFixed(3)} €/l</span>` : ''}
          ${r.odometer ? `<span>📍 ${r.odometer} km</span>` : ''}
        </div>
      </div>
      <div class="trip-right">
        <div class="trip-profit negative">-${r.totalPrice.toFixed(2)} €</div>
        <div class="trip-actions">
          <button class="trip-edit-btn" onclick="window.appEditRefuel(${r.id}, '${r.docId || ''}')">✏️ Upraviť</button>
          <button class="trip-delete-btn" onclick="window.appDeleteRefuel(${r.id}, '${r.docId || ''}')">Odstrániť</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;

  const trips = (state.trips || []).map(t => ({ ...t, itemType: 'trip' }));
  const refuels = (state.refuels || []).map(r => ({ ...r, itemType: 'fuel' }));

  let combined = [];

  if (state.historyFilter === 'all') {
    combined = [...trips, ...refuels];
  } else if (state.historyFilter === 'trips') {
    combined = trips;
  } else if (state.historyFilter === 'fuel') {
    combined = refuels;
  }

  combined.sort((a, b) => {
    if (a.date !== b.date) {
      return (b.date || '').localeCompare(a.date || '');
    }
    return (b.id || 0) - (a.id || 0);
  });

  if (combined.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <div class="empty-icon">📋</div>
        <p>Žiadne záznamy v histórii.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = combined.map(item => {
    if (item.itemType === 'trip') {
      const fare = item.totalFare || item.netProfit || 0;

      const totalCount = item.totalPassengers || item.passengers || 0;
      let passengerInfo = `${totalCount} ľudí`;
      if (item.noPassengers || totalCount === 0) {
        passengerInfo = `0 ľudí (sám)`;
      } else if (item.individualPrices && item.passengerPrices && item.passengerPrices.length > 0) {
        const pricesStr = item.passengerPrices.map(p => `${(p || 0).toFixed(2)}€`).join(' + ');
        passengerInfo = `${item.passengerPrices.length} ľudí (${pricesStr})`;
      } else if (item.hasDiscountPassengers && item.discountPassengers > 0) {
        passengerInfo = `${totalCount} ľudí (${item.passengers}×${item.pricePerPerson ? item.pricePerPerson.toFixed(2) : '7.50'}€ + ${item.discountPassengers}×${item.discountPrice ? item.discountPrice.toFixed(2) : ''}€${item.discountNote ? ' • ' + item.discountNote : ''})`;
      } else if (item.pricePerPerson) {
        passengerInfo = `${item.passengers} ľudí (${item.pricePerPerson.toFixed(2)} €/os.)`;
      }

      return `
        <div class="trip-item">
          <div class="trip-left">
            <div class="trip-route">
              <span class="history-badge trip">🚗 Jazda</span> ${item.routeLabel}
            </div>
            <div class="trip-meta">
              <span>📅 ${formatDate(item.date)}</span>
              <span>🛣️ ${item.distanceKm} km</span>
              <span>👥 ${passengerInfo}</span>
            </div>
          </div>
          <div class="trip-right">
            <div class="trip-profit positive">+${fare.toFixed(2)} €</div>
            <div class="trip-actions">
              <button class="trip-edit-btn" onclick="window.appEditTrip(${item.id}, '${item.docId || ''}')">✏️ Upraviť</button>
              <button class="trip-delete-btn" onclick="window.appDeleteTrip(${item.id}, '${item.docId || ''}')">Odstrániť</button>
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="trip-item">
          <div class="trip-left">
            <div class="trip-route">
              <span class="history-badge fuel">⛽ Tankovanie</span> ${item.station}
            </div>
            <div class="trip-meta">
              <span>📅 ${formatDate(item.date)}</span>
              ${item.liters > 0 ? `<span>💧 ${item.liters.toFixed(1)} l</span>` : ''}
              ${item.pricePerL > 0 ? `<span>💶 ${item.pricePerL.toFixed(3)} €/l</span>` : ''}
              ${item.odometer ? `<span>📍 ${item.odometer} km</span>` : ''}
            </div>
          </div>
          <div class="trip-right">
            <div class="trip-profit negative">-${item.totalPrice.toFixed(2)} €</div>
            <div class="trip-actions">
              <button class="trip-edit-btn" onclick="window.appEditRefuel(${item.id}, '${item.docId || ''}')">✏️ Upraviť</button>
              <button class="trip-delete-btn" onclick="window.appDeleteRefuel(${item.id}, '${item.docId || ''}')">Odstrániť</button>
            </div>
          </div>
        </div>
      `;
    }
  }).join('');
}

function renderStats() {
  const trips = state.trips || [];
  const refuels = state.refuels || [];

  let totalIncome = 0;
  let totalKm = 0;
  let totalPassengers = 0;

  trips.forEach(t => {
    totalIncome += (t.totalFare || t.netProfit || 0);
    totalKm += t.distanceKm || 0;
    totalPassengers += (t.totalPassengers || t.passengers || 0);
  });

  let totalSpentFuel = 0;
  let totalLiters = 0;

  refuels.forEach(r => {
    totalSpentFuel += r.totalPrice || 0;
    totalLiters += r.liters || 0;
  });

  const walletNet = totalIncome - totalSpentFuel;
  const avgFuelPrice = totalLiters > 0 ? (totalSpentFuel / totalLiters) : 0;

  const elWalletNet = document.getElementById('stat-wallet-net');
  const elWalletBanner = document.getElementById('wallet-banner');
  const elTotalIncome = document.getElementById('stat-total-income');
  const elTotalRefueled = document.getElementById('stat-total-refueled');
  const elTripsProfit = document.getElementById('stat-trips-profit');

  const elTotalKm = document.getElementById('stat-total-km');
  const elTotalPassengers = document.getElementById('stat-total-passengers');
  const elTotalTrips = document.getElementById('stat-total-trips');
  const elTotalRefuelsCount = document.getElementById('stat-total-refuels-count');
  const elTotalLitersAll = document.getElementById('stat-total-liters-all');
  const elAvgFuelPrice = document.getElementById('stat-avg-fuel-price');

  if (elWalletNet) {
    elWalletNet.textContent = `${walletNet >= 0 ? '+' : ''}${walletNet.toFixed(2)} €`;
    if (elWalletBanner) {
      elWalletBanner.classList.remove('in-profit', 'in-loss', 'neutral');
      if (walletNet > 0.005) {
        elWalletBanner.classList.add('in-profit');
      } else if (walletNet < -0.005) {
        elWalletBanner.classList.add('in-loss');
      } else {
        elWalletBanner.classList.add('neutral');
      }
    }
  }

  if (elTotalIncome) elTotalIncome.textContent = `+${totalIncome.toFixed(2)} €`;
  if (elTotalRefueled) elTotalRefueled.textContent = `-${totalSpentFuel.toFixed(2)} €`;
  if (elTripsProfit) elTripsProfit.textContent = `+${totalIncome.toFixed(2)} €`;

  if (elTotalKm) elTotalKm.textContent = `${totalKm.toLocaleString()} km`;
  if (elTotalPassengers) elTotalPassengers.textContent = totalPassengers;
  if (elTotalTrips) elTotalTrips.textContent = trips.length;
  if (elTotalRefuelsCount) elTotalRefuelsCount.textContent = refuels.length;
  if (elTotalLitersAll) elTotalLitersAll.textContent = `${totalLiters.toFixed(1)} l`;
  if (elAvgFuelPrice) elAvgFuelPrice.textContent = `${avgFuelPrice.toFixed(3)} €/l`;
}

function exportData() {
  const data = {
    mode: state.isCloudMode ? 'cloud' : 'local',
    username: state.currentUser,
    trips: state.trips || [],
    refuels: state.refuels || [],
    exportedAt: new Date().toISOString()
  };

  if (data.trips.length === 0 && data.refuels.length === 0) {
    showToast('⚠️ Nemáš žiadne dáta na export.');
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `spolujazda_${state.currentUser || 'zaloha'}_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('📥 Kompletná záloha bola stiahnutá.');
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      const tripsToImport = imported.trips || (Array.isArray(imported) ? imported : []);
      const refuelsToImport = imported.refuels || [];

      if (state.isCloudMode && state.firebaseUser) {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        for (const t of tripsToImport) {
          delete t.docId;
          await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips'), t);
        }
        for (const r of refuelsToImport) {
          delete r.docId;
          await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'refuels'), r);
        }
        showToast('☁️ Dáta úspešne naimportované do Cloudu!');
      } else {
        // Local mode
        saveLocalStoredTrips(tripsToImport);
        saveLocalStoredRefuels(refuelsToImport);
        state.trips = tripsToImport;
        state.refuels = refuelsToImport;
        renderFuelTab();
        renderHistory();
        renderStats();
        showToast('✅ Dáta úspešne obnovené lokálne!');
      }
    } catch (err) {
      console.error('Import error', err);
      showToast('❌ Chyba pri čítaní súboru.');
    }
  };
  reader.readAsText(file);
}

// Window globally accessible functions for HTML onclick buttons
window.appDeleteTrip = deleteTrip;
window.appDeleteRefuel = deleteRefuel;
window.appEditTrip = openEditTrip;
window.appEditRefuel = openEditRefuel;
