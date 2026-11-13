// v25: arkib (pelajar, leads, kejohanan), tetapan sijil & tandatangan, ketersediaan + maklumat peribadi coach,
// paksa tukar kata laluan sementara (admin / urus setia).
import { VIEWS, ACTIONS } from '../registry.js';
import { S, update, saveSetting, rpc, setPassword } from '../data.js';
import { esc, F, UI, app, toast, openModal, confirmModal, fmtShort, friendlyError } from '../ui.js';
import { T, byId } from './helpers.js';
import { uploadMedia, publicUrl } from '../media.js';
import { certDoc } from '../cert.js';
import { openDoc } from '../docview.js';
import { LOGO_DATA } from '../logo-data.js';
import { savePrivate, privateForm, privatePatch, slotsText } from '../staffpriv.js';

const nowISO = () => new Date().toISOString();

/* ---------------- ARKIB ---------------- */
Object.assign(ACTIONS, {
  'st-sel': id => { const s = (UI.stSel ||= new Set()); s.has(id) ? s.delete(id) : s.add(id); app.render(); },
  'st-sel-all': ids => { const s = (UI.stSel ||= new Set()), list = String(ids || '').split(',').filter(Boolean), all = list.every(i => s.has(i)); list.forEach(i => (all ? s.delete(i) : s.add(i))); app.render(); },
  'st-sel-clear': () => { UI.stSel = new Set(); app.render(); },
  'st-bulk': kind => {
    const ids = [...(UI.stSel || [])]; if (!ids.length) return;
    const L = { left: ['Tandakan berhenti?', 'Status ditukar kepada "Berhenti". Sesi akan datang tidak dijana untuk mereka.'], archive: ['Arkib pelajar?', 'Pelajar ditanda "Berhenti" dan disembunyikan daripada senarai. Semua rekod (invois, kehadiran) kekal dan boleh dikeluarkan semula dari tapisan "Arkib".'],
      active: ['Aktifkan semula?', 'Status ditukar kepada "Aktif".'], unarchive: ['Keluarkan dari arkib?', 'Pelajar dipaparkan semula dalam senarai (status kekal "Berhenti").'] }[kind];
    confirmModal({ title: L[0], message: `<b>${ids.length} pelajar</b>: ${ids.slice(0, 8).map(i => esc(byId('students', i)?.full_name || '')).join(', ')}${ids.length > 8 ? '…' : ''}<br><br>${L[1]}`, ok: 'Teruskan',
      onOk: async () => {
        const patch = { left: { status: 'left' }, archive: { status: 'left', archived_at: nowISO() }, active: { status: 'active', archived_at: null }, unarchive: { archived_at: null } }[kind];
        for (const id of ids) { const s = byId('students', id); await update('students', id, kind === 'archive' && !['active', 'paused', 'pending', 'awaiting_payment'].includes(s?.status) ? { archived_at: patch.archived_at } : patch); }
        UI.stSel = new Set(); toast(`${ids.length} pelajar dikemas kini`); app.render();
      } });
  },
  'st-archive': id => { const s = byId('students', id);
    if (s.archived_at) return update('students', id, { archived_at: null }).then(() => { toast('Dikeluarkan dari arkib'); app.render(); });
    confirmModal({ title: 'Arkib pelajar?', message: `<b>${esc(s.full_name)}</b> akan ditanda "Berhenti" dan disembunyikan daripada senarai. Rekod kekal (lihat tapisan "Arkib").`, ok: 'Arkib',
      onOk: async () => { await update('students', id, { archived_at: nowISO(), ...(s.status === 'left' ? {} : { status: 'left' }) }); toast('Pelajar diarkib'); app.render(); } }); },
  'lead-archive': async id => { const l = byId('leads', id); await update('leads', id, { archived_at: l.archived_at ? null : nowISO() }); toast(l.archived_at ? 'Lead dipulihkan' : 'Lead diarkib'); app.render(); },
  'tn-arch': async id => { const t = byId('tournaments', id); await update('tournaments', id, { archived_at: t.archived_at ? null : nowISO() }); toast(t.archived_at ? 'Kejohanan dikeluarkan dari arkib' : 'Kejohanan diarkib'); app.render(); },
  'tn-showarch': () => { UI.tnArch = !UI.tnArch; location.hash = 'kejohanan'; app.render(); },
});

