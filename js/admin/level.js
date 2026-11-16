/* =====================================================================
   NAIK / TUKAR TAHAP — cth. Foundation → Performance.
   Satu langkah: tukar program, keluar dari kelas lama, masuk kelas baru,
   dan urus baki pakej lama (teruskan / kredit / biar).
   Penting: pakej ditolak ikut PROGRAM kelas — tanpa langkah ini baki pakej
   Foundation tidak akan ditolak bila pelajar hadir kelas Performance.
   ===================================================================== */
import { ACTIONS } from '../registry.js';
import { S, insert, update, remove } from '../data.js';
import { esc, F, RM, app, toast, openModal, closeModal, todayISO, hm, DAYS } from '../ui.js';
import { T, byId, progName, venueName, staffName, enrolledIn, studentPackages, pkgRemaining } from './helpers.js';

const groupProgs = () => T('programmes').filter(p => p.active && p.kind !== 'personal').sort((a, b) => (a.sort || 0) - (b.sort || 0));
const progOf = c => byId('programmes', c?.programme_id);

function classList(sid, prog, venue, picked) {
  const L = T('classes').filter(c => c.active !== false && c.programme_id === prog && (!venue || c.venue_id === venue))
    .sort((a, b) => a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time)));
  if (!L.length) return `<div class="muted" style="padding:10px">Tiada kelas ${esc(progName(prog))}${venue ? ' di ' + esc(venueName(venue)) : ''}. Tukar tapisan lokasi kepada "Semua lokasi" atau cipta kelas dahulu.</div>`;
  return L.map(c => { const n = enrolledIn(c.id).filter(e => e.student_id !== sid).length, full = c.capacity && n >= c.capacity;
    return `<label class="check-row ${full ? 'full' : ''}"><input type="checkbox" name="class_ids" value="${c.id}" ${picked.includes(c.id) ? 'checked' : ''}><span>${c.title ? esc(c.title) + ' · ' : ''}${DAYS[c.weekday]} ${hm(c.start_time)}–${hm(c.end_time)} · ${esc(venueName(c.venue_id))} · ${esc(staffName(c.coach_id))}</span><em>${n}/${c.capacity || '∞'}${full ? ' penuh' : ''}</em></label>`; }).join('');
}

