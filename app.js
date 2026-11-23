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
  firestoreTransfersUnsub: null,

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
  fuelConsumption: 6.5,
  fuelConsumedLiters: 9.75,
  hasDiscountPassengers: false,
  discountPassengers: 1,
  discountPrice: 5.00,
  discountNote: '',
  hasCashPayment: false,
  cashPassengers: 1,
  cashAmount: 0.00,
  hasCzkPayment: false,
  czkPassengers: 1,
  czkPricePerPerson: 200,
  czkAmount: 200,
  czkRate: 25.00,
  czkEurAmount: 8.00,
  totalPassengerFare: 22.50,

  // In-memory cache for trips, refuels and bank transfers
  trips: [],
  refuels: [],
  transfers: []
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
const inputTripConsumption = document.getElementById('trip-consumption');
const inputTripConsumedLiters = document.getElementById('trip-consumed-liters');
const consumptionPresetBtns = document.querySelectorAll('.consumption-preset-btn');
const toggleCashPayment = document.getElementById('toggle-cash-payment');
const cashPaymentDetails = document.getElementById('cash-payment-details');
const inputCashPassengersCount = document.getElementById('cash-passengers-count');
const inputCashAmount = document.getElementById('cash-amount');
const toggleCzkPayment = document.getElementById('toggle-czk-payment');
const czkPaymentDetails = document.getElementById('czk-payment-details');
const inputCzkPassengersCount = document.getElementById('czk-passengers-count');
const inputCzkPricePerPerson = document.getElementById('czk-price-per-person');
const inputCzkAmount = document.getElementById('czk-amount');
const inputCzkRate = document.getElementById('czk-rate');
const inputCzkEurAmount = document.getElementById('czk-eur-amount');

// Trip Displays
const profitBanner = document.getElementById('profit-banner');
const profitStatusText = document.getElementById('profit-status-text');
const profitAmount = document.getElementById('profit-amount');
const displayPricePerson = document.getElementById('display-price-person');
const displayPassengers = document.getElementById('display-passengers');
const displayRouteKm = document.getElementById('display-route-km');
const displayTripFuel = document.getElementById('display-trip-fuel');

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
const checkRefuelPaidFromAccount = document.getElementById('refuel-paid-from-account');
const checkEditRefuelPaidFromAccount = document.getElementById('edit-refuel-paid-from-account');

// Receipt Photo State & Elements
let currentRefuelReceipt = null;
let editRefuelReceipt = null;

const inputRefuelReceipt = document.getElementById('refuel-receipt-input');
const btnRefuelReceiptTrigger = document.getElementById('btn-refuel-receipt-trigger');
const containerRefuelReceiptPreview = document.getElementById('refuel-receipt-preview-container');
const imgRefuelReceiptPreview = document.getElementById('refuel-receipt-preview-img');
const btnRemoveRefuelReceipt = document.getElementById('btn-remove-refuel-receipt');

const inputEditRefuelReceipt = document.getElementById('edit-refuel-receipt-input');
const btnEditRefuelReceiptTrigger = document.getElementById('btn-edit-refuel-receipt-trigger');
const containerEditRefuelReceiptPreview = document.getElementById('edit-refuel-receipt-preview-container');
const imgEditRefuelReceiptPreview = document.getElementById('edit-refuel-receipt-preview-img');
const btnRemoveEditRefuelReceipt = document.getElementById('btn-remove-edit-refuel-receipt');

const modalReceipt = document.getElementById('receipt-modal');
const modalReceiptTitle = document.getElementById('receipt-modal-title');
const modalReceiptImg = document.getElementById('receipt-modal-img');
const btnCloseReceiptModal = document.getElementById('btn-close-receipt-modal');

// OCR Elements
const checkRefuelEnableOcr = document.getElementById('refuel-enable-ocr');
const elRefuelOcrStatus = document.getElementById('refuel-receipt-ocr-status');
const elRefuelOcrText = document.getElementById('refuel-receipt-ocr-text');
const btnRefuelRerunOcr = document.getElementById('btn-refuel-rerun-ocr');

const checkEditRefuelEnableOcr = document.getElementById('edit-refuel-enable-ocr');
const elEditRefuelOcrStatus = document.getElementById('edit-refuel-receipt-ocr-status');
const elEditRefuelOcrText = document.getElementById('edit-refuel-receipt-ocr-text');
const btnEditRefuelRerunOcr = document.getElementById('btn-edit-refuel-rerun-ocr');

