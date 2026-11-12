// Portal Ibu Bapa & Pelajar: ringkasan anak, jadual & tempahan, yuran (bayar + bukti + resit), progres.
// Semua teks melalui t() supaya boleh dipaparkan dalam BM / English / 中文.
import { ACTIONS, INPUTS } from '../registry.js';
import { annCard, visibleAnns } from '../admin/announce.js';
import { offerCard } from '../admin/ops2.js';
import { mediaGrid, publicUrl } from '../media.js';
import { S, loadParent, insert, update, remove, refresh, markRead, subscribeNotifications, setPassword, rpc } from '../data.js';
import { $, esc, ic, F, RM, badge, avatar, UI, app, toast, openModal, closeModal, confirmModal, fmtDate, fmtShort, hm, todayISO, addDays, DAYS, LABEL, friendlyError } from '../ui.js';
import { T, byId, venueName, progName, staffName, invStatus, paidOf, creditOf, pkgRemaining } from '../admin/helpers.js';
import { openReceipt } from '../receipt.js';
import { openInvoice, openCreditNote } from '../invoice.js';
import { t, langSwitch, setI18nActive } from '../i18n.js';
import { themeSwitch } from '../theme.js';
import { tr } from '../i18n-dom.js';

const PV = {};
const NAV = [['utama', 'Utama', 'home'], ['jadual', 'Jadual', 'calendar'], ['tempah', 'Tempah', 'plus'], ['yuran', 'Yuran', 'wallet'], ['progres', 'Progres', 'trend'], ['akaun', 'Akaun', 'user']];
const me = () => S.profile.id;
const kids = () => T('students').filter(s => s.guardian_id === me()).sort((a, b) => a.full_name.localeCompare(b.full_name));
const kidSet = () => new Set(kids().map(k => k.id));
const myInvoices = () => { const ks = kidSet(); return T('invoices').filter(i => ks.has(i.student_id)); };
const kidName = id => byId('students', id)?.full_name || '';
const pendingOf = inv => T('payments').filter(p => p.invoice_id === inv.id && p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
const balanceOf = inv => Math.max(Number(inv.amount) - creditOf(inv) - paidOf(inv), 0);
const firstLine = s => String(s || '').split('\n')[0];
const activePkgs = id => T('student_packages').filter(p => p.student_id === id && p.status === 'active');
const flexPkg = id => activePkgs(id).find(p => p.schedule_mode === 'flexible' && pkgRemaining(p) > 0);
const curKid = () => { const ks = kids(); return ks.find(k => k.id === UI.pKid) || ks[0]; };
const classOf = sid => { const s = byId('class_sessions', sid); return { s, c: s && byId('classes', s.class_id) }; };
const when = (date, c) => `${DAYS[new Date(date + 'T00:00:00').getDay()]}, ${fmtShort(date)}${c ? ' · ' + hm(c.start_time) + '–' + hm(c.end_time) : ''}`;
const where = c => c ? `${progName(c.programme_id)} · ${venueName(c.venue_id)}` : '';
const unread = () => T('notifications').filter(n => !n.read_at);

/* ===================================================================== SHELL */
function renderShell() {
  $('#root').innerHTML = `
  <div class="app">
    <aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark"><img src="assets/logo.png" alt="MBA" class="brand-img"></div><div><div class="brand-name">MAXXIMA</div><div class="brand-sub">${t('Portal Ibu Bapa')}</div></div></div>
      <nav class="nav" id="nav"></nav>
      <div class="side-foot"><div class="avatar lime">${esc((S.profile.full_name || 'P').slice(0, 2).toUpperCase())}</div><div style="min-width:0;flex:1"><div class="who">${esc(S.profile.full_name || S.profile.email)}</div><div class="role">${t('Ibu Bapa')}</div></div>
      <button class="icon-btn dark" data-action="logout" title="${t('Log keluar')}">${ic('logout', 'sm')}</button></div></aside>
    <div class="overlay" data-action="close-nav"></div>
    <div class="main-col"><header class="topbar"><button class="menu-btn" data-action="open-nav">${ic('menu')}</button>
      <div class="crumb"><div class="crumb-top">Maxxima Badminton Academy</div><div class="crumb-title" id="crumbTitle"></div></div>
      ${S.mode === 'demo' ? '<span class="demo-pill">DEMO</span>' : ''}<button class="icon-btn" data-action="p-notif" id="bellBtn" aria-label="${t('Notifikasi')}"></button></header>
      <main id="view"></main></div></div>
  <nav class="bottomnav" id="bottomnav"></nav>`;
}
const parse = () => { const id = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/')[0]; return PV[id] ? id : 'utama'; };
function render() {
  if (UI.ob && $('#view')) { $('#view').innerHTML = onboardView(); return; }
  if (!$('#view')) return;
  const id = parse(), sy = window.scrollY;
  try { $('#view').innerHTML = PV[id](); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>${t('Ralat memaparkan halaman.')}</b><p class="muted">${esc(e.message)}</p></div>`; }
  const item = NAV.find(n => n[0] === id) || [id, id === 'kursus' ? 'Kursus online' : 'Berita & acara', 'msg'];
  $('#crumbTitle').textContent = t(item[1]); document.title = `${t(item[1])} — Maxxima`;
  $('#nav').innerHTML = `<div class="nav-group">${NAV.map(([k, l, i]) => `<a href="#${k}" class="nav-link ${k === id ? 'active' : ''}">${ic(i)}<span>${t(l)}</span>${k === 'yuran' && dueNow().length ? `<span class="nav-count red">${dueNow().length}</span>` : ''}</a>`).join('')}</div>`;
  $('#bottomnav').innerHTML = NAV.map(([k, l, i]) => `<a href="#${k}" class="${k === id ? 'active' : ''}">${ic(i)}${t(l)}</a>`).join('');
  $('#bellBtn').innerHTML = ic('bell') + (unread().length ? '<span class="dot"></span>' : '');
  window.scrollTo(0, sy);
}
const dueNow = () => myInvoices().filter(i => i.status === 'issued' && balanceOf(i) - pendingOf(i) > 0.001);

export async function enterParent() {
  setI18nActive(true);
  renderShell(); app.render = render; app.relang = () => { renderShell(); render(); };
  $('#view').innerHTML = `<div class="boot">${t('Memuatkan data anak anda…')}</div>`;
  try { await loadParent(); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>${t('Gagal memuatkan data.')}</b><p class="muted">${esc(friendlyError(e))}</p></div>`; return; }
  subscribeNotifications(() => render());
  window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); render(); window.scrollTo(0, 0); });
  if (needsOnboard()) { UI.ob = S.profile.must_change_pw ? 1 : 2; }
  render();
}
/* ---- Log masuk kali pertama: kata laluan → bahasa/tema → profil anak → Terma & Syarat ---- */
const needsOnboard = () => S.mode === 'supabase' ? (!!S.profile.must_change_pw || !S.profile.tc_accepted_at) : /onboard/.test(location.search);
function onboardView() {
  const step = UI.ob, steps = [t('Kata laluan'), t('Paparan'), t('Profil anak'), t('Terma & Syarat')];
  const bar = `<div class="chips mb">${steps.map((l, i) => `<span class="chip ${step === i + 1 ? 'on' : ''}">${i + 1}. ${l}</span>`).join('')}</div>`;
  let body = '';
  if (step === 1) body = `<h3>${t('Tukar kata laluan sementara')}</h3><p class="muted" style="font-size:13px;margin:4px 0 12px">${t('Untuk keselamatan, sila tetapkan kata laluan anda sendiri (sekurang-kurangnya 8 aksara).')}</p>
    <div class="form-grid"><label class="f full">${t('Kata laluan baharu')}<input type="password" id="obP1" autocomplete="new-password"></label><label class="f full">${t('Ulang kata laluan')}<input type="password" id="obP2" autocomplete="new-password"></label></div>
    <button class="btn primary" style="margin-top:14px" data-action="ob-pw">${t('Simpan & teruskan')}</button>`;
  if (step === 2) body = `<h3>${t('Pilih bahasa dan tema')}</h3>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px"><span>${t('Bahasa')}</span>${langSwitch()}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px"><span>${t('Tema')}</span>${themeSwitch()}</div>
    <button class="btn primary" style="margin-top:18px" data-action="ob-next">${t('Teruskan')}</button>`;
  if (step === 3) body = `<h3>${t('Semak profil anak')}</h3><p class="muted" style="font-size:13px;margin:4px 0 12px">${t('Tarikh lahir digunakan untuk kategori umur dalam sesi kumpulan. Maklumat kesihatan membantu coach menjaga keselamatan anak.')}</p>
    ${kids().map(k => `<div class="card card-pad mb" data-kid="${k.id}"><b>${esc(k.full_name)}</b><div class="form-grid" style="margin-top:10px">
      <label class="f">${t('Tarikh lahir')}<input type="date" name="birth" value="${esc(k.birth_date || '')}"></label>
      <label class="f">${t('Jantina')}<select name="gender"><option value="">—</option><option value="male" ${k.gender === 'male' ? 'selected' : ''}>${t('Lelaki')}</option><option value="female" ${k.gender === 'female' ? 'selected' : ''}>${t('Perempuan')}</option></select></label>
      <label class="f full">${t('Masalah kesihatan / alahan (jika ada)')}<input name="medical" maxlength="300" value="${esc(k.medical_notes || '')}" placeholder="${t('cth. asma')}"></label>
      <label class="f full">${t('Kenalan kecemasan (nama & no. telefon)')}<input name="emergency" maxlength="150" value="${esc(k.emergency_contact || '')}"></label></div></div>`).join('') || `<p class="muted">${t('Belum ada anak dipautkan.')}</p>`}
    <button class="btn primary" data-action="ob-kids">${t('Simpan & teruskan')}</button>`;
  if (step === 4) body = `<h3>${t('Terma & Syarat')}</h3>
    <ul class="muted" style="font-size:13px;margin:10px 0 0 18px;line-height:1.7">
      <li>${t('Pakej mesti dibayar sebelum sesi dimulakan; slot hanya terjamin selepas bayaran.')}</li>
      <li>${t('Batal / reschedule sekurang-kurangnya 48 jam sebelum sesi. Kurang 48 jam atau tidak hadir dikira sebagai sesi digunakan.')}</li>
      <li>${t('Kecemasan (sakit, MC, hal keluarga) boleh dipertimbangkan dengan bukti; sesi ganti sah 30 hari.')}</li>
      <li>${t('Personal training: batal lewat — court hangus + 50% yuran coach.')}</li>
      <li>${t('Pakej tidak boleh dipindah milik dan tiada bayaran balik selepas sesi bermula, kecuali atas budi bicara pengurusan.')}</li></ul>
    <div class="actions" style="margin-top:12px;flex-wrap:wrap"><a class="btn sm" href="assets/terms/terma-syarat-maxxima.pdf" target="_blank" rel="noopener">${ic('file', 'sm')} ${t('Terma & Syarat (penuh)')}</a><a class="btn sm" href="assets/terms/terma-personal-training.pdf" target="_blank" rel="noopener">${ic('file', 'sm')} ${t('Terma Personal Training')}</a></div>
    <label class="consent" style="display:flex;gap:10px;align-items:flex-start;margin-top:16px;font-size:13.5px"><input type="checkbox" id="obTc" style="width:auto;height:auto;margin-top:3px"> <span>${t('Saya telah membaca dan bersetuju dengan Terma & Syarat Maxxima Badminton Academy.')}</span></label>
    <button class="btn primary" style="margin-top:14px" data-action="ob-done">${t('Setuju & mula guna portal')}</button>
    <div class="hint" style="margin-top:16px;background:var(--surface-2);border-radius:10px;padding:10px 12px;font-size:12.5px">📱 <b>${t('Tip: jadikan portal seperti app')}</b><br>${t('iPhone (Safari): tekan Kongsi → "Add to Home Screen". Android (Chrome): tekan ⋮ → "Tambah ke skrin utama".')}</div>`;
  return `${head(t('Selamat datang ke Portal Ibu Bapa'), t('Lengkapkan langkah ringkas ini sebelum mula.'))}${bar}<div class="card card-pad">${body}</div>`;
}

