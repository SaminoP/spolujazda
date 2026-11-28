// Účet (prihlasovacia obrazovka), cloud, pravidelné jazdy a push notifikácie – UI v záložke Prehľad
import * as sync from './sync.js';
import * as store from './store.js';
import * as push from './push.js';
import { cfg, saveCfg, DAYS } from './auto.js';
import { $ } from './util.js';
import { toast } from './ui.js';

const LOCAL_FLAG = 'pnbr.local';

// ───────── prihlasovacia obrazovka ─────────
let mode = 'login';
function setMode(m) {
  mode = m;
  $('#authTabLogin').classList.toggle('on', m === 'login');
  $('#authTabReg').classList.toggle('on', m === 'register');
  $('#authPass2Wrap').classList.toggle('open', m === 'register');
  $('#authPass2Wrap').inert = m !== 'register';
  $('#authGo').textContent = m === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet';
  $('#authAlert').hidden = true;
}
const showAlert = (t, ok = false) => { const a = $('#authAlert'); a.textContent = t; a.classList.toggle('ok', ok); a.hidden = false; };

export function showAuth() { setMode('login'); $('#authScreen').classList.add('in'); document.body.classList.add('lock'); }
export function hideAuth() { $('#authScreen').classList.remove('in'); document.body.classList.remove('lock'); }

async function submitAuth() {
  const u = $('#authUser').value.trim(), p = $('#authPass').value;
  if (u.length < 3) return showAlert('Meno musí mať aspoň 3 znaky.');
  if (p.length < 3) return showAlert('Heslo musí mať aspoň 3 znaky.');
  if (mode === 'register' && p !== $('#authPass2').value) return showAlert('Heslá sa nezhodujú.');
  const btn = $('#authGo');
  btn.disabled = true;
  showAlert(mode === 'login' ? 'Prihlasujem…' : 'Vytváram účet…', true);
  try {
    if (mode === 'login') await sync.signIn(u, p); else await sync.register(u, p);
    try { localStorage.removeItem(LOCAL_FLAG); } catch { /* ignore */ }
    $('#authPass').value = ''; $('#authPass2').value = '';
    hideAuth();
    toast('Prihlásený ✓');
  } catch (e) { showAlert(e.message); }
  btn.disabled = false;
}

// ───────── karta Účet a cloud ─────────
function paintAccount() {
  const s = sync.getStatus();
  $('#acctUser').textContent = s.user ? `👤 ${s.user}` : '👤 Nie si prihlásený';
  $('#acctStatus').textContent = s.text;
  $('#acctStatus').classList.toggle('ok', !!s.user);
  $('#acctLogin').hidden = !!s.user;
  $('#acctLogout').hidden = !s.user;
  $('#acctMigrate').hidden = !s.user;
}

// ───────── pravidelné jazdy + push ─────────
async function paintPush() {
  const st = await push.state();
  $('#pushStatus').textContent = st.text;
  $('#pushStatus').classList.toggle('ok', st.kind === 'on');
  $('#pushEnable').hidden = !['off'].includes(st.kind);
  $('#pushTest').hidden = st.kind !== 'on';
}

function paintAuto() {
  const c = cfg();
  $('#autoOn').checked = !!c.enabled;
  if (document.activeElement !== $('#autoTime')) $('#autoTime').value = c.time;
  $('#autoBody').classList.toggle('open', !!c.enabled);
  $('#autoBody').inert = !c.enabled;
  $('#autoRules').innerHTML = c.rules.map((r, i) => `
    <div class="rule">
      <select class="field" data-r="${i}" data-f="dow" aria-label="Deň">${DAYS.map((d, k) => `<option value="${k}" ${k === r.dow ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <select class="field" data-r="${i}" data-f="dir" aria-label="Smer"><option value="PB" ${r.dir === 'PB' ? 'selected' : ''}>PN ➔ Brno</option><option value="BP" ${r.dir === 'BP' ? 'selected' : ''}>Brno ➔ PN</option></select>
      <button type="button" class="rm" data-rm="${i}" aria-label="Odstrániť pravidlo">✕</button>
    </div>`).join('') || '<p class="muted">Žiadne pravidlo – pridaj aspoň jedno.</p>';
}

export function initAccount() {
  // prihlásenie
  $('#authTabLogin').addEventListener('click', () => setMode('login'));
  $('#authTabReg').addEventListener('click', () => setMode('register'));
  $('#authGo').addEventListener('click', submitAuth);
  $('#authScreen').addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
  $('#authSkip').addEventListener('click', () => { try { localStorage.setItem(LOCAL_FLAG, '1'); } catch { /* ignore */ } hideAuth(); });

  // účet
  $('#acctLogin').addEventListener('click', showAuth);
  $('#acctLogout').addEventListener('click', async () => { await sync.signOut(); toast('Odhlásený'); });
  $('#acctMigrate').addEventListener('click', async () => {
    try { const n = await sync.migrateLegacy(true); toast(n ? `Prevedených ${n} záznamov zo starej aplikácie` : 'Nič nové na prevod'); }
    catch (e) { toast(e.message, 'err'); }
  });
  sync.onChange(() => { paintAccount(); paintPush(); });

  // pravidelné jazdy
  $('#autoOn').addEventListener('change', e => {
    saveCfg({ enabled: e.target.checked, since: Date.now() });
    paintAuto();
    if (e.target.checked && !sync.getUser()) toast('Prihlás sa do cloudu, aby ti notifikácie chodili aj pri zatvorenej aplikácii', 'err');
  });
  $('#autoTime').addEventListener('change', e => { if (e.target.value) saveCfg({ time: e.target.value, since: Date.now() }); });
  $('#autoRules').addEventListener('change', e => {
    const el = e.target.closest('[data-r]');
    if (!el) return;
    const rules = cfg().rules.map(r => ({ ...r }));
    rules[+el.dataset.r][el.dataset.f] = el.dataset.f === 'dow' ? +el.value : el.value;
    saveCfg({ rules, since: Date.now() });
  });
  $('#autoRules').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    saveCfg({ rules: cfg().rules.filter((_, i) => i !== +b.dataset.rm) });
    paintAuto();
  });
  $('#autoAdd').addEventListener('click', () => { saveCfg({ rules: [...cfg().rules, { dow: 5, dir: 'BP' }], since: Date.now() }); paintAuto(); });

  // push
  $('#pushEnable').addEventListener('click', async () => {
    try { await push.enable(); toast('Notifikácie zapnuté ✓'); } catch (e) { toast(e.message, 'err'); }
    paintPush();
  });
  $('#pushTest').addEventListener('click', async () => {
    const b = $('#pushTest');
    b.disabled = true;
    try {
      const r = await push.sendTest();
      toast(r.sent ? `Skúšobná notifikácia odoslaná (${r.sent}×) – mala by o chvíľu prísť` : 'Server nenašiel žiadne zariadenie – zapni notifikácie znova', r.sent ? 'ok' : 'err');
    } catch (e) { toast(e.message, 'err'); }
    b.disabled = false;
  });

  store.subscribe(paintAuto);
  paintAccount(); paintAuto(); paintPush();
}

/** Po zistení stavu prihlásenia: ak nikto nie je prihlásený a používateľ si nezvolil lokálny režim, ukáž prihlásenie. */
export async function gateAuth() {
  await sync.init();
  let local = false;
  try { local = !!localStorage.getItem(LOCAL_FLAG); } catch { /* ignore */ }
  if (!sync.getUser() && !local && !sync.getStatus().offlineError) showAuth();
}
