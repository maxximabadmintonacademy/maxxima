// v25: Portal coach — hari & masa tersedia, maklumat peribadi (bank, kecemasan), amaran akaun belum dipautkan.
import { ACTIONS } from '../registry.js';
import { S, rpc } from '../data.js';
import { esc, app, toast, openModal, fmtShort } from '../ui.js';
import { T } from '../admin/helpers.js';
import { availForm, availFromForm, slotsText, savePrivate, privateForm, privatePatch } from '../staffpriv.js';

const me = () => T('staff').find(s => s.profile_id === S.profile.id) || (S.mode === 'demo' ? (T('staff').find(s => /alvi/i.test(s.full_name)) || T('staff')[0]) : null);

export function coachExtraCards(st) {
  if (!st) return `<div class="card card-pad mb" style="border-color:var(--warn);background:var(--warn-soft,#fff8e6)"><b>Akaun belum dipautkan kepada rekod coach</b>
    <p style="font-size:13px;margin-top:6px">Jadual, pelajar dan kehadiran akan muncul selepas admin memautkan akaun ini (Admin → Tetapan → Pengguna → Edit → "Rekod staf dipautkan") dan menetapkan anda sebagai coach kelas/sesi.</p></div>`;
  const pv = T('staff_private').find(x => x.staff_id === st.id), av = st.availability || [], part = st.employment_type === 'part_time';
  const todo = [!av.length && 'hari & masa tersedia', !pv?.bank_account && 'akaun bank', !pv?.emergency_phone && 'kenalan kecemasan'].filter(Boolean);
  return `${todo.length ? `<div class="hint mb" style="border-color:var(--warn)">📝 Sila lengkapkan: <b>${todo.join(', ')}</b>${part ? ' — penting untuk coach sambilan (jadual & gaji).' : '.'}</div>` : ''}
  <div class="grid g-2 mb"><div class="card card-pad"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><b>🗓️ Hari & masa tersedia</b>
      <div class="muted" style="font-size:12.5px;margin-top:4px">${av.length ? esc(slotsText(av)) : 'Belum diisi'}${st.max_hours_week ? ` · maks ${st.max_hours_week} jam/minggu` : ''}${st.avail_note ? '<br>' + esc(st.avail_note) : ''}${st.avail_updated_at ? `<br>Dikemas kini ${fmtShort(st.avail_updated_at.slice(0, 10))}` : ''}</div></div>
      <button class="btn sm ${av.length ? '' : 'primary'}" data-action="c-avail">${av.length ? 'Kemas kini' : 'Isi'}</button></div></div>
    <div class="card card-pad"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><b>🔒 Maklumat peribadi</b>
      <div class="muted" style="font-size:12.5px;margin-top:4px">${pv?.bank_account ? `${esc(pv.bank_name || 'Bank')} ····${esc(String(pv.bank_account).slice(-4))}` : 'Akaun bank belum diisi'}<br>${pv?.emergency_phone ? 'Kecemasan: ' + esc(pv.emergency_name || '') : 'Kenalan kecemasan belum diisi'}</div>
      <div class="muted" style="font-size:11.5px;margin-top:4px">Hanya anda & admin boleh lihat.</div></div>
      <button class="btn sm ${pv?.bank_account ? '' : 'primary'}" data-action="c-private">${pv ? 'Kemas kini' : 'Isi'}</button></div></div></div>`;
}

Object.assign(ACTIONS, {
  'c-avail': () => { const st = me(); if (!st) return;
    openModal({ title: 'Hari & masa tersedia', wide: true, submit: 'Simpan', body: availForm(st), onSubmit: async d => {
      const slots = availFromForm(d), max = d.max === '' ? null : Number(d.max);
      if (S.mode === 'supabase') await rpc('coach_set_availability', { p_slots: slots, p_note: d.note || '', p_max: max });
      Object.assign(st, { availability: slots, avail_note: d.note || null, max_hours_week: max, avail_updated_at: new Date().toISOString() });
      toast('Ketersediaan disimpan — admin dimaklumkan'); app.render(); } }); },
  'c-private': () => { const st = me(); if (!st) return; const pv = T('staff_private').find(x => x.staff_id === st.id);
    openModal({ title: 'Maklumat peribadi', submit: 'Simpan', body: privateForm(pv), onSubmit: async d => { await savePrivate(st.id, privatePatch(d)); toast('Disimpan'); app.render(); } }); },
});
