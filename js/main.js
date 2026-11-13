// Titik masuk: log masuk, penghalaan peranan, shell Portal Admin, router.
import { S, init, loadAll, signIn, signOut, resetPassword, setPassword, demoLogin, expirePackages, markRead, subscribeNotifications } from './data.js';
import { $, $$, esc, ic, ICONS, toast, app, UI, openModal, closeModal, run, friendlyError } from './ui.js';
import { VIEWS, ACTIONS, INPUTS } from './registry.js';
import { t, setLang, setI18nActive, langSwitch } from './i18n.js';
import { setTheme } from './theme.js';
import { startDomI18n } from './i18n-dom.js';
import { NAV, ALL_ITEMS, BOTTOM_NAV } from './admin/nav.js';
import { tasks, academy } from './admin/helpers.js';
import './admin/dashboard.js';
import './admin/students.js';
import './admin/schedule.js';
import './admin/finance.js';
import './admin/expenses.js';
import './admin/tournaments.js';
import './admin/team.js';
import './admin/system.js';
import './admin/setup.js';
import './admin/review.js';
import './admin/sessions.js';
import './admin/calendar.js';
import './admin/ops.js';
import './admin/announce.js';
import './admin/ops2.js';
import './admin/auto.js';

const root = () => $('#root');
const logoSvg = `<img src="assets/logo.png" alt="MBA" class="brand-img">`;

/* =====================================================================
   SKRIN LOG MASUK & MESEJ
   ===================================================================== */
function authCard(inner, sw = false) {
  root().innerHTML = `<div class="auth"><div class="auth-card">
    ${sw ? `<div style="display:flex;justify-content:flex-end;margin-bottom:10px">${langSwitch()}</div>` : ''}
    <div class="auth-brand"><div class="brand-mark">${logoSvg}</div><div><div class="brand-name" style="color:var(--brand)">MAXXIMA</div><div class="brand-sub" style="color:var(--muted)">Badminton Academy</div></div></div>
    ${inner}</div></div>`;
}

function showLogin(msg = '') {
  const demo = S.mode === 'demo';
  setI18nActive(true); app.relang = () => showLogin($('#authErr')?.textContent || '');
  authCard(`
    <h1>${t('Log Masuk')}</h1>
    <p class="muted" style="margin-bottom:18px">${demo ? t('Mod demo: pilih peranan untuk pratonton.') : t('Masuk dengan e-mel dan kata laluan anda.')}</p>
    ${demo ? `<div class="demo-note">Mod demo — data rekaan, tidak disimpan. Sambungkan Supabase dalam <code>js/config.js</code> untuk data sebenar.</div>
      <div class="stack">
        <button class="btn primary" style="height:44px" data-action="demo-login" data-id="admin">${ic('shield', 'sm')} ${t('Masuk sebagai Admin')}</button>
        <button class="btn" style="height:44px" data-action="demo-login" data-id="coach">${ic('award', 'sm')} ${t('Masuk sebagai Coach')}</button>
        <button class="btn" style="height:44px" data-action="demo-login" data-id="parent">${ic('users', 'sm')} ${t('Masuk sebagai Ibu Bapa')}</button>
      </div>` : `
    <form id="loginForm" class="stack" novalidate>
      <label class="f">${t('E-mel atau No. Telefon')}<input name="email" type="text" inputmode="email" autocomplete="username" required autofocus></label>
      <label class="f">${t('Kata laluan')}<input name="password" type="password" autocomplete="current-password" required></label>
      <div class="auth-err" id="authErr">${esc(msg)}</div>
      <button class="btn primary" style="height:44px" type="submit">${t('Log Masuk')}</button>
      <button class="btn ghost" type="button" data-action="forgot">${t('Lupa kata laluan?')}</button>
    </form>`}`, true);
  $('#loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target; if (!f.reportValidity()) return;
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = t('Sedang masuk…');
    try { await signIn(f.email.value.trim(), f.password.value); await enter(); }
    catch (err) { $('#authErr').textContent = friendlyError(err); btn.disabled = false; btn.textContent = t('Log Masuk'); }
  });
}