/* ---------------- TETAPAN SIJIL ---------------- */
const certCfg = () => (S.t.settings || []).find(x => x.key === 'cert')?.value || {};
ACTIONS['cert-settings'] = () => {
  const c = certCfg(), sg = [0, 1, 2].map(i => (c.signers || [])[i] || {});
  openModal({ title: 'Tetapan Sijil & Tandatangan', wide: true, submit: 'Simpan', body: `<div class="form-grid">
    ${sg.map((x, i) => `<div class="f full" style="border:1px solid var(--line);border-radius:12px;padding:12px"><b style="font-size:13px">Penandatangan ${i + 1}${i === 2 ? ' (pilihan)' : ''}</b>
      <div class="form-grid" style="margin-top:8px">${F('Nama', 's' + i + '_name', { value: x.name, ph: i ? 'cth. En. Ahmad' : 'cth. Coach Doryn' })}${F('Jawatan', 's' + i + '_title', { value: x.title ?? (i === 0 ? 'Ketua Jurulatih' : i === 1 ? 'Pengarah Kejohanan' : ''), ph: 'cth. Ketua Jurulatih' })}
      <label class="f">Gambar tandatangan (PNG/JPG latar putih)${x.img ? ' — ada' : ''}<input type="file" name="s${i}_img" accept="image/*"></label>
      ${x.img ? `<div class="f" style="flex-direction:row;gap:10px;align-items:center"><img src="${esc(publicUrl(x.img))}" style="max-height:44px;max-width:150px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:4px"><label style="display:flex;gap:6px;align-items:center;font-size:12.5px"><input type="checkbox" name="s${i}_del" value="1" style="width:auto;height:auto"> Buang</label></div>` : ''}</div></div>`).join('')}
    ${F('Sijil pemenang', 'winner_mode', { value: c.winner_mode || 'plain', full: true, opts: [['plain', 'Teks sahaja — urus setia cetak atas kertas sijil sendiri'], ['design', 'Reka bentuk penuh (sama seperti sijil penyertaan)']] })}
    ${F('Jarak teks dari atas kertas (mm) — untuk sijil pemenang teks sahaja', 'plain_top_mm', { type: 'number', min: 0, max: 180, value: c.plain_top_mm ?? 78 })}
    <label class="f" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="plain_event" value="1" ${c.plain_event === false ? '' : 'checked'} style="width:auto;height:auto"> Cetak nama kejohanan & tarikh pada sijil pemenang</label></div>
    <p class="muted" style="font-size:12.5px;margin-top:10px">Tandatangan dipaparkan pada sijil penyertaan (termasuk yang dimuat turun peserta). Petua: tandatangan dengan pen hitam atas kertas putih, ambil gambar terang, potong rapat. <a href="javascript:void 0" data-action="cert-preview">Pratonton sijil →</a></p>`,
    onSubmit: async d => {
      const signers = [];
      for (const i of [0, 1, 2]) { let img = d[`s${i}_del`] === '1' ? null : sg[i].img || null;
        if (d[`s${i}_img`] && d[`s${i}_img`].size) img = await uploadMedia('public-media', 'cert', d[`s${i}_img`], { maxMB: 3 });
        const name = (d[`s${i}_name`] || '').trim(), title = (d[`s${i}_title`] || '').trim();
        if (name || title || img) signers.push({ name, title, img }); }
      await saveSetting('cert', { ...c, signers, winner_mode: d.winner_mode, plain_top_mm: Number(d.plain_top_mm) || 0, plain_event: d.plain_event === '1' });
      toast('Tetapan sijil disimpan'); app.render();
    } });
};
ACTIONS['cert-preview'] = () => openDoc(certDoc([{ name: 'Nama Peserta Contoh', cat: "Boys' Singles Under 12", place: 1, ref: 'BR26-CONTOH' }, { name: 'Nama Peserta Contoh', cat: "Boys' Singles Under 12", place: 0, ref: 'BR26-CONTOH' }],
  { event: 'Bukit Raja Badminton Challenge 2026', dates: '12 Dis 2026', venue: 'GoTeam Sports Complex', logo: LOGO_DATA, cfg: certCfg(), imgUrl: publicUrl }), 'contoh-sijil.html');