const kidTabs = () => kids().length > 1 ? `<div class="chips mb">${kids().map(k => `<button class="chip ${curKid()?.id === k.id ? 'on' : ''}" data-action="p-kid" data-id="${k.id}">${esc(k.full_name.split(' ')[0])}</button>`).join('')}</div>` : '';
const noKids = () => `<div class="card card-pad"><b>${t('Belum ada anak dipautkan.')}</b><p class="muted" style="margin-top:6px">${t('Hubungi admin akademi untuk memautkan akaun anda kepada anak anda.')}</p></div>`;
const head = (title, sub) => `<div class="page-head"><div><h1>${title}</h1><p>${sub || ''}</p></div></div>`;
const kindLabel = i => esc(tr(firstLine(i.description)) || LABEL[i.kind]);

/* ===================================================================== UTAMA */
PV.utama = () => {
  const ks = kids(); if (!ks.length) return head(t('Selamat datang'), '') + noKids();
  const due = dueNow(), toConfirm = T('attendance').filter(a => kidSet().has(a.student_id) && ['present', 'late'].includes(a.status) && !a.parent_confirmed);
  return `${head(t('Salam, {name} 👋', { name: esc((S.profile.full_name || '').split(' ').slice(0, 2).join(' ')) }), t('Ringkasan anak anda di Maxxima Badminton Academy'))}
  ${T('courses').some(c => c.status === 'published') ? `<a class="card card-pad mb" href="#kursus" style="display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit">${ic('award')}<b>${t('Kursus online')}</b><span class="muted" style="font-size:12.5px;margin-left:auto">${t('Belajar peraturan, peralatan, senaman dan lain-lain')} →</span></a>` : ''}
  ${T('tournaments').filter(x => x.public_page && x.slug && x.status === 'open').map(x => `<div class="card card-pad mb" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">${ic('trophy')}<div style="flex:1;min-width:180px"><b>${esc(x.name)}</b><div class="muted" style="font-size:12.5px">${x.start_date ? fmtShort(x.start_date) : ''}${x.registration_deadline ? ' · ' + t('tutup pendaftaran') + ' ' + fmtShort(x.registration_deadline) : ''}</div></div><a class="btn sm primary" target="_blank" rel="noopener" href="tournament.html?t=${encodeURIComponent(x.slug)}">${t('Daftar sekarang')}</a></div>`).join('')}
  ${visibleAnns().length ? `<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 10px"><h3 style="font-size:15px">${t('Berita & acara terkini')}</h3>${visibleAnns().length > 2 ? `<a class="btn sm ghost" href="#berita">${t('Lihat semua')}</a>` : ''}</div>${visibleAnns().slice(0, 2).map(a => annCard(a, t)).join('')}` : ''}
  ${due.length ? `<div class="card mb" style="border-color:var(--warn)"><div class="card-head"><div><h3>${t('Yuran belum dijelaskan')}</h3><div class="sub">${t('Bayar melalui QR atau pindahan bank, kemudian muat naik bukti.')}</div></div><span class="badge b-warn">${due.length}</span></div>
    <ul class="list">${due.map(i => `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${esc(kidName(i.student_id))} · <span class="num">${RM(balanceOf(i) - pendingOf(i))}</span></div><div class="li-sub">${kindLabel(i)} · ${esc(i.number)} · ${t('akhir {d}', { d: fmtShort(i.due_date) })}</div></div>
    <div class="actions"><button class="btn sm primary" data-action="p-pay" data-id="${i.id}">${t('Bayar')}</button></div></li>`).join('')}</ul></div>` : ''}
  ${toConfirm.length ? `<div class="card card-pad mb" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>${t('{n} kehadiran menunggu pengesahan anda', { n: toConfirm.length })}</b><div class="muted" style="font-size:13px">${t('Sahkan anak benar-benar hadir.')}</div></div><a class="btn sm primary" href="#jadual">${t('Semak')}</a></div>` : ''}
  ${ks.map(k => { const ps = activePkgs(k.id), ses = nextSessions(k.id).find(u => !u.off); return `<div class="card card-pad mb">
    <div class="cell-person" style="margin-bottom:12px">${avatar(k.full_name)}<div><b>${esc(k.full_name)}</b><span>${esc([progName(k.programme_id), venueName(k.venue_id)].filter(x => x && x !== '—').join(' · '))}</span></div></div>
    ${T('student_packages').filter(p => p.student_id === k.id && ['active', 'pending'].includes(p.status) && !p.mode_set_at && (byId('packages', p.package_id)?.mode_policy || 'choose') !== 'flexible' && byId('programmes', p.programme_id)?.kind !== 'personal').map(p => `<div class="hint warn" style="margin-bottom:10px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><span>${t('Pilih cara latihan untuk {p}: jadual tetap atau fleksibel.', { p: esc(tr(p.name)) })}</span><button class="btn sm primary" data-action="p-mode" data-id="${p.id}">${t('Pilih')}</button></div>`).join('')}
    ${ps.length ? ps.map(p => { const rem = pkgRemaining(p), pct = Math.round(rem / p.sessions_total * 100); return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(tr(p.name))}</b><span class="num"><b>${rem}</b> / ${p.sessions_total} ${t('sesi')}</span></div>
      <div class="bar lg" style="margin-top:6px"><span style="width:${pct}%;background:${rem <= 1 ? 'var(--bad)' : 'var(--ok)'}"></span></div>
      <div class="muted" style="font-size:12px;margin-top:4px">${p.expires_on ? t('Sah hingga {d}', { d: fmtDate(p.expires_on) }) : ''}${rem <= 1 ? ` · <b style="color:var(--bad)">${t('hampir habis')}</b>, ${t('invois pembaharuan akan dikeluarkan')}` : ''}</div></div>`; }).join('')
      : `<div class="muted" style="font-size:13px;margin-bottom:10px">${t('Tiada pakej aktif')}${T('student_packages').some(p => p.student_id === k.id && p.status === 'pending') ? ' · ' + t('menunggu bayaran') : ''}.</div>`}
    <div style="font-size:13px;display:flex;gap:8px;align-items:center">${ic('calendar', 'sm')}${ses ? `<span><b>${t('Sesi seterusnya:')}</b> ${when(ses.date, ses.c)}</span>` : `<span class="muted">${t('Tiada sesi akan datang dijadualkan.')}</span>`}</div></div>`; }).join('')}`;
};

/* sesi akan datang untuk seorang anak: kelas berdaftar + tempahan */
function nextSessions(kidId, days = 30) {
  const today = todayISO(), end = addDays(today, days);
  const cls = new Set(T('class_enrolments').filter(e => e.student_id === kidId).map(e => e.class_id));
  const recs = new Map(T('attendance').filter(a => a.student_id === kidId).map(a => [a.session_id, a]));
  const out = [], have = new Set();
  T('class_sessions').filter(s => s.session_date >= today && s.session_date <= end && (cls.has(s.class_id) || recs.has(s.id))).forEach(s => {
    const c = byId('classes', s.class_id), a = recs.get(s.id); have.add(s.class_id + '|' + s.session_date);
    if (s.status === 'cancelled' || (a && !['booked', 'present', 'late'].includes(a.status) && a.status)) { out.push({ id: s.id, date: s.session_date, c, s, rec: a, off: true }); return; }
    out.push({ id: s.id, date: s.session_date, c, s, rec: a, booking: a?.status === 'booked' && !cls.has(s.class_id) ? a : null, fixed: cls.has(s.class_id) });
  });
  for (let d = today; d <= end; d = addDays(d, 1)) {
    const wd = new Date(d + 'T00:00:00').getDay();
    T('classes').filter(c => c.active && cls.has(c.id) && c.weekday === wd && !have.has(c.id + '|' + d)).forEach(c => out.push({ id: null, date: d, c, s: null, fixed: true }));
  }
  return out.filter(u => u.c).sort((a, b) => a.date.localeCompare(b.date) || (a.s?.start_time || a.c?.start_time || '').localeCompare(b.s?.start_time || b.c?.start_time || ''));
}

/* ---- Reschedule / batal / kecemasan (ikut Terma & Syarat) ---- */
const policy = () => ({ notice_hours: Number(S.t.settings?.find(s => s.key === 'billing')?.value?.cancel_notice_hours ?? 48), replacement_days: 30, auto_group: true, ...(S.t.settings?.find(s => s.key === 'policy')?.value || {}) });
const startTs = (c, date, s) => new Date(`${date}T${hm(s?.start_time || c.start_time)}:00+08:00`);
const hoursLeft = (c, date, s) => (startTs(c, date, s) - Date.now()) / 3600000;
const isPersonalC = c => byId('programmes', c?.programme_id)?.kind === 'personal';
const pendingReq = (kid, cid, d) => T('booking_requests').find(b => b.student_id === kid && b.from_class_id === cid && b.from_date === d && b.status === 'new');
async function changeSession(args) {
  if (S.mode === 'supabase') return rpc('parent_session_change', args);
  // demo: tiruan ringkas
  const { p_student, p_class, p_date, p_action, p_to_class, p_to_date } = args, c = byId('classes', p_class), late = hoursLeft(c, p_date) < policy().notice_hours;
  if (isPersonalC(c) || p_action === 'emergency') { await insert('booking_requests', { student_id: p_student, kind: isPersonalC(c) ? 'personal' : 'group', action: p_action, from_class_id: p_class, from_date: p_date, class_id: p_to_class || null, session_date: p_to_date || null, reason: args.p_reason || null, pref_time: args.p_pref || null, late, status: 'new', created_at: new Date().toISOString() }); return { mode: 'request', late }; }
  if (p_action === 'reschedule' && late) throw new Error(t('Reschedule mesti dibuat sekurang-kurangnya {h} jam sebelum sesi.', { h: policy().notice_hours }));
  const ens = async (cid, d) => T('class_sessions').find(x => x.class_id === cid && x.session_date === d) || insert('class_sessions', { class_id: cid, session_date: d, status: 'scheduled' });
  const s = await ens(p_class, p_date), a = T('attendance').find(x => x.session_id === s.id && x.student_id === p_student);
  const st = late ? 'late_cancel' : 'excused';
  if (a && a.status === 'booked' && !late && !T('class_enrolments').some(e => e.class_id === p_class && e.student_id === p_student)) await remove('attendance', a.id);
  else if (a) await update('attendance', a.id, { status: st }); else await insert('attendance', { session_id: s.id, student_id: p_student, status: st });
  if (p_action === 'reschedule') { const s2 = await ens(p_to_class, p_to_date); await insert('attendance', { session_id: s2.id, student_id: p_student, status: 'booked', note: 'Reschedule' }); }
  await insert('booking_requests', { student_id: p_student, kind: 'group', action: p_action, from_class_id: p_class, from_date: p_date, class_id: p_to_class || null, session_date: p_to_date || null, late, status: 'accepted', admin_note: 'Disahkan automatik oleh sistem', created_at: new Date().toISOString() });
  return { mode: 'done', late };
}

PV.kursus = () => { const cs = T('courses').filter(c => c.status === 'published').sort((a, b) => a.sort - b.sort), open = UI.pCourse;
  if (open) { const c = byId('courses', open); if (c) return `${head(esc(c.title), esc(c.summary || ''))}<button class="btn sm ghost mb" data-action="p-course" data-id="">← ${t('Semua kursus')}</button>${T('course_lessons').filter(l => l.course_id === c.id).sort((a, b) => a.sort - b.sort).map((l, i) => lessonCard(l, i)).join('') || `<div class="card empty">${t('Belum ada pelajaran.')}</div>`}`; }
  return `${head(t('Kursus online'), t('Belajar peraturan, peralatan, senaman dan lain-lain'))}${cs.map(c => `<div class="card mb ann" style="cursor:pointer" data-action="p-course" data-id="${c.id}">${c.cover_path ? `<img class="ann-img" style="max-height:180px" src="${publicUrl(c.cover_path)}" alt="">` : ''}<div class="card-pad"><b>${esc(c.title)}</b><div class="muted" style="font-size:12.5px">${T('course_lessons').filter(l => l.course_id === c.id).length} ${t('pelajaran')}</div>${c.summary ? `<p class="ann-body" style="margin-top:6px">${esc(c.summary)}</p>` : ''}</div></div>`).join('') || `<div class="card empty">${t('Kursus akan datang. Nantikan!')}</div>`}`; };
const ytEmbed = u => { const m = String(u || '').match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/); return m ? `<div style="position:relative;padding-top:56.25%;margin-top:8px"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px" allowfullscreen loading="lazy"></iframe></div>` : u ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(u)}">${t('Tonton video')}</a>` : ''; };
const lessonCard = (l, i) => `<div class="card card-pad mb"><b>${i + 1}. ${esc(l.title)}</b>${l.minutes ? ` <span class="muted" style="font-size:12px">· ${l.minutes} min</span>` : ''}${l.image_path ? `<img src="${publicUrl(l.image_path)}" alt="" style="width:100%;border-radius:10px;margin-top:8px">` : ''}${ytEmbed(l.video_url)}${l.body ? `<p class="ann-body" style="margin-top:8px">${esc(l.body)}</p>` : ''}</div>`;
PV.berita = () => `${head(t('Berita & acara'), t('Pengumuman daripada Maxxima Badminton Academy'))}${visibleAnns().map(a => annCard(a, t)).join('') || `<div class="card empty">${t('Belum ada berita.')}</div>`}`;

/* ===================================================================== TEMPAH (kumpulan / personal, walaupun belum ada pakej) */
const ageCatOf = (st, on) => {
  if (!st?.birth_date) return null; const b = new Date(st.birth_date + 'T00:00:00'), d = new Date(on + 'T00:00:00');
  let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  const gs = S.t.settings?.find(x => x.key === 'age_groups')?.value || []; return gs.find(g => a >= Number(g.min) && a <= Number(g.max))?.code || null;
};
async function loadOpen() {
  if (S.pOpen) return;
  S.pOpen = 'loading';
  await new Promise(r => setTimeout(r, 0));
  try {
    if (S.mode === 'supabase') S.pOpen = await rpc('parent_open_sessions', { p_from: todayISO(), p_days: 21 }) || [];
    else {
      const out = []; for (let i = 0; i <= 21; i++) { const d = addDays(todayISO(), i), wd = new Date(d + 'T00:00:00').getDay();
        T('classes').filter(c => c.active && c.weekday === wd && byId('programmes', c.programme_id)?.kind === 'group').forEach(c => out.push({ class_id: c.id, session_date: d, start_time: c.start_time, end_time: c.end_time, programme: progName(c.programme_id), programme_id: c.programme_id, venue: venueName(c.venue_id), venue_id: c.venue_id, categories: c.categories || [], capacity: c.capacity, booked: T('class_enrolments').filter(e => e.class_id === c.id).length })); }
      S.pOpen = out;
    }
  } catch (e) { console.error(e); S.pOpen = []; toast(friendlyError(e), true); }
  render();
}
const myReq = k => T('booking_requests').filter(b => b.student_id === k.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
const REQ_ST = { new: ['Menunggu pengesahan', 'b-warn'], accepted: ['Diterima', 'b-ok'], rejected: ['Ditolak', 'b-bad'], cancelled: ['Dibatalkan', 'b-muted'] };
PV.tempah = () => {
  const k = curKid(); if (!k) return head(t('Tempah'), '') + noKids();
  const tab = UI.pBk || (T('class_offers').some(o => o.status === 'open') ? 'offers' : 'group'), has = activePkgs(k.id);
  let body = '';
  if (tab === 'group') {
    if (!S.pOpen || S.pOpen === 'loading') { loadOpen(); body = `<div class="boot">${t('Memuatkan slot…')}</div>`; }
    else {
      const vf = UI.pBkV ?? (k.venue_id || ''), pf = UI.pBkP ?? (k.programme_id || '');
      const taken = new Set([...T('attendance').filter(a => a.student_id === k.id).map(a => byId('class_sessions', a.session_id)).filter(Boolean).map(s => s.class_id + '|' + s.session_date),
        ...T('booking_requests').filter(b => b.student_id === k.id && ['new', 'accepted'].includes(b.status)).map(b => b.class_id + '|' + b.session_date)]);
      const fixed = new Set(T('class_enrolments').filter(e => e.student_id === k.id).map(e => e.class_id));
      const slots = S.pOpen.filter(x => (!vf || x.venue_id === vf) && (!pf || x.programme_id === pf) && !fixed.has(x.class_id) && x.session_date >= todayISO());
      const vs = [...new Map(S.pOpen.map(x => [x.venue_id, x.venue])).entries()], ps = [...new Map(S.pOpen.map(x => [x.programme_id, x.programme])).entries()];
      body = `<div class="card card-pad mb"><div class="filters">
        <label class="field"><select data-on-change="p-bkv"><option value="">${t('Semua lokasi')}</option>${vs.map(([id, n]) => `<option value="${id}" ${vf === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="field"><select data-on-change="p-bkp"><option value="">${t('Semua program')}</option>${ps.map(([id, n]) => `<option value="${id}" ${pf === id ? 'selected' : ''}>${esc(tr(n))}</option>`).join('')}</select></label></div>
        <p class="muted" style="font-size:12.5px;margin-top:8px">${has.length ? t('Sesi akan ditolak daripada pakej aktif anak anda.') : t('Belum ada pakej? Tidak mengapa — admin akan sahkan tempahan dan menghantar invois walk-in.')}</p></div>
      <div class="card"><ul class="list">${slots.slice(0, 60).map(x => { const key = x.class_id + '|' + x.session_date, left = Math.max(Number(x.capacity) - Number(x.booked || 0), 0), cat = ageCatOf(k, x.session_date);
        return `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${DAYS[new Date(x.session_date + 'T00:00:00').getDay()]}, ${fmtShort(x.session_date)} · ${hm(x.start_time)}–${hm(x.end_time)}</div>
          <div class="li-sub">${esc(tr(x.programme))} · ${esc(x.venue)}${(x.categories || []).length ? ' · ' + x.categories.map(esc).join('/') : ''}${cat ? ` · ${t('Kategori anak')}: <b>${esc(cat)}</b>` : ''} · ${left > 0 ? t('{n} tempat kosong', { n: left }) : `<b style="color:var(--bad)">${t('penuh')}</b>`}</div></div>
          ${taken.has(key) ? `<span class="badge b-info">${t('Sudah ditempah')}</span>` : `<button class="btn sm primary" data-action="p-req-g" data-id="${key}" ${left <= 0 ? 'disabled' : ''}>${t('Tempah')}</button>`}</li>`; }).join('') || `<li class="empty">${t('Tiada slot terbuka dalam 3 minggu ini.')}</li>`}</ul></div>`;
    }
  } else {
    const progs = T('programmes').filter(p => p.active && p.kind === 'personal');
    if (!S.pCoaches) { S.pCoaches = []; (S.mode === 'supabase' ? rpc('parent_coaches') : Promise.resolve(T('staff').filter(x => x.active !== false))).then(r => { S.pCoaches = r || []; render(); }).catch(e => console.warn(e)); }
    body = `<form class="card card-pad mb" id="pReqForm" novalidate><div class="form-grid">
      ${F(t('Program'), 'programme_id', { req: true, opts: progs.map(p => [p.id, tr(p.name)]) })}
      ${F(t('Lokasi pilihan'), 'venue_id', { opts: [['', t('Mana-mana')], ...T('venues').filter(v => v.active).map(v => [v.id, v.name])] })}
      <label class="f full">${t('Coach pilihan')}<select name="coach_id"><option value="">${t('Mana-mana coach')}</option>${(S.pCoaches || []).map(c => `<option value="${c.id}">${esc(c.full_name)}${(c.languages || []).length ? ' · ' + c.languages.map(l => ({ ms: 'BM', en: 'EN', zh: '中文', ta: 'TA' })[l] || l).join('/') : ''}</option>`).join('')}</select>
        ${(S.pCoaches || []).filter(c => c.qualifications).length ? `<span class="hint">${(S.pCoaches || []).filter(c => c.qualifications).map(c => `<b>${esc(c.full_name.split(' ')[0])}</b>: ${esc(c.qualifications)}`).join('<br>')}</span>` : ''}</label>
      <div class="f full">${t('Hari pilihan')}<div class="langchk">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="days" value="${d}"> ${DAYS[d]}</label>`).join('')}</div></div>
      ${F(t('Masa pilihan (cth. 6pm–8pm)'), 'pref_time', {})}
      ${F(t('Bilangan sesi'), 'sessions', { type: 'number', min: 1, value: 4 })}
      ${F(t('Catatan (tahap, sasaran, coach pilihan)'), 'notes', { type: 'textarea', full: true })}
    </div><button class="btn primary" type="submit" style="margin-top:12px">${t('Hantar permintaan')}</button>
    <p class="muted" style="font-size:12.5px;margin-top:8px">${t('Admin akan hubungi anda untuk sahkan slot, coach dan yuran. Tidak perlu beli pakej dahulu.')}</p></form>`;
    setTimeout(() => { const f = $('#pReqForm'); if (f && !f._b) { f._b = 1; f.addEventListener('submit', async e => { e.preventDefault(); const fd = new FormData(f);
      try { await insert('booking_requests', { student_id: k.id, requested_by: S.mode === 'demo' ? null : me(), kind: 'personal', programme_id: fd.get('programme_id') || null, venue_id: fd.get('venue_id') || null, coach_id: fd.get('coach_id') || null, pref_days: fd.getAll('days').map(Number), pref_time: fd.get('pref_time') || null, sessions: Number(fd.get('sessions')) || null, notes: fd.get('notes') || null, status: 'new' });
        toast(t('Permintaan dihantar. Admin akan menghubungi anda.')); UI.pBk = 'mine'; render(); } catch (err) { toast(friendlyError(err), true); } }); } }, 0);
  }
  const reqs = myReq(k);
  return `${head(t('Tempah'), t('Tempah sesi kumpulan atau minta sesi personal'))}${kidTabs()}
  <div class="chips">${[['offers', 'Kelas dibuka'], ['group', 'Sesi kumpulan'], ['personal', 'Sesi personal'], ['mine', 'Permintaan saya']].map(([x, l]) => `<button class="chip ${tab === x ? 'on' : ''}" style="cursor:pointer" data-action="p-bk" data-id="${x}">${t(l)}${x === 'mine' && reqs.filter(r => r.status === 'new').length ? ` <span class="n">${reqs.filter(r => r.status === 'new').length}</span>` : ''}</button>`).join('')}</div>
  ${tab === 'offers' ? offersBody(k) : tab === 'mine' ? `<div class="card"><ul class="list">${reqs.map(b => { const c = byId('classes', b.class_id), [lbl, tone] = REQ_ST[b.status] || [b.status, 'b-muted']; return `<li class="list-item" style="flex-wrap:wrap"><div class="li-main">
      <div class="li-title">${b.kind === 'group' ? t('Sesi kumpulan') : t('Sesi personal')} <span class="badge ${tone}">${t(lbl)}</span></div>
      <div class="li-sub">${b.kind === 'group' ? `${b.session_date ? when(b.session_date, c || { start_time: '', end_time: '' }) : ''}${c ? ' · ' + esc(where(c)) : ''}` : `${(b.pref_days || []).map(d => DAYS[d]).join(', ')}${b.pref_time ? ' · ' + esc(b.pref_time) : ''}`}${b.admin_note ? ' · ' + esc(b.admin_note) : ''}</div></div>
      ${b.status === 'new' ? `<button class="btn sm danger-o" data-action="p-req-x" data-id="${b.id}">${t('Batal')}</button>` : ''}</li>`; }).join('') || `<li class="empty">${t('Belum ada permintaan.')}</li>`}</ul></div>` : body}`;
};
function offersBody(k) {
  const L = T('class_offers').filter(o => o.status !== 'closed');
  L.filter(o => o.coach_id && o.coach_name === undefined).forEach(o => { o.coach_name = null; if (S.mode === 'supabase') rpc('offer_coach_name', { p: o.coach_id }).then(n => { o.coach_name = n ? 'Coach ' + n : null; render(); }).catch(() => {}); else { const st = byId('staff', o.coach_id); o.coach_name = st ? 'Coach ' + st.full_name : null; } });
  return L.map(o => { const mine = T('booking_requests').some(b => b.offer_id === o.id && b.student_id === k.id && b.status !== 'cancelled');
    return `${offerCard(o, t)}<div style="margin:-8px 0 16px">${mine ? `<span class="badge b-info">${t('Minat dihantar — admin akan hubungi anda')}</span>` : o.status === 'full' ? '' : `<button class="btn primary" data-action="p-offer" data-id="${o.id}">${t('Saya berminat')}</button>`}</div>`; }).join('') || `<div class="card empty">${t('Tiada kelas dibuka buat masa ini.')}</div>`;
}
INPUTS['p-bkv'] = v => { UI.pBkV = v; render(); };
INPUTS['p-bkp'] = v => { UI.pBkP = v; render(); };
Object.assign(ACTIONS, {
  'p-bk': x => { UI.pBk = x; render(); },
  'p-course': id => { UI.pCourse = id || null; location.hash = 'kursus'; render(); },
  'p-offer': id => { const o = byId('class_offers', id), k = curKid();
    openModal({ title: t('Saya berminat'), submit: t('Hantar'), body: `<p><b>${esc(o.title)}</b></p><p class="muted" style="font-size:13px">${esc(k.full_name)}</p>${F(t('Catatan (pilihan)'), 'notes', { type: 'textarea', full: true, ph: t('cth. boleh mula bulan depan / ada kawan nak join sekali') })}`,
      onSubmit: async d => { await insert('booking_requests', { student_id: k.id, requested_by: S.mode === 'demo' ? null : me(), kind: o.otype === 'share_personal' ? 'personal' : 'group', offer_id: o.id, class_id: o.class_id || null, programme_id: o.programme_id || null, venue_id: o.venue_id || null, notes: ['[' + o.title + ']', d.notes].filter(Boolean).join(' '), status: 'new', pref_days: [] }); toast(t('Terima kasih! Admin akan menghubungi anda.')); render(); } }); },
  'p-req-g': async key => {
    const [cid, d] = key.split('|'), k = curKid(), x = (Array.isArray(S.pOpen) ? S.pOpen : []).find(y => y.class_id === cid && y.session_date === d);
    confirmModal({ title: t('Sahkan tempahan?'), message: `${esc(k.full_name)} — ${DAYS[new Date(d + 'T00:00:00').getDay()]}, ${fmtShort(d)} ${x ? hm(x.start_time) + ' · ' + esc(tr(x.programme)) + ' · ' + esc(x.venue) : ''}`, ok: t('Tempah'), onOk: async () => {
      await insert('booking_requests', { student_id: k.id, requested_by: S.mode === 'demo' ? null : me(), kind: 'group', class_id: cid, session_date: d, programme_id: x?.programme_id || null, venue_id: x?.venue_id || null, status: 'new' });
      toast(t('Tempahan dihantar. Admin akan sahkan.')); render();
    } });
  },
  'p-req-x': async id => { await update('booking_requests', id, { status: 'cancelled' }); toast(t('Permintaan dibatalkan')); render(); },
});

/* ===================================================================== JADUAL */
const seatCache = (S.pSeats ||= {});
async function loadSeats(ids) {
  const miss = ids.filter(id => !(id in seatCache)); if (!miss.length) return;
  if (S.mode === 'demo') { miss.forEach(id => { const { s, c } = classOf(id); seatCache[id] = c ? Math.max(c.capacity - T('class_enrolments').filter(e => e.class_id === c.id).length - T('attendance').filter(a => a.session_id === id && a.status === 'booked').length, 0) : 0; }); return; }
  await Promise.all(miss.map(async id => { const { data } = await S.client.rpc('session_seats', { p_session: id }); seatCache[id] = data ?? 0; }));
  app.render();
}
const bookable = kid => {
  const fp = flexPkg(kid.id); if (!fp) return [];
  const today = todayISO(), end = addDays(today, 21), mine = new Set(T('attendance').filter(a => a.student_id === kid.id).map(a => a.session_id));
  const enrolled = new Set(T('class_enrolments').filter(e => e.student_id === kid.id).map(e => e.class_id));
  return T('class_sessions').filter(s => s.status === 'scheduled' && s.session_date >= today && s.session_date <= end && !mine.has(s.id) && !enrolled.has(s.class_id)).map(s => ({ s, c: byId('classes', s.class_id) }))
    .filter(x => x.c && x.c.active && x.c.programme_id === fp.programme_id && (!fp.expires_on || fp.expires_on >= x.s.session_date))
    .sort((a, b) => a.s.session_date.localeCompare(b.s.session_date) || a.c.start_time.localeCompare(b.c.start_time));
};

PV.jadual = () => {
  const k = curKid(); if (!k) return head(t('Jadual'), '') + noKids();
  const up = nextSessions(k.id), fp = flexPkg(k.id), canBook = bookable(k);
  loadSeats(canBook.map(x => x.s.id));
  const hist = T('attendance').filter(a => a.student_id === k.id && a.status !== 'booked' && (a.session_date || '') <= todayISO()).sort((a, b) => (b.session_date || '').localeCompare(a.session_date || '')).slice(0, 15);
  const hrs = Number(S.t.settings?.find(s => s.key === 'billing')?.value?.cancel_notice_hours ?? 48);
  return `${head(t('Jadual'), t('Sesi akan datang, tempahan dan sejarah kehadiran'))}${kidTabs()}
  <div class="card mb"><div class="card-head"><div><h3>${t('Sesi akan datang')} — ${esc(k.full_name)}</h3><div class="sub">${t('30 hari seterusnya')}</div></div></div>
   ${up.length ? `<ul class="list">${up.map(u => { const pr = pendingReq(k.id, u.c.id, u.date); return `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${when(u.date, u.s?.start_time ? { start_time: u.s.start_time, end_time: u.s.end_time || u.c.end_time } : u.c)}</div><div class="li-sub">${esc(where(u.c))}${u.rec?.note && /Reschedule/.test(u.rec.note) ? ' · ' + esc(u.rec.note) : ''}</div></div>
     <div class="actions">${u.off ? `<span class="badge b-muted">${u.s?.status === 'cancelled' ? t('Dibatalkan') : esc(tr(LABEL[u.rec?.status] || ''))}</span>` : `${u.booking ? `<span class="badge b-info">${t('Ditempah')}</span>` : isPersonalC(u.c) ? `<span class="badge b-purple">${t('Personal')}</span>` : `<span class="badge b-muted">${t('Kelas tetap')}</span>`}
       ${pr ? `<span class="badge b-warn">${t('Permintaan disemak admin')}</span>` : hoursLeft(u.c, u.date, u.s) > 0 ? `<button class="btn sm" data-action="p-change" data-id="${k.id}|${u.c.id}|${u.date}">${t('Ubah / Batal')}</button>` : ''}`}</div></li>`; }).join('')}</ul>` : `<div class="empty">${t('Tiada sesi dijadualkan dalam 30 hari ini.')}</div>`}</div>
  ${fp ? `<div class="card mb"><div class="card-head"><div><h3>${t('Tempah sesi')}</h3><div class="sub">${t('Pakej fleksibel anda: baki <b>{n}</b> sesi', { n: pkgRemaining(fp) })}${fp.expires_on ? ' · ' + t('sah hingga {d}', { d: fmtDate(fp.expires_on) }) : ''}. ${t('Pembatalan perlu dibuat sekurang-kurangnya {h} jam sebelum kelas.', { h: hrs })}</div></div></div>
   ${canBook.length ? `<ul class="list">${canBook.map(({ s, c }) => { const seats = seatCache[s.id]; return `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${when(s.session_date, c)}</div><div class="li-sub">${esc(where(c))}${seats != null ? ` · ${seats > 0 ? t('{n} tempat kosong', { n: seats }) : `<b style="color:var(--bad)">${t('penuh')}</b>`}` : ''}</div></div>
     <div class="actions"><button class="btn sm primary" data-action="p-book" data-id="${s.id}" data-kid="${k.id}" ${seats === 0 ? 'disabled' : ''}>${t('Tempah')}</button></div></li>`; }).join('')}</ul>` : `<div class="empty">${t('Tiada sesi tersedia untuk ditempah dalam 21 hari.')}</div>`}</div>` : ''}
  <div class="card"><div class="card-head"><div><h3>${t('Sejarah kehadiran')}</h3><div class="sub">${t('Sahkan kehadiran anak selepas setiap sesi')}</div></div></div>
   ${hist.length ? `<ul class="list">${hist.map(a => { const { c } = classOf(a.session_id); return `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${a.session_date ? when(a.session_date, c) : ''}</div><div class="li-sub">${esc(where(c))}</div></div>
     <div class="actions">${badge(a.status)}${['present', 'late'].includes(a.status) ? (a.parent_confirmed ? `<span class="badge b-ok">${t('Disahkan')}</span>` : `<button class="btn sm primary" data-action="p-confirm" data-id="${a.id}">${t('Sahkan')}</button>`) : ''}</div></li>`; }).join('')}</ul>` : `<div class="empty">${t('Belum ada rekod kehadiran.')}</div>`}</div>`;
};

Object.assign(ACTIONS, {
  'p-kid': id => { UI.pKid = id; app.render(); },
  'p-book': async (id, el) => {
    const kid = el.dataset.kid, { s, c } = classOf(id);
    confirmModal({ title: t('Tempah sesi?'), message: `<b>${esc(kidName(kid))}</b><br>${when(s.session_date, c)}<br>${esc(where(c))}<br><span class="muted">${t('1 sesi akan ditolak daripada pakej fleksibel apabila anak hadir.')}</span>`, ok: t('Tempah'),
      onOk: async () => {
        if (S.mode === 'demo') { const fp = flexPkg(kid); if (!fp) throw new Error(t('Tiada pakej fleksibel aktif untuk program ini.')); await insert('attendance', { session_id: id, student_id: kid, status: 'booked' }); }
        else { const { error } = await S.client.rpc('book_session', { p_student: kid, p_session: id }); if (error) throw error; await refresh(['attendance', 'student_packages']); }
        delete seatCache[id]; toast(t('Sesi ditempah')); app.render();
      } });
  },
  'p-cancel': id => confirmModal({ title: t('Batalkan tempahan?'), message: t('Sesi akan dipulangkan ke pakej anda jika dibatalkan dalam tempoh notis yang dibenarkan.'), ok: t('Batalkan Tempahan'), danger: true,
    onOk: async () => {
      if (S.mode === 'demo') await remove('attendance', id);
      else { const { error } = await S.client.rpc('cancel_booking', { p_attendance: id }); if (error) throw error; await refresh(['attendance', 'student_packages']); }
      Object.keys(seatCache).forEach(k => delete seatCache[k]); toast(t('Tempahan dibatalkan')); app.render();
    } }),
  'ob-pw': async () => {
    const a = $('#obP1').value, b = $('#obP2').value;
    if (a.length < 8) return toast(t('Kata laluan mesti sekurang-kurangnya 8 aksara.'), true);
    if (a !== b) return toast(t('Kata laluan tidak sepadan.'), true);
    try { if (S.mode === 'supabase') await setPassword(a); UI.ob = 2; render(); } catch (e) { toast(friendlyError(e), true); }
  },
  'ob-next': () => { UI.ob = 3; render(); },
  'ob-kids': async () => {
    try {
      for (const el of document.querySelectorAll('[data-kid]')) {
        const id = el.dataset.kid, g = n => el.querySelector(`[name=${n}]`).value;
        if (S.mode === 'supabase') await rpc('parent_update_child', { p_student: id, p_birth: g('birth') || null, p_gender: g('gender') || null, p_medical: g('medical') || null, p_emergency: g('emergency') || null });
        Object.assign(byId('students', id), { birth_date: g('birth') || byId('students', id).birth_date, gender: g('gender') || byId('students', id).gender, medical_notes: g('medical') || null, emergency_contact: g('emergency') || null });
      }
      UI.ob = 4; render();
    } catch (e) { toast(friendlyError(e), true); }
  },
  'ob-done': async () => {
    if (!$('#obTc').checked) return toast(t('Sila tandakan persetujuan Terma & Syarat.'), true);
    try { if (S.mode === 'supabase') await rpc('parent_onboard', { p_accept: true }); S.profile.must_change_pw = false; S.profile.tc_accepted_at = new Date().toISOString(); UI.ob = 0; toast(t('Terima kasih! Selamat menggunakan portal.')); render(); }
    catch (e) { toast(friendlyError(e), true); }
  },
  /* Pakej "ibu bapa pilih": jadual tetap (pilih slot mingguan) atau fleksibel */
  'p-mode': async spId => {
    const sp = byId('student_packages', spId), pol = byId('packages', sp.package_id)?.mode_policy || 'choose';
    if (!Array.isArray(S.pOpen)) { S.pOpen = null; await loadOpen(); }
    const seen = new Set(), weekly = (Array.isArray(S.pOpen) ? S.pOpen : []).filter(x => x.programme_id === sp.programme_id && !seen.has(x.class_id) && seen.add(x.class_id)).sort((a, b) => new Date(a.session_date + 'T00:00:00').getDay() - new Date(b.session_date + 'T00:00:00').getDay() || hm(a.start_time).localeCompare(hm(b.start_time)));
    openModal({ title: t('Pilih cara latihan'), cancel: t('Tutup'), body: `<p><b>${esc(kidName(sp.student_id))}</b> · ${esc(tr(sp.name))}</p>
      ${pol !== 'flexible' ? `<div class="card card-pad" style="margin-top:12px"><b>${t('Jadual tetap')}</b><p class="muted" style="font-size:12.5px;margin:4px 0 10px">${t('Anak hadir slot yang sama setiap minggu. Tempat dikhaskan; masih boleh reschedule jika 48 jam lebih awal.')}</p>
        <label class="f full">${t('Slot mingguan')}<select id="pmCls">${weekly.map(x => `<option value="${x.class_id}" ${Number(x.capacity) - Number(x.booked || 0) <= 0 ? 'disabled' : ''}>${DAYS[new Date(x.session_date + 'T00:00:00').getDay()]} ${hm(x.start_time)}–${hm(x.end_time)} · ${esc(x.venue)}${Number(x.capacity) - Number(x.booked || 0) <= 0 ? ' — ' + t('penuh') : ''}</option>`).join('') || `<option value="">${t('Tiada slot')}</option>`}</select></label>
        <button class="btn primary" style="margin-top:10px" data-action="p-mode-go" data-id="${spId}|fixed" ${weekly.length ? '' : 'disabled'}>${t('Pilih jadual tetap')}</button></div>` : ''}
      ${pol !== 'fixed' ? `<div class="card card-pad" style="margin-top:12px"><b>${t('Fleksibel')}</b><p class="muted" style="font-size:12.5px;margin:4px 0 10px">${t('Tempah sendiri slot kosong setiap minggu melalui menu Tempah, ikut masa anda.')}</p>
        <button class="btn" data-action="p-mode-go" data-id="${spId}|flexible">${t('Pilih fleksibel')}</button></div>` : ''}` });
  },
  'p-mode-go': async key => {
    const [spId, mode] = key.split('|'), cls = mode === 'fixed' ? $('#pmCls')?.value : null, sp = byId('student_packages', spId);
    try {
      if (S.mode === 'supabase') { await rpc('parent_set_mode', { p_sp: spId, p_mode: mode, p_class: cls }); await refresh(['student_packages', 'class_enrolments', 'classes']); }
      else { Object.assign(sp, { schedule_mode: mode, mode_set_at: new Date().toISOString() }); if (cls && !T('class_enrolments').some(e => e.class_id === cls && e.student_id === sp.student_id)) await insert('class_enrolments', { class_id: cls, student_id: sp.student_id }); }
      closeModal(); S.pOpen = null; toast(mode === 'fixed' ? t('Jadual tetap disimpan. Anak didaftarkan ke slot mingguan.') : t('Cara fleksibel dipilih. Tempah sesi di menu Tempah.')); render();
    } catch (e) { toast(friendlyError(e), true); }
  },
  'p-change': async key => {
    const [kid, cid, d] = key.split('|'), c = byId('classes', cid), s = T('class_sessions').find(x => x.class_id === cid && x.session_date === d);
    const pol = policy(), h = hoursLeft(c, d, s), late = h < pol.notice_hours, pers = isPersonalC(c);
    let slots = [];
    if (!pers && !late) {
      if (!Array.isArray(S.pOpen)) { S.pOpen = null; await loadOpen(); }
      const exp = activePkgs(kid).filter(p => p.programme_id === c.programme_id).map(p => p.expires_on).filter(Boolean).sort().pop();
      slots = (Array.isArray(S.pOpen) ? S.pOpen : []).filter(x => x.programme_id === c.programme_id && !(x.class_id === cid && x.session_date === d) && Number(x.capacity) - Number(x.booked || 0) > 0 && (!exp || x.session_date <= exp) && new Date(`${x.session_date}T${hm(x.start_time)}:00+08:00`) > new Date());
    }
    const hrsTxt = h >= 48 ? t('{n} hari lagi', { n: Math.floor(h / 24) }) : t('{n} jam lagi', { n: Math.max(0, Math.floor(h)) });
    const warn = pers
      ? (late ? t('Kurang {h} jam: yuran court hangus dan 50% yuran coach dikenakan (kecuali kecemasan yang diluluskan — court sahaja).', { h: pol.notice_hours }) : t('Lebih {h} jam: tiada caj. Admin akan sahkan slot ganti mengikut kekosongan coach dan court.', { h: pol.notice_hours }))
      : (late ? t('Kurang {h} jam: pembatalan dikira sebagai sesi digunakan (ditolak daripada pakej). Untuk kecemasan (sakit, MC, hal keluarga), hantar bukti — admin akan semak.', { h: pol.notice_hours }) : t('Lebih {h} jam: sesi tidak ditolak. Reschedule disahkan terus jika slot kosong.', { h: pol.notice_hours }));
    openModal({ title: t('Ubah sesi'), cancel: t('Tutup'), body: `<p><b>${esc(kidName(kid))}</b><br>${when(d, c)}<br>${esc(where(c))}<br><span class="muted">${hrsTxt}</span></p>
      <div class="hint ${late ? 'bad' : ''}" style="margin:12px 0;${late ? '' : 'background:var(--surface-2);border-radius:10px;padding:9px 12px'}">${warn}</div>
      ${!pers && !late ? `<label class="f full">${t('Slot baharu')}<select id="pcTo">${slots.map(x => `<option value="${x.class_id}|${x.session_date}">${when(x.session_date, x)} · ${esc(x.venue)}</option>`).join('') || `<option value="">${t('Tiada slot kosong sebelum pakej tamat')}</option>`}</select></label>
        <div class="actions" style="margin-top:12px;flex-wrap:wrap"><button class="btn primary" data-action="p-chg-go" data-id="reschedule|${key}" ${slots.length ? '' : 'disabled'}>${t('Reschedule')}</button><button class="btn danger-o" data-action="p-chg-go" data-id="cancel|${key}">${t('Batal sesi')}</button></div>`
      : pers ? `<label class="f full">${t('Tarikh / masa ganti pilihan (jika reschedule)')}<input id="pcPref" placeholder="${t('cth. Jumaat 21/11, 4pm')}"></label>
        <div class="actions" style="margin-top:12px;flex-wrap:wrap"><button class="btn primary" data-action="p-chg-go" data-id="reschedule|${key}">${t('Minta reschedule')}</button><button class="btn" data-action="p-chg-go" data-id="cancel|${key}">${t('Minta batal')}</button>${late ? `<button class="btn danger-o" data-action="p-emerg" data-id="${key}">${t('Kecemasan / MC')}</button>` : ''}</div>`
      : `<div class="actions" style="margin-top:12px;flex-wrap:wrap"><button class="btn danger-o" data-action="p-chg-go" data-id="cancel|${key}">${t('Batal (sesi ditolak)')}</button><button class="btn primary" data-action="p-emerg" data-id="${key}">${t('Kecemasan / MC')}</button></div>`}
      <p class="muted" style="font-size:12px;margin-top:12px">${t('Tertakluk kepada Terma & Syarat Maxxima. Coach, court, hari atau masa yang sama tidak dijamin.')}</p>` });
  },
  'p-chg-go': async key => {
    const [act, kid, cid, d] = key.split('|'), to = document.getElementById('pcTo')?.value || '', pref = document.getElementById('pcPref')?.value || null;
    const [tc, td] = to.split('|');
    try {
      const r = await changeSession({ p_student: kid, p_class: cid, p_date: d, p_action: act, p_to_class: act === 'reschedule' && tc ? tc : null, p_to_date: act === 'reschedule' && td ? td : null, p_pref: pref });
      closeModal(); S.pOpen = null;
      if (S.mode === 'supabase') await refresh(['class_sessions', 'attendance', 'booking_requests', 'classes', 'student_packages']);
      toast(r?.mode === 'request' ? t('Permintaan dihantar kepada admin.') : act === 'reschedule' ? t('Sesi berjaya direschedule.') : r?.late ? t('Sesi dibatalkan (ditolak daripada pakej).') : t('Sesi dibatalkan. Tidak ditolak daripada pakej.'));
      app.render();
    } catch (e) { toast(friendlyError(e), true); }
  },
  'p-emerg': key => {
    const [kid, cid, d] = key.split('|');
    const f = openModal({ title: t('Kecemasan / MC'), submit: t('Hantar'), body: `<p class="muted" style="font-size:13px">${t('Contoh: sakit tiba-tiba, kecederaan, masuk hospital, kematian keluarga terdekat. Lampirkan MC atau bukti (boleh dihantar kemudian dalam 48 jam). Kelulusan tertakluk kepada semakan pengurusan.')}</p>
      <div class="form-grid">${F(t('Sebab'), 'reason', { type: 'textarea', req: true, full: true })}<label class="f full">${t('Bukti (gambar / PDF, maks 5MB)')}<input type="file" name="proof" accept="image/*,application/pdf"></label></div>`,
      onSubmit: async x => {
        let proof = null; const file = x.proof;
        if (file && file.size) {
          if (file.size > 5 * 1024 * 1024) throw new Error(t('Fail terlalu besar (maksimum 5MB).'));
          if (S.mode === 'supabase') { proof = `${me()}/mc-${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`; const { error } = await S.client.storage.from('payment-proofs').upload(proof, file, { contentType: file.type, upsert: false }); if (error) throw error; }
        }
        await changeSession({ p_student: kid, p_class: cid, p_date: d, p_action: 'emergency', p_reason: x.reason, p_proof: proof });
        if (S.mode === 'supabase') await refresh(['booking_requests']);
        toast(t('Permintaan kecemasan dihantar. Admin akan semak.')); app.render();
      } });
    return f;
  },
  'p-confirm': async id => {
    try {
      if (S.mode === 'demo') await update('attendance', id, { parent_confirmed: true, parent_confirmed_at: new Date().toISOString() });
      else { const { error } = await S.client.rpc('confirm_attendance', { p_attendance_id: id }); if (error) throw error; const a = byId('attendance', id); if (a) { a.parent_confirmed = true; } }
      toast(t('Kehadiran disahkan')); app.render();
    } catch (e) { toast(friendlyError(e), true); }
  },
});

/* ===================================================================== YURAN */
const BANK = () => ({ bank_name: 'Maybank', bank_account: '5142-0866-3231', bank_holder: 'Muhaimin Badminton Academy', ...(S.t.settings?.find(s => s.key === 'academy')?.value || {}) });
PV.yuran = () => {
  const ks = kids(); if (!ks.length) return head(t('Yuran'), '') + noKids();
  const invs = myInvoices().filter(i => i.status !== 'void' || creditOf(i) > 0).sort((a, b) => (b.issued_on || '').localeCompare(a.issued_on || '') || b.number.localeCompare(a.number));
  const open = invs.filter(i => i.status === 'issued'), done = invs.filter(i => i.status !== 'issued');
  const row = i => {
    const st = invStatus(i), pend = pendingOf(i), cr = creditOf(i), pays = T('payments').filter(p => p.invoice_id === i.id), conf = pays.filter(p => p.status === 'confirmed'), rej = pays.filter(p => p.status === 'rejected').slice(-1)[0];
    return `<li class="list-item" style="flex-wrap:wrap;align-items:flex-start"><div class="li-main" style="min-width:220px"><div class="li-title">${esc(kidName(i.student_id))} · <span class="num">${RM(i.amount)}</span> ${badge(st)}</div>
      <div class="li-sub">${kindLabel(i)} · ${esc(i.number)} · ${i.status === 'paid' ? t('dibayar {d}', { d: fmtShort(i.paid_on) }) : t('akhir {d}', { d: fmtShort(i.due_date) })}${cr ? ` · ${t('kredit')} -${RM(cr)}` : ''}</div>
      ${pend ? `<div class="li-sub" style="margin-top:3px"><span class="badge b-info" style="white-space:normal">${t('Bayaran {a} menunggu pengesahan admin', { a: RM(pend) })}</span></div>` : ''}
      ${rej && i.status === 'issued' ? `<div class="li-sub" style="color:var(--bad);margin-top:3px">${t('Bayaran ditolak:')} ${esc(rej.note || t('sila semak bukti dan hantar semula'))}</div>` : ''}</div>
      <div class="actions">${i.status === 'issued' && balanceOf(i) - pend > 0.001 ? `<button class="btn sm primary" data-action="p-pay" data-id="${i.id}">${t('Bayar')}</button>` : ''}<button class="btn sm" data-action="p-inv" data-id="${i.id}">${ic('file', 'sm')} ${t('Invois')}</button>${conf.map(p => `<button class="btn sm" data-action="p-receipt" data-id="${p.id}">${ic('file', 'sm')} ${t('Resit')}</button>`).join('')}</div></li>`;
  };
  const cns = T('credit_notes').filter(c => invs.some(i => i.id === c.invoice_id));
  return `${head(t('Yuran'), t('Invois, bayaran dan resit'))}
  <div class="card mb"><div class="card-head"><div><h3>${t('Belum dijelaskan')}</h3></div><span class="badge b-${open.length ? 'warn' : 'ok'}">${open.length}</span></div>${open.length ? `<ul class="list">${open.map(row).join('')}</ul>` : `<div class="empty">${t('Semua yuran telah dijelaskan. Terima kasih! 🎉')}</div>`}</div>
  ${done.length ? `<div class="card mb"><div class="card-head"><div><h3>${t('Sejarah')}</h3></div></div><ul class="list">${done.slice(0, 30).map(row).join('')}</ul></div>` : ''}
  ${cns.length ? `<div class="card"><div class="card-head"><div><h3>${t('Nota Kredit')}</h3></div></div><ul class="list">${cns.map(c => `<li class="list-item"><div class="li-main"><div class="li-title">${esc(c.number)} · <span class="num">-${RM(c.amount)}</span></div><div class="li-sub">${esc(byId('invoices', c.invoice_id)?.number || '')} · ${fmtDate(c.issued_on)}${c.reason ? ' · ' + esc(c.reason) : ''}</div></div><button class="btn sm" data-action="p-cn" data-id="${c.id}">${ic('file', 'sm')} ${t('Cetak')}</button></li>`).join('')}</ul></div>` : ''}`;
};

Object.assign(ACTIONS, {
  'p-inv': id => openInvoice(id), 'p-cn': id => openCreditNote(id),
  'p-receipt': id => { try { openReceipt(id); } catch (e) { toast(friendlyError(e), true); } },
  'p-pay': id => {
    const inv = byId('invoices', id), due = Math.max(balanceOf(inv) - pendingOf(inv), 0), b = BANK();
    openModal({
      title: `${t('Bayar')} — ${esc(kidName(inv.student_id))}`, submit: t('Hantar Bukti Bayaran'), wide: true,
      body: `<div class="card card-pad" style="background:var(--bg,#f6f7fb);margin-bottom:14px"><div style="font-size:12px;color:var(--muted)">${esc(inv.number)} · ${kindLabel(inv)}</div><div style="font-size:26px;font-weight:800">${RM(due)}</div></div>
      <div class="grid g-2" style="gap:12px;margin-bottom:14px">
        <div style="text-align:center"><div class="muted" style="font-size:12px;margin-bottom:4px">Maybank QR / DuitNow</div><img src="assets/qr-maybank.png" alt="QR Maybank" style="max-width:100%;width:210px;border-radius:10px;border:1px solid var(--line)"></div>
        <div style="text-align:center"><div class="muted" style="font-size:12px;margin-bottom:4px">Touch 'n Go eWallet</div><img src="assets/qr-tng.png" alt="QR Touch n Go" style="max-width:100%;width:210px;border-radius:10px;border:1px solid var(--line)"></div></div>
      <div class="muted" style="font-size:13px;margin-bottom:14px">${t('Atau pindahan bank:')} <b>${esc(b.bank_name)}</b> ${esc(b.bank_account)} · ${esc(b.bank_holder)}. ${t('Sila masukkan <b>{no}</b> dalam rujukan bayaran.', { no: esc(inv.number) })}</div>
      <div class="form-grid">
        ${F(t('Amaun dibayar (RM)'), 'amount', { type: 'number', step: '0.01', min: 0.01, max: due, value: due.toFixed(2), req: true })}
        ${F(t('Kaedah'), 'method', { opts: [['duitnow', 'DuitNow / Maybank QR'], ['other', "Touch 'n Go eWallet"], ['transfer', t('Pindahan Bank')]] })}
        ${F(t('Tarikh bayaran'), 'paid_on', { type: 'date', value: todayISO(), req: true })}
        ${F(t('No. rujukan (jika ada)'), 'reference')}
        <label class="f full">${t('Bukti bayaran (tangkapan skrin / PDF)')}<input name="proof" type="file" accept="image/*,application/pdf" ${S.mode === 'demo' ? '' : 'required'}></label>
      </div><p class="muted" style="margin-top:10px;font-size:12.5px">${t('Admin akan menyemak bukti anda. Resit tersedia di sini selepas bayaran disahkan.')}</p>`,
      onSubmit: async d => {
        const amt = Number(d.amount); if (!(amt > 0) || amt > due + 0.001) throw new Error(t('Amaun mesti antara RM0.01 dan {max}.', { max: RM(due) }));
        let proof_path = null; const f = d.proof;
        if (f && f.size) {
          if (f.size > 5 * 1024 * 1024) throw new Error(t('Fail terlalu besar (maksimum 5MB).'));
          if (S.mode === 'supabase') {
            proof_path = `${me()}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
            const { error } = await S.client.storage.from('payment-proofs').upload(proof_path, f, { contentType: f.type, upsert: false }); if (error) throw error;
          }
        }
        await insert('payments', { invoice_id: id, amount: amt, method: d.method, paid_on: d.paid_on, reference: d.reference || null, status: 'pending', proof_path, submitted_by: S.mode === 'demo' ? null : me(), submitted_at: new Date().toISOString() });
        toast(t('Bukti dihantar. Admin akan mengesahkan tidak lama lagi.')); app.render();
      },
    });
  },
});

