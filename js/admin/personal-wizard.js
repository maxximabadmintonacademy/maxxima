/* Wizard Sesi Personal: 1) Kelas  2) Jadual  3) Pelajar & pakej  4) Semak & simpan */
import { ACTIONS, INPUTS } from '../registry.js';
import { S, insert } from '../data.js';
import { esc, val, app, toast, openModal, closeModal, hm, todayISO, addDays, parseISO, fmtDate, fmtShort, DAYS, LABEL } from '../ui.js';
import { T, byId, studentName, progName, venueName, staffName, livePackages } from './helpers.js';
import { calItems, langWarn } from './sessions.js';
import { sellPackage, dueDefault } from './finance.js';

const STEPS = ['Kelas', 'Jadual', 'Pelajar & pakej', 'Semak'];
let W = null;
const $w = () => document.getElementById('pw');
const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
const toMin = t => { const [h, m] = String(t || '0:0').split(':'); return +h * 60 + (+m || 0); };
const pkgRem = p => Number(p.sessions_total || 0) - Number(p.sessions_used || 0);

/** Senarai tarikh + masa dari mod jadual semasa. */
function slots() {
  if (W.mode === 'custom') return W.rows.filter(r => r.date && r.start && r.end).map(r => ({ ...r })).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const out = []; for (let i = 0; i < Math.max(1, Number(W.weeks) || 1); i++) { const d = addDays(W.date, 7 * i); if (!W.skip.has(d)) out.push({ date: d, start: W.start, end: W.end }); }
  return out;
}
/** Pertindihan: coach yang sama ada sesi lain pada masa yang bertindih. */
function clash(sl) {
  if (!W.coach_id) return null;
  const x = calItems(sl.date, sl.date, { mine: W.coach_id }).find(({ s, c }) => {
    if (s?.status === 'cancelled') return false;
    const [t1, t2] = [hm(s?.start_time || c.start_time), hm(s?.end_time || c.end_time)];
    return toMin(t1) < toMin(sl.end) && toMin(sl.start) < toMin(t2);
  });
  return x ? `${staffName(W.coach_id)} ada ${x.c.title || progName(x.c.programme_id)} ${hm(x.s?.start_time || x.c.start_time)}` : null;
}
const autoTitle = () => W.students.length ? `Personal · ${W.students.map(id => studentName(id).split(' ')[0]).join(' & ')}` : 'Personal';

