// Portal Coach: sesi hari ini & minggu ini (termasuk kategori umur yang diberi), tanda kehadiran, pelajar, akaun.
import { ACTIONS, INPUTS } from '../registry.js';
import { S, loadCoach, markRead, subscribeNotifications, subscribeTables, setPassword, insert, rpc } from '../data.js';
import { uploadMedia, mediaGrid, publicUrl, photoAvatar } from '../media.js';
import { planCard, planView, openPlanEditor, copyPlan } from '../planner.js';
import { LANGS_ALL } from '../admin/sessions.js';
import { $, esc, ic, F, avatar, UI, app, toast, openModal, fmtDate, fmtShort, hm, todayISO, addDays, parseISO, DAYS, LABEL, friendlyError, liveRender } from '../ui.js';
import { T, byId, venueName, progName, attRate, studentName } from '../admin/helpers.js';
import { courtLbl, calItems, sessionAlerts, sTime, sCourt, groupsOf, rosterOf, ageOn, ageCat, isPersonal, ensureSession, openSession, langName } from '../admin/sessions.js';
import { setI18nActive } from '../i18n.js';
import { annCard, visibleAnns } from '../admin/announce.js';
import { startDomI18n } from '../i18n-dom.js';
import { langSwitch } from '../i18n.js';
import { themeSwitch } from '../theme.js';

const CV = {};
const SKILLS = [['footwork', 'Footwork'], ['strokes', 'Pukulan'], ['tactics', 'Taktik'], ['fitness', 'Kecergasan'], ['attitude', 'Sikap']];
const NAV = [['hari', 'Hari Ini', 'home'], ['minggu', 'Minggu Ini', 'calendar'], ['pelajar', 'Pelajar', 'users'], ['pelan', 'Pelan Latihan', 'check'], ['akaun', 'Akaun', 'user']];
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
  if (UI.cob) { $('#view').innerHTML = onboard(); $('#crumbTitle').textContent = 'Selamat datang'; $('#nav').innerHTML = ''; $('#bottomnav').innerHTML = ''; return; }
  const id = parse(), sy = window.scrollY;
  try { $('#view').innerHTML = CV[id](); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card card-pad"><b>Ralat memaparkan halaman.</b><p class="muted">${esc(e.message)}</p></div>`; }
  const item = NAV.find(n => n[0] === id) || [id, id === 'kursus' ? 'Kursus' : 'Berita & acara', 'msg'];
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
  if (S.mode === 'supabase' ? (S.profile.must_change_pw || !S.profile.tc_accepted_at) : /onboard/.test(location.search)) UI.cob = S.profile.must_change_pw ? 1 : 2;
  subscribeNotifications(n => { if (n?.title) toast('🔔 ' + n.title); liveRender(render); });
  subscribeTables(['attendance', 'class_sessions', 'announcements', 'feedback', 'progress_records', 'trials', 'events', 'booking_requests', 'lesson_plans'], () => liveRender(render));
  window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); render(); window.scrollTo(0, 0); });
  render();
}