/* ===================================================================== PROGRES */
const SK = [['footwork', 'Gerak kaki'], ['strokes', 'Pukulan'], ['tactics', 'Taktikal'], ['fitness', 'Fizikal'], ['attitude', 'Sikap']];
PV.progres = () => {
  const k = curKid(); if (!k) return head(t('Progres'), '') + noKids();
  const recs = T('progress_records').filter(r => r.student_id === k.id).sort((a, b) => (b.recorded_on || '').localeCompare(a.recorded_on || ''));
  return `${head(t('Progres'), t('Penilaian daripada jurulatih (skala 1–5)'))}${kidTabs()}
  ${recs.length ? recs.slice(0, 10).map(r => `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><b>${fmtDate(r.recorded_on)}</b><span class="muted" style="font-size:12px">${esc(r.coach_id ? staffName(r.coach_id) : '')}</span></div>
    ${SK.map(([f, l]) => r[f] ? `<div style="display:flex;align-items:center;gap:10px;font-size:13px;margin:5px 0"><span style="width:84px">${t(l)}</span><div class="bar" style="flex:1"><span style="width:${r[f] * 20}%;background:var(--ok)"></span></div><b class="num">${r[f]}/5</b></div>` : '').join('')}
    ${r.title ? `<div style="margin-top:10px;font-weight:700">${esc(r.title)}</div>` : ''}${r.notes ? `<div class="muted" style="margin-top:6px;font-size:13px;white-space:pre-line">${esc(r.notes)}</div>` : ''}${mediaGrid(r.media)}</div>`).join('') : `<div class="card card-pad"><div class="empty">${t('Belum ada penilaian untuk {name}.', { name: esc(k.full_name) })}</div></div>`}`;
};