function compressImageFile(file, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Vybraný súbor nie je obrázok.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Chyba pri čítaní súboru.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Chyba pri načítaní obrázka.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function openReceiptModal(refuelId, docId) {
  const refuel = state.refuels.find(r => (docId && r.docId === docId) || r.id === refuelId);
  if (!refuel || !refuel.receiptImage) {
    showToast('⚠️ Fotka bločku sa nenašla.');
    return;
  }
  if (modalReceiptImg) modalReceiptImg.src = refuel.receiptImage;
  if (modalReceiptTitle) {
    modalReceiptTitle.textContent = `🧾 Bloček – ${refuel.station} (${formatDate(refuel.date)})`;
  }
  if (modalReceipt) modalReceipt.classList.add('open');
}

// ================= OCR RECEIPT PARSER =================
function parseReceiptText(text) {
  if (!text) return {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {
    date: null,
    totalPrice: null,
    liters: null,
    pricePerL: null,
    station: null
  };

  // 1. Čerpacia stanica (Značka + Mesto)
  const KNOWN_BRANDS = [
    { regex: /slovnaft/i, name: 'Slovnaft' },
    { regex: /omv|o\s*m\s*v/i, name: 'OMV' },
    { regex: /orlen|benzina/i, name: 'Orlen' },
    { regex: /shell/i, name: 'Shell' },
    { regex: /daltrans|daloil|dal\s*oil/i, name: 'Daltrans' },
    { regex: /jurki/i, name: 'Jurki' },
    { regex: /tesco/i, name: 'Tesco ČS' },
    { regex: /metro/i, name: 'Metro ČS' },
    { regex: /tam\s*autocentrum|tam\s*oil/i, name: 'TAM' },
    { regex: /\bgas\b/i, name: 'GAS' },
    { regex: /tank\s*&?\s*go/i, name: 'Tank&Go' },
    { regex: /real-?k/i, name: 'Real-K' },
    { regex: /avia/i, name: 'Avia' },
    { regex: /\bmol\b/i, name: 'MOL' },
    { regex: /eurooil/i, name: 'EuroOil' },
    { regex: /robin\s*oil/i, name: 'Robin Oil' },
    { regex: /pap\s*oil/i, name: 'PAP Oil' }
  ];

  const CITIES = [
    'Piešťany', 'Piestany', 'Trnava', 'Brno', 'Bratislava', 'Nitra', 'Trenčín', 'Trencin',
    'Hlohovec', 'Senica', 'Nové Mesto', 'Nove Mesto', 'Žilina', 'Zilina', 'Břeclav', 'Breclav',
    'Hodonín', 'Hodonin', 'Malacky', 'Zvolen', 'Pezinok', 'Senec', 'Sládkovičovo', 'Galanta'
  ];

  let detectedBrand = null;
  for (const b of KNOWN_BRANDS) {
    if (b.regex.test(text)) {
      detectedBrand = b.name;
      break;
    }
  }

  let detectedCity = null;
  for (const city of CITIES) {
    const cityRegex = new RegExp('\\b' + city + '\\b', 'i');
    if (cityRegex.test(text)) {
      detectedCity = city;
      break;
    }
  }

  if (detectedBrand && detectedCity) {
    result.station = `${detectedBrand} ${detectedCity}`;
  } else if (detectedBrand) {
    result.station = detectedBrand;
  } else if (lines.length > 0) {
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const line = lines[i];
      if (!/ico|ic\s*dph|dic|doklad|pokladna|tel|kassa|faktura/i.test(line) && line.length >= 3 && line.length <= 30) {
        result.station = line;
        break;
      }
    }
  }

  // 2. Dátum (DD.MM.YYYY alebo YYYY-MM-DD)
  const dateMatch1 = text.match(/\b([0-3]?\d)[.\/-]([0-1]?\d)[.\/-](202\d)\b/);
  const dateMatch2 = text.match(/\b(202\d)[.\/-]([0-1]?\d)[.\/-]([0-3]?\d)\b/);

  if (dateMatch1) {
    const day = parseInt(dateMatch1[1]);
    const month = parseInt(dateMatch1[2]);
    const year = parseInt(dateMatch1[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      result.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  } else if (dateMatch2) {
    const year = parseInt(dateMatch2[1]);
    const month = parseInt(dateMatch2[2]);
    const day = parseInt(dateMatch2[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      result.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. Litre a Cena za liter
  // Hľadáme objem označený jednotkou 'l', 'ltr', 'lit'
  for (const line of lines) {
    const litMatch = line.match(/\b(\d{1,3}[.,]\d{1,3})\s*(?:l|ltr|lit|litrov)\b/i);
    if (litMatch) {
      const val = parseFloat(litMatch[1].replace(',', '.'));
      if (val >= 2 && val <= 120) {
        result.liters = val;
        break;
      }
    }
  }

  // Hľadáme násobenie "Volume x UnitPrice" (napr. 28,50 * 1,590)
  if (!result.liters || !result.pricePerL) {
    for (const line of lines) {
      const multMatch = line.match(/\b(\d{1,3}[.,]\d{1,3})\s*(?:x|\*)\s*(\d{1,2}[.,]\d{2,3})\b/i);
      if (multMatch) {
        const v1 = parseFloat(multMatch[1].replace(',', '.'));
        const v2 = parseFloat(multMatch[2].replace(',', '.'));
        if (v1 >= 4 && v1 <= 120 && v2 >= 1.0 && v2 <= 3.0) {
          result.liters = v1;
          result.pricePerL = v2;
          break;
        } else if (v2 >= 4 && v2 <= 120 && v1 >= 1.0 && v1 <= 3.0) {
          result.liters = v2;
          result.pricePerL = v1;
          break;
        }
      }
    }
  }

  // Ak cena za liter stále chýba, hľadáme vzor €/l alebo 1.XXX pri palive
  if (!result.pricePerL) {
    for (const line of lines) {
      const pplMatch = line.match(/\b(1[.,]\d{2,3})\s*(?:€|eur)\s*\/\s*(?:l|ltr)\b/i);
      if (pplMatch) {
        result.pricePerL = parseFloat(pplMatch[1].replace(',', '.'));
        break;
      }
    }
    if (!result.pricePerL) {
      for (const line of lines) {
        if (/natural|diesel|nafta|evo|bmb|maxxmotion|v-power|fuel|palivo|efecta/i.test(line)) {
          const m = line.match(/\b(1[.,]\d{3})\b/);
          if (m) {
            result.pricePerL = parseFloat(m[1].replace(',', '.'));
            break;
          }
        }
      }
    }
  }

  // 4. Celková suma (SPOLU, CELKOM, K ÚHRADE, SUMA, atď.)
  const TOTAL_KEYWORDS = /spolu|celkom|k\s*úhrade|k\s*uhrade|celkov[aá]\s*suma|suma|platba|karty/i;
  let candidates = [];

  for (const line of lines) {
    if (TOTAL_KEYWORDS.test(line)) {
      const numMatches = line.match(/\b(\d{1,3}[.,]\d{2})\b/g);
      if (numMatches) {
        for (const nm of numMatches) {
          const val = parseFloat(nm.replace(',', '.'));
          if (val >= 5 && val <= 350) {
            candidates.push({ val, priority: /spolu|celkom|k\s*úhrade|k\s*uhrade/i.test(line) ? 2 : 1 });
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority || b.val - a.val);
    result.totalPrice = candidates[0].val;
  } else {
    // Záložná možnosť: najvyššia rozumná suma na bločku
    let allPrices = [];
    for (const line of lines) {
      const numMatches = line.match(/\b(\d{1,3}[.,]\d{2})\b/g);
      if (numMatches) {
        for (const nm of numMatches) {
          const val = parseFloat(nm.replace(',', '.'));
          if (val >= 10 && val <= 300) {
            allPrices.push(val);
          }
        }
      }
    }
    if (allPrices.length > 0) {
      allPrices.sort((a, b) => b - a);
      result.totalPrice = allPrices[0];
    }
  }

  // 5. Dopočítanie chýbajúcich hodnôt ak máme sumu a objem/cenu
  if (result.totalPrice && result.liters && !result.pricePerL && result.liters > 0) {
    result.pricePerL = parseFloat((result.totalPrice / result.liters).toFixed(3));
  } else if (result.totalPrice && result.pricePerL && !result.liters && result.pricePerL > 0) {
    result.liters = parseFloat((result.totalPrice / result.pricePerL).toFixed(2));
  }

  return result;
}

async function runOcrOnReceipt(imageSource, statusEl, textEl) {
  if (statusEl) {
    statusEl.style.display = 'flex';
    statusEl.classList.remove('error');
    if (textEl) textEl.textContent = '⏳ Pripravujem OCR model...';
  }

  try {
    let TesseractLib = window.Tesseract;
    if (!TesseractLib) {
      if (textEl) textEl.textContent = '⏳ Načítavam knižnicu Tesseract...';
      const mod = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
      TesseractLib = mod.default || mod;
    }

    if (textEl) textEl.textContent = '🔍 Analyzujem text bločku...';

    const result = await TesseractLib.recognize(imageSource, 'slk+eng', {
      logger: m => {
        if (m.status === 'recognizing text' && textEl) {
          const pct = Math.round((m.progress || 0) * 100);
          textEl.textContent = `🔍 Rozpoznávam text z bločku... ${pct}%`;
        }
      }
    });

    const parsed = parseReceiptText(result.data.text);
    return { success: true, parsed, rawText: result.data.text };
  } catch (err) {
    console.error('OCR Error:', err);
    if (statusEl) {
      statusEl.classList.add('error');
      if (textEl) textEl.textContent = '⚠️ Nepodarilo sa vyčítať text z bločku.';
    }
    return { success: false, error: err };
  }
}

function applyParsedDataToForm(parsed, isEdit = false) {
  const prefix = isEdit ? 'edit-refuel-' : 'refuel-';
  let filledFields = [];

  if (parsed.date) {
    const el = document.getElementById(prefix + 'date');
    if (el) {
      el.value = parsed.date;
      el.classList.add('ocr-auto-filled');
      setTimeout(() => el.classList.remove('ocr-auto-filled'), 2000);
      filledFields.push('Dátum: ' + formatDate(parsed.date));
    }
  }

  if (parsed.totalPrice) {
    const el = document.getElementById(prefix + 'total-price');
    if (el) {
      el.value = parsed.totalPrice.toFixed(2);
      el.classList.add('ocr-auto-filled');
      setTimeout(() => el.classList.remove('ocr-auto-filled'), 2000);
      filledFields.push('Suma: ' + parsed.totalPrice.toFixed(2) + ' €');
    }
  }

  if (parsed.liters) {
    const el = document.getElementById(prefix + 'liters');
    if (el) {
      el.value = parsed.liters.toFixed(2);
      el.classList.add('ocr-auto-filled');
      setTimeout(() => el.classList.remove('ocr-auto-filled'), 2000);
      filledFields.push('Objem: ' + parsed.liters.toFixed(2) + ' l');
    }
  }

  if (parsed.pricePerL) {
    const el = document.getElementById(prefix + 'price-per-l');
    if (el) {
      el.value = parsed.pricePerL.toFixed(3);
      el.classList.add('ocr-auto-filled');
      setTimeout(() => el.classList.remove('ocr-auto-filled'), 2000);
    }
  }

  if (parsed.station) {
    const el = document.getElementById(prefix + 'station');
    if (el) {
      el.value = parsed.station;
      el.classList.add('ocr-auto-filled');
      setTimeout(() => el.classList.remove('ocr-auto-filled'), 2000);
      filledFields.push('Čerpačka: ' + parsed.station);
    }
  }

  return filledFields;
}

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
  state.transfers = [];

  // Unsubscribe listeners
  if (state.firestoreTripsUnsub) state.firestoreTripsUnsub();
  if (state.firestoreRefuelsUnsub) state.firestoreRefuelsUnsub();
  if (state.firestoreTransfersUnsub) state.firestoreTransfersUnsub();

  appMain.style.display = 'none';
  appNav.style.display = 'none';
  headerUserSection.style.display = 'none';
  authScreen.style.display = 'block';
  authTabLogin.click();
}

async function setupFirestoreListeners(uid) {
  const { collection, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  // 1. Preload local data immediately so user sees their data even before/if Cloud connects
  const localTrips = getLocalStoredTrips();
  const localRefuels = getLocalStoredRefuels();
  const localTransfers = getLocalStoredTransfers();
  if (localTrips.length > 0) state.trips = localTrips;
  if (localRefuels.length > 0) state.refuels = localRefuels;
  if (localTransfers.length > 0) state.transfers = localTransfers;
  renderHistory();
  renderFuelTab();
  renderStats();

  let hasWarnedPermission = false;
  function handlePermissionError(source, err) {
    console.error(`Firestore ${source} error:`, err);
    if ((err.code === 'permission-denied' || (err.message && err.message.includes('permission'))) && !hasWarnedPermission) {
      hasWarnedPermission = true;
      if (btnCloudModal) {
        btnCloudModal.textContent = '⚠️ Cloud: Pravidlá expirovali';
        btnCloudModal.className = 'cloud-badge offline';
        btnCloudModal.title = 'Testovací režim Firestore (30 dní) vypršal. Klikni pre návod na trvalé pravidlá.';
      }
      showToast('⚠️ Firestore: Vypršali 30-dňové testovacie pravidlá v konzole. Zobrazujú sa lokálne dáta.');
    }
  }

  // Trips real-time sync
  const tripsRef = collection(state.firebaseDb, 'users', uid, 'trips');
  const tripsQuery = query(tripsRef, orderBy('id', 'desc'));

  state.firestoreTripsUnsub = onSnapshot(tripsQuery, (snapshot) => {
    state.trips = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    saveLocalStoredTrips(state.trips);
    renderHistory();
    renderStats();
  }, (err) => {
    handlePermissionError('Trips', err);
  });

  // Refuels real-time sync
  const refuelsRef = collection(state.firebaseDb, 'users', uid, 'refuels');
  const refuelsQuery = query(refuelsRef, orderBy('id', 'desc'));

  state.firestoreRefuelsUnsub = onSnapshot(refuelsQuery, (snapshot) => {
    state.refuels = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    saveLocalStoredRefuels(state.refuels);
    renderFuelTab();
    renderHistory();
    renderStats();
  }, (err) => {
    handlePermissionError('Refuels', err);
  });

  // Transfers real-time sync
  const transfersRef = collection(state.firebaseDb, 'users', uid, 'transfers');
  const transfersQuery = query(transfersRef, orderBy('id', 'desc'));

  state.firestoreTransfersUnsub = onSnapshot(transfersQuery, (snapshot) => {
    state.transfers = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    saveLocalStoredTransfers(state.transfers);
    renderStats();
  }, (err) => {
    handlePermissionError('Transfers', err);
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
  state.transfers = getLocalStoredTransfers();

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

function getLocalTransfersKey() {
  return state.currentUser ? `spolujazda_transfers_${state.currentUser}` : 'spolujazda_transfers';
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

function getLocalStoredTransfers() {
  try {
    const raw = localStorage.getItem(getLocalTransfersKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalStoredTransfers(transfers) {
  localStorage.setItem(getLocalTransfersKey(), JSON.stringify(transfers));
}

// ================= BANK TRANSFERS LOGIC =================
function getPendingTransferAmount() {
  const trips = state.trips || [];
  const refuels = state.refuels || [];
  const transfers = state.transfers || [];
  const totalBankIncome = trips.reduce((sum, t) => {
    const fare = t.totalFare || t.netProfit || 0;
    const cash = t.cashAmount !== undefined
      ? (t.cashAmount || 0)
      : (t.hasCashPayment ? fare : 0);
    const czkEur = t.czkEurAmount !== undefined
      ? (t.czkEurAmount || 0)
      : (t.hasCzkPayment ? (((t.czkAmount !== undefined ? t.czkAmount : 0)) / (t.czkRate || 25.00)) : 0);
    const bankFare = Math.max(0, fare - cash - czkEur);
    return sum + bankFare;
  }, 0);
  const totalFuelFromAccount = refuels
    .filter(r => r.paidFromAccount)
    .reduce((sum, r) => sum + (r.totalPrice || 0), 0);
  const totalTransferred = transfers.reduce((sum, tr) => sum + (tr.amount || 0), 0);
  return Math.max(0, parseFloat((totalBankIncome - totalFuelFromAccount - totalTransferred).toFixed(2)));
}

async function markTransferCompleted() {
  const pending = getPendingTransferAmount();
  if (pending <= 0) {
    showToast('ℹ️ Nemáš žiadne nevyplatené peniaze na odoslanie (0.00 €).');
    return;
  }

  const ok = confirm(`Odoslal si sumu ${pending.toFixed(2)} € na osobný účet?\n\nTýmto sa počítadlo neodoslaných peňazí vynuluje.`);
  if (!ok) return;

  const transfer = {
    id: Date.now(),
    date: new Date().toISOString(),
    amount: pending
  };

  let savedToCloud = false;
  if (state.isCloudMode && state.firebaseUser) {
    try {
      const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'transfers'), transfer);
      savedToCloud = true;
      showToast(`✅ Prevod ${pending.toFixed(2)} € zaznamenaný v Cloude! Počítadlo bolo vynulované.`);
    } catch (e) {
      console.error('Chyba pri ukladaní prevodu do Cloudu:', e);
      const isPermission = e.code === 'permission-denied' || (e.message && e.message.includes('permission'));
      showToast(isPermission
        ? '⚠️ Firestore pravidlá vypršali. Prevod bol zaznamenaný lokálne!'
        : `⚠️ Cloud (${e.code || 'chyba'}): Prevod bol zaznamenaný lokálne!`);
    }
  }

  if (!savedToCloud) {
    state.transfers.unshift(transfer);
    saveLocalStoredTransfers(state.transfers);
    if (!state.isCloudMode) {
      showToast(`✅ Prevod ${pending.toFixed(2)} € zaznamenaný! Počítadlo bolo vynulované.`);
    }
    renderStats();
    recalculateTrip();
  }
}

// ================= APP LISTENERS =================
function dismissActiveKeyboard() {
  const active = document.activeElement;
  if (active && typeof active.blur === 'function') {
    active.blur();
  }
}

function initEventListeners() {
  // Dismiss virtual keyboard when tapping anywhere outside an editable input
  document.addEventListener('pointerdown', (e) => {
    const active = document.activeElement;
    if (!active) return;
    const isEditable = (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
                       !['button', 'submit', 'checkbox', 'radio', 'file', 'image'].includes(active.type) &&
                       !active.readOnly && !active.disabled;
    if (!isEditable) return;

    if (e.target === active || active.contains(e.target)) return;

    const isTargetEditable = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') &&
                             !['button', 'submit', 'checkbox', 'radio', 'file', 'image'].includes(e.target.type) &&
                             !e.target.readOnly && !e.target.disabled;
    if (!isTargetEditable) {
      active.blur();
    }
  }, { passive: true });

  // Mini-steppers (+ and - buttons for count fields)
  document.querySelectorAll('.mini-stepper-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      dismissActiveKeyboard();
      const targetId = btn.dataset.target;
      const step = parseInt(btn.dataset.step) || 1;
      const inp = document.getElementById(targetId);
      if (!inp) return;
      const min = inp.min !== '' ? parseInt(inp.min) : 0;
      const max = inp.max !== '' ? parseInt(inp.max) : 99;
      const cur = parseInt(inp.value) || 0;
      const next = Math.max(min, Math.min(max, cur + step));
      if (next !== cur) {
        inp.value = next;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dismissActiveKeyboard();
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  historyFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dismissActiveKeyboard();
      historyFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.historyFilter = btn.dataset.historyFilter;
      renderHistory();
    });
  });

  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dismissActiveKeyboard();
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const routeKey = btn.dataset.route;
      state.routeType = routeKey;
      state.distanceKm = 150;
      inputDistance.value = 150;
      updateTripConsumption();
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
        dismissActiveKeyboard();
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
      dismissActiveKeyboard();
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
    if (state.hasCzkPayment) {
      updateCzkPaymentCalculation(false);
      fare += (state.czkEurAmount || 0);
    }
    state.totalPassengerFare = parseFloat(fare.toFixed(2));
    inputTotalFare.value = state.totalPassengerFare.toFixed(2);
    if (state.hasCashPayment) {
      updateCashPaymentCalculation(false);
    }
    recalculateTrip();
  }

  if (toggleNoPassengers) {
    toggleNoPassengers.addEventListener('change', (e) => {
      dismissActiveKeyboard();
      state.noPassengers = e.target.checked;

      const cashGroup = document.getElementById('cash-payment-group');
      const czkGroup = document.getElementById('czk-payment-group');

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
        if (cashGroup) {
          cashGroup.style.opacity = '0.4';
          cashGroup.style.pointerEvents = 'none';
        }
        if (czkGroup) {
          czkGroup.style.opacity = '0.4';
          czkGroup.style.pointerEvents = 'none';
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
        if (cashGroup) {
          cashGroup.style.opacity = '1';
          cashGroup.style.pointerEvents = 'auto';
        }
        if (czkGroup) {
          czkGroup.style.opacity = '1';
          czkGroup.style.pointerEvents = 'auto';
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
      dismissActiveKeyboard();
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
    dismissActiveKeyboard();
    if (state.noPassengers) return;
    const minPass = (state.hasDiscountPassengers || state.hasCzkPayment) ? 0 : 1;
    if (state.passengers > minPass) {
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
    dismissActiveKeyboard();
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
      dismissActiveKeyboard();
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

  function updateCashPaymentCalculation(isUserTypingAmount = false) {
    if (!state.hasCashPayment) return;
    if (!isUserTypingAmount) {
      // Auto-prefill cash amount based on count and price
      let computed = 0;
      if (state.individualPrices && Array.isArray(state.passengerPrices)) {
        const count = Math.min(state.cashPassengers, state.passengerPrices.length);
        computed = state.passengerPrices.slice(0, count).reduce((s, p) => s + (p || 0), 0);
      } else {
        computed = (state.cashPassengers || 1) * (state.pricePerPerson || 7.50);
      }
      state.cashAmount = parseFloat(Math.min(computed, state.totalPassengerFare || 0).toFixed(2));
      if (inputCashAmount) inputCashAmount.value = state.cashAmount.toFixed(2);
    }
    recalculateTrip();
  }

  if (toggleCashPayment) {
    toggleCashPayment.addEventListener('change', (e) => {
      dismissActiveKeyboard();
      state.hasCashPayment = e.target.checked;
      if (cashPaymentDetails) {
        cashPaymentDetails.style.display = state.hasCashPayment ? 'block' : 'none';
      }
      if (state.hasCashPayment) {
        if (!inputCashPassengersCount.value) inputCashPassengersCount.value = '1';
        state.cashPassengers = parseInt(inputCashPassengersCount.value) || 1;
        updateCashPaymentCalculation(false);
      } else {
        state.cashAmount = 0.00;
        recalculateTrip();
      }
    });
  }

  if (inputCashPassengersCount) {
    inputCashPassengersCount.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.cashPassengers = isNaN(val) ? 1 : Math.max(1, val);
      updateCashPaymentCalculation(false);
    });
  }

  if (inputCashAmount) {
    inputCashAmount.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.cashAmount = isNaN(val) ? 0 : Math.max(0, val);
      updateCashPaymentCalculation(true);
    });
  }

  function updateCzkPaymentCalculation(isUserTypingCzkAmount = false) {
    if (!state.hasCzkPayment) {
      state.czkEurAmount = 0;
      return;
    }
    const passengers = state.czkPassengers || 1;
    const pricePerPerson = state.czkPricePerPerson !== undefined ? state.czkPricePerPerson : 200;
    const rate = (state.czkRate && state.czkRate > 0) ? state.czkRate : 25.00;

    if (!isUserTypingCzkAmount) {
      state.czkAmount = passengers * pricePerPerson;
      if (inputCzkAmount) inputCzkAmount.value = state.czkAmount;
    }

    const eur = parseFloat(((state.czkAmount || 0) / rate).toFixed(2));
    state.czkEurAmount = eur;
    if (inputCzkEurAmount) inputCzkEurAmount.value = eur.toFixed(2);
  }

  if (toggleCzkPayment) {
    toggleCzkPayment.addEventListener('change', (e) => {
      dismissActiveKeyboard();
      state.hasCzkPayment = e.target.checked;
      if (czkPaymentDetails) {
        czkPaymentDetails.style.display = state.hasCzkPayment ? 'block' : 'none';
      }
      if (state.hasCzkPayment) {
        if (!inputCzkPassengersCount.value) inputCzkPassengersCount.value = '1';
        if (!inputCzkPricePerPerson.value) inputCzkPricePerPerson.value = '200';
        if (!inputCzkRate.value) inputCzkRate.value = '25.00';
        state.czkPassengers = parseInt(inputCzkPassengersCount.value) || 1;
        state.czkPricePerPerson = parseFloat(inputCzkPricePerPerson.value) || 200;
        state.czkRate = parseFloat(inputCzkRate.value) || 25.00;
        updateCzkPaymentCalculation(false);
      } else {
        state.czkEurAmount = 0.00;
        if (state.passengers === 0 && !state.hasDiscountPassengers) {
          state.passengers = 1;
          if (stepperVal) stepperVal.textContent = 1;
        }
      }
      updatePassengerFare();
    });
  }

  if (inputCzkPassengersCount) {
    inputCzkPassengersCount.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.czkPassengers = isNaN(val) ? 1 : Math.max(1, val);
      updateCzkPaymentCalculation(false);
      updatePassengerFare();
    });
  }

  if (inputCzkPricePerPerson) {
    inputCzkPricePerPerson.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.czkPricePerPerson = isNaN(val) ? 0 : Math.max(0, val);
      updateCzkPaymentCalculation(false);
      updatePassengerFare();
    });
  }

  if (inputCzkAmount) {
    inputCzkAmount.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.czkAmount = isNaN(val) ? 0 : Math.max(0, val);
      updateCzkPaymentCalculation(true);
      updatePassengerFare();
    });
  }

  if (inputCzkRate) {
    inputCzkRate.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.czkRate = (isNaN(val) || val <= 0) ? 25.00 : val;
      updateCzkPaymentCalculation(false);
      updatePassengerFare();
    });
  }

  function updateTripConsumption() {
    const consumption = parseFloat(inputTripConsumption ? inputTripConsumption.value : state.fuelConsumption) || 0;
    state.fuelConsumption = Math.max(0, consumption);
    const liters = parseFloat(((state.distanceKm * state.fuelConsumption) / 100).toFixed(2));
    state.fuelConsumedLiters = liters;
    if (inputTripConsumedLiters) {
      inputTripConsumedLiters.value = liters.toFixed(2);
    }
    if (displayTripFuel) {
      displayTripFuel.textContent = `${liters.toFixed(2)} l`;
    }
  }

  if (inputTripConsumption) {
    inputTripConsumption.addEventListener('input', updateTripConsumption);
  }

  consumptionPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dismissActiveKeyboard();
      const consumption = parseFloat(btn.dataset.consumption);
      if (inputTripConsumption) inputTripConsumption.value = consumption.toFixed(1);
      updateTripConsumption();
    });
  });

  btnSaveTrip.addEventListener('click', () => {
    dismissActiveKeyboard();
    saveTrip();
  });
  btnResetTrip.addEventListener('click', () => {
    dismissActiveKeyboard();
    resetTripForm();
  });

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

  // Refuel receipt picker events
  if (btnRefuelReceiptTrigger && inputRefuelReceipt) {
    btnRefuelReceiptTrigger.addEventListener('click', () => {
      inputRefuelReceipt.click();
    });
  }

  if (inputRefuelReceipt) {
    inputRefuelReceipt.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        showToast('⏳ Spracovávam fotku bločku...');
        const compressedBase64 = await compressImageFile(file, 1000, 0.7);
        currentRefuelReceipt = compressedBase64;
        if (imgRefuelReceiptPreview) imgRefuelReceiptPreview.src = compressedBase64;
        if (containerRefuelReceiptPreview) containerRefuelReceiptPreview.style.display = 'block';
        if (btnRefuelRerunOcr) btnRefuelRerunOcr.style.display = 'inline-flex';
        showToast('📷 Bloček bol pripojený!');

        // Ak je zaškrtnutá kolonka OCR, automaticky vyčítame údaje
        if (checkRefuelEnableOcr && checkRefuelEnableOcr.checked) {
          const ocrRes = await runOcrOnReceipt(compressedBase64, elRefuelOcrStatus, elRefuelOcrText);
          if (ocrRes.success) {
            const filled = applyParsedDataToForm(ocrRes.parsed, false);
            if (filled.length > 0) {
              if (elRefuelOcrText) elRefuelOcrText.textContent = `✅ Vyčítané údaje: ${filled.join(', ')}`;
              showToast('🤖 Údaje z bločku boli úspešne načítané!');
            } else {
              if (elRefuelOcrText) elRefuelOcrText.textContent = 'ℹ️ Bloček prečítaný, ale údaje doplň manuálne.';
            }
          }
        } else {
          if (elRefuelOcrStatus) elRefuelOcrStatus.style.display = 'none';
        }
      } catch (err) {
        console.error('Chyba pri spracovaní obrázka:', err);
        showToast('❌ Nepodarilo sa načítať obrázok.');
      }
    });
  }

  if (btnRefuelRerunOcr) {
    btnRefuelRerunOcr.addEventListener('click', async () => {
      if (!currentRefuelReceipt) return;
      const ocrRes = await runOcrOnReceipt(currentRefuelReceipt, elRefuelOcrStatus, elRefuelOcrText);
      if (ocrRes.success) {
        const filled = applyParsedDataToForm(ocrRes.parsed, false);
        if (filled.length > 0) {
          if (elRefuelOcrText) elRefuelOcrText.textContent = `✅ Vyčítané údaje: ${filled.join(', ')}`;
          showToast('🤖 Údaje z bločku boli úspešne načítané!');
        } else {
          if (elRefuelOcrText) elRefuelOcrText.textContent = 'ℹ️ Bloček prečítaný, ale údaje doplň manuálne.';
        }
      }
    });
  }

  if (btnRemoveRefuelReceipt) {
    btnRemoveRefuelReceipt.addEventListener('click', () => {
      currentRefuelReceipt = null;
      if (inputRefuelReceipt) inputRefuelReceipt.value = '';
      if (imgRefuelReceiptPreview) imgRefuelReceiptPreview.src = '';
      if (containerRefuelReceiptPreview) containerRefuelReceiptPreview.style.display = 'none';
      if (elRefuelOcrStatus) elRefuelOcrStatus.style.display = 'none';
      if (btnRefuelRerunOcr) btnRefuelRerunOcr.style.display = 'none';
      showToast('🗑️ Bloček bol odstránený.');
    });
  }

  if (imgRefuelReceiptPreview) {
    imgRefuelReceiptPreview.addEventListener('click', () => {
      if (currentRefuelReceipt && modalReceipt && modalReceiptImg) {
        modalReceiptImg.src = currentRefuelReceipt;
        if (modalReceiptTitle) modalReceiptTitle.textContent = '🧾 Náhľad nového bločku';
        modalReceipt.classList.add('open');
      }
    });
  }

  // Lightbox modal close listeners
  if (btnCloseReceiptModal) {
    btnCloseReceiptModal.addEventListener('click', () => {
      if (modalReceipt) modalReceipt.classList.remove('open');
    });
  }

  if (modalReceipt) {
    modalReceipt.addEventListener('click', (e) => {
      if (e.target === modalReceipt) {
        modalReceipt.classList.remove('open');
      }
    });
  }

  const btnExport = document.getElementById('btn-export-data');
  if (btnExport) btnExport.addEventListener('click', exportData);

  const fileImport = document.getElementById('file-import-data');
  if (fileImport) fileImport.addEventListener('change', importData);

  const btnResetTransfer = document.getElementById('btn-reset-transfer');
  if (btnResetTransfer) {
    btnResetTransfer.addEventListener('click', markTransferCompleted);
  }

  const quickTransferBox = document.getElementById('quick-transfer-box');
  if (quickTransferBox) {
    quickTransferBox.addEventListener('click', () => {
      switchTab('stats');
    });
  }
}

