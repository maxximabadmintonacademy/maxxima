// Portal Coach: sesi hari ini & minggu ini (termasuk kategori umur yang diberi), tanda kehadiran, pelajar, akaun.
import { ACTIONS } from '../registry.js';
import { S, loadCoach, markRead, subscribeNotifications, setPassword, insert } from '../data.js';
import { $, esc, ic, F, avatar, UI, app, toast, openModal, fmtDate, fmtShort, hm, todayISO, addDays, parseISO, DAYS, LABEL, friendlyError } from '../ui.js';
import { T, byId, venueName, progName, attRate } from '../admin/helpers.js';
import { courtLbl, calItems, sessionAlerts, sTime, sCourt, groupsOf, rosterOf, ageOn, ageCat, isPersonal, ensureSession, openSession, langName } from '../admin/sessions.js';
import { setI18nActive } from '../i18n.js';
import { startDomI18n } from '../i18n-dom.js';
import { langSwitch } from '../i18n.js';
import { themeSwitch } from '../theme.js';

const CV = {};
const NAV = [['hari', 'Hari Ini', 'home'], ['minggu', 'Minggu Ini', 'calendar'], ['pelajar', 'Pelajar', 'users'], ['akaun', 'Akaun', 'user']];
const meStaff = () => T('staff').find(s => s.profile_id === S.profile.id) || (S.mode === 'demo' ? (T('staff').find(s => /alvi/i.test(s.full_name)) || T('staff')[0]) : null);
const mine = (from, to) => { const st = meStaff(); return st ? calItems(from, to, { mine: st.id }) : []; };
const unread = () => T('notifications').filter(n => !n.read_at && n.user_id === S.profile.id);

function renderShell() {
  $('#root').innerHTML = `
  <div class="app">
    <aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark"><img src="assets/logo.png" alt="MBA" class="brand-img"></div><div><div class="brand-name">MAXXIMA</div><div class="brand-sub">Portal Coach</div></div></div>
      <nav class="nav" id="nav"></nav>
      <div class="side-foot"><div class="avatar lime">${esc((S.profile.full_name || 'C').slice(0, 2).toUpperCase())}</div><div style="min-width:0;flex:1"><div class="who">${esc(S.profile.full_name || S.profile.email)}</div><div class="role">Coach</div></div>
      <button class="icon-btn dark" data-action="logout" title="Log keluar">${ic('logout', 'sm')}</button></div></aside>
    <div class="overlay" data-action="close-nav"></div>
    <div class="main-col"><header class="topbar"><button class="menu-btn" data-action="open-nav">${ic('menu')}</button>
      <div class="crumb"><div class="crumb-top">Maxxima Badminton Academy</div><div class="crumb-title" id="crumbTitle"></div></div>
      ${S.mode === 'demo' ? '<span class="demo-pill">DEMO</span>' : ''}<button class="icon-btn" data-action="c-notif" id="bellBtn" aria-label="Notifikasi"></button></header>
      <main id="view"></main></div></div>
  <nav class="bottomnav" id="bottomnav"></nav>`;
}
const parse = () => { const id = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/')[0]; return CV[id] ? id : 'hari'; };
function render() {
  if (!$('#view')) return;
  const id = parse(), sy = window.scrollY;
  try { $('#view').innerHTML = CV[id](); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>Ralat memaparkan halaman.</b><p class="muted">${esc(e.message)}</p></div>`; }
  const item = NAV.find(n => n[0] === id);
  $('#crumbTitle').textContent = item[1]; document.title = `${item[1]} — Maxxima Coach`;
  $('#nav').innerHTML = `<div class="nav-group">${NAV.map(([k, l, i]) => `<a href="#${k}" class="nav-link ${k === id ? 'active' : ''}">${ic(i)}<span>${l}</span></a>`).join('')}</div>`;
  $('#bottomnav').innerHTML = NAV.map(([k, l, i]) => `<a href="#${k}" class="${k === id ? 'active' : ''}">${ic(i)}${l}</a>`).join('');
  $('#bellBtn').innerHTML = ic('bell') + (unread().length ? '<span class="dot"></span>' : '');
  window.scrollTo(0, sy);
}

export async function enterCoach() {
  setI18nActive(true); startDomI18n();
  renderShell(); app.render = render; app.relang = () => { renderShell(); render(); };
  $('#view').innerHTML = `<div class="boot">Memuatkan jadual anda…</div>`;
  try { await loadCoach(); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>Gagal memuatkan data.</b><p class="muted">${esc(friendlyError(e))}</p></div>`; return; }
  subscribeNotifications(() => render());
  window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); render(); window.scrollTo(0, 0); });
  render();
}