/* ---- Onboarding coach: kata laluan → paparan → profil → panduan ---- */
function onboard() {
  const st = meStaff(), step = UI.cob, bar = `<div class="chips mb">${['Kata laluan', 'Paparan', 'Profil coach', 'Panduan'].map((l, i) => `<span class="chip ${step === i + 1 ? 'on' : ''}">${i + 1}. ${l}</span>`).join('')}</div>`;
  let b = '';
  if (step === 1) b = `<h3>Tukar kata laluan sementara</h3><div class="form-grid" style="margin-top:12px"><label class="f full">Kata laluan baharu (min. 8 aksara)<input type="password" id="cP1"></label><label class="f full">Ulang kata laluan<input type="password" id="cP2"></label></div><button class="btn primary" style="margin-top:14px" data-action="cob-pw">Simpan & teruskan</button>`;
  if (step === 2) b = `<h3>Bahasa & tema</h3><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px"><span>Bahasa</span>${langSwitch()}</div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px"><span>Tema</span>${themeSwitch()}</div><button class="btn primary" style="margin-top:16px" data-action="cob-go" data-id="3">Teruskan</button>`;
  if (step === 3) b = `<h3>Profil coach</h3><p class="muted" style="font-size:13px;margin:4px 0 12px">Admin guna maklumat ini untuk menetapkan kelas yang sesuai (cth. lokasi yang memerlukan coach berbahasa Inggeris). Ibu bapa nampak bahasa & kelayakan semasa memilih coach personal.</p>
    <div class="f full">Bahasa pertuturan<div class="langchk">${LANGS_ALL.map(([k, l]) => `<label><input type="checkbox" name="clang" value="${k}" ${(st?.languages || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
    <label class="f full" style="margin-top:10px">Kelayakan & pencapaian<textarea id="cQual" placeholder="cth. BAM Level 2, bekas pemain negeri">${esc(st?.qualifications || '')}</textarea></label>
    <label class="f full" style="margin-top:10px">No. telefon<input id="cPhone" value="${esc(st?.phone || '')}"></label>
    <button class="btn primary" style="margin-top:14px" data-action="cob-prof">Simpan & teruskan</button>`;
  if (step === 4) b = `<h3>Cara guna Portal Coach</h3><ol style="margin:10px 0 0 18px;line-height:1.8;font-size:13.5px">
      <li>Hari Ini — sesi anda hari ini. Tekan sesi untuk tanda kehadiran (Semua hadir / ikut pelajar) dan tulis nota latihan.</li>
      <li>Kategori umur (U8/U12/U17) yang diberikan kepada anda ditunjukkan pada setiap sesi, bersama nombor court.</li>
      <li>Pelajar — tekan nama pelajar untuk lihat maklumat kesihatan dan tambah progres dengan gambar atau video. Ibu bapa akan nampak di portal mereka.</li>
      <li>Nama pelajar Trial dan nota kesihatan ⚕ dipaparkan dalam panel sesi — sila beri perhatian.</li>
      <li>Berita & acara akademi dipaparkan di Hari Ini. Notifikasi di ikon loceng.</li></ol>
    <button class="btn primary" style="margin-top:16px" data-action="cob-done">Mula guna portal</button>`;
  return `<div class="page-head"><div><h1>Selamat datang, Coach ${esc((st?.full_name || S.profile.full_name || '').split(' ')[0])} 👋</h1><p>Lengkapkan langkah ringkas ini sebelum mula.</p></div></div>${bar}<div class="card card-pad">${b}</div>`;
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
  ${past.length ? `<h3 style="font-size:14px;margin:18px 0 8px">Belum ditanda (7 hari lepas)</h3>${past.map(x => card(x, true)).join('')}` : ''}
  ${T('events').filter(e => e.start_date >= today && e.status !== 'cancelled').length ? `<h3 style="font-size:14px;margin:20px 0 8px">Acara akan datang</h3>${T('events').filter(e => e.start_date >= today && e.status !== 'cancelled').sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 3).map(e => `<div class="card card-pad mb"><b>${esc(e.name)}</b><div class="muted" style="font-size:12.5px">${fmtDate(e.start_date)}${e.start_time ? ' · ' + hm(e.start_time) : ''}${e.venue_note ? ' · ' + esc(e.venue_note) : e.venue_id ? ' · ' + esc(venueName(e.venue_id)) : ''}${(e.staff_ids || []).includes(me.id) ? ' · <b>Anda bertugas</b>' : ''}</div></div>`).join('')}` : ''}
  ${T('courses').some(c => c.status === 'published') ? `<a class="card card-pad mb" href="#kursus" style="display:block;text-decoration:none;color:inherit">${ic('award', 'sm')} <b>Kursus</b> <span class="muted" style="font-size:12.5px">— bahan pembelajaran akademi →</span></a>` : ''}
  ${visibleAnns().length ? `<div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 10px"><h3 style="font-size:14px">Berita & acara terkini</h3><a class="btn sm ghost" href="#berita">Lihat semua</a></div>${visibleAnns().slice(0, 2).map(a => annCard(a)).join('')}` : ''}`;
};
CV.berita = () => `${head('Berita & acara', 'Pengumuman akademi')}${visibleAnns().map(a => annCard(a)).join('') || '<div class="card empty">Belum ada berita.</div>'}`;
CV.pelan = () => { const me = st(), mine = T('lesson_plans').filter(p => p.coach_id === me?.id && !p.is_template).sort((a, b) => (b.plan_date || '').localeCompare(a.plan_date || '')), tpl = T('lesson_plans').filter(p => p.is_template);
  return `${head('Pelan Latihan', 'Rancang sesi: warm up, footwork, feeding, fizikal, sparring, pemerhatian & kelas seterusnya')}<button class="btn primary mb" data-action="c-lp-new">${ic('plus', 'sm')} Pelan baharu</button>
  ${tpl.length ? `<h3 style="font-size:14px;margin:6px 0 8px">Templat</h3>${tpl.map(p => planCard(p, { canEdit: p.coach_id === me?.id })).join('')}` : ''}
  <h3 style="font-size:14px;margin:12px 0 8px">Pelan saya</h3>${mine.map(p => planCard(p)).join('') || '<div class="card empty">Belum ada pelan. Tekan "Pelan baharu" atau salin templat.</div>'}`; };
CV.kursus = () => { const cs = T('courses').filter(c => c.status === 'published'); return `${head('Kursus', 'Bahan pembelajaran akademi')}${cs.map(c => `<div class="card card-pad mb"><b>${esc(c.title)}</b>${c.summary ? `<p class="muted" style="font-size:13px">${esc(c.summary)}</p>` : ''}<ol style="margin:8px 0 0 18px;font-size:13.5px">${T('course_lessons').filter(l => l.course_id === c.id).sort((a, b) => a.sort - b.sort).map(l => `<li style="margin-bottom:6px"><b>${esc(l.title)}</b>${l.video_url ? ` · <a target="_blank" rel="noopener" href="${esc(l.video_url)}">video</a>` : ''}${l.body ? `<div style="white-space:pre-line">${esc(l.body)}</div>` : ''}</li>`).join('')}</ol></div>`).join('') || '<div class="card empty">Belum ada kursus.</div>'}`; };
CV.minggu = () => {
  const today = todayISO(), list = mine(today, addDays(today, 7)), days = [...new Set(list.map(x => x.date))];
  return `${head('Minggu Ini', '7 hari akan datang')}${days.map(d => `<div class="daylist"><div class="dh">${DAYS[parseISO(d).getDay()]}, ${fmtDate(d)}</div>${list.filter(x => x.date === d).map(x => card(x)).join('')}</div>`).join('') || '<div class="card empty">Tiada sesi.</div>'}`;
};
CV.pelajar = () => {
  const today = todayISO(), ids = new Set(); mine(addDays(today, -60), addDays(today, 14)).forEach(({ s, c }) => rosterOf(s, c).forEach(x => ids.add(x.id)));
  T('class_enrolments').filter(e => T('classes').some(c => c.id === e.class_id && c.coach_id === st()?.id)).forEach(e => ids.add(e.student_id));
  const list = [...ids].map(id => byId('students', id)).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return `${head('Pelajar', `${list.length} pelajar dalam sesi anda`)}<div class="card"><ul class="list">${list.map(x => { const r = attRate(x.id); return `<li class="list-item" style="cursor:pointer" data-action="c-student" data-id="${x.id}">${photoAvatar(x.full_name, x.photo_path, { priv: true })}<div class="li-main"><div class="li-title">${esc(x.full_name)}${x.medical_notes ? ' <span style="color:var(--bad)">⚕</span>' : ''}</div>
    <div class="li-sub">${x.birth_date ? ageOn(x.birth_date) + ' thn · ' + esc(ageCat(x) || '') + ' · ' : ''}${esc(progName(x.programme_id))}</div></div>${r != null ? `<b class="num" style="color:${r < 75 ? 'var(--bad)' : 'var(--ok)'}">${r}%</b>` : ''}</li>`; }).join('') || '<li class="empty">Belum ada pelajar.</li>'}</ul></div>`;
};
CV.akaun = () => { const me = st(); return `${head('Akaun', '')}<div class="card card-pad mb"><div class="cell-person">${photoAvatar(S.profile.full_name || S.profile.email, me?.photo_path, { size: 56 })}<div><b>${esc(S.profile.full_name || '')}</b><span>${esc(S.profile.email || '')}</span></div></div>
  ${me ? `<p class="muted" style="margin-top:10px;font-size:13px">Bahasa: ${(me.languages || []).map(langName).join(', ') || '—'}${me.qualifications ? '<br>Kelayakan: ' + esc(me.qualifications) : ''}</p>` : ''}
  <div class="actions" style="margin-top:14px">${me ? `<label class="btn" style="cursor:pointer">📷 ${me.photo_path ? 'Tukar gambar profil' : 'Tambah gambar profil'}<input type="file" accept="image/*" style="display:none" data-on-change="c-photo"></label>` : ''}${'Notification' in window && Notification.permission === 'default' ? '<button class="btn" data-action="notif-perm">🔔 Hidupkan notifikasi</button>' : ''}<button class="btn" data-action="c-pw">Tukar kata laluan</button><button class="btn danger-o" data-action="logout">${ic('logout', 'sm')} Log keluar</button></div></div>
  ${T('feedback').length ? `<div class="card mb"><div class="card-head"><div><h3>Maklum balas ibu bapa</h3><div class="sub">Untuk sesi anda</div></div><b>${(T('feedback').reduce((n, f) => n + f.rating, 0) / T('feedback').length).toFixed(1)} ★</b></div><ul class="list">${T('feedback').slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10).map(f => `<li class="list-item"><div class="li-main"><div class="li-title"><span style="color:#f5b301">${'★'.repeat(f.rating)}</span><span style="color:#d1d5db">${'★'.repeat(5 - f.rating)}</span> ${esc(studentName(f.student_id) || '')}</div>${f.comment ? `<div class="li-sub">“${esc(f.comment)}”</div>` : ''}<div class="li-sub">${fmtShort((f.created_at || '').slice(0, 10))}</div></div></li>`).join('')}</ul></div>` : ''}
  <div class="card card-pad"><b>Tetapan paparan</b>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px"><span>Bahasa</span>${langSwitch()}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px"><span>Tema</span>${themeSwitch()}</div></div>`; };