function showSetPassword() {
  setI18nActive(true); app.relang = showSetPassword;
  authCard(`
    <h1>${t('Tetapkan Kata Laluan')}</h1>
    <p class="muted" style="margin-bottom:18px">${t('Cipta kata laluan untuk akaun anda (sekurang-kurangnya 8 aksara).')}</p>
    <form id="pwForm" class="stack" novalidate>
      <label class="f">${t('Kata laluan baharu')}<input name="p1" type="password" minlength="8" autocomplete="new-password" required></label>
      <label class="f">${t('Ulang kata laluan')}<input name="p2" type="password" minlength="8" autocomplete="new-password" required></label>
      <div class="auth-err" id="authErr"></div>
      <button class="btn primary" style="height:44px" type="submit">${t('Simpan & Masuk')}</button>
    </form>`, true);
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    if (f.p1.value.length < 8) return ($('#authErr').textContent = t('Kata laluan mesti sekurang-kurangnya 8 aksara.'));
    if (f.p1.value !== f.p2.value) return ($('#authErr').textContent = t('Kata laluan tidak sepadan.'));
    try { await setPassword(f.p1.value); await enter(); } catch (err) { $('#authErr').textContent = friendlyError(err); }
  });
}

function showMessage(title, text) {
  authCard(`<h1>${esc(title)}</h1><p class="muted" style="margin:6px 0 18px">${text}</p>
    <button class="btn" data-action="logout">${ic('logout', 'sm')} Log keluar</button>`);
}

function showPortalSoon(role) {
  const name = { coach: 'Portal Coach', parent: 'Portal Ibu Bapa & Pelajar' }[role] || 'Portal';
  const what = role === 'coach'
    ? 'jadual kelas harian, senarai semak kehadiran, rekod prestasi dan pelan rancangan kelas'
    : 'jadual latihan anak, status yuran, progres dan pengesahan kehadiran';
  authCard(`<h1>${name}</h1>
    <p class="muted" style="margin:6px 0 14px">Selamat datang, <b style="color:var(--ink)">${esc(S.profile.full_name || S.profile.email)}</b>. Akaun anda berfungsi dan peranan telah disahkan.</p>
    <div class="demo-note">${name} akan disiapkan pada fasa seterusnya — ia akan memaparkan ${what}. Pangkalan data dan peraturan keselamatan untuk peranan ini sudah sedia.</div>
    <button class="btn" data-action="logout">${ic('logout', 'sm')} Log keluar</button>`);
}

/* =====================================================================
   MASUK KE PORTAL
   ===================================================================== */
