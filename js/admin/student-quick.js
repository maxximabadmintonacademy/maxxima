/* =====================================================================
   SENARAI PELAJAR — tindakan pantas terus dari jadual:
   • klik sel Pakej     → lihat / laras / jual pakej
   • klik sel Kehadiran → tanda kehadiran sesi lepas & akan datang
   ===================================================================== */
import { ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove, refresh } from '../data.js';
import '../pkg-usage.js';
import { esc, RM, LABEL, badge, openModal, closeModal, toast, todayISO, addDays, fmtShort, DAYS, app } from '../ui.js';
import { T, byId, progName, venueName, pkgRemaining, studentPackages } from './helpers.js';
import { calItems, ensureSession, sTime, isPersonal } from './sessions.js';

const ATT = ['present', 'late', 'absent', 'excused', 'late_cancel', 'trial'];
const CONS = ['present', 'late', 'absent', 'late_cancel'];
const orphans = id => T('attendance').filter(a => a.student_id === id && !a.student_package_id && CONS.includes(a.status)).length;
const by = () => (S.mode === 'demo' ? null : S.profile?.id || null);
const reopen = (act, id) => { closeModal(); ACTIONS[act](id); };

ACTIONS['sq-pkg'] = async id => {
  const s = byId('students', id); if (!s) return;
  if (S.mode === 'supabase') { try { await refresh(['student_packages']); } catch (_) {} }   // baki terkini dari pelayan
  const L = studentPackages(id).filter(p => p.status !== 'cancelled').sort((a, b) => (['active', 'pending'].includes(b.status) - ['active', 'pending'].includes(a.status)) || (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);
  const row = p => { const used = Number(p.sessions_used || 0), tot = Number(p.sessions_total || 0), left = pkgRemaining(p);
    const st = p.status === 'pending' ? badge('pending', 'Menunggu bayaran') : p.status === 'completed' ? badge('completed', 'Sesi habis') : badge(p.status);
    return `<div class="slot" style="border-left-color:${p.status === 'active' ? 'var(--ok)' : 'var(--line)'};margin-bottom:8px;display:flex;gap:10px;align-items:center">
      <div style="flex:1;cursor:pointer" data-action="pkg-usage" data-id="${p.id}" title="Lihat sesi yang ditolak daripada pakej ini"><b>${esc(p.name)}</b> ${st}
        <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(progName(p.programme_id))} · <span style="font-weight:700;color:${left <= 1 && p.status === 'active' ? 'var(--bad)' : 'var(--ink)'}">${left}</span> / ${tot} sesi baki (${used} digunakan)${p.expires_on ? ' · tamat ' + fmtShort(p.expires_on) : ''} · ${RM(p.price)}</div>
        ${p.status === 'active' && tot ? `<div class="bar" style="margin-top:6px"><span style="width:${Math.min(used / tot * 100, 100)}%;background:var(--brand)"></span></div>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:6px"><button type="button" class="btn sm primary" data-action="pkg-usage" data-id="${p.id}">Lihat sesi (${T('attendance').filter(a => a.student_package_id === p.id && ['present', 'late', 'absent', 'late_cancel'].includes(a.status)).length})</button>${p.status === 'active' && left > 0 ? `<button type="button" class="btn sm" data-action="sq-pk-done" data-id="${p.id}" title="Baki sebenar sudah habis (cth. sesi lama sebelum sistem)">Tandakan habis</button>` : ''}<button type="button" class="btn sm" data-action="sp-edit" data-id="${p.id}">Laras</button></div></div>`; };
  openModal({ title: `Pakej — ${esc(s.full_name)}`, wide: true, cancel: 'Tutup',
    body: `${L.length ? L.map(row).join('') : '<p class="muted">Tiada pakej lagi.</p>'}
      <p class="muted" style="font-size:12.5px;margin:6px 0 12px">"Laras" untuk tambah sesi, lanjut tarikh tamat atau tukar status. Baki dikira automatik daripada kehadiran.</p>
      <div class="actions"><button type="button" class="btn primary" data-action="sell" data-id="${id}">Jual Pakej</button>
      <button type="button" class="btn" data-action="sq-att" data-id="${id}">Kehadiran</button>
      <button type="button" class="btn" data-action="student-view" data-id="${id}">Profil penuh</button></div>` });
};

/** Baki sebenar sudah habis (sesi sebelum sistem): simpan sebagai "used_offset" supaya tidak hilang bila dikira semula. */
export async function markPkgDone(pkId) {
  const p = byId('student_packages', pkId); if (!p) return;
  const counted = T('attendance').filter(a => a.student_package_id === pkId && ['present', 'late', 'absent', 'late_cancel'].includes(a.status)).length;
  const tot = Number(p.sessions_total || 0);
  await update('student_packages', pkId, { used_offset: Math.max(tot - counted, 0), sessions_used: tot, status: 'completed', renewal_sent: true });   // tiada invois pembaharuan automatik
}
ACTIONS['sq-pk-done'] = id => { const p = byId('student_packages', id);
  openModal({ title: 'Tandakan pakej habis?', submit: 'Ya, tandakan habis',
    body: `<p><b>${esc(p.name)}</b> — sistem kata baki ${pkgRemaining(p)} sesi. Tandakan semua ${p.sessions_total} sesi sudah digunakan (cth. sesi lama sebelum sistem)?</p>
      <label class="check-row" style="margin-top:10px"><input type="checkbox" name="sell" checked><span>Terus jual pakej baru & keluarkan invois</span></label>`,
    onSubmit: async d => { await markPkgDone(id); toast('Pakej ditanda habis'); app.render(); if (d.sell) setTimeout(() => ACTIONS.sell(p.student_id), 50); else setTimeout(() => ACTIONS['sq-pkg'](p.student_id), 50); } }); };

ACTIONS['sq-att'] = id => {
  const s = byId('students', id); if (!s) return;
  const today = todayISO(), from = addDays(today, -35), to = addDays(today, 14);
  const myCls = new Set(T('class_enrolments').filter(e => e.student_id === id).map(e => e.class_id));
  const mine = new Set(T('attendance').filter(a => a.student_id === id).map(a => a.session_id));
  const items = calItems(from, to).filter(x => x.s?.status !== 'cancelled' && ((x.s && mine.has(x.s.id)) || (myCls.has(x.c.id) && !isPersonal(x.c))))
    .sort((a, b) => b.date.localeCompare(a.date) || String(sTime(b.s, b.c)[0]).localeCompare(String(sTime(a.s, a.c)[0])));
  const rec = x => x.s && T('attendance').find(a => a.session_id === x.s.id && a.student_id === id);
  const done = items.filter(x => x.date <= today && ['present', 'late', 'trial'].includes(rec(x)?.status)).length, past = items.filter(x => x.date <= today).length;
  openModal({ title: `Kehadiran — ${esc(s.full_name)}`, wide: true, cancel: 'Tutup',
    body: `<p class="muted" style="margin-bottom:10px">5 minggu lepas & 2 minggu akan datang · hadir ${done}/${past} sesi lepas. Tukar status terus di sini — baki pakej dikira semula automatik.</p>
    <ul class="list" style="margin:0 -20px">${[...items.filter(x => x.date <= today), ...items.filter(x => x.date > today).reverse()].map((x, i, arr) => { const a = rec(x), [t] = sTime(x.s, x.c), fut = x.date > today, head = fut && !(arr[i - 1]?.date > today);
      const opts = fut ? ['excused'] : ATT;
      return `${head ? '<li class="list-item" style="padding:6px 20px;background:var(--soft,#f4f6fb)"><b style="font-size:12.5px">Akan datang — hanya boleh tanda cuti</b></li>' : ''}<li class="list-item" style="padding:8px 20px"><div class="li-main"><div class="li-title">${DAYS[new Date(x.date + 'T00:00').getDay()].slice(0, 3)} ${fmtShort(x.date)} · ${t} · ${esc(x.c.title || progName(x.c.programme_id))}${x.date === today ? ' <span class="badge b-info">hari ini</span>' : ''}</div><div class="li-sub">${esc(venueName(x.c.venue_id))}${a && CONS.includes(a.status) ? (a.student_package_id ? ` · ${esc(byId('student_packages', a.student_package_id)?.name || 'pakej')}` : ' · <span style="color:var(--bad)">tiada pakej</span>') : ''}${a ? ` · <button type="button" class="linkbtn" data-action="sq-att-move" data-id="${a.id}" title="Pindah ke kelas / program lain (tarikh sama)" style="border:0;background:none;color:var(--brand);cursor:pointer;padding:0;font-size:12px;text-decoration:underline">Tukar kelas</button>` : ''}</div></div>
        <select class="att-select ${a ? 'a-' + a.status : ''}" data-on-change="sq-att-set" data-key="${x.c.id}|${x.date}|${x.s?.id || ''}|${id}"><option value="">${a?.status === 'booked' ? 'ditempah — belum direkod' : '— belum direkod —'}</option>${opts.map(o => `<option value="${o}" ${a?.status === o ? 'selected' : ''}>${LABEL[o]}</option>`).join('')}${a && !opts.includes(a.status) && a.status !== 'booked' ? `<option value="${a.status}" selected>${LABEL[a.status] || a.status}</option>` : ''}</select></li>`; }).join('') || '<li class="empty">Tiada sesi dalam tempoh ini. Pelajar belum ditempatkan dalam kelas?</li>'}</ul>
    <div class="actions" style="margin-top:12px">${orphans(id) ? `<button type="button" class="btn danger-o" data-action="att-link" data-id="${id}">Pautkan ${orphans(id)} sesi ke pakej</button>` : ''}<button type="button" class="btn primary" data-action="sq-att-old" data-id="${id}">+ Rekod kehadiran lama</button><button type="button" class="btn" data-action="sq-pkg" data-id="${id}">Pakej</button><button type="button" class="btn" data-action="student-view" data-id="${id}">Profil penuh</button></div>` });
};

INPUTS['sq-att-set'] = async (v, el) => {
  const [cid, date, sid0, stid] = el.dataset.key.split('|');
  try {
    if (date > todayISO() && v && !['excused'].includes(v)) throw new Error('Sesi belum berlaku — hanya boleh tanda cuti.');
    const sid = sid0 || (await ensureSession(cid, date))?.id; if (!sid) throw new Error('Sesi tidak dapat dicipta.');
    const r = T('attendance').find(a => a.session_id === sid && a.student_id === stid);
    if (!v) { if (r && r.status !== 'booked') await update('attendance', r.id, { status: 'booked', marked_by: by() }); }
    else if (r) await update('attendance', r.id, { status: v, marked_by: by() });
    else await insert('attendance', { session_id: sid, student_id: stid, status: v, marked_by: by() });
    if (S.mode === 'supabase') { try { await refresh(['attendance', 'student_packages']); } catch (_) {} }   // baki pakej dikira di pelayan
    const r2 = T('attendance').find(a => a.session_id === sid && a.student_id === stid), pk = r2?.student_package_id && byId('student_packages', r2.student_package_id);
    toast(v ? `Ditanda: ${LABEL[v]}${pk ? ` · ${pk.name}: baki ${pkgRemaining(pk)}/${Number(pk.sessions_total)}` : ['present', 'late', 'absent', 'late_cancel'].includes(v) ? ' · tiada pakej aktif untuk program ini — tekan "Pautkan ke pakej"' : ''}` : 'Dikosongkan', !!(v && !pk && ['present', 'late', 'absent', 'late_cancel'].includes(v)));
  } catch (e) { toast(e.message || String(e), true); }
  app.render(); reopen('sq-att', stid);
};

/* ---------- Rekod kehadiran lama (sebelum sistem) — supaya ibu bapa nampak sejarah & pakej ditolak dengan betul ---------- */
/** Tarikh hari kelas dari "from" hingga hari ini (terbaru dahulu) + tarikh tambahan pilihan admin. */
const pastDates = (c, from, extra = []) => { const out = new Set(extra.filter(x => x && x <= todayISO())); const lim = from || addDays(todayISO(), -84); let d = todayISO();
  for (let i = 0; i < 400 && d >= lim; i++) { if (new Date(d + 'T00:00').getDay() === c.weekday) out.add(d); d = addDays(d, -1); }
  return [...out].sort().reverse(); };
/** Tarikh mula lalai: sesi pertama pakej (starts_on), atau tarikh invois / jualan, atau 12 minggu lepas. */
const pkgFrom = p => p ? (p.starts_on || byId('invoices', p.invoice_id)?.issued_on || String(p.created_at || '').slice(0, 10) || addDays(todayISO(), -84)) : addDays(todayISO(), -84);
function oldDatesHtml(stid, cid, pkgId, from, extra = []) {
  const c = byId('classes', cid); if (!c) return '<div class="muted">Pilih kelas.</div>';
  const CONS = ['present', 'late', 'absent', 'late_cancel'];
  return pastDates(c, from, extra).map(d => { const ss = T('class_sessions').find(x => x.class_id === cid && x.session_date === d), a = ss && T('attendance').find(x => x.session_id === ss.id && x.student_id === stid);
    const rec = a && a.status !== 'booked', linked = rec && pkgId && a.student_package_id === pkgId, lock0 = rec && (!pkgId || linked || !CONS.includes(a.status));
    // rekod pada tarikh sama di kelas lain (cth. sesi lama direkod dalam kelas Personal / Sabtu)
    const o = !rec && T('attendance').find(x => x.student_id === stid && x.session_date === d && x.status !== 'booked' && byId('class_sessions', x.session_id)?.class_id !== cid);
    const oc = o && byId('classes', byId('class_sessions', o.session_id)?.class_id), lock = lock0 || !!o;
    const tag = o ? `<span class="muted">${esc(LABEL[o.status] || o.status)} · sudah direkod di ${esc(oc ? progName(oc.programme_id) + ' ' + DAYS[oc.weekday].slice(0, 3) : 'kelas lain')}${o.student_package_id === pkgId && pkgId ? ' ✓ · ditolak pakej ini' : ''}</span>` : !rec ? '' : linked ? `${esc(LABEL[a.status] || a.status)} ✓ · ditolak pakej ini` : CONS.includes(a.status) ? `<span style="color:var(--warn)">${esc(LABEL[a.status] || a.status)} · ${a.student_package_id ? 'pakej lain' : 'belum ditolak pakej'} — tanda untuk tolak</span>` : esc(LABEL[a.status] || a.status);
    return `<label class="check-row"><input type="checkbox" name="dates" value="${d}" ${lock ? 'disabled' : ''}><span>${DAYS[new Date(d + 'T00:00').getDay()]} ${fmtShort(d)}${ss?.status === 'cancelled' ? ' · <i>sesi dibatalkan</i>' : ''}</span><em>${tag}</em></label>`; }).join('');
}
ACTIONS['sq-att-old'] = async id => {
  const s = byId('students', id); if (!s) return;
  if (S.mode === 'supabase') { try { await refresh(['student_packages', 'attendance']); } catch (_) {} }
  const pk = studentPackages(id).filter(p => p.status !== 'cancelled').sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const mineP = new Set([...T('class_enrolments').filter(e => e.student_id === id).map(e => e.class_id), ...T('attendance').filter(a => a.student_id === id).map(a => byId('class_sessions', a.session_id)?.class_id)]);
  const cls = T('classes').filter(c => (c.active !== false && !isPersonal(c)) || (isPersonal(c) && mineP.has(c.id))).sort((a, b) => (a.venue_id === s.venue_id ? 0 : 1) - (b.venue_id === s.venue_id ? 0 : 1) || a.weekday - b.weekday);
  const defPk = pk.find(p => Number(p.used_offset || 0) > 0) || pk.find(p => p.status === 'active') || pk[0];
  const defC = cls.find(c => T('class_enrolments').some(e => e.class_id === c.id && e.student_id === id) && c.programme_id === defPk?.programme_id) || cls.find(c => c.programme_id === defPk?.programme_id && c.venue_id === s.venue_id) || cls.find(c => c.venue_id === s.venue_id) || cls[0];
  const f = openModal({ title: `Rekod kehadiran lama — ${esc(s.full_name)}`, wide: true, submit: 'Simpan kehadiran',
    body: `<p class="muted" style="margin-bottom:10px">Untuk sesi yang sudah berlaku sebelum sistem digunakan. Ibu bapa akan nampak rekod ini di portal, dan sesi ditolak daripada pakej yang dipilih.</p>
    <div class="form-grid">
      <label class="f full">Kelas<select name="class_id">${cls.map(c => `<option value="${c.id}" ${c.id === defC?.id ? 'selected' : ''}>${esc(c.title || progName(c.programme_id))} · ${DAYS[c.weekday]} ${String(c.start_time).slice(0, 5)} · ${esc(venueName(c.venue_id))}</option>`).join('')}</select></label>
      <label class="f">Status<select name="status">${['present', 'late', 'absent', 'excused', 'trial'].map(o => `<option value="${o}">${LABEL[o]}</option>`).join('')}</select></label>
      <label class="f">Tolak daripada pakej<select name="pkg"><option value="">— Tiada (rekod sahaja) —</option>${pk.map(p => `<option value="${p.id}" ${p.id === defPk?.id ? 'selected' : ''}>${esc(p.name)} · ${pkgRemaining(p)}/${p.sessions_total} baki${Number(p.used_offset || 0) ? ' (' + p.used_offset + ' ditanda sebelum sistem)' : ''}</option>`).join('')}</select></label>
    </div>
    <div class="form-grid" style="margin-top:12px"><label class="f">Senaraikan tarikh dari<input type="date" name="from" value="${pkgFrom(defPk)}" max="${todayISO()}"><span class="hint">Lalai: tarikh mula pakej dipilih</span></label>
      <div class="f">Tarikh lain (hari berbeza)<div style="display:flex;gap:6px"><input type="date" id="sqOldAdd" max="${todayISO()}"><button type="button" class="btn sm" id="sqOldAddBtn">+ Tambah</button></div></div></div>
    <div class="f" style="margin-top:12px"><span>Tanda tarikh dia hadir</span><div class="checklist" id="sqOldDates" style="max-height:340px;overflow:auto">${defC ? oldDatesHtml(id, defC.id, defPk?.id, pkgFrom(defPk)) : ''}</div></div>`,
    onSubmit: async d => {
      const dates = [].concat(d.dates || []).sort(); if (!dates.length) { toast('Tandakan sekurang-kurangnya satu tarikh', true); return false; }
      const p = d.pkg ? byId('student_packages', d.pkg) : null, consumes = ['present', 'late', 'absent'].includes(d.status);
      let off = Number(p?.used_offset || 0), n = 0;
      if (p && consumes && !p.renewal_sent) await update('student_packages', p.id, { renewal_sent: true });   // rekod sejarah — jangan jana invois pembaharuan automatik
      for (const dt of dates) {
        const ss = await ensureSession(d.class_id, dt); const sid = ss?.id; if (!sid) continue;
        const r0 = T('attendance').find(a => a.session_id === sid && a.student_id === id), willUse = p && (consumes || (r0 && ['present', 'late', 'absent', 'late_cancel'].includes(r0.status)));
        if (willUse && off > 0) { off--; await update('student_packages', p.id, { used_offset: off }); }   // ganti "sesi sebelum sistem" dengan rekod sebenar
        const r = T('attendance').find(a => a.session_id === sid && a.student_id === id), row = { status: d.status, marked_by: by(), ...(p && consumes ? { student_package_id: p.id } : {}) };
        if (r && ['present', 'late', 'absent', 'late_cancel'].includes(r.status)) await update('attendance', r.id, p ? { student_package_id: p.id } : {});   // rekod sedia ada: kekalkan status, hanya tolak pakej
        else if (r) await update('attendance', r.id, row); else await insert('attendance', { session_id: sid, student_id: id, ...row });
        n++;
      }
      if (S.mode === 'supabase') { try { await refresh(['student_packages', 'attendance', 'class_sessions']); } catch (_) {} }   // baki dikira semula di pelayan
      const np = p && byId('student_packages', p.id);
      toast(`${n} rekod kehadiran disimpan${np && consumes ? ` · ${np.name}: baki ${pkgRemaining(np)}/${np.sessions_total}` : ''}`); app.render(); setTimeout(() => ACTIONS['sq-att'](id), 50);
    } });
  const extra = [];
  const redraw = () => { const keep = new Set([...f.querySelectorAll('#sqOldDates input[name=dates]:checked')].map(x => x.value));
    f.querySelector('#sqOldDates').innerHTML = oldDatesHtml(id, f.elements.class_id.value, f.elements.pkg.value, f.elements.from.value, extra);
    f.querySelectorAll('#sqOldDates input[name=dates]').forEach(x => { if (keep.has(x.value) && !x.disabled) x.checked = true; }); };
  f.elements.class_id.addEventListener('change', redraw); f.elements.from.addEventListener('change', redraw);
  f.elements.pkg.addEventListener('change', () => { f.elements.from.value = pkgFrom(byId('student_packages', f.elements.pkg.value)); redraw(); });
  f.querySelector('#sqOldAddBtn').addEventListener('click', () => { const v = f.querySelector('#sqOldAdd').value; if (!v) return; if (!extra.includes(v)) extra.push(v); redraw();
    const cb = f.querySelector(`#sqOldDates input[value="${v}"]`); if (cb && !cb.disabled) cb.checked = true; });
};

/* ---------- Pindah satu rekod kehadiran ke kelas / program lain (tarikh sama) — cth. sesi direkod dalam kelas Personal tetapi sepatutnya Performance ---------- */
ACTIONS['sq-att-move'] = attId => {
  const a = byId('attendance', attId); if (!a) return;
  const s0 = byId('class_sessions', a.session_id), c0 = s0 && byId('classes', s0.class_id), stu = byId('students', a.student_id);
  const [t1, t2] = sTime(s0, c0);
  // Kelas berkaitan sahaja: lokasi pelajar / sesi ini + program pakej & kelas pelajar, aktif, hari yang sama didahulukan
  const dow = new Date(a.session_date + 'T00:00').getDay();
  const pkOf = st => T('student_packages').filter(p => p.student_id === a.student_id && st.includes(p.status)).map(p => p.programme_id);
  let progs = new Set([stu?.programme_id, ...pkOf(['active', 'pending']), ...T('class_enrolments').filter(e => e.student_id === a.student_id).map(e => byId('classes', e.class_id)?.programme_id)].filter(x => x && !isPersonal({ programme_id: x })));
  if (!progs.size) progs = new Set(pkOf(['completed', 'expired']).filter(Boolean));
  const vens = new Set([c0?.venue_id, stu?.venue_id, ...T('class_enrolments').filter(e => e.student_id === a.student_id).map(e => byId('classes', e.class_id)?.venue_id)].filter(Boolean));
  const sortC = L => L.sort((x, y) => (x.weekday === dow ? 0 : 1) - (y.weekday === dow ? 0 : 1) || (x.venue_id === c0?.venue_id ? 0 : 1) - (y.venue_id === c0?.venue_id ? 0 : 1) || progName(x.programme_id).localeCompare(progName(y.programme_id)) || String(x.start_time).localeCompare(String(y.start_time)));
  const all = sortC(T('classes').filter(c => c.id !== c0?.id));
  let rel = all.filter(c => c.active !== false && vens.has(c.venue_id) && (!progs.size || progs.has(c.programme_id)) && !isPersonal(c));
  if (!rel.length) rel = all.filter(c => c.active !== false && vens.has(c.venue_id));
  const optsHtml = L => L.map(c => `<option value="${c.id}">${esc(progName(c.programme_id))}${c.title ? ' · ' + esc(c.title) : ''} · ${DAYS[c.weekday].slice(0, 3)} ${String(c.start_time).slice(0, 5)} · ${esc(venueName(c.venue_id))}${c.active === false ? ' (tidak aktif)' : ''}</option>`).join('');
  const cls = rel;
  const f = openModal({ title: `Tukar kelas — ${esc(stu?.full_name || '')}`, submit: 'Pindah',
    body: `<p class="muted" style="margin-bottom:10px">${fmtShort(a.session_date)} · ${t1}–${t2} · sekarang dalam ${esc(c0?.title || progName(c0?.programme_id))} (${esc(venueName(c0?.venue_id))}). Rekod (${esc(LABEL[a.status] || a.status)}) dipindah ke kelas di bawah pada tarikh yang sama, dan ditolak daripada pakej program kelas baharu.</p>
      <label class="f full">Kelas baharu<select name="cls" required>${optsHtml(cls)}</select><span class="hint">${rel.length} kelas berkaitan — ${esc([...vens].map(venueName).join(', '))} · ${esc([...progs].map(progName).join(', ') || 'semua program')}</span></label>
      <label class="check-row" style="margin-top:6px"><input type="checkbox" name="showall"><span>Tunjuk semua kelas (${all.length})</span></label>
      <label class="check-row" style="margin-top:10px"><input type="checkbox" name="keep" checked><span>Kekalkan masa ${t1}–${t2} (jika sesi baharu dicipta)</span></label>`,
    onSubmit: async d => {
      const had = T('class_sessions').some(x => x.class_id === d.cls && x.session_date === a.session_date);
      const ns = await ensureSession(d.cls, a.session_date); if (!ns?.id) throw new Error('Sesi tidak dapat dicipta.');
      if (!had && d.keep) await update('class_sessions', ns.id, { start_time: t1, end_time: t2 });
      const ex = T('attendance').find(x => x.session_id === ns.id && x.student_id === a.student_id), row = { status: a.status, note: a.note || null, hours: a.hours ?? null, marked_by: by() }, pk0 = a.student_package_id && byId('student_packages', a.student_package_id);
      if (pk0 && pk0.programme_id === byId('classes', d.cls)?.programme_id) row.student_package_id = pk0.id;   // pakej sama program kekal
      await remove('attendance', a.id);
      if (ex) await update('attendance', ex.id, { student_package_id: null, ...row }); else await insert('attendance', { session_id: ns.id, student_id: a.student_id, ...row });
      if (c0 && isPersonal(c0) && !T('attendance').some(x => x.session_id === s0.id)) { try { await remove('class_sessions', s0.id); } catch (_) {} }   // sesi personal kosong dibuang
      if (S.mode === 'supabase') { try { await refresh(['attendance', 'student_packages', 'class_sessions']); } catch (_) {} }
      const r = T('attendance').find(x => x.session_id === ns.id && x.student_id === a.student_id), pk = r?.student_package_id && byId('student_packages', r.student_package_id);
      toast(`Dipindah ke ${progName(byId('classes', d.cls)?.programme_id)}${pk ? ` · ${pk.name}: baki ${pkgRemaining(pk)}/${Number(pk.sessions_total)}` : CONS.includes(a.status) ? ' · tiada pakej aktif — pautkan atau jual pakej' : ''}`);
      app.render(); setTimeout(() => ACTIONS['sq-att'](a.student_id), 60);
    } });
  f.elements.showall.addEventListener('change', () => { f.elements.cls.innerHTML = optsHtml(f.elements.showall.checked ? all : rel); });
};
