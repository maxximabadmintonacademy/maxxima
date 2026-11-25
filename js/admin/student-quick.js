/* =====================================================================
   SENARAI PELAJAR — tindakan pantas terus dari jadual:
   • klik sel Pakej     → lihat / laras / jual pakej
   • klik sel Kehadiran → tanda kehadiran sesi lepas & akan datang
   ===================================================================== */
import { ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove, refresh, rpc, loadStudentHistory, loadRange } from '../data.js';
import '../pkg-usage.js';
import { esc, RM, LABEL, badge, openModal, closeModal, toast, todayISO, addDays, fmtShort, DAYS, app } from '../ui.js';
import { T, byId, progName, venueName, pkgRemaining, studentPackages, isOldPkg } from './helpers.js';
import { calItems, ensureSession, sTime, isPersonal } from './sessions.js';

const ATT = ['present', 'late', 'absent', 'excused', 'late_cancel', 'trial'];
const CONS = ['present', 'late', 'absent', 'late_cancel'];
const orphans = id => T('attendance').filter(a => a.student_id === id && !a.student_package_id && CONS.includes(a.status)).length;
const by = () => (S.mode === 'demo' ? null : S.profile?.id || null);
const reopen = (act, id) => { closeModal(); ACTIONS[act](id); };

ACTIONS['sq-pkg'] = async id => {
  const s = byId('students', id); if (!s) return;
  if (S.mode === 'supabase') { try { await refresh(['student_packages']); await loadStudentHistory(id); } catch (_) {} }   // baki terkini + kehadiran lama dari pelayan
  const L = studentPackages(id).filter(p => p.status !== 'cancelled' && !isOldPkg(p)).sort((a, b) => (['active', 'pending'].includes(b.status) - ['active', 'pending'].includes(a.status)) || (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);
  const row = p => { const used = Number(p.sessions_used || 0), tot = Number(p.sessions_total || 0), left = pkgRemaining(p);
    const st = p.status === 'pending' ? badge('pending', 'Menunggu bayaran') : p.status === 'completed' ? badge('completed', 'Sesi habis') : badge(p.status);
    return `<div class="slot" style="border-left-color:${p.status === 'active' ? 'var(--ok)' : 'var(--line)'};margin-bottom:8px;display:flex;gap:10px;align-items:center">
      <div style="flex:1;cursor:pointer" data-action="pkg-usage" data-id="${p.id}" title="Lihat sesi yang ditolak daripada pakej ini"><b>${esc(p.name)}</b> ${st}
        <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(progName(p.programme_id))} · <span style="font-weight:700;color:${left <= 1 && p.status === 'active' ? 'var(--bad)' : 'var(--ink)'}">${left}</span> / ${tot} sesi baki (${used} digunakan)${p.expires_on ? ' · tamat ' + fmtShort(p.expires_on) : ''} · ${RM(p.price)}</div>
        ${p.status === 'active' && tot ? `<div class="bar" style="margin-top:6px"><span style="width:${Math.min(used / tot * 100, 100)}%;background:var(--brand)"></span></div>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:6px"><button type="button" class="btn sm primary" data-action="pkg-usage" data-id="${p.id}">Lihat sesi (${T('attendance').filter(a => a.student_package_id === p.id && ['present', 'late', 'absent', 'late_cancel'].includes(a.status)).length})</button>${p.status === 'active' && left > 0 ? `<button type="button" class="btn sm" data-action="sq-pk-done" data-id="${p.id}" title="Baki sebenar sudah habis (cth. sesi lama sebelum sistem)">Tandakan habis</button>` : ''}<button type="button" class="btn sm" data-action="sp-edit" data-id="${p.id}">Laras</button><button type="button" class="btn sm danger-o" data-action="pkg-del" data-id="${p.id}">Padam</button></div></div>`; };
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

/* ---------- Rekod kehadiran lama — pilih PAKEJ dahulu; tarikh disenaraikan dari semua kelas berkaitan (program pakej + lokasi pelajar), Sabtu & Ahad sekali ---------- */
const CONS_A = ['present', 'late', 'absent', 'late_cancel'];
const pkgFrom = p => p ? (p.starts_on || byId('invoices', p.invoice_id)?.issued_on || String(p.created_at || '').slice(0, 10) || addDays(todayISO(), -84)) : addDays(todayISO(), -84);
/** Lokasi pelajar: profil + kelas berdaftar + kelas yang pernah dihadiri. */
const stuVenues = id => new Set([byId('students', id)?.venue_id, ...T('class_enrolments').filter(e => e.student_id === id).map(e => byId('classes', e.class_id)?.venue_id),
  ...T('attendance').filter(a => a.student_id === id).map(a => byId('classes', byId('class_sessions', a.session_id)?.class_id)?.venue_id)].filter(Boolean));
/** Kelas berkaitan pakej: program sama + lokasi pelajar. Kelas tidak aktif dimasukkan jika pernah ada sesi dalam julat. */
function relClasses(id, pkg, from) {
  const vens = stuVenues(id), prog = pkg?.programme_id || byId('students', id)?.programme_id;
  return T('classes').filter(c => c.programme_id === prog && (!vens.size || vens.has(c.venue_id)) && (c.active !== false || T('class_sessions').some(x => x.class_id === c.id && x.session_date >= from)))
    .sort((x, y) => x.weekday - y.weekday || String(x.start_time).localeCompare(String(y.start_time)));
}
function oldRows(stid, classes, pkgId, from, extra = []) {
  if (!classes.length) return '<div class="muted">Tiada kelas untuk program pakej ini di lokasi pelajar. Tandakan "Tunjuk semua kelas".</div>';
  const today = todayISO(), rows = [];
  for (const c of classes) { let d = today; for (let i = 0; i < 400 && d >= from; i++) { if (new Date(d + 'T00:00').getDay() === c.weekday) rows.push([c, d]); d = addDays(d, -1); } }
  for (const [cid, d] of extra) { const c = byId('classes', cid); if (c && !rows.some(([x, y]) => x.id === cid && y === d)) rows.push([c, d]); }
  rows.sort((x, y) => y[1].localeCompare(x[1]) || String(x[0].start_time).localeCompare(String(y[0].start_time)));
  return rows.map(([c, d]) => { const ss = T('class_sessions').find(x => x.class_id === c.id && x.session_date === d), a = ss && T('attendance').find(x => x.session_id === ss.id && x.student_id === stid);
    const rec = a && a.status !== 'booked', linked = rec && pkgId && a.student_package_id === pkgId;
    const o = !rec && T('attendance').find(x => x.student_id === stid && x.session_date === d && x.status !== 'booked' && byId('class_sessions', x.session_id)?.class_id !== c.id);
    const oc = o && byId('classes', byId('class_sessions', o.session_id)?.class_id);
    const lock = (rec && (!pkgId || linked || !CONS_A.includes(a.status))) || !!o;
    const tag = o ? `<span class="muted">${esc(LABEL[o.status] || o.status)} · sudah direkod di ${esc(oc ? progName(oc.programme_id) + ' ' + DAYS[oc.weekday].slice(0, 3) : 'kelas lain')}${pkgId && o.student_package_id === pkgId ? ' ✓ · ditolak pakej ini' : ''}</span>`
      : !rec ? '' : linked ? `<span style="color:var(--ok)">${esc(LABEL[a.status] || a.status)} ✓ · ditolak pakej ini</span>`
      : CONS_A.includes(a.status) ? `<span style="color:var(--warn)">${esc(LABEL[a.status] || a.status)} · ${a.student_package_id ? 'pakej lain' : 'belum ditolak pakej'} — tanda untuk tolak</span>` : esc(LABEL[a.status] || a.status);
    return `<label class="check-row"><input type="checkbox" name="dates" value="${c.id}|${d}" ${lock ? 'disabled' : ''} ${linked ? 'checked' : ''}><span>${DAYS[new Date(d + 'T00:00').getDay()].slice(0, 3)} ${fmtShort(d)} · ${String(sTime(ss, c)[0])} · ${esc(c.title || progName(c.programme_id))}${classes.some(x => x.venue_id !== c.venue_id) ? ' · ' + esc(venueName(c.venue_id)) : ''}${ss?.status === 'cancelled' ? ' · <i>sesi dibatalkan</i>' : ''}</span><em>${tag}</em></label>`; }).join('');
}
ACTIONS['sq-att-old'] = async (id, pkPre) => {
  const s = byId('students', id); if (!s) return;
  if (S.mode === 'supabase') { try { await refresh(['student_packages']); await loadStudentHistory(id, true); } catch (_) {} }
  const pk = studentPackages(id).filter(p => p.status !== 'cancelled').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const defPk = (typeof pkPre === 'string' && byId('student_packages', pkPre)) || pk.find(p => Number(p.used_offset || 0) > 0) || pk.find(p => p.status === 'active') || pk[0];
  const from0 = pkgFrom(defPk);
  if (S.mode === 'supabase' && from0 < addDays(todayISO(), -90)) { try { await loadRange(from0, todayISO()); } catch (_) {} }
  const f = openModal({ title: `Rekod kehadiran lama — ${esc(s.full_name)}`, wide: true, submit: 'Simpan kehadiran',
    body: `<p class="muted" style="margin-bottom:10px">Pilih pakej, kemudian tandakan tarikh pelajar hadir. Tarikh disenaraikan dari semua kelas program pakej itu di lokasi pelajar (cth. Sabtu & Ahad). Ibu bapa akan nampak rekod ini, dan sesi ditolak daripada pakej yang dipilih.</p>
    <div class="form-grid">
      <label class="f">Tolak daripada pakej<select name="pkg"><option value="">— Tiada (rekod sahaja) —</option>${pk.map(p => `<option value="${p.id}" ${p.id === defPk?.id ? 'selected' : ''}>${esc(p.name)} · ${pkgRemaining(p)}/${p.sessions_total} baki${Number(p.used_offset || 0) ? ' (' + p.used_offset + ' ditanda sebelum sistem)' : ''}</option>`).join('')}</select></label>
      <label class="f">Status<select name="status">${['present', 'late', 'absent', 'excused', 'trial'].map(o => `<option value="${o}">${LABEL[o]}</option>`).join('')}</select></label>
      <label class="f">Senaraikan tarikh dari<input type="date" name="from" value="${from0}" max="${todayISO()}"><span class="hint">Lalai: tarikh mula pakej dipilih</span></label>
      <label class="f">Kelas<select name="class_id"></select><span class="hint" id="sqOldClsHint"></span></label>
    </div>
    <label class="check-row" style="margin-top:6px"><input type="checkbox" name="showall"><span>Tunjuk semua kelas</span></label>
    <div class="f" style="margin-top:10px"><span>Tarikh lain (hari / kelas berbeza)</span><div style="display:flex;gap:6px;flex-wrap:wrap"><input type="date" id="sqOldAdd" max="${todayISO()}"><select id="sqOldAddCls" style="max-width:260px"></select><button type="button" class="btn sm" id="sqOldAddBtn">+ Tambah</button></div></div>
    <div class="f" style="margin-top:12px"><span>Tanda tarikh dia hadir <span class="muted" id="sqOldCount"></span></span><div class="checklist" id="sqOldDates" style="max-height:360px;overflow:auto"></div></div>`,
    onSubmit: async d => {
      const keys = [].concat(d.dates || []).filter(Boolean).sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]));
      const p = d.pkg ? byId('student_packages', d.pkg) : null, consumes = ['present', 'late', 'absent'].includes(d.status);
      const todo = keys.filter(k => { const [cid, dt] = k.split('|'), ss = T('class_sessions').find(x => x.class_id === cid && x.session_date === dt), a = ss && T('attendance').find(x => x.session_id === ss.id && x.student_id === id); return !(p && a?.student_package_id === p.id); });
      if (!todo.length) { toast('Tiada tarikh baharu ditanda', true); return false; }
      if (p && consumes && todo.length > pkgRemaining(p) + Number(p.used_offset || 0)) throw new Error(`Baki ${p.name} hanya ${pkgRemaining(p) + Number(p.used_offset || 0)} sesi — kurangkan tarikh, pilih pakej lain, atau tambah jumlah sesi (Laras).`);
      let off = Number(p?.used_offset || 0), n = 0;
      if (p && consumes && !p.renewal_sent) await update('student_packages', p.id, { renewal_sent: true });   // rekod sejarah — jangan jana invois pembaharuan automatik
      for (const k of todo) {
        const [cid, dt] = k.split('|');
        const ss = await ensureSession(cid, dt); const sid = ss?.id; if (!sid) continue;
        const r = T('attendance').find(a => a.session_id === sid && a.student_id === id);
        const willUse = p && (consumes || (r && CONS_A.includes(r.status)));
        if (willUse && off > 0) { off--; await update('student_packages', p.id, { used_offset: off }); }   // ganti "sesi sebelum sistem" dengan rekod sebenar
        const row = { status: d.status, marked_by: by(), ...(p && consumes ? { student_package_id: p.id } : {}) };
        if (r && CONS_A.includes(r.status)) await update('attendance', r.id, p ? { student_package_id: p.id } : {});   // rekod sedia ada: kekalkan status, hanya tolak pakej
        else if (r) await update('attendance', r.id, row); else await insert('attendance', { session_id: sid, student_id: id, ...row });
        n++;
      }
      if (S.mode === 'supabase') { try { await refresh(['student_packages']); await loadStudentHistory(id, true); } catch (_) {} }
      const np = p && byId('student_packages', p.id);
      toast(`${n} rekod kehadiran disimpan${np && consumes ? ` · ${np.name}: baki ${pkgRemaining(np)}/${np.sessions_total}` : ''}`); app.render();
      setTimeout(() => (np ? ACTIONS['pkg-usage'](np.id) : ACTIONS['sq-att'](id)), 60);
    } });
  const E = f.elements, extra = [];
  let rel = [];
  const fillCls = () => { const pkg = byId('student_packages', E.pkg.value), from = E.from.value || from0;
    rel = E.showall.checked ? T('classes').filter(c => c.active !== false || stuVenues(id).has(c.venue_id)).sort((x, y) => progName(x.programme_id).localeCompare(progName(y.programme_id)) || x.weekday - y.weekday) : relClasses(id, pkg, from);
    const lab = c => `${esc(progName(c.programme_id))}${c.title ? ' · ' + esc(c.title) : ''} · ${DAYS[c.weekday].slice(0, 3)} ${String(c.start_time).slice(0, 5)} · ${esc(venueName(c.venue_id))}${c.active === false ? ' (tidak aktif)' : ''}`;
    E.class_id.innerHTML = `<option value="">Semua kelas berkaitan (${rel.length})</option>` + rel.map(c => `<option value="${c.id}">${lab(c)}</option>`).join('');
    f.querySelector('#sqOldAddCls').innerHTML = rel.map(c => `<option value="${c.id}">${lab(c)}</option>`).join('');
    f.querySelector('#sqOldClsHint').textContent = pkg ? `${progName(pkg.programme_id)} · ${[...stuVenues(id)].map(venueName).join(', ')}` : ''; };
  const redraw = () => { const keep = new Set([...f.querySelectorAll('#sqOldDates input[name=dates]:checked')].map(x => x.value));
    const cls = E.class_id.value ? rel.filter(c => c.id === E.class_id.value) : rel;
    f.querySelector('#sqOldDates').innerHTML = oldRows(id, cls, E.pkg.value, E.from.value || from0, extra);
    f.querySelectorAll('#sqOldDates input[name=dates]').forEach(x => { if (keep.has(x.value) && !x.disabled) x.checked = true; });
    const pkg = byId('student_packages', E.pkg.value);
    f.querySelector('#sqOldCount').textContent = pkg ? `· ${pkg.name}: ${Number(pkg.sessions_used || 0)}/${pkg.sessions_total} digunakan` : ''; };
  const reload = async () => { const from = E.from.value || from0; if (S.mode === 'supabase' && from < addDays(todayISO(), -90)) { try { await loadRange(from, todayISO()); } catch (_) {} } fillCls(); redraw(); };
  E.pkg.addEventListener('change', () => { E.from.value = pkgFrom(byId('student_packages', E.pkg.value)); reload(); });
  E.from.addEventListener('change', reload); E.showall.addEventListener('change', () => { fillCls(); redraw(); }); E.class_id.addEventListener('change', redraw);
  f.querySelector('#sqOldAddBtn').addEventListener('click', async () => { const v = f.querySelector('#sqOldAdd').value, cid = f.querySelector('#sqOldAddCls').value; if (!v || !cid) return;
    if (S.mode === 'supabase' && v < addDays(todayISO(), -90)) { try { await loadRange(v, addDays(v, 1)); } catch (_) {} }
    if (!extra.some(([a, b]) => a === cid && b === v)) extra.push([cid, v]); redraw();
    const cb = f.querySelector(`#sqOldDates input[value="${cid}|${v}"]`); if (cb && !cb.disabled) cb.checked = true; });
  fillCls(); redraw();
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

/* =====================================================================
   BELUM DIJADUALKAN — jaring keselamatan supaya pelajar yang sudah beli / bayar pakej tidak tercicir dari jadual
   • Kumpulan (jadual tetap): pakej aktif / menunggu bayaran tetapi pelajar belum didaftar ke mana-mana kelas program itu
   • Personal: pakej masih ada baki tetapi tiada sesi akan datang ditempah
   ===================================================================== */
const progKind = id => byId('programmes', id)?.kind;
export function unscheduled() {
  const today = todayISO(), out = [];
  const pk = T('student_packages').filter(p => ['active', 'pending'].includes(p.status) && pkgRemaining(p) > 0 && ['active', 'pending', 'awaiting_payment'].includes(byId('students', p.student_id)?.status));
  const seen = new Set();
  for (const p of pk) {
    const key = p.student_id + '|' + p.programme_id; if (seen.has(key)) continue;
    if (progKind(p.programme_id) === 'personal') {
      const fut = T('attendance').some(a => a.student_id === p.student_id && a.session_date >= today && a.status === 'booked' && progKind(byId('classes', byId('class_sessions', a.session_id)?.class_id)?.programme_id) === 'personal');
      if (!fut) { seen.add(key); out.push({ p, kind: 'personal' }); }
    } else {
      if (p.schedule_mode === 'flexible') {   // fleksibel: ibu bapa tempah sendiri — senarai jika tiada tempahan 14 hari akan datang
        if (p.status !== 'active') continue;
        const to = addDays(today, 14), booked = T('attendance').some(a => a.student_id === p.student_id && a.session_date >= today && a.session_date <= to && ['booked', 'present', 'late'].includes(a.status));
        if (!booked) { seen.add(key); out.push({ p, kind: 'flex' }); }
        continue;
      }
      const inCls = T('class_enrolments').some(e => e.student_id === p.student_id && byId('classes', e.class_id)?.programme_id === p.programme_id && byId('classes', e.class_id)?.active !== false);
      if (!inCls) { seen.add(key); out.push({ p, kind: 'group' }); }
    }
  }
  return out.sort((a, b) => (a.p.status === 'active' ? 0 : 1) - (b.p.status === 'active' ? 0 : 1));
}
const usRow = ({ p, kind }) => { const s = byId('students', p.student_id);
  return `<li class="list-item"><div class="li-main"><div class="li-title">${esc(s?.full_name || '—')} <span class="badge ${p.status === 'active' ? 'b-ok' : 'b-warn'}">${p.status === 'active' ? 'Dibayar' : 'Menunggu bayaran'}</span></div>
    <div class="li-sub">${esc(p.name)} · ${esc(progName(p.programme_id))} · baki ${pkgRemaining(p)}${s?.venue_id ? ' · ' + esc(venueName(s.venue_id)) : ''} · ${kind === 'personal' ? 'tiada sesi personal akan datang' : kind === 'flex' ? 'fleksibel · belum tempah 14 hari akan datang' + (p.book_reminded_at ? ' · diingatkan ' + fmtShort(String(p.book_reminded_at).slice(0, 10)) : '') : 'belum dalam kelas'}</div></div>
    ${kind === 'personal' ? `<button type="button" class="btn sm primary" data-action="us-personal" data-id="${p.id}">Jadualkan sesi</button>` : kind === 'flex' ? `<button type="button" class="btn sm" data-action="us-remind" data-id="${p.id}">Ingatkan ibu bapa</button>` : `<button type="button" class="btn sm primary" data-action="us-enrol" data-id="${p.id}">Masukkan kelas</button>`}</li>`; };
export function unschedCard() {
  const all = unscheduled(); if (!all.length) return '';
  const L = all.filter(x => x.kind !== 'flex'), F2 = all.filter(x => x.kind === 'flex');
  return `<div class="card mb" style="border-color:var(--warn)"><div class="card-head"><div><h3>${L.length ? `${L.length} pelajar belum dijadualkan${F2.length ? ` · ${F2.length} fleksibel belum tempah` : ''}` : `${F2.length} pelajar fleksibel belum tempah`}</h3><p>Sudah beli / bayar pakej tetapi belum ada dalam kelas atau jadual sesi</p></div><button type="button" class="btn sm" data-action="us-view">Lihat semua</button></div>
    <ul class="list">${[...L.slice(0, 4), ...F2.slice(0, L.length >= 4 ? 1 : 5 - L.length)].map(usRow).join('')}</ul></div>`;
}
ACTIONS['us-view'] = () => { const all = unscheduled(), L = all.filter(x => x.kind !== 'flex'), F2 = all.filter(x => x.kind === 'flex');
  openModal({ title: 'Pelajar belum dijadualkan', wide: true, cancel: 'Tutup',
  body: `<h4 style="font-size:13.5px;margin:0 0 6px">Belum dalam kelas / tiada sesi (${L.length})</h4><p class="muted" style="margin-top:0;font-size:12.5px">Pakej kumpulan (jadual tetap) tanpa kelas, dan pakej personal tanpa sesi akan datang.</p>
    <ul class="list" style="margin:0 -20px 16px">${L.map(usRow).join('') || '<li class="empty">Semua pelajar sudah dijadualkan 🎉</li>'}</ul>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h4 style="font-size:13.5px;margin:0">Fleksibel: belum tempah 14 hari akan datang (${F2.length})</h4>${F2.length ? '<button type="button" class="btn sm primary" data-action="us-remind-all">Ingatkan semua ibu bapa</button>' : ''}</div>
    <p class="muted" style="font-size:12.5px">Ibu bapa tempah sendiri di portal. Peringatan automatik dihantar setiap Isnin 9 pagi (maks. sekali seminggu bagi setiap pakej).</p>
    <ul class="list" style="margin:0 -20px">${F2.map(usRow).join('') || '<li class="empty">Semua pakej fleksibel sudah ada tempahan.</li>'}</ul>` }); };
async function remindOne(id) {
  if (S.mode === 'supabase') await rpc('remind_flex_booking', { p_sp: id });
  const p = byId('student_packages', id); if (p) p.book_reminded_at = new Date().toISOString();
}
ACTIONS['us-remind'] = async id => { try { await remindOne(id); toast('Peringatan dihantar kepada ibu bapa'); app.render(); if (document.querySelector('#modal.open')) setTimeout(() => ACTIONS['us-view'](), 60); } catch (e) { toast(e.message || String(e), true); } };
ACTIONS['us-remind-all'] = async () => { const L = unscheduled().filter(x => x.kind === 'flex'); let n = 0, bad = 0;
  for (const { p } of L) { try { await remindOne(p.id); n++; } catch (_) { bad++; } }
  toast(`${n} peringatan dihantar${bad ? ` · ${bad} tiada akaun ibu bapa (guna WhatsApp)` : ''}`, !!bad); app.render(); setTimeout(() => ACTIONS['us-view'](), 60); };
/** Senarai kelas berkaitan untuk pelajar & program (lokasi pelajar didahulukan). */
export function classPicker(sid, progId, name = 'cls') {
  const vens = stuVenues(sid);
  const L0 = T('classes').filter(c => c.active !== false && c.programme_id === progId), near = L0.filter(c => vens.has(c.venue_id));
  const L = (near.length ? near : L0).sort((x, y) => (vens.has(x.venue_id) ? 0 : 1) - (vens.has(y.venue_id) ? 0 : 1) || x.weekday - y.weekday || String(x.start_time).localeCompare(String(y.start_time)));
  if (!L.length) return '<p class="muted">Tiada kelas aktif untuk program ini. Tambah kelas di Jadual Mingguan.</p>';
  const cnt = c => T('class_enrolments').filter(e => e.class_id === c.id).length;
  return `<div class="checklist" style="max-height:300px;overflow:auto">${L.map(c => { const on = T('class_enrolments').some(e => e.class_id === c.id && e.student_id === sid);
    return `<label class="check-row"><input type="checkbox" name="${name}" value="${c.id}" ${on ? 'checked disabled' : ''}><span>${DAYS[c.weekday].slice(0, 3)} ${String(c.start_time).slice(0, 5)} · ${esc(c.title || progName(c.programme_id))} · ${esc(venueName(c.venue_id))}</span><em class="muted">${cnt(c)}${c.capacity ? '/' + c.capacity : ''} pelajar${on ? ' · sudah berdaftar' : ''}${!vens.has(c.venue_id) && vens.size ? ' · lokasi lain' : ''}</em></label>`; }).join('')}</div>`;
}
export async function enrolInto(sid, ids) {
  let n = 0;
  for (const cid of [].concat(ids || []).filter(Boolean)) { if (T('class_enrolments').some(e => e.class_id === cid && e.student_id === sid)) continue; await insert('class_enrolments', { class_id: cid, student_id: sid }); n++; }
  return n;
}
ACTIONS['us-enrol'] = id => { const p = byId('student_packages', id); if (!p) return; const s = byId('students', p.student_id);
  openModal({ title: `Masukkan kelas — ${esc(s?.full_name || '')}`, submit: 'Daftar ke kelas',
    body: `<p class="muted" style="margin-top:0">${esc(p.name)} · ${esc(progName(p.programme_id))}. Pilih satu atau lebih kelas (cth. Sabtu & Ahad). Pelajar akan muncul dalam senarai kelas & jadual sesi mingguan.</p>${classPicker(p.student_id, p.programme_id)}`,
    onSubmit: async d => { const n = await enrolInto(p.student_id, d.cls); if (!n) { toast('Pilih sekurang-kurangnya satu kelas', true); return false; } toast(`Didaftar ke ${n} kelas`); app.render(); } }); };
ACTIONS['us-personal'] = id => { const p = byId('student_packages', id); if (!p) return; const s = byId('students', p.student_id);
  ACTIONS['cal-personal']?.({ students: [p.student_id], programme_id: p.programme_id, venue_id: s?.venue_id || '' }); };