/* ===================================================================== AKAUN + NOTIFIKASI */
const ID_KEYS = { nric: 'No. Kad Pengenalan (NRIC)', passport: 'No. Pasport', army: 'No. Tentera/Polis', brn: 'No. Pendaftaran Syarikat' };
const idLbl = k => (ID_KEYS[k] ? t(ID_KEYS[k]) : 'ID');
const taxCard = () => {
  const x = (S.t.parent_tax_info || []).find(r => r.id === me());
  return `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><b>${t('Maklumat cukai & e-invois')}</b><div class="muted" style="font-size:12.5px;margin-top:4px">${t('Untuk invois atas nama anda dan tuntutan pelepasan cukai sukan (LHDN).')}</div></div><button class="btn sm primary" data-action="p-tax">${ic('edit', 'sm')} ${x ? t('Edit') : t('Isi')}</button></div>
  ${x ? `<div style="margin-top:12px;font-size:13.5px;line-height:1.7"><div>${esc(x.legal_name || '—')}</div><div class="muted">${esc(idLbl(x.id_type))}: ${esc(x.id_no || '—')}</div><div class="muted">TIN: ${esc(x.tin || '—')}</div>${x.address ? `<div class="muted">${esc(x.address)}</div>` : ''}</div>` : `<div class="muted" style="margin-top:10px;font-size:13px">${t('Belum diisi. Anda boleh isi sekarang supaya invois terus memaparkan maklumat anda.')}</div>`}</div>`;
};
PV.akaun = () => `${head(t('Akaun'), '')}<div class="card card-pad mb"><div class="cell-person">${avatar(S.profile.full_name || S.profile.email)}<div><b>${esc(S.profile.full_name || '')}</b><span>${esc(S.profile.email || '')}</span></div></div>
  <div class="actions" style="margin-top:14px"><button class="btn" data-action="p-pw">${t('Tukar kata laluan')}</button><button class="btn danger-o" data-action="logout">${ic('logout', 'sm')} ${t('Log keluar')}</button></div></div>
  <div class="card card-pad mb"><b>${t('Tetapan paparan')}</b>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px"><span>${t('Bahasa')}</span>${langSwitch()}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px"><span>${t('Tema')}</span>${themeSwitch()}</div></div>
  ${taxCard()}
  <div class="card card-pad"><b>${t('Anak anda')}</b>${kids().map(k => `<div style="margin-top:8px">${esc(k.full_name)} <span class="muted">· ${esc(progName(k.programme_id))}</span></div>`).join('') || `<div class="muted">${t('Belum ada anak dipautkan.')}</div>`}
  <p class="muted" style="margin-top:12px;font-size:12.5px">${t('Untuk menukar maklumat anak atau nombor telefon, hubungi admin akademi.')}</p></div>`;