function recalculateTrip() {
  const total = state.totalPassengerFare || 0;
  if (profitAmount) profitAmount.textContent = `+${total.toFixed(2)} €`;

  if (displayPricePerson) {
    if (state.noPassengers) {
      displayPricePerson.textContent = `0.00 €`;
    } else {
      let parts = [];
      if (state.passengers > 0) parts.push(`${state.pricePerPerson.toFixed(2)} €`);
      if (state.hasDiscountPassengers && state.discountPassengers > 0) parts.push(`zľav.`);
      if (state.hasCzkPayment && state.czkPassengers > 0) parts.push(`${state.czkPricePerPerson} Kč`);
      displayPricePerson.textContent = parts.length > 0 ? parts.join(' + ') : `0.00 €`;
    }
  }

  if (displayPassengers) {
    if (state.noPassengers) {
      displayPassengers.textContent = `0 ľudí (sám)`;
    } else {
      const totalCount = (state.passengers || 0) + (state.hasDiscountPassengers ? (state.discountPassengers || 0) : 0) + (state.hasCzkPayment ? (state.czkPassengers || 0) : 0);
      const word = totalCount === 1 ? 'človek' : (totalCount < 5 ? 'ľudia' : 'ľudí');
      displayPassengers.textContent = `${totalCount} ${word}`;
    }
  }
  if (displayRouteKm) displayRouteKm.textContent = `${state.distanceKm} km`;
  if (displayTripFuel) {
    const liters = state.fuelConsumedLiters !== undefined
      ? state.fuelConsumedLiters
      : parseFloat(((state.distanceKm * (state.fuelConsumption || 6.5)) / 100).toFixed(2));
    displayTripFuel.textContent = `${liters.toFixed(2)} l`;
  }

  const pendingTransfer = getPendingTransferAmount();
  const elQuickPendingTransfer = document.getElementById('quick-pending-transfer');
  if (elQuickPendingTransfer) {
    elQuickPendingTransfer.textContent = `${pendingTransfer.toFixed(2)} €`;
  }
}