/* ---------------- KETERSEDIAAN & MAKLUMAT PERIBADI COACH (admin) ---------------- */
const origCoach = VIEWS.coach;
VIEWS.coach = p => origCoach(p) + availCard();
function availCard() {
  const st = T('staff').filter(s => s.active).sort((a, b) => (b.employment_type === 'part_time') - (a.employment_type === 'part_time') || a.full_name.localeCompare(b.full_name));
  if (!st.length) return '';
  return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Ketersediaan & maklumat coach</h3><div class="sub">Coach (terutama sambilan) isi sendiri di Portal Coach → Akaun → "Hari & masa tersedia" dan "Maklumat peribadi".</div></div></div>
  <div class="table-wrap"><table><thead><tr><th>Coach</th><th>Hari & masa tersedia</th><th>Maks jam/minggu</th><th>Dikemas kini</th><th>Bank / kecemasan</th></tr></thead><tbody>
  ${st.map(s => { const pv = T('staff_private').find(x => x.staff_id === s.id);
    return `<tr><td><b>${esc(s.full_name)}</b><div class="muted" style="font-size:12px">${esc(s.position || '')}${s.employment_type === 'part_time' ? ' · sambilan' : ''}</div></td>
      <td style="font-size:12.5px;max-width:320px">${(s.availability || []).length ? esc(slotsText(s.availability)) : '<span class="muted">Belum diisi</span>'}${s.avail_note ? `<div class="muted">${esc(s.avail_note)}</div>` : ''}</td>
      <td>${s.max_hours_week ?? '—'}</td><td style="font-size:12px">${s.avail_updated_at ? fmtShort(s.avail_updated_at.slice(0, 10)) : '—'}</td>
      <td><button class="btn sm" data-action="staff-private" data-id="${s.id}">${pv?.bank_account ? '✓ ' : ''}${pv?.bank_account ? 'Lihat' : 'Isi'}</button></td></tr>`; }).join('')}</tbody></table></div></div>`;
}
ACTIONS['staff-private'] = id => { const s = byId('staff', id), pv = T('staff_private').find(x => x.staff_id === id);
  openModal({ title: 'Maklumat peribadi — ' + esc(s.full_name), submit: 'Simpan', body: privateForm(pv), onSubmit: async d => { await savePrivate(id, privatePatch(d)); toast('Disimpan'); app.render(); } }); };

/* ---------------- TUKAR KATA LALUAN SEMENTARA (admin / urus setia) ---------------- */
export function pwPrompt() {
  if (S.mode !== 'supabase' || !S.profile?.must_change_pw) return;
  openModal({ title: 'Tukar kata laluan sementara', submit: 'Simpan', cancel: 'Kemudian', body: `<p class="muted" style="font-size:13px;margin-bottom:10px">Akaun anda menggunakan kata laluan sementara. Sila tetapkan kata laluan sendiri.</p><div class="form-grid">${F('Kata laluan baharu (min. 8 aksara)', 'p1', { type: 'password', full: true })}${F('Ulang kata laluan', 'p2', { type: 'password', full: true })}</div>`,
    onSubmit: async d => { if ((d.p1 || '').length < 8) throw new Error('Kata laluan mesti sekurang-kurangnya 8 aksara.'); if (d.p1 !== d.p2) throw new Error('Kata laluan tidak sepadan.');
      try { await setPassword(d.p1); await rpc('self_pw_changed'); S.profile.must_change_pw = false; toast('Kata laluan dikemas kini'); } catch (e) { throw new Error(friendlyError(e)); } } });
}