async function enter() {
  const p = S.profile;
  if (!p) return showMessage('Profil tidak dijumpai', 'Akaun anda sudah wujud tetapi belum mempunyai profil. Hubungi admin akademi.');
  if (!p.active) return showMessage('Akaun dinyahaktifkan', 'Sila hubungi admin akademi.');
  if (p.lang) setLang(p.lang);   // bahasa diingat pada akaun, bukan hanya peranti
  if (p.role === 'parent') { const pp = await import('./parent/portal.js'); return pp.enterParent(); }
  if (p.role === 'coach') { const cp = await import('./coach/portal.js'); return cp.enterCoach(); }
  if (p.role !== 'admin') return showPortalSoon(p.role);
  setI18nActive(true); startDomI18n(); app.relang = () => { renderShell(); route(); };   // Portal Admin: teks diterjemah oleh i18n-dom.js
  renderShell();
  $('#view').innerHTML = `<div class="boot">Memuatkan data akademi…</div>`;
  try { await loadAll(); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>Gagal memuatkan data.</b><p class="muted">${esc(friendlyError(e))}</p><p class="muted" style="margin-top:6px">Pastikan schema.sql telah dijalankan dan config.js betul.</p></div>`; return; }
  try { await expirePackages(); } catch (e) { console.warn('expire_packages', e); }
  subscribeNotifications(() => { renderNav(parse().id); });
  window.addEventListener('hashchange', route);
  route();
}

/* =====================================================================
   SHELL ADMIN + ROUTER
   ===================================================================== */
function renderShell() {
  root().innerHTML = `
  <div class="app">
    <aside class="sidebar" id="sidebar" aria-label="Menu utama">
      <div class="brand"><div class="brand-mark">${logoSvg}</div><div><div class="brand-name">MAXXIMA</div><div class="brand-sub">Badminton Academy</div></div></div>
      <nav class="nav" id="nav"></nav>
      <div class="side-foot">
        <div class="avatar lime">${esc((S.profile.full_name || 'A').slice(0, 2).toUpperCase())}</div>
        <div style="min-width:0;flex:1"><div class="who">${esc(S.profile.full_name || 'Admin')}</div><div class="role">Pentadbir Sistem</div></div>
        <button class="icon-btn dark" data-action="logout" title="Log keluar" aria-label="Log keluar">${ic('logout', 'sm')}</button>
      </div>
    </aside>
    <div class="overlay" data-action="close-nav"></div>
    <div class="main-col">
      <header class="topbar">
        <button class="menu-btn" data-action="open-nav" aria-label="Buka menu">${ic('menu')}</button>
        <div class="crumb"><div class="crumb-top" id="crumbTop">Portal Admin</div><div class="crumb-title" id="crumbTitle">Dashboard</div></div>
        ${S.mode === 'demo' ? '<span class="demo-pill">MOD DEMO</span>' : ''}
        <label class="top-search">${ic('search', 'sm')}<input id="globalSearch" placeholder="Cari pelajar… (Enter)"></label>
        <button class="icon-btn" data-action="notifications" aria-label="Tugasan" id="bellBtn"></button>
      </header>
      <main id="view"></main>
    </div>
  </div>
  <nav class="bottomnav" id="bottomnav" aria-label="Navigasi bawah"></nav>`;
  $('#globalSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    UI.studentQ = e.target.value; e.target.value = '';
    if (parse().id === 'pelajar') render(); else location.hash = 'pelajar';
  });
}

const parse = () => {
  const [id, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  return { id: VIEWS[id] ? id : 'dashboard', param: rest.join('/') || null };
};

function renderNav(id) {
  $('#nav').innerHTML = NAV.map(g => `<div class="nav-group"><div class="nav-group-label">${g.group}</div>
    ${g.items.map(i => { const c = i.count ? i.count() : 0; return `<a href="#${i.id}" class="nav-link ${i.id === id ? 'active' : ''}">${ic(i.icon)}<span>${i.label}</span>${c ? `<span class="nav-count ${i.red ? 'red' : ''}">${c}</span>` : ''}</a>`; }).join('')}</div>`).join('');
  $('#bottomnav').innerHTML = BOTTOM_NAV.map(i => `<a href="#${i.id}" class="${i.id === id ? 'active' : ''}">${ic(i.icon)}${i.label}</a>`).join('') + `<button data-action="open-nav">${ic('menu')}Menu</button>`;
  $('#bellBtn').innerHTML = ic('bell') + (tasks().length || (S.t.notifications || []).some(n => !n.read_at) ? '<span class="dot"></span>' : '');
}

function render() {
  if (!$('#view') || !S.t.venues) return;
  const { id, param } = parse(), item = ALL_ITEMS.find(i => i.id === id);
  const act = document.activeElement, fid = act?.id, pos = act?.selectionStart;
  const sy = window.scrollY;
  try { $('#view').innerHTML = VIEWS[id](param); }
  catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>Ralat memaparkan halaman.</b><p class="muted">${esc(e.message)}</p></div>`; }
  $('#crumbTop').textContent = 'Portal Admin · ' + item.group;
  $('#crumbTitle').textContent = item.label;
  document.title = `${item.label} — Maxxima Admin`;
  renderNav(id);
  if (fid) { const n = document.getElementById(fid); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* bukan input teks */ } } }
  window.scrollTo(0, sy);
}
app.render = render;

function route() {
  document.body.classList.remove('nav-open'); closeModal(); render(); window.scrollTo(0, 0);
}

/* =====================================================================
   TINDAKAN GLOBAL
   ===================================================================== */
