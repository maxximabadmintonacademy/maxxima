// Tempahan ibu bapa, Padankan Nama (import WhatsApp), Bil Personal Bulanan & Walk-in.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, refresh, rpc, setting, saveSetting } from '../data.js';
import { ic, esc, F, val, RM, UI, app, toast, openModal, confirmModal, pageHead, hm, todayISO, addDays, parseISO, fmtDate, fmtShort, DAYS, LABEL, monthLabel, badge, avatar } from '../ui.js';
import { T, byId, venueName, progName, staffName, studentName, livePackages } from './helpers.js';
import { ensureSession, sTime, sHours, isPersonal, openSession } from './sessions.js';

/* =====================================================================
   TEMPAHAN (daripada portal ibu bapa)
   ===================================================================== */
export const newBookings = () => T('booking_requests').filter(b => b.status === 'new');
const ACT = { book: ['Tempahan', 'b-info'], reschedule: ['Reschedule', 'b-purple'], cancel: ['Batal', 'b-muted'], emergency: ['Kecemasan / MC', 'b-bad'] };
const slotTxt = (cid, d) => { const c = byId('classes', cid); return d ? `${DAYS[parseISO(d).getDay()]} ${fmtShort(d)}${c ? ' ' + hm(c.start_time) + ' · ' + progName(c.programme_id) + ' · ' + venueName(c.venue_id) : ''}` : ''; };
const bkWhen = b => (b.action && b.action !== 'book')
  ? `Sesi asal: ${slotTxt(b.from_class_id, b.from_date)}${b.session_date ? ' → ' + slotTxt(b.class_id, b.session_date) : ''}${b.pref_time ? ' · pilihan: ' + b.pref_time : ''}${b.reason ? ' · sebab: ' + b.reason : ''}`
  : b.kind === 'group'
  ? (() => { const c = byId('classes', b.class_id); return `${b.session_date ? DAYS[parseISO(b.session_date).getDay()] + ', ' + fmtDate(b.session_date) : ''}${c ? ' · ' + hm(c.start_time) + '–' + hm(c.end_time) + ' · ' + progName(c.programme_id) + ' · ' + venueName(c.venue_id) : ''}`; })()
  : `Hari pilihan: ${(b.pref_days || []).map(d => DAYS[d]).join(', ') || '—'}${b.pref_time ? ' · ' + b.pref_time : ''}${b.venue_id ? ' · ' + venueName(b.venue_id) : ''}${b.sessions ? ' · ' + b.sessions + ' sesi' : ''}`;