function switchTab(tabId) {
  state.currentTab = tabId;
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  tabViews.forEach(v => v.classList.toggle('active', v.id === `tab-${tabId}`));

  if (tabId === 'fuel') renderFuelTab();
  else if (tabId === 'history') renderHistory();
  else if (tabId === 'stats') renderStats();
}

async function saveTrip() {
  const dateVal = inputTripDate.value || new Date().toISOString().split('T')[0];
  const income = parseFloat((state.totalPassengerFare || 0).toFixed(2));
  const routeKey = state.routeType || 'pn-brno';
  const routeLabel = ROUTES[routeKey] ? ROUTES[routeKey].label : 'Jazda';
  const totalCount = state.noPassengers ? 0 : (
    (state.passengers || 0) +
    (state.hasDiscountPassengers ? (state.discountPassengers || 0) : 0) +
    (state.hasCzkPayment ? (state.czkPassengers || 0) : 0)
  );

  const trip = {
    id: Date.now(),
    type: 'trip',
    date: dateVal,
    routeType: routeKey,
    routeLabel: routeLabel,
    distanceKm: state.distanceKm || 150,
    noPassengers: !!state.noPassengers,
    passengers: state.noPassengers ? 0 : (state.passengers || 0),
    pricePerPerson: state.noPassengers ? 0 : (state.pricePerPerson || 0),
    hasDiscountPassengers: state.noPassengers ? false : !!state.hasDiscountPassengers,
    discountPassengers: (state.noPassengers || !state.hasDiscountPassengers) ? 0 : (state.discountPassengers || 0),
    discountPrice: (state.noPassengers || !state.hasDiscountPassengers) ? 0 : (state.discountPrice || 0),
    discountNote: (state.noPassengers || !state.hasDiscountPassengers) ? '' : (state.discountNote || ''),
    individualPrices: state.noPassengers ? false : !!state.individualPrices,
    passengerPrices: (state.noPassengers || !state.individualPrices) ? [] : (state.passengerPrices || []).map(p => parseFloat(p) || 0),
    fuelConsumption: state.fuelConsumption !== undefined && !isNaN(state.fuelConsumption) ? parseFloat(state.fuelConsumption) : 6.5,
    fuelConsumedLiters: state.fuelConsumedLiters !== undefined && !isNaN(state.fuelConsumedLiters) ? parseFloat(state.fuelConsumedLiters) : 9.75,
    hasCashPayment: (state.noPassengers || !state.hasCashPayment) ? false : true,
    cashPassengers: (state.noPassengers || !state.hasCashPayment) ? 0 : (state.cashPassengers || 1),
    cashAmount: (state.noPassengers || !state.hasCashPayment) ? 0 : (parseFloat(state.cashAmount) || 0),
    hasCzkPayment: (state.noPassengers || !state.hasCzkPayment) ? false : true,
    czkPassengers: (state.noPassengers || !state.hasCzkPayment) ? 0 : (state.czkPassengers || 1),
    czkPricePerPerson: (state.noPassengers || !state.hasCzkPayment) ? 0 : (parseFloat(state.czkPricePerPerson) || 200),
    czkAmount: (state.noPassengers || !state.hasCzkPayment) ? 0 : (parseFloat(state.czkAmount) || 0),
    czkRate: (state.noPassengers || !state.hasCzkPayment) ? 25.00 : (parseFloat(state.czkRate) || 25.00),
    czkEurAmount: (state.noPassengers || !state.hasCzkPayment) ? 0 : (parseFloat(state.czkEurAmount) || 0),
    totalPassengers: totalCount,
    totalFare: income,
    paidPassengers: new Array(totalCount).fill(false)
  };

  let savedToCloud = false;

  if (state.isCloudMode && state.firebaseUser) {
    try {
      const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips'), trip);
      savedToCloud = true;
      showToast('☁️ Jazda bola synchronizovaná do Cloudu!');
      resetTripForm();
    } catch (e) {
      console.error('Chyba pri ukladaní do Cloudu:', e);
      const isPermission = e.code === 'permission-denied' || (e.message && e.message.includes('permission'));
      if (isPermission) {
        if (btnCloudModal) {
          btnCloudModal.textContent = '⚠️ Cloud: Pravidlá expirovali';
          btnCloudModal.className = 'cloud-badge offline';
        }
        showToast('⚠️ Firestore: Vypršali pravidlá v konzole (Permission Denied). Jazda bola bezpečne uložená lokálne!');
      } else {
        showToast(`⚠️ Cloud (${e.code || 'chyba'}): Jazda bola bezpečne uložená lokálne!`);
      }
    }
  }

  // Ak nie je pripojený Cloud, alebo ak ukladanie do Cloudu zlyhalo:
  // VŽDY uložíme jazdu lokálne, aby používateľ o ňu nikdy neprišiel!
  if (!savedToCloud) {
    if (!state.trips.some(t => t.id === trip.id)) {
      state.trips.unshift(trip);
    }
    saveLocalStoredTrips(state.trips);
    if (!state.isCloudMode) {
      showToast('✅ Jazda bola uložená lokálne!');
    }
    renderHistory();
    renderStats();
    resetTripForm();
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

  // Reset fuel consumption
  state.fuelConsumption = 6.5;
  state.fuelConsumedLiters = 9.75;
  if (inputTripConsumption) inputTripConsumption.value = '6.5';
  if (inputTripConsumedLiters) inputTripConsumedLiters.value = '9.75';

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

  state.hasCashPayment = false;
  state.cashPassengers = 1;
  state.cashAmount = 0.00;
  if (toggleCashPayment) toggleCashPayment.checked = false;
  if (cashPaymentDetails) cashPaymentDetails.style.display = 'none';
  if (inputCashPassengersCount) inputCashPassengersCount.value = '1';
  if (inputCashAmount) inputCashAmount.value = '';
  const cashGroup = document.getElementById('cash-payment-group');
  if (cashGroup) { cashGroup.style.opacity = '1'; cashGroup.style.pointerEvents = 'auto'; }

  state.hasCzkPayment = false;
  state.czkPassengers = 1;
  state.czkPricePerPerson = 200;
  state.czkAmount = 200;
  state.czkRate = 25.00;
  state.czkEurAmount = 8.00;
  if (toggleCzkPayment) toggleCzkPayment.checked = false;
  if (czkPaymentDetails) czkPaymentDetails.style.display = 'none';
  if (inputCzkPassengersCount) inputCzkPassengersCount.value = '1';
  if (inputCzkPricePerPerson) inputCzkPricePerPerson.value = '200';
  if (inputCzkAmount) inputCzkAmount.value = '200';
  if (inputCzkRate) inputCzkRate.value = '25.00';
  if (inputCzkEurAmount) inputCzkEurAmount.value = '8.00';
  const czkGroup = document.getElementById('czk-payment-group');
  if (czkGroup) { czkGroup.style.opacity = '1'; czkGroup.style.pointerEvents = 'auto'; }

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

  const paidFromAccount = checkRefuelPaidFromAccount ? checkRefuelPaidFromAccount.checked : false;

  const refuel = {
    id: Date.now(),
    type: 'fuel',
    date: dateVal,
    totalPrice: totalPrice,
    liters: liters,
    pricePerL: pricePerL || (liters > 0 ? parseFloat((totalPrice / liters).toFixed(3)) : 0),
    station: station,
    odometer: odometer,
    receiptImage: currentRefuelReceipt || null,
    paidFromAccount: paidFromAccount
  };

  let savedToCloud = false;

  if (state.isCloudMode && state.firebaseUser) {
    try {
      const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'refuels'), refuel);
      savedToCloud = true;
      showToast('☁️ Tankovanie bolo synchronizované do Cloudu!');
    } catch (e) {
      console.error('Chyba pri ukladaní do Cloudu:', e);
      const isPermission = e.code === 'permission-denied' || (e.message && e.message.includes('permission'));
      showToast(isPermission
        ? '⚠️ Firestore pravidlá vypršali (Permission Denied). Tankovanie bolo bezpečne uložené lokálne!'
        : `⚠️ Cloud (${e.code || 'chyba'}): Tankovanie bolo bezpečne uložené lokálne!`);
    }
  }

  if (!savedToCloud) {
    if (!state.refuels.some(r => r.id === refuel.id)) {
      state.refuels.unshift(refuel);
    }
    saveLocalStoredRefuels(state.refuels);
    if (!state.isCloudMode) {
      showToast('⛽ Tankovanie bolo uložené lokálne!');
    }
    renderFuelTab();
    renderHistory();
    renderStats();
  }

  inputRefuelTotalPrice.value = '';
  inputRefuelLiters.value = '';
  inputRefuelPricePerL.value = '';
  inputRefuelStation.value = '';
  inputRefuelOdometer.value = '';
  if (checkRefuelPaidFromAccount) checkRefuelPaidFromAccount.checked = false;

  currentRefuelReceipt = null;
  if (inputRefuelReceipt) inputRefuelReceipt.value = '';
  if (containerRefuelReceiptPreview) containerRefuelReceiptPreview.style.display = 'none';
  if (imgRefuelReceiptPreview) imgRefuelReceiptPreview.src = '';
  if (elRefuelOcrStatus) elRefuelOcrStatus.style.display = 'none';
  if (btnRefuelRerunOcr) btnRefuelRerunOcr.style.display = 'none';
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

  // Fuel consumption in edit modal
  const editTripConsumption = document.getElementById('edit-trip-consumption');
  const editTripConsumedLiters = document.getElementById('edit-trip-consumed-liters');
  const consumption = trip.fuelConsumption !== undefined ? trip.fuelConsumption : 6.5;
  if (editTripConsumption) editTripConsumption.value = consumption;
  const d = trip.distanceKm || 150;
  const liters = parseFloat(((d * consumption) / 100).toFixed(2));
  if (editTripConsumedLiters) editTripConsumedLiters.value = liters.toFixed(2);

  // Cash payment in edit modal
  const editToggleCash = document.getElementById('edit-toggle-cash-payment');
  const editCashDetails = document.getElementById('edit-cash-payment-details');
  const editCashCount = document.getElementById('edit-cash-passengers-count');
  const editCashAmount = document.getElementById('edit-cash-amount');
  const editCashGroup = document.getElementById('edit-cash-payment-group');

  const hasCash = !!trip.hasCashPayment || (trip.cashAmount > 0);
  if (editToggleCash) editToggleCash.checked = hasCash;
  if (editCashDetails) editCashDetails.style.display = hasCash ? 'block' : 'none';
  if (editCashCount) editCashCount.value = trip.cashPassengers || 1;
  if (editCashAmount) {
    if (trip.cashAmount !== undefined && trip.cashAmount !== null) {
      editCashAmount.value = trip.cashAmount > 0 ? trip.cashAmount.toFixed(2) : '';
    } else if (hasCash && trip.totalFare) {
      editCashAmount.value = trip.totalFare.toFixed(2);
    } else {
      editCashAmount.value = '';
    }
  }
  if (editCashGroup) {
    editCashGroup.style.opacity = isNoPass ? '0.4' : '1';
    editCashGroup.style.pointerEvents = isNoPass ? 'none' : 'auto';
  }

  // CZK payment in edit modal
  const editToggleCzk = document.getElementById('edit-toggle-czk-payment');
  const editCzkDetails = document.getElementById('edit-czk-payment-details');
  const editCzkCount = document.getElementById('edit-czk-passengers-count');
  const editCzkPrice = document.getElementById('edit-czk-price-per-person');
  const editCzkAmount = document.getElementById('edit-czk-amount');
  const editCzkRate = document.getElementById('edit-czk-rate');
  const editCzkEur = document.getElementById('edit-czk-eur-amount');
  const editCzkGroup = document.getElementById('edit-czk-payment-group');

  const hasCzk = !!trip.hasCzkPayment || (trip.czkAmount > 0);
  if (editToggleCzk) editToggleCzk.checked = hasCzk;
  if (editCzkDetails) editCzkDetails.style.display = hasCzk ? 'block' : 'none';
  if (editCzkCount) editCzkCount.value = trip.czkPassengers || 1;
  if (editCzkPrice) editCzkPrice.value = trip.czkPricePerPerson !== undefined ? trip.czkPricePerPerson : 200;
  if (editCzkAmount) editCzkAmount.value = trip.czkAmount !== undefined ? trip.czkAmount : (hasCzk ? ((trip.czkPassengers || 1) * (trip.czkPricePerPerson || 200)) : 200);
  if (editCzkRate) editCzkRate.value = trip.czkRate !== undefined ? trip.czkRate : '25.00';
  if (editCzkEur) {
    const rate = trip.czkRate || 25.00;
    const czk = trip.czkAmount !== undefined ? trip.czkAmount : 200;
    editCzkEur.value = (trip.czkEurAmount !== undefined ? trip.czkEurAmount : (czk / rate)).toFixed(2);
  }
  if (editCzkGroup) {
    editCzkGroup.style.opacity = isNoPass ? '0.4' : '1';
    editCzkGroup.style.pointerEvents = isNoPass ? 'none' : 'auto';
  }

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
    if (editToggleCzk && editToggleCzk.checked) {
      const czkRate = parseFloat(editCzkRate ? editCzkRate.value : 25) || 25.00;
      const czkVal = parseFloat(editCzkAmount ? editCzkAmount.value : 0) || 0;
      const czkEurVal = parseFloat((czkVal / czkRate).toFixed(2));
      if (editCzkEur) editCzkEur.value = czkEurVal.toFixed(2);
      sum += czkEurVal;
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
  if (checkEditRefuelPaidFromAccount) checkEditRefuelPaidFromAccount.checked = !!refuel.paidFromAccount;

  editRefuelReceipt = refuel.receiptImage || null;
  if (inputEditRefuelReceipt) inputEditRefuelReceipt.value = '';
  if (containerEditRefuelReceiptPreview && imgEditRefuelReceiptPreview) {
    if (editRefuelReceipt) {
      imgEditRefuelReceiptPreview.src = editRefuelReceipt;
      containerEditRefuelReceiptPreview.style.display = 'block';
    } else {
      imgEditRefuelReceiptPreview.src = '';
      containerEditRefuelReceiptPreview.style.display = 'none';
    }
  }

  if (elEditRefuelOcrStatus) elEditRefuelOcrStatus.style.display = 'none';
  if (btnEditRefuelRerunOcr) {
    btnEditRefuelRerunOcr.style.display = editRefuelReceipt ? 'inline-flex' : 'none';
  }

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

  const editTripConsumption = document.getElementById('edit-trip-consumption');
  const fuelConsumption = editTripConsumption ? Math.max(0, parseFloat(editTripConsumption.value) || 0) : 6.5;
  const fuelConsumedLiters = parseFloat(((150 * fuelConsumption) / 100).toFixed(2));

  // Cash payment in edit modal
  let hasCashPayment = false;
  let cashPassengers = 0;
  let cashAmount = 0.00;
  if (!isNoPass) {
    const editToggleCash = document.getElementById('edit-toggle-cash-payment');
    hasCashPayment = editToggleCash ? editToggleCash.checked : false;
    if (hasCashPayment) {
      cashPassengers = Math.max(1, parseInt(document.getElementById('edit-cash-passengers-count')?.value) || 1);
      const typedCash = parseFloat(document.getElementById('edit-cash-amount')?.value);
      cashAmount = isNaN(typedCash) ? totalFare : Math.max(0, typedCash);
    }
  }

  // CZK payment in edit modal
  let hasCzkPayment = false;
  let czkPassengers = 0;
  let czkPricePerPerson = 200;
  let czkAmount = 0;
  let czkRate = 25.00;
  let czkEurAmount = 0.00;
  if (!isNoPass) {
    const editToggleCzk = document.getElementById('edit-toggle-czk-payment');
    hasCzkPayment = editToggleCzk ? editToggleCzk.checked : false;
    if (hasCzkPayment) {
      czkPassengers = Math.max(1, parseInt(document.getElementById('edit-czk-passengers-count')?.value) || 1);
      czkPricePerPerson = Math.max(0, parseFloat(document.getElementById('edit-czk-price-per-person')?.value) || 200);
      czkRate = Math.max(0.1, parseFloat(document.getElementById('edit-czk-rate')?.value) || 25.00);
      const typedCzk = parseFloat(document.getElementById('edit-czk-amount')?.value);
      czkAmount = isNaN(typedCzk) ? (czkPassengers * czkPricePerPerson) : Math.max(0, typedCzk);
      czkEurAmount = parseFloat((czkAmount / czkRate).toFixed(2));
      totalFare = parseFloat((totalFare + czkEurAmount).toFixed(2));
      totalCount += czkPassengers;
    }
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
    fuelConsumption: fuelConsumption,
    fuelConsumedLiters: fuelConsumedLiters,
    hasDiscountPassengers: hasDiscountPassengers,
    discountPassengers: discountPassengers,
    discountPrice: discountPrice,
    discountNote: discountNote,
    hasCashPayment: hasCashPayment,
    cashPassengers: cashPassengers,
    cashAmount: cashAmount,
    hasCzkPayment: hasCzkPayment,
    czkPassengers: czkPassengers,
    czkPricePerPerson: czkPricePerPerson,
    czkAmount: czkAmount,
    czkRate: czkRate,
    czkEurAmount: czkEurAmount,
    totalPassengers: totalCount,
    totalFare: totalFare,
    paidPassengers: (state.trips.find(t => t.id === tripId || (docId && t.docId === docId))?.paidPassengers) || []
  };

  let updatedInCloud = false;
  if (state.isCloudMode && state.firebaseUser && docId) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await updateDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips', docId), updatedTrip);
      updatedInCloud = true;
      showToast('☁️ Jazda bola aktualizovaná v Cloude!');
    } catch (e) {
      console.error('Chyba pri aktualizácii v Cloude:', e);
      const isPermission = e.code === 'permission-denied' || (e.message && e.message.includes('permission'));
      showToast(isPermission
        ? '⚠️ Firestore pravidlá vypršali. Zmeny boli uložené lokálne!'
        : `⚠️ Cloud (${e.code || 'chyba'}): Zmeny boli uložené lokálne!`);
    }
  }

  if (!updatedInCloud) {
    const idx = state.trips.findIndex(t => t.id === tripId || (docId && t.docId === docId));
    if (idx !== -1) {
      state.trips[idx] = { ...state.trips[idx], ...updatedTrip };
      saveLocalStoredTrips(state.trips);
      renderHistory();
      renderStats();
      if (!state.isCloudMode) {
        showToast('✅ Jazda úspešne upravená!');
      }
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

  const paidFromAccount = checkEditRefuelPaidFromAccount ? checkEditRefuelPaidFromAccount.checked : false;

  const updatedRefuel = {
    id: refuelId,
    type: 'fuel',
    date: dateVal,
    totalPrice: totalPrice,
    liters: liters,
    pricePerL: pricePerL || (liters > 0 ? parseFloat((totalPrice / liters).toFixed(3)) : 0),
    station: station,
    odometer: odometer,
    receiptImage: editRefuelReceipt || null,
    paidFromAccount: paidFromAccount
  };

  let refuelUpdatedInCloud = false;
  if (state.isCloudMode && state.firebaseUser && docId) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await updateDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'refuels', docId), updatedRefuel);
      refuelUpdatedInCloud = true;
      showToast('☁️ Tankovanie aktualizované v Cloude!');
    } catch (e) {
      console.error('Chyba pri aktualizácii v Cloudu:', e);
      const isPermission = e.code === 'permission-denied' || (e.message && e.message.includes('permission'));
      showToast(isPermission
        ? '⚠️ Firestore pravidlá vypršali. Zmeny boli uložené lokálne!'
        : `⚠️ Cloud (${e.code || 'chyba'}): Zmeny boli uložené lokálne!`);
    }
  }

  if (!refuelUpdatedInCloud) {
    const idx = state.refuels.findIndex(r => r.id === refuelId || (docId && r.docId === docId));
    if (idx !== -1) {
      state.refuels[idx] = { ...state.refuels[idx], ...updatedRefuel };
      saveLocalStoredRefuels(state.refuels);
      renderFuelTab();
      renderHistory();
      renderStats();
      if (!state.isCloudMode) {
        showToast('✅ Tankovanie úspešne upravené!');
      }
    }
  }

  const modalRefuel = document.getElementById('edit-refuel-modal');
  if (modalRefuel) modalRefuel.classList.remove('open');
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
    if (editToggleCzk && editToggleCzk.checked) {
      const czkRate = parseFloat(editCzkRate ? editCzkRate.value : 25) || 25.00;
      const czkVal = parseFloat(editCzkAmount ? editCzkAmount.value : 0) || 0;
      const czkEurVal = parseFloat((czkVal / czkRate).toFixed(2));
      if (editCzkEur) editCzkEur.value = czkEurVal.toFixed(2);
      sum += czkEurVal;
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
          <input type="number" class="input-field edit-individual-price-input" data-idx="${idx}" value="${p.toFixed(2)}" min="0" step="0.5" inputmode="decimal">
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
      dismissActiveKeyboard();
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
      dismissActiveKeyboard();
      const count = Math.min(8, Math.max(1, parseInt(editIndivCount.value) || 1));
      editIndivCount.value = count;
      renderEditIndividualRows(count);
    });
  }

  if (btnCloseTrip && modalTrip) {
    btnCloseTrip.addEventListener('click', () => {
      dismissActiveKeyboard();
      modalTrip.classList.remove('open');
    });
    modalTrip.addEventListener('click', (e) => {
      if (e.target === modalTrip) {
        dismissActiveKeyboard();
        modalTrip.classList.remove('open');
      }
    });
  }

  routeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dismissActiveKeyboard();
      routeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const editToggleCash = document.getElementById('edit-toggle-cash-payment');
  const editCashDetails = document.getElementById('edit-cash-payment-details');
  const editCashCount = document.getElementById('edit-cash-passengers-count');
  const editCashAmount = document.getElementById('edit-cash-amount');

  const editToggleCzk = document.getElementById('edit-toggle-czk-payment');
  const editCzkDetails = document.getElementById('edit-czk-payment-details');
  const editCzkCount = document.getElementById('edit-czk-passengers-count');
  const editCzkPrice = document.getElementById('edit-czk-price-per-person');
  const editCzkAmount = document.getElementById('edit-czk-amount');
  const editCzkRate = document.getElementById('edit-czk-rate');
  const editCzkEur = document.getElementById('edit-czk-eur-amount');

  function updateEditCashCalculation(isUserTyping = false) {
    if (!editToggleCash || !editToggleCash.checked) return;
    if (!isUserTyping && editCashAmount) {
      let farePerPerson = 7.50;
      if (inputPrice) farePerPerson = parseFloat(inputPrice.value) || 7.50;
      const cCount = parseInt(editCashCount ? editCashCount.value : 1) || 1;
      const autoCash = (cCount * farePerPerson).toFixed(2);
      editCashAmount.value = autoCash;
    }
  }

  function updateEditCzkCalculation(isUserTyping = false) {
    if (!editToggleCzk || !editToggleCzk.checked) return;
    const cCount = parseInt(editCzkCount ? editCzkCount.value : 1) || 1;
    const cPrice = parseFloat(editCzkPrice ? editCzkPrice.value : 200) || 200;
    const cRate = parseFloat(editCzkRate ? editCzkRate.value : 25) || 25;
    if (!isUserTyping && editCzkAmount) {
      editCzkAmount.value = cCount * cPrice;
    }
    const cVal = parseFloat(editCzkAmount ? editCzkAmount.value : 0) || 0;
    const eur = parseFloat((cVal / cRate).toFixed(2));
    if (editCzkEur) editCzkEur.value = eur.toFixed(2);
    recalcEditTrip();
  }

  if (editToggleCash) {
    editToggleCash.addEventListener('change', () => {
      dismissActiveKeyboard();
      if (editCashDetails) editCashDetails.style.display = editToggleCash.checked ? 'block' : 'none';
      if (editToggleCash.checked) {
        updateEditCashCalculation(false);
      }
    });
  }

  if (editCashCount) {
    editCashCount.addEventListener('input', () => {
      updateEditCashCalculation(false);
    });
  }

  if (editToggleCzk) {
    editToggleCzk.addEventListener('change', () => {
      dismissActiveKeyboard();
      if (editCzkDetails) editCzkDetails.style.display = editToggleCzk.checked ? 'block' : 'none';
      if (editToggleCzk.checked) {
        updateEditCzkCalculation(false);
      } else {
        recalcEditTrip();
      }
    });
  }

  if (editCzkCount) {
    editCzkCount.addEventListener('input', () => updateEditCzkCalculation(false));
  }
  if (editCzkPrice) {
    editCzkPrice.addEventListener('input', () => updateEditCzkCalculation(false));
  }
  if (editCzkAmount) {
    editCzkAmount.addEventListener('input', () => updateEditCzkCalculation(true));
  }
  if (editCzkRate) {
    editCzkRate.addEventListener('input', () => updateEditCzkCalculation(false));
  }

  if (toggleNoPass) {
    toggleNoPass.addEventListener('change', () => {
      dismissActiveKeyboard();
      if (passSection) passSection.style.display = toggleNoPass.checked ? 'none' : 'block';
      const editCashGroup = document.getElementById('edit-cash-payment-group');
      if (editCashGroup) {
        editCashGroup.style.opacity = toggleNoPass.checked ? '0.4' : '1';
        editCashGroup.style.pointerEvents = toggleNoPass.checked ? 'none' : 'auto';
      }
      const editCzkGroup = document.getElementById('edit-czk-payment-group');
      if (editCzkGroup) {
        editCzkGroup.style.opacity = toggleNoPass.checked ? '0.4' : '1';
        editCzkGroup.style.pointerEvents = toggleNoPass.checked ? 'none' : 'auto';
      }
      recalcEditTrip();
    });
  }

  if (inputPass) inputPass.addEventListener('input', () => {
    recalcEditTrip();
    updateEditCashCalculation(false);
  });
  if (inputPrice) inputPrice.addEventListener('input', () => {
    recalcEditTrip();
    updateEditCashCalculation(false);
  });

  if (toggleDisc) {
    toggleDisc.addEventListener('change', () => {
      dismissActiveKeyboard();
      if (discContainer) discContainer.style.display = toggleDisc.checked ? 'block' : 'none';
      recalcEditTrip();
    });
  }

  if (inputDiscCount) inputDiscCount.addEventListener('input', recalcEditTrip);
  if (inputDiscPrice) inputDiscPrice.addEventListener('input', recalcEditTrip);

  const editTripConsumption = document.getElementById('edit-trip-consumption');
  const editTripConsumedLiters = document.getElementById('edit-trip-consumed-liters');
  if (editTripConsumption) {
    editTripConsumption.addEventListener('input', () => {
      const d = 150;
      const c = parseFloat(editTripConsumption.value) || 0;
      if (editTripConsumedLiters) {
        editTripConsumedLiters.value = ((d * c) / 100).toFixed(2);
      }
    });
  }

  if (btnSaveTripEdit) {
    btnSaveTripEdit.addEventListener('click', () => {
      dismissActiveKeyboard();
      saveEditedTrip();
    });
  }

  // Edit Refuel Modal listeners
  const modalRefuel = document.getElementById('edit-refuel-modal');
  const btnCloseRefuel = document.getElementById('btn-close-edit-refuel');
  const btnSaveRefuelEdit = document.getElementById('btn-save-edit-refuel');
  const inputRefuelTotal = document.getElementById('edit-refuel-total-price');
  const inputRefuelLiters = document.getElementById('edit-refuel-liters');
  const inputRefuelPriceL = document.getElementById('edit-refuel-price-per-l');

  if (btnCloseRefuel && modalRefuel) {
    btnCloseRefuel.addEventListener('click', () => {
      dismissActiveKeyboard();
      modalRefuel.classList.remove('open');
    });
    modalRefuel.addEventListener('click', (e) => {
      if (e.target === modalRefuel) {
        dismissActiveKeyboard();
        modalRefuel.classList.remove('open');
      }
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
    btnSaveRefuelEdit.addEventListener('click', () => {
      dismissActiveKeyboard();
      saveEditedRefuel();
    });
  }

  if (btnEditRefuelReceiptTrigger && inputEditRefuelReceipt) {
    btnEditRefuelReceiptTrigger.addEventListener('click', () => {
      inputEditRefuelReceipt.click();
    });
  }

  if (inputEditRefuelReceipt) {
    inputEditRefuelReceipt.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        showToast('⏳ Spracovávam fotku bločku...');
        const compressedBase64 = await compressImageFile(file, 1000, 0.7);
        editRefuelReceipt = compressedBase64;
        if (imgEditRefuelReceiptPreview) imgEditRefuelReceiptPreview.src = compressedBase64;
        if (containerEditRefuelReceiptPreview) containerEditRefuelReceiptPreview.style.display = 'block';
        if (btnEditRefuelRerunOcr) btnEditRefuelRerunOcr.style.display = 'inline-flex';
        showToast('📷 Bloček bol pripojený k úprave!');

        // Ak je zaškrtnutá kolonka OCR v úprave, automaticky vyčítame údaje
        if (checkEditRefuelEnableOcr && checkEditRefuelEnableOcr.checked) {
          const ocrRes = await runOcrOnReceipt(compressedBase64, elEditRefuelOcrStatus, elEditRefuelOcrText);
          if (ocrRes.success) {
            const filled = applyParsedDataToForm(ocrRes.parsed, true);
            if (filled.length > 0) {
              if (elEditRefuelOcrText) elEditRefuelOcrText.textContent = `✅ Vyčítané údaje: ${filled.join(', ')}`;
              showToast('🤖 Údaje z bločku boli úspešne načítané!');
            } else {
              if (elEditRefuelOcrText) elEditRefuelOcrText.textContent = 'ℹ️ Bloček prečítaný, ale údaje doplň manuálne.';
            }
          }
        } else {
          if (elEditRefuelOcrStatus) elEditRefuelOcrStatus.style.display = 'none';
        }
      } catch (err) {
        console.error('Chyba pri spracovaní obrázka:', err);
        showToast('❌ Nepodarilo sa načítať obrázok.');
      }
    });
  }

  if (btnEditRefuelRerunOcr) {
    btnEditRefuelRerunOcr.addEventListener('click', async () => {
      if (!editRefuelReceipt) return;
      const ocrRes = await runOcrOnReceipt(editRefuelReceipt, elEditRefuelOcrStatus, elEditRefuelOcrText);
      if (ocrRes.success) {
        const filled = applyParsedDataToForm(ocrRes.parsed, true);
        if (filled.length > 0) {
          if (elEditRefuelOcrText) elEditRefuelOcrText.textContent = `✅ Vyčítané údaje: ${filled.join(', ')}`;
          showToast('🤖 Údaje z bločku boli úspešne načítané!');
        } else {
          if (elEditRefuelOcrText) elEditRefuelOcrText.textContent = 'ℹ️ Bloček prečítaný, ale údaje doplň manuálne.';
        }
      }
    });
  }

  if (btnRemoveEditRefuelReceipt) {
    btnRemoveEditRefuelReceipt.addEventListener('click', () => {
      editRefuelReceipt = null;
      if (inputEditRefuelReceipt) inputEditRefuelReceipt.value = '';
      if (imgEditRefuelReceiptPreview) imgEditRefuelReceiptPreview.src = '';
      if (containerEditRefuelReceiptPreview) containerEditRefuelReceiptPreview.style.display = 'none';
      if (elEditRefuelOcrStatus) elEditRefuelOcrStatus.style.display = 'none';
      if (btnEditRefuelRerunOcr) btnEditRefuelRerunOcr.style.display = 'none';
      showToast('🗑️ Bloček bol z úpravy odstránený.');
    });
  }

  if (imgEditRefuelReceiptPreview) {
    imgEditRefuelReceiptPreview.addEventListener('click', () => {
      if (editRefuelReceipt && modalReceipt && modalReceiptImg) {
        modalReceiptImg.src = editRefuelReceipt;
        if (modalReceiptTitle) modalReceiptTitle.textContent = '🧾 Náhľad bločku';
        modalReceipt.classList.add('open');
      }
    });
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
      <div class="trip-main-row">
        <div class="trip-left">
          <div class="trip-route">
            <span class="history-badge fuel">⛽ Tankovanie</span> ${r.station}
          </div>
          <div class="trip-meta">
            <span>📅 ${formatDate(r.date)}</span>
            ${r.liters > 0 ? `<span>💧 ${r.liters.toFixed(1)} l</span>` : ''}
            ${r.pricePerL > 0 ? `<span>💶 ${r.pricePerL.toFixed(3)} €/l</span>` : ''}
            ${r.odometer ? `<span>📍 ${r.odometer} km</span>` : ''}
            ${r.paidFromAccount ? `<span>💳 Z účtu</span>` : ''}
            ${r.receiptImage ? `<button type="button" class="receipt-view-btn" onclick="window.appViewReceipt(${r.id}, '${r.docId || ''}')">🧾 Bloček</button>` : ''}
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
    </div>
  `).join('');
}

function getTripPassengerList(item) {
  if (item.noPassengers || (item.passengers === 0 && !item.hasDiscountPassengers && !item.hasCzkPayment)) {
    return [];
  }
  const list = [];
  if (item.individualPrices && Array.isArray(item.passengerPrices) && item.passengerPrices.length > 0) {
    item.passengerPrices.forEach((price, idx) => {
      list.push({
        index: idx,
        label: `Cestujúci ${idx + 1}`,
        price: parseFloat(price) || 0
      });
    });
  } else {
    const normalCount = item.passengers !== undefined ? item.passengers : 3;
    const normalPrice = item.pricePerPerson !== undefined ? item.pricePerPerson : 7.50;
    for (let i = 0; i < normalCount; i++) {
      list.push({
        index: i,
        label: `Cestujúci ${i + 1}`,
        price: normalPrice
      });
    }
  }

  let curIdx = list.length;
  if (item.hasDiscountPassengers && item.discountPassengers > 0) {
    const discCount = item.discountPassengers;
    const discPrice = item.discountPrice !== undefined ? item.discountPrice : 5.00;
    const note = item.discountNote ? ` (${item.discountNote})` : '';
    for (let j = 0; j < discCount; j++) {
      list.push({
        index: curIdx + j,
        label: `Cestujúci ${curIdx + j + 1}${note}`,
        price: discPrice
      });
    }
    curIdx += discCount;
  }

  if (item.hasCzkPayment && item.czkPassengers > 0) {
    const czkCount = item.czkPassengers;
    const czkPrice = item.czkPricePerPerson !== undefined ? item.czkPricePerPerson : 200;
    const czkRate = (item.czkRate && item.czkRate > 0) ? item.czkRate : 25.00;
    const czkPriceEur = parseFloat((czkPrice / czkRate).toFixed(2));
    for (let k = 0; k < czkCount; k++) {
      list.push({
        index: curIdx + k,
        label: `Cestujúci ${curIdx + k + 1} (${czkPrice} Kč)`,
        price: czkPriceEur,
        isCzk: true,
        czkAmount: czkPrice
      });
    }
    curIdx += czkCount;
  }

  return list;
}

async function togglePassengerPaid(tripId, docId, passengerIndex) {
  const trip = state.trips.find(t => t.id === tripId || (docId && t.docId === docId));
  if (!trip) return;

  const passengersList = getTripPassengerList(trip);
  if (!Array.isArray(trip.paidPassengers)) {
    trip.paidPassengers = new Array(passengersList.length).fill(false);
  }
  while (trip.paidPassengers.length < passengersList.length) {
    trip.paidPassengers.push(false);
  }

  trip.paidPassengers[passengerIndex] = !trip.paidPassengers[passengerIndex];
  const newState = trip.paidPassengers[passengerIndex];

  const activeDocId = trip.docId || docId;
  if (state.isCloudMode && state.firebaseUser && activeDocId) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await updateDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips', activeDocId), {
        paidPassengers: trip.paidPassengers
      });
    } catch (err) {
      console.warn('Nepodarilo sa uložiť platbu na Cloud, ukladám lokálne:', err);
    }
  }

  saveLocalStoredTrips(state.trips);
  renderHistory();
  renderStats();

  const pName = passengersList[passengerIndex] ? passengersList[passengerIndex].label : `Cestujúci ${passengerIndex + 1}`;
  if (newState) {
    showToast(`✅ ${pName}: zaplatené na účet ✓`);
  } else {
    showToast(`ℹ️ ${pName}: platba zrušená`);
  }
}

async function toggleAllPassengersPaid(tripId, docId) {
  const trip = state.trips.find(t => t.id === tripId || (docId && t.docId === docId));
  if (!trip) return;

  const passengersList = getTripPassengerList(trip);
  if (!Array.isArray(trip.paidPassengers)) {
    trip.paidPassengers = new Array(passengersList.length).fill(false);
  }
  while (trip.paidPassengers.length < passengersList.length) {
    trip.paidPassengers.push(false);
  }

  const allPaid = trip.paidPassengers.slice(0, passengersList.length).every(Boolean);
  const newState = !allPaid;
  trip.paidPassengers = new Array(passengersList.length).fill(newState);

  const activeDocId = trip.docId || docId;
  if (state.isCloudMode && state.firebaseUser && activeDocId) {
    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await updateDoc(doc(state.firebaseDb, 'users', state.firebaseUser.uid, 'trips', activeDocId), {
        paidPassengers: trip.paidPassengers
      });
    } catch (err) {
      console.warn('Nepodarilo sa uložiť na Cloud:', err);
    }
  }

  saveLocalStoredTrips(state.trips);
  renderHistory();
  renderStats();

  showToast(newState ? '✅ Všetci pasažieri označení ako zaplatení!' : 'ℹ️ Označenie platieb zrušené.');
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
        let extra = '';
        if (item.hasCzkPayment && item.czkPassengers > 0) {
          extra += ` + ${item.czkPassengers}×${item.czkPricePerPerson || 200}Kč`;
        }
        passengerInfo = `${totalCount} ľudí (${pricesStr}${extra})`;
      } else if (item.hasDiscountPassengers && item.discountPassengers > 0) {
        let parts = [];
        if (item.passengers > 0) parts.push(`${item.passengers}×${item.pricePerPerson ? item.pricePerPerson.toFixed(2) : '7.50'}€`);
        parts.push(`${item.discountPassengers}×${item.discountPrice ? item.discountPrice.toFixed(2) : ''}€${item.discountNote ? ' • ' + item.discountNote : ''}`);
        if (item.hasCzkPayment && item.czkPassengers > 0) {
          parts.push(`${item.czkPassengers}×${item.czkPricePerPerson || 200}Kč`);
        }
        passengerInfo = `${totalCount} ľudí (${parts.join(' + ')})`;
      } else if (item.hasCzkPayment && item.czkPassengers > 0) {
        let parts = [];
        if (item.passengers > 0) parts.push(`${item.passengers}×${item.pricePerPerson ? item.pricePerPerson.toFixed(2) : '7.50'}€`);
        parts.push(`${item.czkPassengers}×${item.czkPricePerPerson || 200}Kč`);
        passengerInfo = `${totalCount} ľudí (${parts.join(' + ')})`;
      } else if (item.pricePerPerson) {
        passengerInfo = `${item.passengers} ľudí (${item.pricePerPerson.toFixed(2)} €/os.)`;
      }

      let fuelInfo = '';
      if (item.fuelConsumption !== undefined && item.fuelConsumption > 0) {
        const liters = item.fuelConsumedLiters !== undefined
          ? item.fuelConsumedLiters
          : parseFloat(((item.distanceKm || 150) * item.fuelConsumption / 100).toFixed(2));
        fuelInfo = `<span>⛽ ${item.fuelConsumption.toFixed(1)} l/100km (${liters.toFixed(2)} l)</span>`;
      }

      let cashInfo = '';
      const cashVal = item.cashAmount !== undefined
        ? (item.cashAmount || 0)
        : (item.hasCashPayment ? fare : 0);
      if (cashVal > 0 || item.hasCashPayment) {
        cashInfo = `<span style="color: #34D399; font-weight: 600;">💵 ${cashVal.toFixed(2)} € v hotovosti</span>`;
      }

      let czkInfo = '';
      if (item.hasCzkPayment || (item.czkAmount && item.czkAmount > 0)) {
        const czkVal = item.czkAmount !== undefined ? item.czkAmount : ((item.czkPassengers || 1) * (item.czkPricePerPerson || 200));
        const rate = item.czkRate || 25.00;
        const czkEurVal = item.czkEurAmount !== undefined ? item.czkEurAmount : parseFloat((czkVal / rate).toFixed(2));
        czkInfo = `<span style="color: #FBBF24; font-weight: 600;">💱 ${czkVal} CZK (${czkEurVal.toFixed(2)} €)</span>`;
      }

      // Platby pasažierov na účet (Fajky)
      let paymentsHtml = '';
      const pList = getTripPassengerList(item);
      if (pList.length > 0) {
        const paidArr = Array.isArray(item.paidPassengers) ? item.paidPassengers : [];
        const paidCount = pList.filter(p => !!paidArr[p.index]).length;
        const paidSum = pList.filter(p => !!paidArr[p.index]).reduce((acc, p) => acc + p.price, 0);
        const totalSum = pList.reduce((acc, p) => acc + p.price, 0);
        const allPaid = paidCount === pList.length && pList.length > 0;

        const chipsHtml = pList.map(p => {
          const isPaid = !!paidArr[p.index];
          return `
            <button type="button" 
                    class="passenger-pay-chip ${isPaid ? 'is-paid' : ''}" 
                    onclick="window.appTogglePassengerPaid(${item.id}, '${item.docId || ''}', ${p.index})"
                    title="${isPaid ? 'Zaplatené na účet (klikni pre zrušenie)' : 'Klikni na fajku pre označenie že poslal peniaze na účet'}">
              <span class="pay-check-box">${isPaid ? '✓' : ''}</span>
              <span class="pay-passenger-name">${p.label}</span>
              <span class="pay-passenger-amount">${p.price.toFixed(2)} €</span>
            </button>
          `;
        }).join('');

        paymentsHtml = `
          <div class="trip-payments-section">
            <div class="trip-payments-header">
              <span class="trip-payments-title">
                <span>💳</span> Poslané na účet:
              </span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="trip-payments-summary ${allPaid ? 'all-paid' : ''}">
                  ${allPaid ? `✅ Všetci zaplatili (${paidSum.toFixed(2)} €)` : `⏳ ${paidCount}/${pList.length} (${paidSum.toFixed(2)} € / ${totalSum.toFixed(2)} €)`}
                </span>
                <button type="button" class="btn-toggle-all-paid" onclick="window.appToggleAllPassengersPaid(${item.id}, '${item.docId || ''}')" title="Označiť všetkých / zrušiť">
                  ${allPaid ? 'Zrušiť' : '✓ Všetci'}
                </button>
              </div>
            </div>
            <div class="trip-payments-chips">
              ${chipsHtml}
            </div>
          </div>
        `;
      }

      return `
        <div class="trip-item">
          <div class="trip-main-row">
            <div class="trip-left">
              <div class="trip-route">
                <span class="history-badge trip">🚗 Jazda</span> ${item.routeLabel}
              </div>
              <div class="trip-meta">
                <span>📅 ${formatDate(item.date)}</span>
                <span>🛣️ ${item.distanceKm} km</span>
                <span>👥 ${passengerInfo}</span>
                ${fuelInfo}
                ${cashInfo}
                ${czkInfo}
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
          ${paymentsHtml}
        </div>
      `;
    } else {
      return `
        <div class="trip-item">
          <div class="trip-main-row">
            <div class="trip-left">
              <div class="trip-route">
                <span class="history-badge fuel">⛽ Tankovanie</span> ${item.station}
              </div>
              <div class="trip-meta">
                <span>📅 ${formatDate(item.date)}</span>
                ${item.liters > 0 ? `<span>💧 ${item.liters.toFixed(1)} l</span>` : ''}
                ${item.pricePerL > 0 ? `<span>💶 ${item.pricePerL.toFixed(3)} €/l</span>` : ''}
                ${item.odometer ? `<span>📍 ${item.odometer} km</span>` : ''}
                ${item.paidFromAccount ? `<span>💳 Z účtu</span>` : ''}
                ${item.receiptImage ? `<button type="button" class="receipt-view-btn" onclick="window.appViewReceipt(${item.id}, '${item.docId || ''}')">🧾 Bloček</button>` : ''}
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
  let totalTripsLiters = 0;
  let tripsWithFuel = 0;
  let sumTripConsumption = 0;
  let totalCzk = 0;
  let totalCzkEur = 0;

  trips.forEach(t => {
    totalIncome += (t.totalFare || t.netProfit || 0);
    totalKm += t.distanceKm || 0;
    totalPassengers += (t.totalPassengers || t.passengers || 0);
    if (t.fuelConsumedLiters !== undefined && t.fuelConsumedLiters > 0) {
      totalTripsLiters += t.fuelConsumedLiters;
    } else if (t.fuelConsumption && t.fuelConsumption > 0) {
      totalTripsLiters += ((t.distanceKm || 150) * t.fuelConsumption) / 100;
    }
    if (t.fuelConsumption && t.fuelConsumption > 0) {
      sumTripConsumption += t.fuelConsumption;
      tripsWithFuel++;
    }
    if (t.hasCzkPayment || (t.czkAmount && t.czkAmount > 0)) {
      const czkVal = parseFloat(t.czkAmount) || 0;
      totalCzk += czkVal;
      const rate = parseFloat(t.czkRate) || 25.00;
      totalCzkEur += (t.czkEurAmount !== undefined ? parseFloat(t.czkEurAmount) : (czkVal / rate));
    }
  });

  const avgTripConsumption = tripsWithFuel > 0 ? (sumTripConsumption / tripsWithFuel) : 0;

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
  const elTotalTripsLiters = document.getElementById('stat-total-trips-liters');
  const elAvgTripConsumption = document.getElementById('stat-avg-trip-consumption');

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
  if (elTotalTripsLiters) elTotalTripsLiters.textContent = `${totalTripsLiters.toFixed(1)} l`;
  if (elAvgTripConsumption) elAvgTripConsumption.textContent = `${avgTripConsumption.toFixed(1)} l/100km`;

  const elTotalCzk = document.getElementById('stat-total-czk');
  const elTotalCzkEur = document.getElementById('stat-total-czk-eur');
  if (elTotalCzk) {
    elTotalCzk.textContent = `${Math.round(totalCzk).toLocaleString('sk-SK')} CZK`;
  }
  if (elTotalCzkEur) {
    elTotalCzkEur.textContent = `≈ ${totalCzkEur.toFixed(2)} €`;
  }

  const pendingTransfer = getPendingTransferAmount();
  const elPendingTransfer = document.getElementById('stat-pending-transfer');
  const elQuickPendingTransfer = document.getElementById('quick-pending-transfer');
  const elTransferLastInfo = document.getElementById('transfer-last-info');

  if (elPendingTransfer) {
    elPendingTransfer.textContent = `${pendingTransfer.toFixed(2)} €`;
  }
  if (elQuickPendingTransfer) {
    elQuickPendingTransfer.textContent = `${pendingTransfer.toFixed(2)} €`;
  }
  if (elTransferLastInfo) {
    if (state.transfers && state.transfers.length > 0) {
      const last = state.transfers[0];
      const d = new Date(last.date);
      const dateStr = !isNaN(d.getTime())
        ? `${d.toLocaleDateString('sk-SK')} ${d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}`
        : formatDate(last.date);
      elTransferLastInfo.innerHTML = `Posledný prevod: <b style="color:var(--text-primary);">${(last.amount || 0).toFixed(2)} €</b> (${dateStr})`;
    } else {
      elTransferLastInfo.textContent = 'Zatiaľ žiadny zaznamenaný prevod.';
    }
  }
}

