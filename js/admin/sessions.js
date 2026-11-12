// Sesi bertarikh: kategori umur, coach & court setiap kategori, amaran, panel kehadiran.
// Dikongsi oleh Kalendar (admin) dan Portal Coach.
import { ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove, setting } from '../data.js';
import { ic, esc, F, val, badge, avatar, app, toast, openModal, hm, todayISO, addDays, parseISO, fmtDate, DAYS, LABEL } from '../ui.js';
import { T, byId, venueName, progName, staffName, enrolledIn, livePackages, pkgRemaining, EXTRA_TASKS } from './helpers.js';

export const LANGS_ALL = [['ms', 'B. Melayu'], ['en', 'English'], ['zh', '中文'], ['ta', 'Tamil']];
export const langName = c => (LANGS_ALL.find(x => x[0] === c) || [c, c])[1];
export const ageGroups = () => { const g = setting('age_groups', null); return Array.isArray(g) && g.length ? g : [{ code: 'U8', min: 0, max: 8 }, { code: 'U12', min: 9, max: 12 }, { code: 'U17', min: 13, max: 17 }, { code: 'Dewasa', min: 18, max: 99 }]; };
export const ageOn = (birth, on) => { if (!birth) return null; const b = parseISO(birth), d = parseISO(on || todayISO()); let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--; return a; };
export const ageCat = (st, on) => { const a = ageOn(st?.birth_date, on); if (a == null) return null; return ageGroups().find(g => a >= Number(g.min) && a <= Number(g.max))?.code || null; };
export const NO_CAT = 'Tiada umur';
export const courtLbl = x => (/^\s*\d+\s*$/.test(String(x)) ? 'Court ' + String(x).trim() : String(x).replace(/[&<>"']/g, ''));

export const isPersonal = c => byId('programmes', c?.programme_id)?.kind === 'personal';
export const sTime = (s, c) => [hm(s?.start_time || c?.start_time), hm(s?.end_time || c?.end_time)];
export const sCoach = (s, c) => s?.coach_id || c?.coach_id || null;
export const sCourt = (s, c) => s?.court || c?.court || null;
export const groupsOf = sid => T('session_groups').filter(g => g.session_id === sid);
const toMin = x => { const [h, m] = String(x || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
export const sHours = (s, c) => { const [a, b] = sTime(s, c); return Math.max((toMin(b) - toMin(a)) / 60, 0); };

/** Bahasa diperlukan oleh lokasi tetapi coach tidak bertutur. */
export function langGap(coachId, venueId) {
  const v = byId('venues', venueId), st = byId('staff', coachId);
  const need = v?.required_langs || []; if (!need.length || !st) return [];
  const has = new Set(st.languages || []); return need.filter(l => !has.has(l));
}
export const langWarn = (coachId, venueId) => { const g = langGap(coachId, venueId); return g.length ? `<div class="hint warn">${ic('alert', 'sm')} ${esc(staffName(coachId))} tidak disenaraikan bertutur ${g.map(langName).join(', ')} — lokasi ini memerlukannya.</div>` : ''; };

/** Pelajar sesi (tetap + tempahan/walk-in) */
export function rosterOf(s, c) {
  const marked = T('attendance').filter(a => a.session_id === s?.id);
  const ids = new Set([...(c && !isPersonal(c) ? enrolledIn(c.id).map(e => e.student_id) : []), ...marked.map(a => a.student_id)]);
  if (c && isPersonal(c)) enrolledIn(c.id).forEach(e => ids.add(e.student_id));
  return [...ids].map(id => byId('students', id)).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
}
/** Kategori pelajar dalam sesi: rekod kehadiran (jika ditetapkan) atau dikira ikut umur. */
export function catFor(st, s, c) {
  const a = T('attendance').find(x => x.session_id === s?.id && x.student_id === st.id);
  if (a?.category) return a.category;
  const cat = ageCat(st, s?.session_date) || NO_CAT, list = c?.categories || [];
  if (!list.length || list.includes(cat)) return cat;
  return list.find(x => x !== NO_CAT && ageGroups().findIndex(g => g.code === x) > ageGroups().findIndex(g => g.code === cat)) || list[list.length - 1];
}
export function byCategory(s, c) {
  const out = new Map(); (c?.categories || []).forEach(k => out.set(k, []));
  rosterOf(s, c).forEach(st => { const k = catFor(st, s, c); if (!out.has(k)) out.set(k, []); out.get(k).push(st); });
  return out;
}

/** Amaran sesi kumpulan: coach / court belum ditetapkan. */
export function sessionAlerts(s, c) {
  if (!c || isPersonal(c) || s?.status === 'cancelled') return [];
  const out = [], cats = c.categories || [];
  if (cats.length && s) {
    const gs = groupsOf(s.id);
    for (const [k, list] of byCategory(s, c)) {
      if (!list.length && !cats.includes(k)) continue;
      const g = gs.find(x => x.category === k);
      if (!(g?.coach_id || (gs.length === 0 && sCoach(s, c)))) out.push(`${k}: tiada coach`);
      if (!(g?.court || (gs.length === 0 && sCourt(s, c)))) out.push(`${k}: tiada court`);
    }
  } else {
    if (!sCoach(s, c)) out.push('tiada coach');
    if (!sCourt(s, c)) out.push('tiada court');
  }
  return out;
}

/** Senarai item kalendar (sesi sebenar + sesi maya daripada jadual mingguan yang belum dijana). */
export function calItems(from, to, f = {}) {
  const out = [], have = new Set();
  T('class_sessions').filter(s => s.session_date >= from && s.session_date <= to).forEach(s => {
    const c = byId('classes', s.class_id); if (!c) return; have.add(c.id + '|' + s.session_date); out.push({ s, c, date: s.session_date });
  });
  const today = todayISO();
  for (let d = from > today ? from : today; d <= to; d = addDays(d, 1)) {
    const wd = parseISO(d).getDay();
    T('classes').filter(c => c.active && c.weekday === wd && !have.has(c.id + '|' + d)).forEach(c => out.push({ s: null, c, date: d }));
  }
  return out.filter(({ s, c }) => {
    if (f.venue && c.venue_id !== f.venue) return false;
    if (f.prog && c.programme_id !== f.prog) return false;
    if (f.type === 'group' && isPersonal(c)) return false;
    if (f.type === 'personal' && !isPersonal(c)) return false;
    if (f.coach) { const ids = [sCoach(s, c), ...(s ? groupsOf(s.id).map(g => g.coach_id) : [])]; if (!ids.includes(f.coach)) return false; }
    if (f.mine) { const ids = [sCoach(s, c), ...(s ? groupsOf(s.id).map(g => g.coach_id) : [])]; if (!ids.includes(f.mine)) return false; }
    if (f.alert && !sessionAlerts(s, c).length) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || sTime(a.s, a.c)[0].localeCompare(sTime(b.s, b.c)[0]));
}

export async function ensureSession(classId, date) {
  const ex = T('class_sessions').find(s => s.class_id === classId && s.session_date === date);
  if (ex) return ex;
  return insert('class_sessions', { class_id: classId, session_date: date, status: 'scheduled' });
}

/* ---------------------------------------------------------------- PANEL SESI */
const ATT_OPTS = ['present', 'late', 'absent', 'excused', 'late_cancel'];
const isCoach = () => S.profile?.role === 'coach';
const markedBy = () => (S.mode === 'demo' ? null : S.profile.id);
const coachOpts = () => [['', '— Pilih coach —'], ...T('staff').filter(x => x.active !== false).map(x => [x.id, x.full_name + ((x.languages || []).length ? ' (' + x.languages.join('/') + ')' : '')])];
const pkgLine = (stId, a) => {
  if (isCoach()) return '';
  const sp = a?.student_package_id ? byId('student_packages', a.student_package_id) : livePackages(stId)[0];
  if (!sp) return `<div class="li-sub" style="color:var(--warn)">tiada pakej aktif — dibil bulanan / walk-in</div>`;
  const u = sp.unit === 'jam' ? 'jam' : 'sesi', rem = pkgRemaining(sp);
  return `<div class="li-sub" style="color:${rem <= 1 ? 'var(--bad)' : ''}">${esc(sp.name)} · baki ${rem}/${Number(sp.sessions_total)} ${u}</div>`;
};

export function openSession(sid) {
  const s = byId('class_sessions', sid), c = s && byId('classes', s.class_id);
  if (!c) return toast('Sesi tidak dijumpai', true);
  const [t1, t2] = sTime(s, c), personal = isPersonal(c), cats = byCategory(s, c), gs = groupsOf(s.id), alerts = sessionAlerts(s, c);
  const multi = !personal && ((c.categories || []).length > 0 || gs.length > 0);
  const stRow = st => {
    const a = T('attendance').find(x => x.session_id === s.id && x.student_id === st.id);
    return `<li class="list-item" style="padding:8px 4px;flex-wrap:wrap">${avatar(st.full_name)}<div class="li-main"><div class="li-title">${esc(st.full_name)} ${a?.status === 'booked' ? '<span class="badge b-info">ditempah</span>' : ''}${st.birth_date ? ` <span class="muted" style="font-size:11.5px">${ageOn(st.birth_date, s.session_date)} thn</span>` : ''}</div>${pkgLine(st.id, a)}</div>
      ${personal && !isCoach() ? `<input class="date-input" style="width:70px" type="number" step="0.25" min="0" title="Jam" placeholder="${sHours(s, c)}" value="${a?.hours ?? ''}" data-on-change="sp-hours" data-key="${s.id}|${st.id}">` : ''}
      ${multi && !isCoach() ? `<select class="att-select" title="Kategori" data-on-change="sp-cat" data-key="${s.id}|${st.id}">${[...new Set([...(c.categories || []), ...ageGroups().map(g => g.code)])].map(k => `<option ${catFor(st, s, c) === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>` : ''}
      <select class="att-select ${a ? 'a-' + a.status : ''}" data-on-change="sp-att" data-key="${s.id}|${st.id}"><option value="">${a?.status === 'booked' ? 'ditempah — belum direkod' : '— belum direkod —'}</option>${ATT_OPTS.map(o => `<option value="${o}" ${a?.status === o ? 'selected' : ''}>${LABEL[o]}</option>`).join('')}</select></li>`;
  };
  const assign = (k, g) => isCoach() ? `<span class="muted" style="font-size:12.5px">${esc(staffName(g?.coach_id))} · ${esc(g?.court || '—')}</span>` : `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <label class="field"><select data-on-change="sp-gcoach" data-key="${s.id}|${esc(k)}">${coachOpts().map(([v, l]) => `<option value="${v}" ${g?.coach_id === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <input class="date-input" style="width:110px" placeholder="Court no." value="${esc(g?.court || '')}" data-on-change="sp-gcourt" data-key="${s.id}|${esc(k)}">
    </div>${g?.coach_id ? langWarn(g.coach_id, c.venue_id) : ''}`;
  const body = `
    <div class="muted" style="margin-bottom:10px">${DAYS[parseISO(s.session_date).getDay()]}, ${fmtDate(s.session_date)} · ${t1}–${t2} · ${esc(venueName(c.venue_id))}</div>
    ${alerts.length ? `<div class="hint bad" style="margin-bottom:10px">${ic('alert', 'sm')} Belum lengkap: ${alerts.map(esc).join(' · ')}</div>` : ''}
    ${isCoach() ? '' : `<div class="form-grid" style="margin-bottom:8px">
      <label class="f">Coach sesi<select data-on-change="sp-coach" data-key="${s.id}">${coachOpts().map(([v, l]) => `<option value="${v}" ${sCoach(s, c) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="f">Court no.<input value="${esc(sCourt(s, c) || '')}" placeholder="cth. 3" data-on-change="sp-court" data-key="${s.id}"></label>
    </div>${langWarn(sCoach(s, c), c.venue_id)}`}
    ${multi ? [...cats].map(([k, list]) => `<div class="card card-pad" style="margin:10px 0;padding:10px 12px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><b>${esc(k)} <span class="muted">(${list.length})</span></b>${assign(k, gs.find(g => g.category === k))}</div>
        <ul class="list">${list.map(stRow).join('') || '<li class="empty" style="padding:8px">Belum ada pelajar</li>'}</ul></div>`).join('')
      : `<ul class="list">${rosterOf(s, c).map(stRow).join('') || '<li class="empty">Belum ada pelajar.</li>'}</ul>`}
    ${isCoach() ? '' : `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><label class="field grow"><select id="spAdd"><option value="">+ Tambah pelajar (walk-in / tempahan)…</option>${T('students').filter(x => x.status === 'active' && !rosterOf(s, c).some(r => r.id === x.id)).sort((a, b) => a.full_name.localeCompare(b.full_name)).map(x => `<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}</select></label><button type="button" class="btn" data-action="sp-add" data-id="${s.id}">Tambah</button></div>`}
    <label class="f" style="margin-top:12px">Pelan / nota sesi<textarea data-on-change="sp-plan" data-key="${s.id}" placeholder="Fokus latihan hari ini…">${esc(s.lesson_plan || '')}</textarea></label>
    <div class="actions" style="margin-top:14px;flex-wrap:wrap">
      ${s.status !== 'cancelled' ? `<button type="button" class="btn sm" data-action="sp-all" data-id="${s.id}">Semua hadir</button>` : ''}
      ${s.status === 'scheduled' ? `<button type="button" class="btn sm" data-action="sp-held" data-id="${s.id}">Tandakan selesai</button>` : ''}
      ${isCoach() ? '' : s.status !== 'cancelled' ? `<button type="button" class="btn sm" data-action="sess-cancel" data-id="${s.id}">Batal sesi</button>` : `<button type="button" class="btn sm" data-action="sess-reopen" data-id="${s.id}">Buka semula</button>`}
      ${isCoach() || !personal ? '' : `<button type="button" class="btn sm danger-o" data-action="sp-del" data-id="${s.id}">${ic('trash', 'sm')} Padam sesi</button>`}
    </div>`;
  openModal({ title: `${esc(progName(c.programme_id))}${s.status === 'cancelled' ? ' · ' + badge('cancelled') : ''}`, body, wide: true, cancel: 'Tutup' });
  openSession.cur = s.id;
}
const reopen = () => { app.render(); if (openSession.cur) openSession(openSession.cur); };
const keyOf = el => el.dataset.key.split('|');

async function setGroup(sid, cat, patch) {
  const g = T('session_groups').find(x => x.session_id === sid && x.category === cat);
  if (g) await update('session_groups', g.id, patch); else await insert('session_groups', { session_id: sid, category: cat, ...patch });
}
async function setAtt(sid, stid, patch) {
  const rec = T('attendance').find(a => a.session_id === sid && a.student_id === stid);
  if (rec) return update('attendance', rec.id, patch);
  return insert('attendance', { session_id: sid, student_id: stid, status: 'booked', ...patch });
}

Object.assign(INPUTS, {
  'sp-att': async (v, el) => {
    const [sid, stid] = keyOf(el), rec = T('attendance').find(a => a.session_id === sid && a.student_id === stid);
    if (!v) { if (rec && rec.status !== 'booked') await update('attendance', rec.id, { status: 'booked', marked_by: markedBy() }); }
    else await setAtt(sid, stid, { status: v, marked_by: markedBy() });
    reopen();
  },
  'sp-hours': async (v, el) => { const [sid, stid] = keyOf(el); await setAtt(sid, stid, { hours: v === '' ? null : Number(v) }); reopen(); },
  'sp-cat': async (v, el) => { const [sid, stid] = keyOf(el); await setAtt(sid, stid, { category: v }); reopen(); },
  'sp-coach': async (v, el) => { await update('class_sessions', keyOf(el)[0], { coach_id: val(v) }); reopen(); },
  'sp-court': async (v, el) => { await update('class_sessions', keyOf(el)[0], { court: val(v.trim()) }); reopen(); },
  'sp-gcoach': async (v, el) => { const [sid, k] = keyOf(el); await setGroup(sid, k, { coach_id: val(v) }); reopen(); },
  'sp-gcourt': async (v, el) => { const [sid, k] = keyOf(el); await setGroup(sid, k, { court: val(v.trim()) }); reopen(); },
  'sp-plan': async (v, el) => { await update('class_sessions', keyOf(el)[0], { lesson_plan: val(v) }); toast('Nota disimpan'); },
});
Object.assign(ACTIONS, {
  'sess-open': id => openSession(id),
  'sess-open-v': async key => { const [cid, d] = key.split('|'); const s = await ensureSession(cid, d); openSession(s.id); app.render(); },
  'sp-add': async sid => { const v = document.getElementById('spAdd')?.value; if (!v) return toast('Pilih pelajar dahulu', true); await setAtt(sid, v, {}); toast('Pelajar ditambah ke sesi'); reopen(); },
  'sp-all': async sid => {
    const s = byId('class_sessions', sid), c = byId('classes', s.class_id);
    for (const st of rosterOf(s, c)) { const a = T('attendance').find(x => x.session_id === sid && x.student_id === st.id); if (!a || a.status === 'booked') await setAtt(sid, st.id, { status: 'present', marked_by: markedBy() }); }
    toast('Semua ditandakan hadir'); reopen();
  },
  'sp-held': async sid => { await update('class_sessions', sid, { status: 'held' }); toast('Sesi ditandakan selesai'); reopen(); },
  'sp-del': async sid => {
    if (T('attendance').some(a => a.session_id === sid && a.status !== 'booked')) return toast('Sesi ada rekod kehadiran — batalkan sahaja, jangan padam.', true);
    await remove('class_sessions', sid); openSession.cur = null; document.querySelector('[data-action=close-modal]')?.click(); toast('Sesi dipadam'); app.render();
  },
});

/** Sesi kumpulan 7 hari akan datang yang belum lengkap (coach / court). */
let _gapCache = { at: 0, v: [] };
export function sessionGaps() {
  if (Date.now() - _gapCache.at < 1500) return _gapCache.v;
  const t = todayISO(); _gapCache = { at: Date.now(), v: calItems(t, addDays(t, 7), { type: 'group' }).filter(x => sessionAlerts(x.s, x.c).length) }; return _gapCache.v;
}
EXTRA_TASKS.push(add => {
  add(sessionGaps().length, 'alert', 't-bad', '{n} sesi kumpulan 7 hari ini belum ada coach / court', 'kalendar');
  add(T('booking_requests').filter(b => b.status === 'new').length, 'calendar', 't-warn', '{n} tempahan baharu daripada ibu bapa', 'tempahan');
});