VIEWS.tempahan = () => {
  const tab = UI.bkTab || 'new', list = T('booking_requests').filter(b => tab === 'all' || b.status === tab).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const cnt = k => T('booking_requests').filter(b => b.status === k).length;
  return `${pageHead('Tempahan Ibu Bapa', 'Tempahan sesi kumpulan (slot terbuka) dan permintaan sesi personal daripada portal ibu bapa — termasuk yang belum beli pakej.',
    `<button class="btn" data-action="cal-personal">${ic('plus', 'sm')} Sesi Personal</button><button class="btn primary" data-action="bk-manual">${ic('plus', 'sm')} Tempahan Manual / Bulk</button>`)}
  <div class="chips">${[['new', 'Baharu'], ['accepted', 'Diterima'], ['rejected', 'Ditolak'], ['cancelled', 'Dibatalkan'], ['all', 'Semua']].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-action="bk-tab" data-id="${k}" style="cursor:pointer">${l}${k !== 'all' ? ` <span class="n">${cnt(k)}</span>` : ''}</button>`).join('')}</div>
  <div class="card"><ul class="list">${list.map(b => { const st = byId('students', b.student_id), pk = livePackages(b.student_id); return `<li class="list-item" style="flex-wrap:wrap">${avatar(st?.full_name || '?')}
    <div class="li-main"><div class="li-title">${esc(st?.full_name || '—')} <span class="badge ${b.kind === 'group' ? 'b-info' : 'b-purple'}">${b.kind === 'group' ? 'Kumpulan' : 'Personal'}</span> <span class="badge ${ACT[b.action || 'book'][1]}">${ACT[b.action || 'book'][0]}</span>${b.late ? ' <span class="badge b-bad">&lt;48 jam</span>' : ''} ${badge(b.status === 'new' ? 'new' : b.status, { new: 'Baharu', accepted: 'Diterima', rejected: 'Ditolak', cancelled: 'Dibatalkan' }[b.status])}</div>
      <div class="li-sub">${esc(bkWhen(b))}</div>
      <div class="li-sub">${pk.length ? 'Pakej aktif: ' + esc(pk.map(p => p.name).join(', ')) : '<span style="color:var(--warn)">Tiada pakej aktif — akan dibil walk-in / bulanan</span>'}${b.notes ? ' · “' + esc(b.notes) + '”' : ''}${b.admin_note ? ' · Admin: ' + esc(b.admin_note) : ''}</div>
      <div class="li-sub">Dihantar ${b.created_at ? fmtShort(b.created_at) : ''}${st?.guardian_phone ? ` · <a target="_blank" rel="noopener" href="https://wa.me/${String(st.guardian_phone).replace(/\D/g, '').replace(/^0/, '60')}">WhatsApp penjaga</a>` : ''}</div></div>
    ${b.status === 'new' ? `<div class="actions">${b.proof_path ? `<button class="btn sm" data-action="bk-proof" data-id="${b.id}">${ic('file', 'sm')} Bukti</button>` : ''}<button class="btn sm primary" data-action="bk-accept" data-id="${b.id}">${ic('tick', 'sm')} ${b.action && b.action !== 'book' ? 'Lulus' : 'Terima'}</button><button class="btn sm danger-o" data-action="bk-reject" data-id="${b.id}">Tolak</button></div>` : b.session_id ? `<button class="btn sm" data-action="sess-open" data-id="${b.session_id}">Buka sesi</button>` : ''}</li>`; }).join('') || '<li class="empty">Tiada tempahan.</li>'}</ul></div>`;
};
Object.assign(ACTIONS, {
  'bk-tab': k => { UI.bkTab = k; app.render(); },
  /* Admin masukkan tempahan sendiri (cth. dari WhatsApp) — ramai pelajar & beberapa tarikh sekali gus */
  'bk-manual': () => {
    const cls = T('classes').filter(c => c.active && !isPersonal(c)).sort((a, b) => a.weekday - b.weekday || hm(a.start_time).localeCompare(hm(b.start_time)));
    const nextOf = c => { for (let i = 0; i < 7; i++) { const d = addDays(todayISO(), i); if (parseISO(d).getDay() === c.weekday) return d; } return todayISO(); };
    const sts = T('students').filter(x => x.status === 'active' || x.status === 'pending' || x.status === 'awaiting_payment').sort((a, b) => a.full_name.localeCompare(b.full_name));
    const f = openModal({ title: 'Tempahan Manual / Bulk', submit: 'Simpan', wide: true, body: `<div class="form-grid">
      <label class="f full">Kelas / slot<select name="class_id" required>${cls.map(c => `<option value="${c.id}">${DAYS[c.weekday]} ${hm(c.start_time)}–${hm(c.end_time)} · ${esc(progName(c.programme_id))} · ${esc(venueName(c.venue_id))}</option>`).join('')}</select></label>
      ${F('Tarikh pertama', 'date', { type: 'date', value: cls[0] ? nextOf(cls[0]) : todayISO(), req: true })}
      ${F('Ulang setiap minggu (bil. minggu)', 'repeat', { type: 'number', value: 1, min: 1, max: 12 })}
      ${F('Rekod sebagai', 'status', { value: 'booked', opts: [['booked', 'Tempahan (akan datang)'], ['present', 'Hadir (rekod sesi lepas)'], ['absent', 'Tidak hadir'], ['excused', 'Dimaafkan']] })}
      <label class="f full">Pelajar (Ctrl/⌘ untuk pilih ramai)<select name="students" multiple size="8">${sts.map(x => `<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}</select></label>
      ${F('Atau tampal senarai nama dari WhatsApp (satu nama setiap baris)', 'paste', { type: 'textarea', full: true, ph: 'Aiman\nTia\nSanvir' })}
    </div><div id="bkPrev" class="muted" style="font-size:12.5px;margin-top:8px"></div>`,
      onSubmit: async d => {
        const c = byId('classes', d.class_id), ids = new Set([].concat(d.students || []).filter(Boolean)), miss = [];
        String(d.paste || '').split(/\n+/).map(x => x.replace(/^[\s\d.)\-•*]+/, '').trim()).filter(Boolean).forEach(n => { const m = pasteMatch(n); if (m) ids.add(m.id); else miss.push(n); });
        if (!ids.size) throw new Error('Pilih atau tampal sekurang-kurangnya seorang pelajar.' + (miss.length ? ' Tidak dijumpai: ' + miss.join(', ') : ''));
        if (parseISO(d.date).getDay() !== c.weekday) throw new Error(`Tarikh pertama mesti hari ${DAYS[c.weekday]}.`);
        let n = 0;
        for (let i = 0; i < Math.max(1, Number(d.repeat) || 1); i++) {
          const s = await ensureSession(c.id, addDays(d.date, 7 * i));
          for (const id of ids) if (!T('attendance').some(a => a.session_id === s.id && a.student_id === id)) { await insert('attendance', { session_id: s.id, student_id: id, status: d.status, note: 'Dimasukkan oleh admin' }); n++; }
        }
        toast(`${n} rekod disimpan untuk ${ids.size} pelajar${miss.length ? ` · tidak dijumpai: ${miss.join(', ')}` : ''}`, !!miss.length); app.render();
      } });
    const prev = () => { const names = String(f.elements.paste.value || '').split(/\n+/).map(x => x.replace(/^[\s\d.)\-•*]+/, '').trim()).filter(Boolean);
      f.querySelector('#bkPrev').innerHTML = names.map(n => { const m = pasteMatch(n); return m ? `✓ ${esc(n)} → <b>${esc(m.full_name)}</b>` : `<span style="color:var(--bad)">✗ ${esc(n)} — tidak pasti / tiada</span>`; }).join('<br>'); };
    f.elements.paste.addEventListener('input', prev);
    f.elements.class_id.addEventListener('change', () => { f.elements.date.value = nextOf(byId('classes', f.elements.class_id.value)); });
  },
  'bk-proof': async id => {
    const b = byId('booking_requests', id); if (S.mode !== 'supabase') return toast('Demo: tiada fail');
    const { data, error } = await S.client.storage.from('payment-proofs').createSignedUrl(b.proof_path, 300); if (error) return toast(error.message, true);
    window.open(data.signedUrl, '_blank', 'noopener');
  },
  'bk-accept': async id => {
    const b = byId('booking_requests', id);
    if (b.action && b.action !== 'book') return approveChange(b);
    if (b.kind === 'group') {
      if (!b.class_id || !b.session_date) return toast('Tempahan tiada slot', true);
      const s = await ensureSession(b.class_id, b.session_date);
      if (!T('attendance').some(a => a.session_id === s.id && a.student_id === b.student_id)) await insert('attendance', { session_id: s.id, student_id: b.student_id, status: 'booked', note: 'Tempahan ibu bapa' });
      await update('booking_requests', id, { status: 'accepted', session_id: s.id, handled_at: new Date().toISOString() });
      toast('Tempahan diterima — pelajar dimasukkan ke sesi'); app.render();
    } else {
      const firstDay = (b.pref_days || [])[0]; let d = todayISO();
      if (firstDay != null) { for (let i = 0; i < 7; i++) { const x = addDays(todayISO(), i + 1); if (parseISO(x).getDay() === Number(firstDay)) { d = x; break; } } }
      const tm = String(b.pref_time || '').match(/(\d{1,2})[:.]?(\d{2})?/);
      const start = tm ? String(Math.min(Number(tm[1]) + (/pm|petang|malam/i.test(b.pref_time) && Number(tm[1]) < 12 ? 12 : 0), 23)).padStart(2, '0') + ':' + (tm[2] || '00') : '18:00';
      ACTIONS['cal-personal']({ students: [b.student_id], venue_id: b.venue_id, programme_id: b.programme_id, date: d, start, end: String(Math.min(Number(start.slice(0, 2)) + 1, 23)).padStart(2, '0') + start.slice(2),
        onDone: async cls => { const s = T('class_sessions').filter(x => x.class_id === cls.id).sort((a, b2) => a.session_date.localeCompare(b2.session_date))[0]; await update('booking_requests', id, { status: 'accepted', session_id: s?.id || null, handled_at: new Date().toISOString() }); } });
    }
  },
  'bk-reject': id => { const b = byId('booking_requests', id); openModal({ title: 'Tolak permintaan', submit: 'Tolak', body: `${b.action === 'emergency' && b.kind === 'group' ? '<p class="muted" style="font-size:13px;margin-bottom:10px">Kecemasan ditolak: sesi dikira batal lewat (ditolak daripada pakej).</p>' : b.action === 'emergency' ? '<p class="muted" style="font-size:13px;margin-bottom:10px">Kecemasan ditolak: court hangus + 50% yuran coach (batal lewat).</p>' : ''}${F('Sebab / cadangan slot lain (dipaparkan kepada ibu bapa)', 'note', { type: 'textarea', full: true })}`,
    onSubmit: async d => {
      if (b.action === 'emergency') await setFromStatus(b, 'late_cancel', 'Kecemasan ditolak');
      await update('booking_requests', id, { status: 'rejected', admin_note: val(d.note), handled_at: new Date().toISOString() }); toast('Permintaan ditolak'); app.render(); } }); },
});