const head = (title, sub) => `<div class="page-head"><div><h1>${title}</h1><p>${sub || ''}</p></div></div>`;
const st = () => meStaff();
const myCat = s => { const me = st(); return s ? groupsOf(s.id).filter(g => g.coach_id === me?.id).map(g => g.category) : []; };
const card = ({ s, c, date }, showDate) => {
  const [a, b] = sTime(s, c), cats = myCat(s), n = s ? rosterOf(s, c).length : T('class_enrolments').filter(e => e.class_id === c.id).length;
  const done = s ? T('attendance').filter(x => x.session_id === s.id && x.status !== 'booked').length : 0;
  const court = cats.length ? groupsOf(s.id).filter(g => cats.includes(g.category)).map(g => g.court).filter(Boolean).join(', ') : sCourt(s, c);
  return `<button class="slot ${s?.status === 'cancelled' ? 'cancel' : ''}" data-action="c-open" data-id="${s ? s.id : c.id + '|' + date}" style="margin-bottom:8px">
    <b>${showDate ? DAYS[parseISO(date).getDay()] + ', ' + fmtShort(date) + ' · ' : ''}${a}–${b} · ${esc(progName(c.programme_id))}</b>
    <div class="meta">${esc(venueName(c.venue_id))}${court ? ' · ' + courtLbl(court) : ''}${cats.length ? ' · Kategori anda: <b>' + cats.map(esc).join(', ') + '</b>' : ''}</div>
    <div class="meta">${isPersonal(c) ? esc(rosterOf(s, c).map(x => x.full_name).join(', ')) : n + ' pelajar'}${s ? ` · ${done}/${n} direkod` : ''}${s?.status === 'held' ? ' · selesai' : ''}${s?.status === 'cancelled' ? ' · dibatalkan' : ''}</div>
  </button>`;
};

