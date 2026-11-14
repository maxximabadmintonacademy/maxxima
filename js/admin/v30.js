// v30: Import Sesi Invois — muat naik CSV semakan invois (No. invois, Pelajar, Tarikh latihan, Masa, Venue, Program, …),
// padan automatik (pelajar, lokasi, program, coach, kelas), isi yang kurang, kemudian cipta semua sesi / tempahan sekali gus.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update } from '../data.js';
import { esc, UI, app, toast, pageHead, todayISO, hm, DAYS, fmtShort, confirmModal } from '../ui.js';
import { T, byId, livePackages, enrolledIn } from './helpers.js';
import { ensureSession, isPersonal } from './sessions.js';

/* ---------------- Penghurai CSV ---------------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const MONTHS = { jan: 1, feb: 2, mar: 3, mac: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12 };
const parseDate = s => { const m = String(s || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/); if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return iso ? iso[0] : null; };
const parseTime = s => { const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/); return m ? [`${m[1].padStart(2, '0')}:${m[2]}`, `${m[3].padStart(2, '0')}:${m[4]}`] : [null, null]; };

/* ---------------- Padanan ---------------- */
const words = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter(w => w.length > 1);
function matchStudent(name) {
  const low = name.trim().toLowerCase(), L = T('students').filter(s => !s.merged_into);
  const ex = L.filter(s => s.full_name.trim().toLowerCase() === low); if (ex.length === 1) return ex[0].id;
  const w = words(name); if (!w.length) return null;
  const sc = L.map(s => { const sw = words(s.full_name); let n = 0; w.forEach(x => { if (sw.includes(x)) n += 3; else if (sw.some(y => y.startsWith(x) || x.startsWith(y))) n += 1; }); return { s, n: n + (s.status === 'active' ? 0.5 : 0) }; })
    .filter(x => x.n >= 3 * w.length).sort((a, b) => b.n - a.n);
  return sc.length && (sc.length === 1 || sc[0].n > sc[1].n) ? sc[0].s.id : null;
}
const VENUE_ALIAS = { goteam: 'goteam', forum: 'forum', ultra: 'ultra', armanee: 'armanee', abedeen: 'abedeen', slk: 'slk', puchong: 'puchong', mxspd: 'mxspd', michael: 'michael', ijm: 'ijm', rimbayu: 'rimbayu' };
function matchVenue(text) {
  const t = String(text || '').toLowerCase(); if (!t) return null;
  const vs = T('venues');
  const ex = vs.find(v => t.startsWith(v.name.toLowerCase()) || v.name.toLowerCase().startsWith(t)); if (ex) return ex.id;
  for (const k of Object.keys(VENUE_ALIAS)) if (t.includes(k)) { const v = vs.find(x => x.name.toLowerCase().includes(VENUE_ALIAS[k])); if (v) return v.id; }
  return null;
}
const personalProgs = () => T('programmes').filter(p => p.kind === 'personal');
function matchProgramme(text, nStudents) {
  const t = String(text || '').toLowerCase();
  if (t.includes('personal') || t.includes('sparring')) { const P = personalProgs(); if (!P.length) return null;
    const want = nStudents >= 3 ? /3|three/ : nStudents === 2 ? /2|two/ : /1|one|personal/; return (P.find(p => want.test(p.name.toLowerCase())) || P[0]).id; }
  const p = T('programmes').find(x => x.kind !== 'personal' && x.name.toLowerCase() === t) || T('programmes').find(x => x.kind !== 'personal' && t && x.name.toLowerCase().includes(t.split(' ')[0]));
  return p?.id || null;
}
function matchCoach(details) {
  const t = String(details || '').toLowerCase(), st = T('staff').filter(s => s.active !== false);
  const GENERIC = /^(coach|head|senior|junior|ketua|jurulatih|sampel|demo)$/;
  const named = st.find(s => { const f = s.full_name.toLowerCase().split(/\s+/).find(w => w.length >= 3 && !GENERIC.test(w)); return f && new RegExp(`\\b${f}\\b`).test(t); }); if (named) return named.id;
  if (/head coach/.test(t)) return st.find(s => /ketua|head/i.test(s.position || ''))?.id || null;
  return null;
}
const isGroupRow = r => r.kind === 'group';
/** Kelas kumpulan yang sepadan: lokasi + hari + (masa / program) */
function groupClass(r) {
  if (!r.venue_id) return null;
  const dow = new Date(r.session_date + 'T00:00').getDay();
  const L = T('classes').filter(c => c.active && !isPersonal(c) && c.venue_id === r.venue_id && c.weekday === dow);
  return (r.start_time && L.find(c => hm(c.start_time) === hm(r.start_time))) || (r.programme_id && L.find(c => c.programme_id === r.programme_id)) || (L.length === 1 ? L[0] : null);
}
/** Sudah ada sesi untuk pelajar ini pada tarikh ini? */
const existing = r => r.student_id && T('attendance').find(a => a.student_id === r.student_id && a.session_date === r.session_date && !['excused', 'late_cancel'].includes(a.status))
  || (r.student_id && T('class_sessions').find(s => s.session_date === r.session_date && s.status !== 'cancelled' && enrolledIn(s.class_id).some(e => e.student_id === r.student_id) && isPersonal(byId('classes', s.class_id))));