/* Kelulusan reschedule / batal / kecemasan (ikut Terma & Syarat). */
async function setFromStatus(b, status, note) {
  const s = await ensureSession(b.from_class_id, b.from_date), a = T('attendance').find(x => x.session_id === s.id && x.student_id === b.student_id);
  if (status === null) {           // batal >=48 jam tanpa caj
    const others = T('attendance').filter(x => x.session_id === s.id && x.student_id !== b.student_id && x.status !== 'excused');
    if (a) await update('attendance', a.id, { status: 'excused', note: note });
    else await insert('attendance', { session_id: s.id, student_id: b.student_id, status: 'excused', note });
    if (byId('programmes', byId('classes', b.from_class_id)?.programme_id)?.kind === 'personal' && !others.length) await update('class_sessions', s.id, { status: 'cancelled', cancel_reason: note });
    return s;
  }
  if (a) await update('attendance', a.id, { status, note: [a.note, note].filter(Boolean).join(' · ') });
  else await insert('attendance', { session_id: s.id, student_id: b.student_id, status, note });
  return s;
}
async function approveChange(b) {
  const pol = { replacement_days: 30, ...(setting('policy', {}) || {}) }, now = new Date().toISOString(), personal = b.kind === 'personal';
  const done = async (note, extra = {}) => { await update('booking_requests', b.id, { status: 'accepted', handled_at: now, admin_note: note, ...extra }); toast('Permintaan diluluskan'); app.render(); };
  if (b.action === 'emergency') {
    await setFromStatus(b, 'excused', personal ? 'Kecemasan diluluskan — court sahaja dikenakan' : 'Kecemasan diluluskan — sesi tidak ditolak');
    if (!personal) {   // kredit ganti: sah sekurang-kurangnya 30 hari dari tarikh asal (fasal 08)
      const until = addDays(b.from_date, Number(pol.replacement_days) || 30), c = byId('classes', b.from_class_id);
      for (const p of T('student_packages').filter(p => p.student_id === b.student_id && p.programme_id === c?.programme_id && p.status === 'active' && p.expires_on && p.expires_on < until)) await update('student_packages', p.id, { expires_on: until });
      return done(`Kecemasan diluluskan. Kredit ganti sah hingga ${fmtDate(until)}.`);
    }
    return done('Kecemasan diluluskan. Court sahaja dikenakan; sesi coaching boleh diganti.');
  }
  if (b.late) await setFromStatus(b, 'late_cancel', b.action === 'reschedule' ? 'Reschedule lewat (<48 jam)' : 'Batal lewat (<48 jam)');
  else await setFromStatus(b, null, b.action === 'reschedule' ? 'Reschedule (notis cukup)' : 'Batal (notis cukup)');
  if (b.action === 'reschedule') {
    if (!personal && b.class_id && b.session_date) { const s2 = await ensureSession(b.class_id, b.session_date); if (!T('attendance').some(a => a.session_id === s2.id && a.student_id === b.student_id)) await insert('attendance', { session_id: s2.id, student_id: b.student_id, status: 'booked', note: 'Reschedule dari ' + fmtShort(b.from_date) }); return done('Reschedule diluluskan', { session_id: s2.id }); }
    const c = byId('classes', b.from_class_id);
    return ACTIONS['cal-personal']({ students: [b.student_id], venue_id: c?.venue_id, programme_id: c?.programme_id, coach_id: c?.coach_id, date: b.session_date || todayISO(), start: hm(c?.start_time) || '18:00', end: hm(c?.end_time) || '19:00',
      onDone: async cls => done('Reschedule diluluskan — sesi ganti ditetapkan') });
  }
  return done(b.late ? 'Batal lewat: dikira mengikut terma' : 'Batal diluluskan tanpa caj');
}