CV.hari = () => {
  const me = st(); if (!me) return head('Portal Coach', '') + `<div class="card card-pad">Akaun anda belum dipautkan dengan profil staf. Hubungi admin.</div>`;
  const today = todayISO(), list = mine(today, today), past = mine(addDays(today, -7), addDays(today, -1)).filter(x => x.s && x.s.status === 'scheduled');
  return `${head(`Hai, ${esc(me.full_name.split(' ')[0])}`, `${DAYS[parseISO(today).getDay()]}, ${fmtDate(today)} · ${list.length} sesi hari ini`)}
  ${list.map(x => card(x)).join('') || '<div class="card empty mb">Tiada sesi hari ini.</div>'}
  ${past.length ? `<h3 style="font-size:14px;margin:18px 0 8px">Belum ditanda (7 hari lepas)</h3>${past.map(x => card(x, true)).join('')}` : ''}`;
};
CV.minggu = () => {
  const today = todayISO(), list = mine(today, addDays(today, 7)), days = [...new Set(list.map(x => x.date))];
  return `${head('Minggu Ini', '7 hari akan datang')}${days.map(d => `<div class="daylist"><div class="dh">${DAYS[parseISO(d).getDay()]}, ${fmtDate(d)}</div>${list.filter(x => x.date === d).map(x => card(x)).join('')}</div>`).join('') || '<div class="card empty">Tiada sesi.</div>'}`;
};
CV.pelajar = () => {
  const today = todayISO(), ids = new Set(); mine(addDays(today, -60), addDays(today, 14)).forEach(({ s, c }) => rosterOf(s, c).forEach(x => ids.add(x.id)));
  T('class_enrolments').filter(e => T('classes').some(c => c.id === e.class_id && c.coach_id === st()?.id)).forEach(e => ids.add(e.student_id));
  const list = [...ids].map(id => byId('students', id)).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return `${head('Pelajar', `${list.length} pelajar dalam sesi anda`)}<div class="card"><ul class="list">${list.map(x => { const r = attRate(x.id); return `<li class="list-item">${avatar(x.full_name)}<div class="li-main"><div class="li-title">${esc(x.full_name)}</div>
    <div class="li-sub">${x.birth_date ? ageOn(x.birth_date) + ' thn · ' + esc(ageCat(x) || '') + ' · ' : ''}${esc(progName(x.programme_id))}</div></div>${r != null ? `<b class="num" style="color:${r < 75 ? 'var(--bad)' : 'var(--ok)'}">${r}%</b>` : ''}</li>`; }).join('') || '<li class="empty">Belum ada pelajar.</li>'}</ul></div>`;
};
CV.akaun = () => { const me = st(); return `${head('Akaun', '')}<div class="card card-pad mb"><div class="cell-person">${avatar(S.profile.full_name || S.profile.email)}<div><b>${esc(S.profile.full_name || '')}</b><span>${esc(S.profile.email || '')}</span></div></div>
  ${me ? `<p class="muted" style="margin-top:10px;font-size:13px">Bahasa: ${(me.languages || []).map(langName).join(', ') || '—'}${me.qualifications ? '<br>Kelayakan: ' + esc(me.qualifications) : ''}</p>` : ''}
  <div class="actions" style="margin-top:14px"><button class="btn" data-action="c-pw">Tukar kata laluan</button><button class="btn danger-o" data-action="logout">${ic('logout', 'sm')} Log keluar</button></div></div>
  <div class="card card-pad"><b>Tetapan paparan</b>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px"><span>Bahasa</span>${langSwitch()}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px"><span>Tema</span>${themeSwitch()}</div></div>`; };

Object.assign(ACTIONS, {
  'c-open': async key => {
    if (!key.includes('|')) return openSession(key);
    const [cid, d] = key.split('|');
    try { const s = await ensureSession(cid, d); openSession(s.id); render(); }
    catch (e) { toast('Sesi belum dijana oleh admin — hubungi admin.', true); }
  },
  'c-pw': () => openModal({ title: 'Tukar Kata Laluan', submit: 'Simpan', body: `<div class="form-grid">${F('Kata laluan baharu (min. 8 aksara)', 'p1', { type: 'password', req: true, full: true })}${F('Ulang kata laluan', 'p2', { type: 'password', req: true, full: true })}</div>`,
    onSubmit: async d => { if (d.p1.length < 8) throw new Error('Kata laluan mesti sekurang-kurangnya 8 aksara.'); if (d.p1 !== d.p2) throw new Error('Kata laluan tidak sepadan.'); if (S.mode === 'demo') return toast('Mod demo: tiada perubahan.'); await setPassword(d.p1); toast('Kata laluan dikemas kini'); } }),
  'c-notif': async () => {
    const ns = T('notifications').filter(n => n.user_id === S.profile.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 30), ids = ns.filter(n => !n.read_at).map(n => n.id);
    openModal({ title: 'Notifikasi', cancel: 'Tutup', body: ns.length ? `<ul class="list" style="margin:0 -20px">${ns.map(n => `<li class="list-item" style="padding:10px 20px"><div class="li-main"><div class="li-title">${esc(n.title)}</div><div class="li-sub">${esc(n.body || '')}</div></div></li>`).join('')}</ul>` : '<div class="empty">Tiada notifikasi.</div>' });
    if (ids.length) { try { await markRead(ids); render(); } catch (e) { console.warn(e); } }
  },
});