/* ---------------- langkah ---------------- */
function step1() {
  const progs = T('programmes').filter(p => p.active && p.kind === 'personal');
  return `<div class="form-grid">
    <label class="f full">Tajuk kelas <span class="muted" style="font-weight:500">(pilihan — dipapar di kalendar)</span><input name="pw_title" value="${esc(W.title)}" placeholder="cth. ${esc(autoTitle())} · Isnin" data-on-input="pw-f" data-k="title"></label>
    <label class="f">Program<select data-on-change="pw-f" data-k="programme_id">${progs.map(p => opt(p.id, p.name, W.programme_id)).join('')}</select></label>
    <div class="f">Format<div class="pw-chips">${[1, 2, 3, 4].map(n => `<button type="button" class="pw-chip ${W.format === n ? 'on' : ''}" data-action="pw-format" data-id="${n}"><b>${n === 1 ? '1 : 1' : n + ' : 1'}</b><small>${n === 1 ? 'one-to-one' : n + ' pelajar'}</small></button>`).join('')}</div></div>
    <label class="f">Coach<select data-on-change="pw-f" data-k="coach_id">${opt('', '— Pilih coach —', W.coach_id)}${T('staff').filter(x => x.active !== false).map(x => opt(x.id, x.full_name, W.coach_id)).join('')}</select></label>
    <label class="f">Lokasi<select data-on-change="pw-f" data-k="venue_id">${opt('', '— Pilih lokasi —', W.venue_id)}${T('venues').filter(v => v.active).map(v => opt(v.id, v.name, W.venue_id)).join('')}</select></label>
    <label class="f">Court no. <span class="muted" style="font-weight:500">(pilihan)</span><input value="${esc(W.court)}" placeholder="cth. 5" data-on-input="pw-f" data-k="court"></label>
  </div>${W.coach_id && W.venue_id ? langWarn(W.coach_id, W.venue_id) : ''}`;
}
function step2() {
  const L = slots();
  const weekly = `<div class="form-grid">
      <label class="f">Tarikh pertama<input type="date" value="${W.date}" data-on-change="pw-f" data-k="date"><span class="hint">${DAYS[parseISO(W.date).getDay()]} setiap minggu</span></label>
      <div class="f">Berapa minggu<div class="pw-chips">${[[1, 'Sekali'], [4, '4 minggu'], [8, '8 minggu'], [12, '12 minggu']].map(([n, l]) => `<button type="button" class="pw-chip sm ${Number(W.weeks) === n ? 'on' : ''}" data-action="pw-weeks" data-id="${n}">${l}</button>`).join('')}
        <input type="number" min="1" max="26" value="${W.weeks}" style="width:70px" data-on-change="pw-f" data-k="weeks" title="Bil. minggu"></div></div>
      <label class="f">Mula<input type="time" value="${W.start}" data-on-change="pw-f" data-k="start"></label>
      <label class="f">Tamat<input type="time" value="${W.end}" data-on-change="pw-f" data-k="end"></label></div>
    <div class="pw-sub">Tarikh yang akan dijana — tekan untuk langkau (cth. cuti):</div>
    <div class="pw-dates">${Array.from({ length: Math.max(1, Number(W.weeks) || 1) }, (_, i) => addDays(W.date, 7 * i)).map(d => { const c = !W.skip.has(d) && clash({ date: d, start: W.start, end: W.end });
      return `<button type="button" class="pw-d ${W.skip.has(d) ? 'off' : ''} ${c ? 'warn' : ''}" data-action="pw-skip" data-id="${d}" title="${esc(c || '')}">${fmtShort(d)}${c ? ' ⚠' : ''}</button>`; }).join('')}</div>`;
  const custom = `<div class="pw-rows">${W.rows.map((r, i) => { const c = r.date && r.start && r.end && clash(r);
      return `<div class="pw-row"><input type="date" value="${r.date}" data-on-change="pw-row" data-i="${i}" data-k="date"><span class="pw-dow">${r.date ? DAYS[parseISO(r.date).getDay()].slice(0, 3) : ''}</span>
      <input type="time" value="${r.start}" data-on-change="pw-row" data-i="${i}" data-k="start"><span>–</span><input type="time" value="${r.end}" data-on-change="pw-row" data-i="${i}" data-k="end">
      ${c ? `<span class="pw-warn" title="${esc(c)}">⚠ bertindih</span>` : ''}<button type="button" class="sp-x" data-action="pw-row-del" data-id="${i}" title="Buang">✕</button></div>`; }).join('')}</div>
    <button type="button" class="btn sm" data-action="pw-row-add">+ Tambah tarikh</button>`;
  const cl = L.map(clash).filter(Boolean);
  return `<div class="pw-seg"><button type="button" class="${W.mode === 'weekly' ? 'on' : ''}" data-action="pw-mode" data-id="weekly">Setiap minggu sama</button><button type="button" class="${W.mode === 'custom' ? 'on' : ''}" data-action="pw-mode" data-id="custom">Tarikh & masa berlainan</button></div>
    ${W.mode === 'weekly' ? weekly : custom}
    <div class="pw-sum">${L.length} sesi${L.length ? ` · ${fmtShort(L[0].date)} – ${fmtShort(L[L.length - 1].date)}` : ''}${cl.length ? ` · <span style="color:var(--warn)">⚠ ${cl.length} bertindih dengan jadual coach</span>` : ''}</div>`;
}
function pkgOptions(sid) {
  const live = livePackages(sid), tpl = T('packages').filter(p => p.active !== false && (!W.programme_id || p.programme_id === W.programme_id));
  return `<optgroup label="Pakej sedia ada">${live.length ? live.map(p => opt(p.id, `${p.name} · baki ${pkgRem(p)}/${Number(p.sessions_total)}${p.status === 'pending' ? ' · belum bayar' : ''}`, W.pkg[sid])).join('') : '<option disabled>— tiada pakej aktif —</option>'}</optgroup>
    ${tpl.length ? `<optgroup label="Jual pakej baharu (invois dikeluarkan)">${tpl.map(p => opt('new:' + p.id, `${p.name} · RM${Number(p.price || 0)}`, W.pkg[sid])).join('')}</optgroup>` : ''}
    <optgroup label="Tanpa pakej">${opt('monthly', 'Bil bulanan ikut sesi', W.pkg[sid])}${opt('walkin', 'Walk-in (bayar setiap sesi)', W.pkg[sid])}</optgroup>`;
}
function step3() {
  const q = W.q.trim().toLowerCase(), full = W.students.length >= W.format;
  const res = q.length < 2 ? [] : T('students').filter(s => !s.merged_into && !s.archived_at && !W.students.includes(s.id) && [s.full_name, s.guardian_name, s.guardian_phone].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || a.full_name.localeCompare(b.full_name)).slice(0, 8);
  return `<div class="pw-sub" style="margin-top:0">Format ${W.format === 1 ? '1 : 1' : W.format + ' : 1'} — pilih ${W.format} pelajar (${W.students.length}/${W.format}).</div>
    <div class="pw-picked">${W.students.map(id => { const s = byId('students', id);
      return `<div class="pw-st"><div class="pw-st-h"><b>${esc(s.full_name)}</b><span class="muted">${esc([s.status !== 'active' ? LABEL[s.status] : '', s.guardian_name].filter(Boolean).join(' · '))}</span><button type="button" class="sp-x" data-action="pw-st-del" data-id="${id}" title="Buang">✕</button></div>
        <label class="pw-pk">Pakej / bil<select data-on-change="pw-pkg" data-id="${id}">${pkgOptions(id)}</select></label></div>`; }).join('') || '<div class="pw-empty">Belum ada pelajar dipilih.</div>'}</div>
    ${full ? '' : `<div class="pw-search"><input type="search" placeholder="Taip nama pelajar / ibu bapa / no. telefon…" value="${esc(W.q)}" data-on-input="pw-q" autocomplete="off">
      ${res.length ? `<div class="pw-res">${res.map(s => `<button type="button" data-action="pw-st-add" data-id="${s.id}"><b>${esc(s.full_name)}</b><span>${esc([s.status !== 'active' ? LABEL[s.status] : '', venueName(s.venue_id), s.guardian_name].filter(x => x && x !== '—').join(' · '))}</span></button>`).join('')}</div>` : q.length >= 2 ? '<div class="pw-empty">Tiada padanan. Daftar pelajar baharu di Senarai Pelajar dahulu.</div>' : ''}</div>`}`;
}
function step4() {
  const L = slots(), monthly = W.students.some(id => W.pkg[id] === 'monthly'), sell = W.students.filter(id => String(W.pkg[id] || '').startsWith('new:'));
  return `<div class="pw-review">
      <div><span>Kelas</span><b>${esc(W.title || autoTitle())}</b><small>${esc(progName(W.programme_id))} · ${W.format === 1 ? '1 : 1' : W.format + ' : 1'}</small></div>
      <div><span>Coach & lokasi</span><b>${esc(staffName(W.coach_id))}</b><small>${esc(venueName(W.venue_id))}${W.court ? ' · Court ' + esc(W.court) : ''}</small></div>
      <div><span>Jadual</span><b>${L.length} sesi</b><small>${L.slice(0, 6).map(x => `${fmtShort(x.date)} ${x.start}–${x.end}`).join(', ')}${L.length > 6 ? '…' : ''}</small></div>
      <div><span>Pelajar</span><b>${W.students.map(id => esc(studentName(id))).join(', ')}</b><small>${W.students.map(id => { const v = W.pkg[id] || ''; const p = byId('student_packages', v), t = v.startsWith('new:') && byId('packages', v.slice(4));
        return esc(studentName(id).split(' ')[0]) + ': ' + esc(p ? p.name : t ? 'pakej baharu ' + t.name : v === 'walkin' ? 'walk-in' : 'bil bulanan'); }).join(' · ')}</small></div></div>
    ${sell.length ? `<div class="pw-note">${sell.length} invois pakej baharu akan dikeluarkan (bayar sebelum ${fmtDate(dueDefault())}). Pakej aktif bila bayaran disahkan.</div>` : ''}
    ${monthly ? `<div class="form-grid" style="margin-top:12px"><label class="f">Kadar coach / jam (RM)<input type="number" step="0.01" min="0" value="${esc(W.rate_coach)}" data-on-input="pw-f" data-k="rate_coach"></label>
      <label class="f">Kadar court / jam (RM)<input type="number" step="0.01" min="0" value="${esc(W.rate_court)}" data-on-input="pw-f" data-k="rate_court"></label></div>` : ''}`;
}
function render() {
  const el = $w(); if (!el) return;
  const body = [step1, step2, step3, step4][W.step]();
  el.innerHTML = `<div class="pw-steps">${STEPS.map((l, i) => `<button type="button" class="${i === W.step ? 'on' : ''} ${i < W.step ? 'done' : ''}" ${i <= W.max ? `data-action="pw-go" data-id="${i}"` : 'disabled'}><i>${i < W.step ? '✓' : i + 1}</i>${l}</button>`).join('')}</div>
    <div class="pw-body">${body}</div>
    <div class="pw-foot">${W.step ? '<button type="button" class="btn" data-action="pw-back">Kembali</button>' : '<span></span>'}
      ${W.step < 3 ? '<button type="button" class="btn primary" data-action="pw-next">Seterusnya</button>' : `<button type="button" class="btn primary" data-action="pw-save">Simpan ${slots().length} sesi</button>`}</div>`;
}
function check(step) {
  if (step === 0) { if (!W.programme_id) return 'Pilih program.'; if (!W.coach_id) return 'Pilih coach.'; if (!W.venue_id) return 'Pilih lokasi.'; }
  if (step === 1) { const L = slots(); if (!L.length) return 'Tiada tarikh dipilih.'; const bad = L.find(x => toMin(x.end) <= toMin(x.start)); if (bad) return `Masa tamat mesti selepas masa mula (${fmtShort(bad.date)}).`; }
  if (step === 2) { if (!W.students.length) return 'Pilih sekurang-kurangnya seorang pelajar.'; if (W.students.length > W.format) return `Format ${W.format} : 1 — terlalu ramai pelajar.`; }
  return null;
}
const defPkg = id => { const L = livePackages(id), pers = L.find(p => p.programme_id === W.programme_id) || L.find(p => byId('programmes', p.programme_id)?.kind === 'personal'); return pers?.id || 'monthly'; };