/* =====================================================================
   PADANKAN NAMA (baki kehadiran import WhatsApp)
   ===================================================================== */
const M = () => (S.t.import_matches ||= null);
async function loadMatches() {
  if (S.mode !== 'supabase') { S.t.import_matches = []; return; }
  const out = [];
  for (let i = 0; ; i += 1000) { const { data, error } = await S.client.from('import_matches').select('*').eq('state', 'open').order('d').range(i, i + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; }
  S.t.import_matches = out;
}
const words = s => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, ' ').split(/[^a-z0-9']+/).filter(w => w.length > 1);
function suggest(raw) {
  const w = words(raw); if (!w.length) return [];
  return T('students').filter(s => !s.merged_into).map(s => { const sw = words(s.full_name); let sc = 0; w.forEach(x => { if (sw.includes(x)) sc += 3; else if (sw.some(y => y.startsWith(x) || x.startsWith(y))) sc += 1; }); return { s, sc: sc + (s.status === 'active' ? 0.5 : 0) }; })
    .filter(x => x.sc >= 1).sort((a, b) => b.sc - a.sc).slice(0, 5).map(x => x.s);
}
/* Padanan nama tampal: tepat satu pelajar dengan skor tertinggi */
function pasteMatch(n) {
  const low = n.toLowerCase(), exact = T('students').filter(s => !s.merged_into && s.full_name.toLowerCase() === low);
  if (exact.length === 1) return exact[0];
  const w = words(n); if (!w.length) return null;
  const sc = T('students').filter(s => !s.merged_into && s.status !== 'left').map(s => { const sw = words(s.full_name); return { s, k: w.filter(x => sw.includes(x)).length }; }).filter(x => x.k === w.length);
  return sc.length === 1 ? sc[0].s : null;
}
VIEWS.padanan = () => {
  if (M() === null) { loadMatches().then(() => app.render()).catch(e => { S.t.import_matches = []; toast(e.message, true); app.render(); }); return `${pageHead('Padankan Nama', '')}<div class="boot">Memuatkan…</div>`; }
  const groups = new Map();
  T('import_matches').forEach(m => { const k = [m.kind, m.raw_name.toLowerCase(), m.prog || '', m.area || ''].join('|'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
  const q = (UI.mqQ || '').toLowerCase(), rows = [...groups.values()].filter(g => !q || g[0].raw_name.toLowerCase().includes(q)).sort((a, b) => b.length - a.length);
  const allSt = T('students').filter(s => !s.merged_into).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return `${pageHead('Padankan Nama', `${T('import_matches').length} rekod kehadiran import WhatsApp (2026) menunggu nama dipadankan dengan pelajar · ${groups.size} nama`)}
  <div class="card card-pad mb"><div class="filters"><label class="field grow">${ic('search', 'sm')}<input placeholder="Cari nama dalam chat…" value="${esc(UI.mqQ || '')}" data-on-change="mq-q"></label></div>
  <p class="muted" style="font-size:12.5px;margin-top:8px">Pilih pelajar sebenar untuk setiap nama dalam chat. Semua tarikh dengan nama yang sama dimasukkan sekali gus sebagai kehadiran (sesi dicipta jika belum ada). "Abaikan" untuk nama yang bukan pelajar / pelajar yang sudah berhenti.</p></div>
  <div class="card"><ul class="list">${rows.slice(0, 80).map(g => { const m = g[0], sg = suggest(m.raw_name), ds = g.map(x => x.d).sort(); return `<li class="list-item" style="flex-wrap:wrap;align-items:flex-start">
    <div class="li-main" style="min-width:220px"><div class="li-title">${esc(m.raw_name)} <span class="badge b-muted">${g.length} sesi</span></div>
      <div class="li-sub">${m.kind === 'group' ? esc(m.prog + ' · ' + m.area) : 'Personal · ' + esc(m.venue || '') + (m.coach ? ' · ' + esc(m.coach) : '')} · ${fmtShort(ds[0])}${ds.length > 1 ? ' – ' + fmtShort(ds[ds.length - 1]) : ''}</div>
      ${sg.length ? `<div class="chips" style="margin:6px 0 0">${sg.map(s => `<button class="chip" style="cursor:pointer" data-action="mq-pick" data-id="${m.id}|${s.id}">${esc(s.full_name)}${s.status !== 'active' ? ' (' + esc(LABEL[s.status] || s.status) + ')' : ''}</button>`).join('')}</div>` : ''}</div>
    <div class="actions" style="flex-wrap:wrap"><label class="field"><select id="mq-${m.id}"><option value="">Pilih pelajar…</option>${allSt.map(s => `<option value="${s.id}">${esc(s.full_name)}</option>`).join('')}</select></label>
      <button class="btn sm primary" data-action="mq-ok" data-id="${m.id}">Padankan</button><button class="btn sm" data-action="mq-ign" data-id="${m.id}">Abaikan</button></div></li>`; }).join('') || `<li class="empty">${S.mode === 'supabase' ? 'Semua nama sudah dipadankan. 🎉' : 'Data import WhatsApp hanya ada pada sistem sebenar (bukan demo).'}</li>`}</ul></div>`;
};
async function resolve(id, sid) {
  const m = T('import_matches').find(x => x.id === Number(id) || String(x.id) === String(id));
  const n = await rpc('import_resolve', { p_id: m.id, p_student: sid, p_all: true });
  S.t.import_matches = T('import_matches').filter(x => !(x.kind === m.kind && x.raw_name.toLowerCase() === m.raw_name.toLowerCase() && (x.prog || '') === (m.prog || '') && (x.area || '') === (m.area || '')));
  await refresh(['classes', 'class_sessions', 'attendance', 'student_packages']);
  toast(`${n} kehadiran dimasukkan untuk ${studentName(sid)}`); app.render();
}
INPUTS['mq-q'] = v => { UI.mqQ = v; app.render(); };
Object.assign(ACTIONS, {
  'mq-pick': key => { const [id, sid] = key.split('|'); return resolve(id, sid); },
  'mq-ok': id => { const sid = document.getElementById('mq-' + id)?.value; if (!sid) return toast('Pilih pelajar dahulu', true); return resolve(id, sid); },
  'mq-ign': async id => { const m = T('import_matches').find(x => String(x.id) === String(id)); await rpc('import_ignore', { p_id: m.id, p_all: true }); S.t.import_matches = T('import_matches').filter(x => !(x.kind === m.kind && x.raw_name.toLowerCase() === m.raw_name.toLowerCase())); toast('Diabaikan'); app.render(); },
});

/* =====================================================================
   BIL PERSONAL BULANAN + WALK-IN
   Hadir/lewat = (coach + court) × jam · Tidak hadir / batal lewat = court + 50% coach · Dimaafkan = court sahaja
   ===================================================================== */
const BILLABLE = ['present', 'late', 'absent', 'late_cancel', 'excused'];
const rates = c => { const r = setting('personal_rates', {}); return { coach: Number(c.rate_coach ?? r.coach ?? 0), court: Number(c.rate_court ?? r.court ?? 0) }; };
const famKey = st => st.family_ref || st.guardian_id || (st.guardian_phone || '').replace(/\D/g, '').slice(-9) || st.id;
export function billLines(month) {
  const from = month + '-01';
  const end = (() => { const d = parseISO(from); return new Date(d.getFullYear(), d.getMonth() + 1, 0); })(), toISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  const out = [];
  T('attendance').filter(a => a.session_date >= from && a.session_date <= toISO && !a.invoice_id && !a.student_package_id && BILLABLE.includes(a.status)).forEach(a => {
    const s = byId('class_sessions', a.session_id), c = s && byId('classes', s.class_id); if (!c || s.status === 'cancelled') return;
    const personal = isPersonal(c);
    if (!personal && c.billing !== 'monthly' && !['present', 'late'].includes(a.status)) return;   // walk-in kumpulan: hanya yang hadir
    const st = byId('students', a.student_id); if (!st) return;
    const h = Number(a.hours ?? sHours(s, c)) || 1, r = rates(c), n = Math.max(T('attendance').filter(x => x.session_id === s.id && BILLABLE.includes(x.status)).length, 1);
    let coach = 0, court = 0;
    if (personal || c.billing === 'monthly') {
      court = r.court * h / n;
      coach = ['present', 'late'].includes(a.status) ? r.coach * h : ['absent', 'late_cancel'].includes(a.status) ? r.coach * h * 0.5 : 0;
    } else {   // walk-in kumpulan: kadar setiap sesi
      coach = ['present', 'late'].includes(a.status) ? Number(c.rate_coach ?? setting('personal_rates', {}).walkin ?? 0) : 0;
    }
    out.push({ a, s, c, st, h, coach: Math.round(coach * 100) / 100, court: Math.round(court * 100) / 100, kind: personal || c.billing === 'monthly' ? 'monthly' : 'walkin', fam: famKey(st) });
  });
  return out.sort((x, y) => x.a.session_date.localeCompare(y.a.session_date));
}
VIEWS.bilpersonal = () => {
  const month = UI.billMonth || todayISO().slice(0, 7), lines = billLines(month), fams = new Map();
  lines.forEach(l => { if (!fams.has(l.fam)) fams.set(l.fam, []); fams.get(l.fam).push(l); });
  const r = setting('personal_rates', {});
  return `${pageHead('Bil Personal & Walk-in', 'Sesi personal tanpa pakej dibil bulanan ikut sesi; sesi kumpulan tanpa pakej dibil walk-in. Pakej (sesi/jam) ditolak automatik dan tidak muncul di sini.',
    `<button class="btn" data-action="bill-rates">${ic('cog', 'sm')} Kadar lalai</button>`)}
  <div class="card card-pad mb"><div class="filters"><label class="field">Bulan <input type="month" class="date-input" value="${month}" data-on-change="bill-month"></label>
    <span class="muted" style="font-size:12.5px">Kadar lalai: coach RM${r.coach ?? 0}/jam · court RM${r.court ?? 0}/jam · walk-in RM${r.walkin ?? 0}/sesi (kadar pada kelas/slot mengatasi kadar lalai)</span></div>
    <p class="muted" style="font-size:12px;margin-top:8px">Hadir/lewat = coach + court · Tidak hadir / batal lewat = court + 50% coach · Dimaafkan = court sahaja · Court dibahagi sama rata bagi small group.</p></div>
  ${[...fams.values()].map(ls => { const tot = ls.reduce((t, l) => t + l.coach + l.court, 0), kids = [...new Set(ls.map(l => l.st.full_name))]; return `<div class="card mb">
    <div class="card-head" style="flex-wrap:wrap"><div><h3>${esc(kids.join(' & '))}</h3><div class="sub">${ls.length} sesi · ${esc(ls[0].st.guardian_name || '')}</div></div>
      <div class="actions"><b class="num">${RM(tot)}</b><button class="btn sm primary" data-action="bill-make" data-id="${ls[0].fam}" ${tot <= 0 ? 'disabled' : ''}>Jana invois</button></div></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Tarikh</th><th>Pelajar</th><th>Sesi</th><th>Status</th><th class="r">Jam</th><th class="r">Coach</th><th class="r">Court</th></tr></thead><tbody>
    ${ls.map(l => `<tr><td><a href="javascript:void 0" data-action="sess-open" data-id="${l.s.id}">${fmtShort(l.a.session_date)}</a></td><td>${esc(l.st.full_name)}</td><td>${esc(progName(l.c.programme_id))} · ${esc(staffName(l.s.coach_id || l.c.coach_id))}${l.kind === 'walkin' ? ' <span class="badge b-info">walk-in</span>' : ''}</td><td>${esc(LABEL[l.a.status])}</td><td class="r num">${l.h}</td><td class="r num">${RM(l.coach)}</td><td class="r num">${RM(l.court)}</td></tr>`).join('')}
    </tbody></table></div></div>`; }).join('') || '<div class="card empty">Tiada sesi tanpa pakej untuk dibil bulan ini.</div>'}`;
};
INPUTS['bill-month'] = v => { if (v) { UI.billMonth = v; app.render(); } };
Object.assign(ACTIONS, {
  'bill-rates': () => { const r = setting('personal_rates', {}); openModal({ title: 'Kadar lalai bil', body: `<div class="form-grid">${F('Coach / jam (RM)', 'coach', { type: 'number', step: '0.01', value: r.coach ?? '' })}${F('Court / jam (RM)', 'court', { type: 'number', step: '0.01', value: r.court ?? '' })}${F('Walk-in kumpulan / sesi (RM)', 'walkin', { type: 'number', step: '0.01', value: r.walkin ?? '' })}</div>`,
    onSubmit: async d => { const v = { coach: Number(d.coach) || 0, court: Number(d.court) || 0, walkin: Number(d.walkin) || 0 }; await saveSetting('personal_rates', v);
      toast('Kadar disimpan'); app.render(); } }); },
  'bill-make': async fam => {
    const month = UI.billMonth || todayISO().slice(0, 7), ls = billLines(month).filter(l => l.fam === fam); if (!ls.length) return;
    const main = ls[0].st, items = [];
    const byKid = new Map(); ls.forEach(l => { if (!byKid.has(l.st.id)) byKid.set(l.st.id, []); byKid.get(l.st.id).push(l); });
    for (const [sid, kl] of byKid) {
      const coachH = kl.filter(l => l.coach > 0), courtH = kl.filter(l => l.court > 0), det = kl.map(l => `${fmtShort(l.a.session_date)} ${hm(sTime(l.s, l.c)[0])} (${l.h}j${l.a.status !== 'present' ? ', ' + LABEL[l.a.status] : ''})`).join(', ');
      const ct = coachH.reduce((t, l) => t + l.coach, 0), cr = courtH.reduce((t, l) => t + l.court, 0);
      if (ct > 0) items.push({ kind: 'fee', description: kl[0].kind === 'walkin' ? `Walk-in — ${monthLabel(month + '-01')}` : `Yuran coach personal — ${monthLabel(month + '-01')}`, unit: kl[0].kind === 'walkin' ? 'sesi' : 'jam', qty: kl[0].kind === 'walkin' ? coachH.length : Math.max(coachH.reduce((t, l) => t + l.h, 0), 0.01), unit_price: 0, amount: Math.round(ct * 100) / 100, student_id: sid, details: det });
      if (cr > 0) items.push({ kind: 'court', description: `Sewa court — ${monthLabel(month + '-01')}`, unit: 'jam', qty: Math.max(courtH.reduce((t, l) => t + l.h, 0), 0.01), unit_price: 0, amount: Math.round(cr * 100) / 100, student_id: sid, details: det });
    }
    items.forEach(it => { it.unit_price = Math.round(it.amount / it.qty * 100) / 100; });
    const total = Math.round(items.reduce((t, i) => t + i.amount, 0) * 100) / 100;
    confirmModal({ title: 'Jana invois?', message: `Invois ${RM(total)} untuk ${esc([...new Set(ls.map(l => l.st.full_name))].join(' & '))} (${ls.length} sesi, ${esc(monthLabel(month + '-01'))}).`, ok: 'Jana invois', onOk: async () => {
      const inv = await insert('invoices', { student_id: main.id, kind: 'personal', amount: total, description: `Sesi personal ${monthLabel(month + '-01')}`, issued_on: todayISO(), due_date: addDays(todayISO(), Number(setting('billing', {}).due_days ?? 7)), status: 'issued' });
      await insert('invoice_items', items.map((it, i) => ({ ...it, invoice_id: inv.id, sort: i + 1 })));
      for (const l of ls) await update('attendance', l.a.id, { invoice_id: inv.id });
      toast(`Invois ${inv.number || ''} dijana`); app.render();
    } });
  },
});
export { openSession };
