// Portal Ibu Bapa & Pelajar: ringkasan anak, jadual & tempahan, yuran (bayar + bukti + resit), progres.
// Semua teks melalui t() supaya boleh dipaparkan dalam BM / English / 中文.
import { ACTIONS, INPUTS } from '../registry.js';
import { S, loadParent, insert, update, remove, refresh, markRead, subscribeNotifications, setPassword } from '../data.js';
import { $, esc, ic, F, RM, badge, avatar, UI, app, toast, openModal, confirmModal, fmtDate, fmtShort, hm, todayISO, addDays, DAYS, LABEL, friendlyError } from '../ui.js';
import { T, byId, venueName, progName, staffName, invStatus, paidOf, creditOf, pkgRemaining } from '../admin/helpers.js';
import { openReceipt } from '../receipt.js';
import { openInvoice, openCreditNote } from '../invoice.js';
import { t, langSwitch, setI18nActive } from '../i18n.js';
import { themeSwitch } from '../theme.js';
import { tr } from '../i18n-dom.js';

const PV = {};
const NAV = [['utama', 'Utama', 'home'], ['jadual', 'Jadual', 'calendar'], ['yuran', 'Yuran', 'wallet'], ['progres', 'Progres', 'trend'], ['akaun', 'Akaun', 'user']];
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
  if (!$('#view')) return;
  const id = parse(), sy = window.scrollY;
  try { $('#view').innerHTML = PV[id](); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>${t('Ralat memaparkan halaman.')}</b><p class="muted">${esc(e.message)}</p></div>`; }
  const item = NAV.find(n => n[0] === id);
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
  render();
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
  ${due.length ? `<div class="card mb" style="border-color:var(--warn)"><div class="card-head"><div><h3>${t('Yuran belum dijelaskan')}</h3><div class="sub">${t('Bayar melalui QR atau pindahan bank, kemudian muat naik bukti.')}</div></div><span class="badge b-warn">${due.length}</span></div>
    <ul class="list">${due.map(i => `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${esc(kidName(i.student_id))} · <span class="num">${RM(balanceOf(i) - pendingOf(i))}</span></div><div class="li-sub">${kindLabel(i)} · ${esc(i.number)} · ${t('akhir {d}', { d: fmtShort(i.due_date) })}</div></div>
    <div class="actions"><button class="btn sm primary" data-action="p-pay" data-id="${i.id}">${t('Bayar')}</button></div></li>`).join('')}</ul></div>` : ''}
  ${toConfirm.length ? `<div class="card card-pad mb" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>${t('{n} kehadiran menunggu pengesahan anda', { n: toConfirm.length })}</b><div class="muted" style="font-size:13px">${t('Sahkan anak benar-benar hadir.')}</div></div><a class="btn sm primary" href="#jadual">${t('Semak')}</a></div>` : ''}
  ${ks.map(k => { const ps = activePkgs(k.id), ses = nextSessions(k.id)[0]; return `<div class="card card-pad mb">
    <div class="cell-person" style="margin-bottom:12px">${avatar(k.full_name)}<div><b>${esc(k.full_name)}</b><span>${esc([progName(k.programme_id), venueName(k.venue_id)].filter(x => x && x !== '—').join(' · '))}</span></div></div>
    ${ps.length ? ps.map(p => { const rem = pkgRemaining(p), pct = Math.round(rem / p.sessions_total * 100); return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(p.name)}</b><span class="num"><b>${rem}</b> / ${p.sessions_total} ${t('sesi')}</span></div>
      <div class="bar lg" style="margin-top:6px"><span style="width:${pct}%;background:${rem <= 1 ? 'var(--bad)' : 'var(--ok)'}"></span></div>
      <div class="muted" style="font-size:12px;margin-top:4px">${p.expires_on ? t('Sah hingga {d}', { d: fmtDate(p.expires_on) }) : ''}${rem <= 1 ? ` · <b style="color:var(--bad)">${t('hampir habis')}</b>, ${t('invois pembaharuan akan dikeluarkan')}` : ''}</div></div>`; }).join('')
      : `<div class="muted" style="font-size:13px;margin-bottom:10px">${t('Tiada pakej aktif')}${T('student_packages').some(p => p.student_id === k.id && p.status === 'pending') ? ' · ' + t('menunggu bayaran') : ''}.</div>`}
    <div style="font-size:13px;display:flex;gap:8px;align-items:center">${ic('calendar', 'sm')}${ses ? `<span><b>${t('Sesi seterusnya:')}</b> ${when(ses.date, ses.c)}</span>` : `<span class="muted">${t('Tiada sesi akan datang dijadualkan.')}</span>`}</div></div>`; }).join('')}`;
};

/* sesi akan datang untuk seorang anak: kelas berdaftar + tempahan */
function nextSessions(kidId, days = 30) {
  const today = todayISO(), end = addDays(today, days);
  const cls = new Set(T('class_enrolments').filter(e => e.student_id === kidId).map(e => e.class_id));
  const bookedIds = new Map(T('attendance').filter(a => a.student_id === kidId && a.status === 'booked').map(a => [a.session_id, a]));
  const out = [];
  T('class_sessions').filter(s => s.session_date >= today && s.session_date <= end && s.status !== 'cancelled' && (cls.has(s.class_id) || bookedIds.has(s.id))).forEach(s => {
    const c = byId('classes', s.class_id); out.push({ id: s.id, date: s.session_date, c, booking: bookedIds.get(s.id) || null, fixed: cls.has(s.class_id) });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.c?.start_time || '').localeCompare(b.c?.start_time || ''));
}

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
  const hist = T('attendance').filter(a => a.student_id === k.id && a.status !== 'booked').sort((a, b) => (b.session_date || '').localeCompare(a.session_date || '')).slice(0, 15);
  const hrs = Number(S.t.settings?.find(s => s.key === 'billing')?.value?.cancel_notice_hours ?? 48);
  return `${head(t('Jadual'), t('Sesi akan datang, tempahan dan sejarah kehadiran'))}${kidTabs()}
  <div class="card mb"><div class="card-head"><div><h3>${t('Sesi akan datang')} — ${esc(k.full_name)}</h3><div class="sub">${t('30 hari seterusnya')}</div></div></div>
   ${up.length ? `<ul class="list">${up.map(u => `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${when(u.date, u.c)}</div><div class="li-sub">${esc(where(u.c))}</div></div>
     ${u.booking ? `<div class="actions"><span class="badge b-info">${t('Ditempah')}</span><button class="btn sm danger-o" data-action="p-cancel" data-id="${u.booking.id}">${t('Batal')}</button></div>` : `<span class="badge b-muted">${t('Kelas tetap')}</span>`}</li>`).join('')}</ul>` : `<div class="empty">${t('Tiada sesi dijadualkan dalam 30 hari ini.')}</div>`}</div>
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
    ${r.notes ? `<div class="muted" style="margin-top:10px;font-size:13px">${esc(r.notes)}</div>` : ''}</div>`).join('') : `<div class="card card-pad"><div class="empty">${t('Belum ada penilaian untuk {name}.', { name: esc(k.full_name) })}</div></div>`}`;
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