Object.assign(ACTIONS, {
  'open-nav': () => document.body.classList.add('nav-open'),
  'close-nav': () => document.body.classList.remove('nav-open'),
  'close-modal': closeModal,
  'logout': () => signOut(),
  'set-lang': id => {
    setLang(id); (app.relang || app.render)();
    if (S.profile && S.mode === 'supabase' && S.profile.lang !== id) { S.profile.lang = id; S.client.from('profiles').update({ lang: id }).eq('id', S.profile.id).then(({ error }) => error && console.warn('lang', error)); }
  },
  'set-theme': id => { setTheme(id); (app.relang || app.render)(); },
  'demo-login': role => { demoLogin(role); enter(); },
  'forgot': () => openModal({
    title: t('Set Semula Kata Laluan'), submit: t('Hantar Pautan'),
    body: `<p class="muted" style="margin-bottom:12px">${t('Kami akan menghantar pautan untuk menetapkan kata laluan baharu.')}</p><label class="f">${t('E-mel')}<input name="email" type="email" required></label>`,
    onSubmit: async d => { await resetPassword(d.email.trim()); toast(t('Pautan dihantar. Semak e-mel anda.')); },
  }),
  'notifications': async () => {
    const ts = tasks(), ns = (S.t.notifications || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 30);
    const unread = ns.filter(n => !n.read_at).map(n => n.id);
    openModal({ title: 'Notifikasi', cancel: 'Tutup', body: `
      ${ns.length ? `<h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 6px">Terkini</h4><ul class="list" style="margin:0 -20px 16px">${ns.map(n => `<li class="list-item" style="padding:10px 20px;${n.read_at ? '' : 'background:var(--accent-soft,#f4fbe6)'}"><div class="li-main"><div class="li-title" style="font-size:13px">${esc(n.title)}</div><div class="li-sub">${esc(n.body || '')}</div></div>${n.link ? `<a class="btn sm" href="#${esc(n.link)}" data-action="close-modal">Lihat</a>` : ''}</li>`).join('')}</ul>` : ''}
      <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 6px">Perlu tindakan</h4>
      ${ts.length ? `<ul class="list" style="margin:0 -20px">${ts.map(t => `<li class="list-item" style="padding:10px 20px"><div class="kpi-ico ${t.tone}" style="display:grid">${ic(t.icon, 'sm')}</div><div class="li-main" style="font-size:13px">${esc(t.text)}</div><a class="btn sm" href="#${t.href}" data-action="close-modal">Lihat</a></li>`).join('')}</ul>` : '<div class="muted" style="font-size:13px">Tiada tugasan tertunggak. 🎉</div>'}` });
    if (unread.length) { await markRead(unread); renderNav(parse().id); }
  },
});

function bindGlobalEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]'); if (!el) return;
    const fn = ACTIONS[el.dataset.action]; if (!fn) return;
    if (el.tagName !== 'A' || el.getAttribute('href') === '#') e.preventDefault();
    run(() => fn(el.dataset.id, el, e));
  });
  document.addEventListener('input', e => { const el = e.target.closest('[data-on-input]'); if (el) INPUTS[el.dataset.onInput]?.(el.value, el); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-on-change]'); if (el) run(() => INPUTS[el.dataset.onChange]?.(el.value, el)); });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); document.body.classList.remove('nav-open'); } });
}

/* =====================================================================
   BOOT
   ===================================================================== */
async function boot() {
  bindGlobalEvents();
  try { await init(); }
  catch (e) { console.error(e); return authCard(`<h1>Tidak dapat bermula</h1><p class="muted">${esc(friendlyError(e))}</p>`); }
  if (S.mode === 'supabase' && S.session && S.needsPassword) return showSetPassword();
  if (!(S.session || S.profile)) return showLogin();
  await enter();
}
boot();

/* PWA: pasang sebagai app (Android/desktop) + kerja luar talian asas */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__installPrompt = e; app.render?.(); });
ACTIONS['pwa-install'] = async () => { const p = window.__installPrompt; if (!p) return toast('Gunakan menu pelayar: "Tambah ke skrin utama" / "Install app".'); p.prompt(); await p.userChoice.catch(() => {}); window.__installPrompt = null; app.render?.(); };