const SKIP_HINT = r => /batal|ditolak|excluded|planned absence/i.test(`${r.review_note} ${r.details} ${r.found}`);

function problems(r) {
  const p = [];
  if (!r.student_id) p.push('Pilih pelajar');
  if (!r.venue_id) p.push('Pilih lokasi');
  if (isGroupRow(r)) { if (!groupClass(r)) p.push('Tiada kelas kumpulan sepadan (lokasi/hari/masa)'); }
  else { if (!r.start_time || !r.end_time) p.push('Isi masa'); else if (hm(r.end_time) <= hm(r.start_time)) p.push('Masa tamat salah'); if (!r.coach_id) p.push('Pilih coach'); if (!r.programme_id) p.push('Pilih program'); }
  return p;
}

/** Rakan sesi personal (invois, tarikh & masa sama) yang belum lengkap */
const partnerBlock = r => r.kind === 'personal' && r.invoice_no && T('session_import').some(x => x.id !== r.id && x.state === 'open' && x.kind === 'personal' && x.invoice_no === r.invoice_no
  && x.session_date === r.session_date && hm(x.start_time) === hm(r.start_time) && problems(x).length);
const isReady = r => !problems(r).length && !existing(r) && !partnerBlock(r);

/* ---------------- Paparan ---------------- */
const rows = () => T('session_import');
VIEWS.importsesi = () => {
  const st = UI.imState || 'open', when = UI.imWhen || 'all', today = todayISO();
  const all = rows(), L = all.filter(r => r.state === st && (when === 'all' || (when === 'future' ? r.session_date >= today : r.session_date < today)))
    .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.student_name.localeCompare(b.student_name));
  const sel = UI.imSel ||= new Set(); [...sel].forEach(id => { if (!L.some(r => r.id === id)) sel.delete(id); });
  const ready = L.filter(isReady), cnt = s => all.filter(r => r.state === s).length;
  const venues = T('venues').filter(v => v.active !== false), coaches = T('staff').filter(x => x.active !== false), progs = T('programmes').filter(p => p.active !== false);
  const studs = T('students').filter(s => !s.merged_into).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const opt = (list, v, lbl = x => x.name) => list.map(x => `<option value="${x.id}" ${x.id === v ? 'selected' : ''}>${esc(lbl(x))}</option>`).join('');
  return `${pageHead('Import Sesi Invois', 'Cipta sesi / tempahan untuk invois yang dibuat tanpa tempahan. Muat naik CSV semakan invois, semak padanan, kemudian cipta sekali gus.',
    `<label class="btn primary" style="cursor:pointer">Muat naik CSV<input type="file" accept=".csv,text/csv" data-on-change="im-file" hidden></label>`)}
  ${!all.length ? `<div class="card card-pad"><b>Belum ada data.</b><p class="muted" style="margin-top:6px">Muat naik fail CSV dengan lajur: No. invois, Pelajar, Tarikh latihan, Masa (MYT), Venue, Program, Status invois, Catatan semakan, Rekod ditemui, Butiran pada invois.</p></div>` : `
  <div class="chips">${[['open', `Belum dicipta (${cnt('open')})`], ['done', `Selesai (${cnt('done')})`], ['skipped', `Diabaikan (${cnt('skipped')})`]].map(([k, l]) => `<button class="chip ${st === k ? 'on' : ''}" data-action="im-state" data-id="${k}">${l}</button>`).join('')}
    <span style="width:12px"></span>${[['all', 'Semua tarikh'], ['future', `Mulai hari ini`], ['past', 'Tarikh lepas']].map(([k, l]) => `<button class="chip ${when === k ? 'on' : ''}" data-action="im-when" data-id="${k}">${l}</button>`).join('')}</div>
  ${st === 'open' ? `<div class="card card-pad mb im-bar">
    <div><b>${ready.length}</b> baris lengkap & sedia · <b>${L.length - ready.length}</b> perlu tindakan${sel.size ? ` · <b>${sel.size}</b> dipilih` : ''}</div>
    <div class="actions" style="flex-wrap:wrap">
      <button class="btn" data-action="im-sel-ready">Pilih semua yang sedia (${ready.length})</button>
      ${sel.size ? `<select class="btn" data-on-change="im-bulk-venue"><option value="">Lokasi untuk dipilih…</option>${opt(venues)}</select>
        <select class="btn" data-on-change="im-bulk-coach"><option value="">Coach untuk dipilih…</option>${opt(coaches, null, x => x.full_name)}</select>
        <button class="btn" data-action="im-skip">Abaikan dipilih</button><button class="btn primary" data-action="im-create">Cipta sesi (${sel.size})</button>` : ''}
    </div>
    <label class="im-opt"><input type="checkbox" data-on-change="im-past" ${UI.imPastPresent !== false ? 'checked' : ''}> Tarikh lepas: rekod pelajar sebagai <b>Hadir</b> (invois sudah dikeluarkan). Jika tidak ditanda: rekod sebagai tempahan sahaja.</label></div>` : ''}
  <div class="card"><div class="table-wrap"><table class="im-table"><thead><tr>${st === 'open' ? `<th class="selcol" data-action="im-sel-all"><span class="cbx ${L.length && L.every(r => sel.has(r.id)) ? 'on' : ''}"></span></th>` : ''}
    <th>Tarikh</th><th>Pelajar</th><th>Jenis</th><th>Masa</th><th>Lokasi</th><th>Program / kelas</th><th>Coach</th></tr></thead><tbody>
  ${L.map(r => { const pb = st === 'open' ? problems(r) : [], ex = st === 'open' && existing(r), gc = isGroupRow(r) && groupClass(r), skipHint = SKIP_HINT(r), dis = st !== 'open' ? 'disabled' : '';
    return `<tr class="${sel.has(r.id) ? 'sel' : ''} ${pb.length || ex ? 'warn' : ''}">
      ${st === 'open' ? `<td class="selcol" data-action="im-sel" data-id="${r.id}"><span class="cbx ${sel.has(r.id) ? 'on' : ''}"></span></td>` : ''}
      <td style="white-space:nowrap"><b>${DAYS[new Date(r.session_date + 'T00:00').getDay()].slice(0, 3)} ${fmtShort(r.session_date)}</b>${r.session_date < todayISO() ? '<div class="muted" style="font-size:11px">lepas</div>' : ''}</td>
      <td><select data-on-change="im-f" data-id="${r.id}" data-k="student_id" ${dis} class="${r.student_id ? '' : 'bad'}"><option value="">— ${esc(r.student_name)} —</option>${opt(studs, r.student_id, x => x.full_name + (x.status !== 'active' ? ` (${x.status})` : ''))}</select>
        ${r.student_id && byId('students', r.student_id)?.full_name.toLowerCase() !== r.student_name.toLowerCase() ? `<div class="muted" style="font-size:11px">CSV: ${esc(r.student_name)}</div>` : ''}</td>
      <td><select data-on-change="im-f" data-id="${r.id}" data-k="kind" ${dis}><option value="personal" ${r.kind === 'personal' ? 'selected' : ''}>Personal</option><option value="group" ${r.kind === 'group' ? 'selected' : ''}>Kumpulan</option></select></td>
      <td style="white-space:nowrap"><input type="time" value="${hm(r.start_time) || ''}" data-on-change="im-f" data-id="${r.id}" data-k="start_time" ${dis} class="${!isGroupRow(r) && !r.start_time ? 'bad' : ''}">–<input type="time" value="${hm(r.end_time) || ''}" data-on-change="im-f" data-id="${r.id}" data-k="end_time" ${dis}></td>
      <td><select data-on-change="im-f" data-id="${r.id}" data-k="venue_id" ${dis} class="${r.venue_id ? '' : 'bad'}"><option value="">${esc(r.venue_text || '— Pilih —')}</option>${opt(venues, r.venue_id)}</select></td>
      <td>${isGroupRow(r) ? (gc ? `<span style="font-size:12.5px">${esc(byId('programmes', gc.programme_id)?.name || '')} · ${DAYS[gc.weekday].slice(0, 3)} ${hm(gc.start_time)}</span>` : '<span style="color:var(--bad);font-size:12.5px">Tiada kelas sepadan</span>')
        : `<select data-on-change="im-f" data-id="${r.id}" data-k="programme_id" ${dis} class="${r.programme_id ? '' : 'bad'}"><option value="">— Pilih —</option>${opt(progs.filter(p => p.kind === 'personal'), r.programme_id)}</select>`}</td>
      <td>${isGroupRow(r) ? '<span class="muted" style="font-size:12px">ikut kelas</span>' : `<select data-on-change="im-f" data-id="${r.id}" data-k="coach_id" ${dis} class="${r.coach_id ? '' : 'bad'}"><option value="">— Pilih —</option>${opt(coaches, r.coach_id, x => x.full_name)}</select>`}</td>
      </tr><tr class="im-sub ${sel.has(r.id) ? 'sel' : ''} ${pb.length || ex ? 'warn' : ''}">${st === 'open' ? '<td></td>' : ''}<td colspan="7"><b>${esc(r.invoice_no || '')}</b> · ${esc(r.invoice_status || '')}
        ${ex ? '<div style="color:var(--warn);font-weight:600">Sudah ada sesi pelajar ini pada tarikh ini — semak sebelum cipta</div>' : ''}${skipHint ? '<div style="color:var(--bad);font-weight:600">Invois menyebut batal / dikecualikan — mungkin perlu diabaikan</div>' : ''}
        ${pb.length ? `<div style="color:var(--bad)">${pb.join(' · ')}</div>` : st === 'open' && partnerBlock(r) ? '<div style="color:var(--warn)">Rakan sesi (pelajar lain pada invois & masa sama) belum lengkap</div>' : ''}${r.review_note ? `<div class="muted">${esc(r.review_note)}</div>` : ''}
        ${r.details ? `<details><summary class="muted">Butiran invois</summary><div class="muted" style="white-space:pre-wrap">${esc(r.details)}</div></details>` : ''}
        ${r.state === 'done' && r.session_id ? '<div style="color:var(--ok)">✓ Sesi dicipta</div>' : ''}${r.state !== 'open' ? `<button class="btn sm" data-action="im-reopen" data-id="${r.id}" style="margin-top:4px">Buka semula</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="8" class="empty">Tiada baris.</td></tr>`}
  </tbody></table></div></div>
  <p class="muted" style="font-size:12px;margin-top:8px">Tip: menukar masa, lokasi atau coach pada satu baris turut mengisi baris lain untuk <b>invois & pelajar yang sama</b> yang masih kosong. Pelajar pada invois, tarikh & masa yang sama (cth. 2-ke-1) digabung dalam satu sesi personal.</p>`}`;
};

/* ---------------- Muat naik ---------------- */
INPUTS['im-file'] = async (v, el) => {
  const file = el.files?.[0]; if (!file) return;
  const grid = parseCSV(await file.text()); const hi = grid.findIndex(r => r.some(c => /no\.?\s*invois/i.test(c)));
  if (hi < 0) return toast('Lajur "No. invois" tidak dijumpai dalam CSV', true);
  const H = grid[hi].map(h => h.trim().toLowerCase()), col = re => H.findIndex(h => re.test(h));
  const ci = { inv: col(/invois$|no\.? invois/), name: col(/^pelajar/), date: col(/tarikh/), time: col(/masa/), venue: col(/venue|lokasi/), prog: col(/program/), st: col(/status/), note: col(/catatan/), found: col(/rekod/), det: col(/butiran/) };
  const batch = file.name.replace(/\.csv$/i, '') + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
  const have = new Set(rows().map(r => `${r.invoice_no}|${r.student_name.toLowerCase()}|${r.session_date}`));
  const out = [];
  for (const r of grid.slice(hi + 1)) {
    const name = (r[ci.name] || '').trim(), date = parseDate(r[ci.date]); if (!name || !date) continue;
    const key = `${(r[ci.inv] || '').trim()}|${name.toLowerCase()}|${date}`; if (have.has(key)) continue; have.add(key);
    const [st, en] = parseTime(r[ci.time] || r[ci.det]), prog = (r[ci.prog] || '').trim(), det = (r[ci.det] || '').trim();
    const kind = /personal|sparring|1-to-1|2-to-1|3-to-1|to-one/i.test(prog + ' ' + det) ? 'personal' : 'group';
    out.push({ batch, invoice_no: (r[ci.inv] || '').trim() || null, student_name: name, student_id: matchStudent(name), session_date: date, start_time: st, end_time: en,
      venue_text: (r[ci.venue] || '').trim() || null, venue_id: matchVenue(r[ci.venue] || det), programme_text: prog || null, kind,
      coach_id: kind === 'personal' ? matchCoach(det) : null, invoice_status: (r[ci.st] || '').trim() || null, review_note: (r[ci.note] || '').trim() || null,
      found: (r[ci.found] || '').trim() || null, details: det || null, state: /batal|excluded|planned absence/i.test(det + ' ' + (r[ci.found] || '')) ? 'skipped' : 'open' });
  }
  // program personal ikut bilangan pelajar pada invois/tarikh/masa yang sama
  out.forEach(r => { if (r.kind === 'personal') r.programme_id = matchProgramme(r.programme_text, out.filter(x => x.invoice_no === r.invoice_no && x.session_date === r.session_date && x.start_time === r.start_time).length);
    else r.programme_id = matchProgramme(r.programme_text, 1); });
  if (!out.length) return toast('Tiada baris baharu dalam CSV (mungkin sudah dimuat naik)');
  await insert('session_import', out);
  UI.imState = 'open'; toast(`${out.length} baris dimuat naik · ${out.filter(r => r.state === 'skipped').length} diabaikan automatik (batal / dikecualikan)`); app.render();
};

/* ---------------- Sunting & pilih ---------------- */
INPUTS['im-f'] = async (v, el) => {
  const r = byId('session_import', el.dataset.id), k = el.dataset.k, val = v || null;
  const patch = { [k]: val }; if (k === 'kind' && val === 'group') patch.coach_id = null;
  await update('session_import', r.id, patch);
  // isi baris lain dengan invois & pelajar sama yang masih kosong
  if (['start_time', 'end_time', 'venue_id', 'coach_id', 'programme_id', 'student_id'].includes(k) && val) {
    const sib = rows().filter(x => x.id !== r.id && x.state === 'open' && !x[k] && (k === 'student_id' ? x.student_name.toLowerCase() === r.student_name.toLowerCase()
      : r.invoice_no ? x.invoice_no === r.invoice_no && (k === 'venue_id' || k === 'programme_id' || x.student_name.toLowerCase() === r.student_name.toLowerCase() || (x.session_date === r.session_date && hm(x.start_time) === hm(r.start_time)))
      : x.student_name.toLowerCase() === r.student_name.toLowerCase()));
    for (const x of sib) await update('session_import', x.id, { [k]: val });
    if (sib.length) toast(`Turut diisi untuk ${sib.length} baris lain`);
  }
  app.render();
};
const bulkSet = k => async v => { if (!v) return; for (const id of UI.imSel || []) { const r = byId('session_import', id); if (k === 'coach_id' && r.kind === 'group') continue; await update('session_import', id, { [k]: v }); } toast('Dikemas kini'); app.render(); };
INPUTS['im-bulk-venue'] = bulkSet('venue_id');
INPUTS['im-bulk-coach'] = bulkSet('coach_id');
INPUTS['im-past'] = (v, el) => { UI.imPastPresent = el.checked; };
Object.assign(ACTIONS, {
  'im-state': id => { UI.imState = id; UI.imSel = new Set(); app.render(); },
  'im-when': id => { UI.imWhen = id; app.render(); },
  'im-sel': id => { const s = (UI.imSel ||= new Set()); s.has(id) ? s.delete(id) : s.add(id); app.render(); },
  'im-sel-all': () => { const L = rows().filter(r => r.state === (UI.imState || 'open')), s = (UI.imSel ||= new Set()), all = L.every(r => s.has(r.id)); L.forEach(r => (all ? s.delete(r.id) : s.add(r.id))); app.render(); },
  'im-sel-ready': () => { const today = todayISO(), w = UI.imWhen || 'all';
    UI.imSel = new Set(rows().filter(r => r.state === 'open' && (w === 'all' || (w === 'future' ? r.session_date >= today : r.session_date < today)) && isReady(r)).map(r => r.id)); app.render(); },
  'im-skip': async () => { for (const id of UI.imSel || []) await update('session_import', id, { state: 'skipped' }); toast('Diabaikan'); UI.imSel = new Set(); app.render(); },
  'im-reopen': async id => { await update('session_import', id, { state: 'open', session_id: null, done_at: null }); app.render(); },
  'im-create': () => {
    let L = [...(UI.imSel || [])].map(id => byId('session_import', id)).filter(r => r && r.state === 'open');
    // rakan sesi (invois, tarikh & masa sama — cth. 2-ke-1) mesti dicipta bersama
    const partners = rows().filter(x => x.state === 'open' && x.kind === 'personal' && !L.includes(x) && L.some(r => r.kind === 'personal' && r.invoice_no && r.invoice_no === x.invoice_no && r.session_date === x.session_date && hm(r.start_time) === hm(x.start_time)));
    const pBad = partners.filter(x => problems(x).length);
    if (pBad.length) return toast(`${pBad[0].student_name} (${fmtShort(pBad[0].session_date)}) berkongsi sesi pada invois sama tetapi belum lengkap: ${problems(pBad[0]).join(', ')}`, true);
    L = [...L, ...partners];
    const bad = L.filter(r => problems(r).length);
    if (bad.length) return toast(`${bad.length} baris dipilih belum lengkap (${problems(bad[0]).join(', ')})`, true);
    const dup = L.filter(existing);
    confirmModal({ title: `Cipta ${L.length} sesi / tempahan?`, ok: 'Cipta', message: `${L.filter(r => r.kind === 'personal').length} personal · ${L.filter(r => r.kind === 'group').length} tempahan kelas kumpulan.
      ${L.some(r => r.session_date < todayISO()) ? `<br>Tarikh lepas direkod sebagai <b>${UI.imPastPresent !== false ? 'Hadir' : 'tempahan'}</b>.` : ''}${dup.length ? `<br><b style="color:var(--warn)">${dup.length} baris sudah ada sesi pada tarikh sama</b> — sesi tambahan tetap akan dicipta.` : ''}
      <br><br>Ibu bapa tidak dimaklumkan secara automatik untuk sesi yang diimport.`,
      onOk: () => createAll(L) });
  },
});

async function createAll(L) {
  const today = todayISO(), pastPresent = UI.imPastPresent !== false; let nS = 0, nB = 0, fail = 0;
  const attStatus = date => (date < today && pastPresent ? 'present' : 'booked');
  // Personal: gabung pelajar pada invois + tarikh + masa + lokasi + coach yang sama
  const groups = new Map();
  for (const r of L.filter(r => r.kind === 'personal')) { const k = [r.invoice_no, r.session_date, hm(r.start_time), hm(r.end_time), r.venue_id, r.coach_id, r.programme_id].join('|'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  for (const rs of groups.values()) {
    try {
      const r0 = rs[0], ids = [...new Set(rs.map(r => r.student_id))], wd = new Date(r0.session_date + 'T00:00').getDay(), st = hm(r0.start_time), en = hm(r0.end_time);
      let cls = T('classes').find(c => !c.active && c.venue_id === r0.venue_id && c.programme_id === r0.programme_id && c.coach_id === r0.coach_id && c.weekday === wd && hm(c.start_time) === st && hm(c.end_time) === en
        && enrolledIn(c.id).map(e => e.student_id).sort().join() === [...ids].sort().join());
      if (!cls) {
        const billing = ids.every(id => livePackages(id).some(p => byId('programmes', p.programme_id)?.kind === 'personal')) ? 'package' : 'monthly';
        cls = await insert('classes', { venue_id: r0.venue_id, programme_id: r0.programme_id, coach_id: r0.coach_id, weekday: wd, start_time: st, end_time: en, capacity: Math.max(ids.length, 1), active: false, billing });
        await insert('class_enrolments', ids.map(id => ({ class_id: cls.id, student_id: id })));
      }
      const s = T('class_sessions').find(x => x.class_id === cls.id && x.session_date === r0.session_date)
        || await insert('class_sessions', { class_id: cls.id, session_date: r0.session_date, status: r0.session_date < today ? 'held' : 'scheduled', coach_id: r0.coach_id, start_time: st, end_time: en });
      for (const id of ids) if (!T('attendance').some(a => a.session_id === s.id && a.student_id === id)) await insert('attendance', { session_id: s.id, student_id: id, status: attStatus(r0.session_date), note: `Import invois ${r0.invoice_no || ''}`.trim() });
      for (const r of rs) await update('session_import', r.id, { state: 'done', session_id: s.id, done_at: new Date().toISOString() });
      nS++;
    } catch (e) { console.warn(e); fail += rs.length; }
  }
  // Kumpulan: tempahan dalam kelas sedia ada
  for (const r of L.filter(r => r.kind === 'group')) {
    try {
      const c = groupClass(r), s = await ensureSession(c.id, r.session_date);
      if (s.status === 'cancelled') { fail++; continue; }
      if (!T('attendance').some(a => a.session_id === s.id && a.student_id === r.student_id)) await insert('attendance', { session_id: s.id, student_id: r.student_id, status: attStatus(r.session_date), note: `Import invois ${r.invoice_no || ''}`.trim() });
      await update('session_import', r.id, { state: 'done', session_id: s.id, done_at: new Date().toISOString() }); nB++;
    } catch (e) { console.warn(e); fail++; }
  }
  UI.imSel = new Set();
  toast(`${nS} sesi personal & ${nB} tempahan kumpulan dicipta${fail ? ` · ${fail} gagal (semak konsol / sesi dibatalkan)` : ''}`, !!fail); app.render();
}