Object.assign(INPUTS, {
  'pw-f': (v, el) => { const k = el.dataset.k; W[k] = k === 'weeks' ? Math.min(26, Math.max(1, Number(v) || 1)) : v; if (['title', 'court', 'rate_coach', 'rate_court'].includes(k)) return; if (k === 'date') W.skip.clear(); if (k === 'programme_id') W.students.forEach(id => { W.pkg[id] = defPkg(id); }); render(); },
  'pw-row': (v, el) => { W.rows[+el.dataset.i][el.dataset.k] = v; render(); },
  'pw-q': v => { W.q = v; render(); const i = $w()?.querySelector('[data-on-input="pw-q"]'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } },
  'pw-pkg': (v, el) => { W.pkg[el.dataset.id] = v; },
});
Object.assign(ACTIONS, {
  'pw-format': n => { W.format = +n; render(); },
  'pw-weeks': n => { W.weeks = +n; render(); },
  'pw-skip': d => { W.skip.has(d) ? W.skip.delete(d) : W.skip.add(d); render(); },
  'pw-mode': m => { if (m === 'custom' && W.mode === 'weekly') W.rows = slots().map(x => ({ ...x })); W.mode = m; if (!W.rows.length) W.rows = [{ date: W.date, start: W.start, end: W.end }]; render(); },
  'pw-row-add': () => { const l = W.rows[W.rows.length - 1]; W.rows.push({ date: l ? addDays(l.date, 7) : W.date, start: l?.start || W.start, end: l?.end || W.end }); render(); },
  'pw-row-del': i => { W.rows.splice(+i, 1); render(); },
  'pw-st-add': id => { if (W.students.length >= W.format) return toast(`Format ${W.format} : 1 sudah penuh`, true); W.students.push(id); W.pkg[id] = defPkg(id); W.q = ''; render(); },
  'pw-st-del': id => { W.students = W.students.filter(x => x !== id); delete W.pkg[id]; render(); },
  'pw-go': i => { W.step = +i; render(); },
  'pw-back': () => { W.step--; render(); },
  'pw-next': () => { const e = check(W.step); if (e) return toast(e, true); W.step++; W.max = Math.max(W.max, W.step); render(); },
  'pw-save': async () => {
    for (let i = 0; i < 3; i++) { const e = check(i); if (e) { W.step = i; render(); return toast(e, true); } }
    const L = slots(), ids = [...W.students], first = L[0];
    // pakej baharu → invois + pakej menunggu bayaran
    for (const id of ids) { const v = W.pkg[id] || ''; if (!v.startsWith('new:')) continue;
      const pkg = byId('packages', v.slice(4)), inv = await sellPackage({ studentId: id, pkg, price: pkg.price, mode: 'fixed', due: dueDefault() });
      W.pkg[id] = T('student_packages').find(p => p.invoice_id === inv.id)?.id || 'monthly'; }
    const kinds = ids.map(id => W.pkg[id]), billing = kinds.every(k => k !== 'monthly' && k !== 'walkin') ? 'package' : kinds.includes('monthly') ? 'monthly' : 'walkin';
    const row = { venue_id: W.venue_id, programme_id: W.programme_id, coach_id: W.coach_id, weekday: parseISO(first.date).getDay(), start_time: first.start, end_time: first.end, court: val(W.court), capacity: W.format, active: false, billing, rate_coach: val(W.rate_coach), rate_court: val(W.rate_court) };
    let cls;
    try { cls = await insert('classes', W.title ? { ...row, title: W.title } : row); }
    catch (e) { if (!/title/.test(e.message || '')) throw e; cls = await insert('classes', row); }   // SQL 40 belum dijalankan
    await insert('class_enrolments', ids.map(id => ({ class_id: cls.id, student_id: id })));
    for (const x of L) {
      const s = await insert('class_sessions', { class_id: cls.id, session_date: x.date, status: x.date < todayISO() ? 'held' : 'scheduled', coach_id: W.coach_id, court: val(W.court), start_time: x.start, end_time: x.end });
      for (const id of ids) { const pk = byId('student_packages', W.pkg[id]); await insert('attendance', { session_id: s.id, session_date: x.date, student_id: id, status: 'booked', ...(pk ? { student_package_id: pk.id } : {}) }); }
    }
    const done = W.onDone; W = null; closeModal();
    toast(`${L.length} sesi personal disimpan untuk ${ids.map(studentName).join(', ')}`);
    if (done) await done(cls);
    app.render();
  },
});

/** Buka wizard. preset (pilihan): { students, programme_id, coach_id, venue_id, date, start, end, onDone } — dari Tempahan dsb. */
ACTIONS['cal-personal'] = (preset = {}) => {
  preset = typeof preset === 'object' && preset ? preset : {};
  const progs = T('programmes').filter(p => p.active && p.kind === 'personal');
  W = { step: 0, max: 0, title: '', programme_id: preset.programme_id || progs[0]?.id || '', format: Math.max(1, Math.min(4, (preset.students || []).length || 1)), coach_id: preset.coach_id || '', venue_id: preset.venue_id || '', court: '',
    mode: 'weekly', date: preset.date || todayISO(), start: preset.start || '18:00', end: preset.end || '19:00', weeks: 4, skip: new Set(), rows: [], students: [...(preset.students || [])], pkg: {}, q: '', rate_coach: '', rate_court: '', onDone: preset.onDone };
  if (preset.date) W.weeks = 1;
  W.students.forEach(id => { W.pkg[id] = defPkg(id); });
  openModal({ title: 'Sesi Personal Baharu', wide: true, cancel: 'Batal', body: '<div id="pw"></div>' });
  render();
};