ACTIONS['st-level'] = id => {
  const s = byId('students', id); if (!s) return;
  const progs = groupProgs(), curIdx = progs.findIndex(p => p.id === s.programme_id);
  const next = progs[curIdx + 1]?.id || progs.find(p => p.id !== s.programme_id)?.id || '';
  const oldEnr = T('class_enrolments').filter(e => e.student_id === id && progOf(byId('classes', e.class_id))?.kind !== 'personal');
  const oldPk = studentPackages(id).filter(p => p.status === 'active' && p.programme_id === s.programme_id && pkgRemaining(p) > 0)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))[0];
  const left = oldPk ? pkgRemaining(oldPk) : 0, per = oldPk && oldPk.sessions_total ? Number(oldPk.price || 0) / Number(oldPk.sessions_total) : 0;
  const credit = Math.round(per * left * 100) / 100;

  const f = openModal({
    title: `Naik / tukar tahap — ${esc(s.full_name)}`, wide: true, submit: 'Simpan perubahan tahap',
    body: `<p class="muted" style="margin-bottom:12px">Sekarang: <b>${esc(progName(s.programme_id))}</b>${oldEnr.length ? ' · ' + oldEnr.map(e => { const c = byId('classes', e.class_id); return `${DAYS[c.weekday].slice(0, 3)} ${hm(c.start_time)} ${esc(venueName(c.venue_id))}`; }).join(', ') : ' · tiada kelas tetap'}</p>
    <div class="form-grid">
      ${F('Tahap / program baru', 'programme_id', { value: next, req: true, opts: progs.filter(p => p.id !== s.programme_id).map(p => [p.id, p.name]) })}
      ${F('Berkuat kuasa mulai', 'from', { type: 'date', value: todayISO(), req: true })}
      ${F('Tapis lokasi kelas', 'venue_id', { value: s.venue_id || '', opts: [['', 'Semua lokasi'], ...T('venues').filter(v => v.active !== false).map(v => [v.id, v.name])], full: true })}
    </div>
    <div class="f" style="margin-top:12px"><span>Kelas baru (boleh pilih lebih dari satu, atau biar kosong jika belum pasti)</span><div class="checklist" id="lvClasses">${classList(id, next, s.venue_id, [])}</div></div>
    ${oldPk ? `<div class="f" style="margin-top:12px"><span>Baki pakej lama: <b>${esc(oldPk.name)}</b> — ${left} sesi lagi (${RM(oldPk.price)})</span>
      <label class="check-row"><input type="radio" name="pk" value="carry" checked><span><b>Teruskan baki ${left} sesi di kelas baru</b> — pakej dipindah ke program baru. Isi caj beza jika yuran baru lebih mahal.</span></label>
      <label class="check-row"><input type="radio" name="pk" value="credit"><span><b>Tamatkan & kredit ${RM(credit)}</b> ke invois akan datang (${left} × ${RM(per)}). Kemudian jual pakej baru.</span></label>
      <label class="check-row"><input type="radio" name="pk" value="done"><span><b>Pakej lama sebenarnya sudah habis</b> — tandakan habis (sesi lama sebelum sistem), tiada kredit.</span></label>
      <label class="check-row"><input type="radio" name="pk" value="keep"><span>Biarkan pakej lama (saya urus sendiri)</span></label></div>
      <div class="form-grid" style="margin-top:8px">${F('Caj beza yuran (RM, pilihan)', 'diff', { type: 'number', step: '0.01', min: 0, ph: 'Kosongkan jika tiada' })}</div>` : '<p class="hint" style="margin-top:12px">Tiada pakej aktif untuk program lama. Jual pakej program baru selepas ini.</p>'}
    <label class="check-row" style="margin-top:12px"><input type="checkbox" name="sell" ${oldPk ? '' : 'checked'}><span><b>Selepas simpan, terus jual pakej program baru & keluarkan invois</b></span></label>
    <p class="muted" style="margin-top:12px;font-size:12.5px">Yang akan berlaku: program pelajar ditukar, pelajar dikeluarkan dari kelas lama mulai tarikh di atas (tempahan akan datang dalam kelas lama dibatalkan), dimasukkan ke kelas baru, dan catatan perubahan disimpan dalam profil. Rekod kehadiran lama kekal.</p>`,
    onSubmit: async d => {
      const prog = d.programme_id, ids = [].concat(d.class_ids || []), from = d.from || todayISO();
      for (const cid of ids) { const c = byId('classes', cid); if (c.capacity && enrolledIn(cid).filter(e => e.student_id !== id).length >= c.capacity) throw new Error(`Kelas ${DAYS[c.weekday]} ${hm(c.start_time)} sudah penuh. Naikkan kapasiti kelas atau pilih kelas lain.`); }
      const oldProg = s.programme_id, done = [];
      // 1. kelas lama → keluar; tempahan akan datang (belum hadir) dibuang
      for (const e of oldEnr) {
        if (ids.includes(e.class_id)) continue;
        const futureSess = new Set(T('class_sessions').filter(x => x.class_id === e.class_id && x.session_date >= from).map(x => x.id));
        for (const a of T('attendance').filter(a => a.student_id === id && futureSess.has(a.session_id) && (!a.status || a.status === 'booked'))) await remove('attendance', a.id);
        await remove('class_enrolments', e.id);
      }
      // 2. kelas baru
      for (const cid of ids.filter(cid => !oldEnr.some(e => e.class_id === cid))) await insert('class_enrolments', { class_id: cid, student_id: id });
      // 3. program pelajar
      const newVenue = ids.length ? byId('classes', ids[0]).venue_id : s.venue_id;
      for (const sp of T('student_programmes').filter(p => p.student_id === id && p.programme_id === oldProg)) await remove('student_programmes', sp.id);
      if (!T('student_programmes').some(p => p.student_id === id && p.programme_id === prog)) { try { await insert('student_programmes', { student_id: id, programme_id: prog, venue_id: newVenue || null }); } catch (_) {} }
      // 4. pakej lama
      const month = from.slice(0, 7);
      if (oldPk && d.pk === 'carry') { await update('student_packages', oldPk.id, { programme_id: prog, name: /→/.test(oldPk.name) ? oldPk.name : `${oldPk.name} → ${progName(prog)}` }); done.push(`baki ${left} sesi diteruskan`); }
      if (oldPk && d.pk === 'credit') {
        await update('student_packages', oldPk.id, { status: 'cancelled' });
        if (credit > 0) await insert('billing_adjustments', { student_id: id, kind: 'credit', amount: credit, apply_month: month, reason: `Naik tahap ke ${progName(prog)} — baki ${left} sesi ${oldPk.name}`, created_by: S.mode === 'demo' ? null : S.profile?.id || null });
        done.push(`kredit ${RM(credit)}`);
      }
      if (oldPk && d.pk === 'done') { const { markPkgDone } = await import('./student-quick.js'); await markPkgDone(oldPk.id); done.push('pakej lama ditanda habis'); }
      if (Number(d.diff) > 0) { await insert('billing_adjustments', { student_id: id, kind: 'charge', amount: Number(d.diff), apply_month: month, reason: `Beza yuran naik tahap ke ${progName(prog)}`, created_by: S.mode === 'demo' ? null : S.profile?.id || null }); done.push(`caj beza ${RM(d.diff)}`); }
      // 5. profil + catatan
      const note = `[${from}] Tahap: ${progName(oldProg)} → ${progName(prog)}`;
      await update('students', id, { programme_id: prog, venue_id: newVenue || null, notes: [s.notes, note].filter(Boolean).join('\n') });
      closeModal();
      toast(`${s.full_name} kini ${progName(prog)}${ids.length ? ` · ${ids.length} kelas` : ' · belum ada kelas'}${done.length ? ' · ' + done.join(', ') : ''}`);
      app.render();
      if (d.sell) setTimeout(() => ACTIONS.sell(id), 50);
    },
  });
  const redraw = () => { const fd = new FormData(f); f.querySelector('#lvClasses').innerHTML = classList(id, fd.get('programme_id'), fd.get('venue_id'), fd.getAll('class_ids')); };
  ['programme_id', 'venue_id'].forEach(n => f.elements[n]?.addEventListener('change', redraw));
};