Object.assign(ACTIONS, {
  'cob-pw': async () => { const a = $('#cP1').value, b = $('#cP2').value; if (a.length < 8) return toast('Kata laluan mesti sekurang-kurangnya 8 aksara.', true); if (a !== b) return toast('Kata laluan tidak sepadan.', true);
    try { if (S.mode === 'supabase') await setPassword(a); UI.cob = 2; render(); } catch (e) { toast(friendlyError(e), true); } },
  'cob-go': n => { UI.cob = Number(n); render(); },
  'cob-prof': async () => {
    const langs = [...document.querySelectorAll('[name=clang]:checked')].map(x => x.value), q = $('#cQual').value, ph = $('#cPhone').value;
    try { if (S.mode === 'supabase') await rpc('coach_update_self', { p_langs: langs, p_quals: q, p_phone: ph }); const st = meStaff(); if (st) Object.assign(st, { languages: langs, qualifications: q || null, phone: ph || st.phone }); UI.cob = 4; render(); }
    catch (e) { toast(friendlyError(e), true); }
  },
  'cob-done': async () => { try { if (S.mode === 'supabase') await rpc('user_onboard_done'); S.profile.must_change_pw = false; S.profile.tc_accepted_at = new Date().toISOString(); UI.cob = 0; renderShell(); render(); toast('Selamat bertugas!'); } catch (e) { toast(friendlyError(e), true); } },
  /* Profil pelajar + progres bergambar/video */
  'c-student': id => {
    const x = byId('students', id), recs = T('progress_records').filter(r => r.student_id === id).sort((a, b) => (b.recorded_on || '').localeCompare(a.recorded_on || '')).slice(0, 8);
    openModal({ title: esc(x.full_name), wide: true, cancel: 'Tutup', body: `<p class="muted">${x.birth_date ? ageOn(x.birth_date) + ' thn · ' + esc(ageCat(x) || '') + ' · ' : ''}${esc(progName(x.programme_id))}</p>
      ${x.medical_notes ? `<div class="hint bad" style="margin-top:10px">⚕ ${esc(x.medical_notes)}</div>` : ''}${x.emergency_contact ? `<p style="margin-top:8px;font-size:13px">Kecemasan: <b>${esc(x.emergency_contact)}</b></p>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px"><h3 style="font-size:14.5px">Progres</h3><button class="btn sm primary" data-action="c-prog-add" data-id="${id}">${ic('plus', 'sm')} Tambah progres</button></div>
      ${recs.map(r => `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between"><b>${esc(r.title || 'Penilaian')}</b><span class="muted" style="font-size:12px">${fmtShort(r.recorded_on)}</span></div>
        <div class="muted" style="font-size:12.5px;margin-top:4px">${SKILLS.filter(([f]) => r[f]).map(([f, l]) => `${l} ${r[f]}/5`).join(' · ')}</div>${r.notes ? `<p style="font-size:13px;margin-top:6px;white-space:pre-line">${esc(r.notes)}</p>` : ''}${mediaGrid(r.media)}</div>`).join('') || '<div class="empty">Belum ada rekod progres.</div>'}` });
  },
  'c-prog-add': id => {
    const sel = n => `<label class="f">${n[1]}<select name="${n[0]}"><option value="">—</option>${[1, 2, 3, 4, 5].map(v => `<option>${v}</option>`).join('')}</select></label>`;
    openModal({ title: 'Tambah progres — ' + esc(studentName(id)), submit: 'Simpan', wide: true, body: `<div class="form-grid">
      ${F('Tajuk', 'title', { full: true, ph: 'cth. Latihan smash — minggu 2' })}${SKILLS.map(sel).join('')}
      ${F('Nota untuk ibu bapa', 'notes', { type: 'textarea', full: true })}
      <label class="f full">Gambar / video (boleh pilih beberapa; video maks 50MB)<input type="file" name="files" multiple accept="image/*,video/*"></label></div>`,
      onSubmit: async d => {
        const files = [].concat(d.files || []).filter(f => f && f.size), media = [];
        for (const f of files) { const path = await uploadMedia('progress-media', id, f, { maxMB: f.type.startsWith('video/') ? 50 : 10 }); media.push({ path, type: f.type }); }
        const row = { student_id: id, coach_id: meStaff()?.id || null, recorded_on: todayISO(), title: d.title || null, notes: d.notes || null, media };
        SKILLS.forEach(([f]) => { if (d[f]) row[f] = Number(d[f]); });
        await insert('progress_records', row); toast('Progres disimpan — ibu bapa boleh lihat di portal'); setTimeout(() => ACTIONS['c-student'](id), 60);
      } });
  },
  'c-lp-new': () => openPlanEditor(null, { coachId: st()?.id || null, onSaved: () => render() }),
  'lp-edit': id => openPlanEditor(byId('lesson_plans', id), { onSaved: () => render() }),
  'lp-view': id => { const p = byId('lesson_plans', id); openModal({ title: esc(p.title), wide: true, cancel: 'Tutup', body: planView(p) }); },
  'lp-copy': async id => { await copyPlan(byId('lesson_plans', id), st()?.id); toast('Pelan disalin'); render(); },
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

INPUTS['c-photo'] = async (v, el) => {
  const f = el.files?.[0], me = st(); if (!f || !me) return;
  try { const path = await uploadMedia('public-media', 'staff/' + me.id, f, { maxMB: 5 });
    if (S.mode === 'supabase') await rpc('coach_set_photo', { p_path: path });
    me.photo_path = path; toast('Gambar profil disimpan — dipaparkan kepada ibu bapa semasa memilih coach'); render(); }
  catch (e) { toast(friendlyError(e), true); }
};