function exportData() {
  const data = {
    mode: state.isCloudMode ? 'cloud' : 'local',
    username: state.currentUser,
    trips: state.trips || [],
    refuels: state.refuels || [],
    transfers: state.transfers || [],
    exportedAt: new Date().toISOString()
  };

  if (data.trips.length === 0 && data.refuels.length === 0 && data.transfers.length === 0) {
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
      const transfersToImport = imported.transfers || [];

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
        for (const tr of transfersToImport) {
          delete tr.docId;
          await addDoc(collection(state.firebaseDb, 'users', state.firebaseUser.uid, 'transfers'), tr);
        }
        showToast('☁️ Dáta úspešne naimportované do Cloudu!');
      } else {
        // Local mode
        saveLocalStoredTrips(tripsToImport);
        saveLocalStoredRefuels(refuelsToImport);
        saveLocalStoredTransfers(transfersToImport);
        state.trips = tripsToImport;
        state.refuels = refuelsToImport;
        state.transfers = transfersToImport;
        renderFuelTab();
        renderHistory();
        renderStats();
        recalculateTrip();
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
window.appDeleteTrip = (...args) => { dismissActiveKeyboard(); return deleteTrip(...args); };
window.appDeleteRefuel = (...args) => { dismissActiveKeyboard(); return deleteRefuel(...args); };
window.appEditTrip = (...args) => { dismissActiveKeyboard(); return openEditTrip(...args); };
window.appEditRefuel = (...args) => { dismissActiveKeyboard(); return openEditRefuel(...args); };
window.appMarkTransferCompleted = (...args) => { dismissActiveKeyboard(); return markTransferCompleted(...args); };
window.appViewReceipt = (...args) => { dismissActiveKeyboard(); return openReceiptModal(...args); };
window.appTogglePassengerPaid = (...args) => { dismissActiveKeyboard(); return togglePassengerPaid(...args); };
window.appToggleAllPassengersPaid = (...args) => { dismissActiveKeyboard(); return toggleAllPassengersPaid(...args); };