Object.assign(ACTIONS, {
  'p-tax': () => {
    const x = (S.t.parent_tax_info || []).find(r => r.id === me()) || {};
    openModal({
      title: t('Maklumat Cukai & E-Invois'), submit: t('Simpan'), wide: true,
      body: `<div class="form-grid">
        ${F(t('Nama penuh (seperti dalam kad pengenalan)'), 'legal_name', { value: x.legal_name || S.profile.full_name, req: true, full: true })}
        ${F(t('Jenis ID'), 'id_type', { value: x.id_type || 'nric', opts: Object.keys(ID_KEYS).map(k => [k, idLbl(k)]) })}
        ${F(t('No. ID'), 'id_no', { value: x.id_no, req: true, ph: '900101-14-5678' })}
        ${F(t('No. TIN LHDN (jika ada)'), 'tin', { value: x.tin, full: true, ph: 'IG12345678901' })}
        ${F(t('Alamat'), 'address', { type: 'textarea', value: x.address, full: true })}
        ${F(t('Telefon'), 'phone', { value: x.phone })}${F(t('E-mel'), 'email', { type: 'email', value: x.email })}
      </div><p class="muted" style="margin-top:10px;font-size:12.5px">${t('Maklumat ini hanya boleh dilihat oleh anda dan admin akademi, dan digunakan pada invois serta e-invois.')}</p>`,
      onSubmit: async d => {
        const row = { legal_name: d.legal_name.trim(), id_type: d.id_type, id_no: d.id_no.trim(), tin: (d.tin || '').trim().toUpperCase() || null, address: (d.address || '').trim() || null, phone: (d.phone || '').trim() || null, email: (d.email || '').trim() || null };
        if (!row.legal_name || !row.id_no) throw new Error(t('Nama dan No. ID diperlukan.'));
        if (x.id) await update('parent_tax_info', me(), row); else await insert('parent_tax_info', { id: me(), ...row });
        toast(t('Maklumat cukai disimpan')); app.render();
      },
    });
  },
  'p-pw': () => openModal({ title: t('Tukar Kata Laluan'), submit: t('Simpan'), body: `<div class="form-grid">${F(t('Kata laluan baharu (min. 8 aksara)'), 'p1', { type: 'password', req: true, full: true })}${F(t('Ulang kata laluan'), 'p2', { type: 'password', req: true, full: true })}</div>`,
    onSubmit: async d => { if (d.p1.length < 8) throw new Error(t('Kata laluan mesti sekurang-kurangnya 8 aksara.')); if (d.p1 !== d.p2) throw new Error(t('Kata laluan tidak sepadan.')); if (S.mode === 'demo') return toast(t('Mod demo: tiada perubahan.')); await setPassword(d.p1); toast(t('Kata laluan dikemas kini')); } }),
  'p-notif': async () => {
    const ns = T('notifications').slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 30), ids = ns.filter(n => !n.read_at).map(n => n.id);
    openModal({ title: t('Notifikasi'), cancel: t('Tutup'), body: ns.length ? `<ul class="list" style="margin:0 -20px">${ns.map(n => `<li class="list-item" style="padding:10px 20px;${n.read_at ? '' : 'background:var(--brand-soft,#eef2ff)'}"><div class="li-main"><div class="li-title">${esc(n.title)}</div><div class="li-sub">${esc(n.body || '')}</div><div class="li-sub" style="font-size:11px">${fmtDate((n.created_at || '').slice(0, 10))}</div></div></li>`).join('')}</ul>` : `<div class="empty">${t('Tiada notifikasi.')}</div>` });
    if (ids.length) { try { await markRead(ids); render(); } catch (e) { console.warn(e); } }
  },
});
