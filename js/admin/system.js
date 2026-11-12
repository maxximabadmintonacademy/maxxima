import { qrSvg } from '../qr.js';
// Pengguna & Akses (peranan, jemputan, pautan ibu bapa/coach) dan Tetapan.
import { themeSwitch } from '../theme.js';
import { langSwitch } from '../i18n.js';
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove, saveSetting, inviteUser, rpc } from '../data.js';
import { ic, esc, F, num, val, badge, avatar, app, toast, openModal, confirmModal, pageHead, fmtDate, LABEL, $ } from '../ui.js';
import { T, byId, venueName, progName, academy, billing } from './helpers.js';
import { LANGS_ALL, ageGroups } from './sessions.js';

/* =====================================================================
   PENGGUNA & AKSES
   ===================================================================== */
VIEWS.pengguna = () => {
  const ps = T('profiles').slice().sort((a, b) => ['admin', 'coach', 'parent'].indexOf(a.role) - ['admin', 'coach', 'parent'].indexOf(b.role) || (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''));
  return `
  ${pageHead('Pengguna & Akses', 'Setiap peranan hanya melihat data yang dibenarkan — dikuatkuasakan oleh pangkalan data, bukan hanya paparan.', `<button class="btn primary" data-action="user-invite">${ic('plus', 'sm')} Jemput Pengguna</button>`)}
  <div class="grid g-3 mb">
    <div class="card card-pad"><div class="badge b-purple">Admin</div><p style="margin-top:8px;font-size:13px">Akses penuh: pelajar, yuran, jadual, HR, kejohanan dan pengguna.</p></div>
    <div class="card card-pad"><div class="badge b-info">Coach</div><p style="margin-top:8px;font-size:13px">Hanya kelas dan pelajar sendiri: kehadiran, prestasi, pelan kelas. Tiada akses yuran atau gaji.</p></div>
    <div class="card card-pad"><div class="badge b-lime">Ibu Bapa</div><p style="margin-top:8px;font-size:13px">Hanya anak yang dipautkan: jadual, yuran, progres dan pengesahan kehadiran.</p></div>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Pengguna</th><th>Peranan</th><th>Dipautkan</th><th>Status</th><th></th></tr></thead>
    <tbody>${ps.map(p => {
      const kids = T('students').filter(s => s.guardian_id === p.id), sf = T('staff').find(s => s.profile_id === p.id);
      return `<tr><td><div class="cell-person">${avatar(p.full_name || p.email)}<div><b>${esc(p.full_name || '(tanpa nama)')}${p.id === S.profile.id ? ' <span class="badge b-muted">anda</span>' : ''}</b><span>${esc(p.email || '')}</span></div></div></td>
        <td>${badge(p.role)}</td>
        <td>${p.role === 'parent' ? (kids.length ? kids.map(k => esc(k.full_name)).join(', ') : '<span class="muted">tiada anak dipautkan</span>') : p.role === 'coach' ? (sf ? esc(sf.full_name) : '<span class="muted">tiada rekod staf dipautkan</span>') : '<span class="muted">—</span>'}</td>
        <td>${p.active ? badge('active') : badge('paused', 'Dinyahaktifkan')}</td>
        <td><button class="btn sm" data-action="user-edit" data-id="${p.id}">${ic('edit', 'sm')}</button></td></tr>`;
    }).join('') || `<tr><td colspan="5" class="empty">Belum ada pengguna.</td></tr>`}</tbody>
  </table></div></div>`;
};

const studentChecklist = (selected = [], pid = null) => {
  const studs = T('students').filter(s => s.status !== 'left' && (!s.guardian_id || s.guardian_id === pid)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return `<div class="checklist">${studs.map(s => `<label class="check-row"><input type="checkbox" name="student_ids" value="${s.id}" ${selected.includes(s.id) ? 'checked' : ''}><span>${esc(s.full_name)}</span><em>${esc(s.guardian_name || '')}</em></label>`).join('') || '<div class="muted" style="padding:10px">Tiada pelajar belum dipautkan.</div>'}</div>`;
};
const staffOpts = (pid = null) => [['', '— Tiada —'], ...T('staff').filter(s => s.active && (!s.profile_id || s.profile_id === pid)).map(s => [s.id, s.full_name])];

ACTIONS['user-invite'] = () => {
  const f = openModal({
    title: 'Jemput Pengguna', submit: 'Hantar Jemputan', wide: true,
    body: `<p class="muted" style="margin-bottom:12px">Pengguna akan menerima e-mel untuk menetapkan kata laluan sendiri.</p>
    <div class="form-grid">
      ${F('E-mel', 'email', { type: 'email', req: true })}
      ${F('Nama', 'full_name')}
      ${F('Peranan', 'role', { value: 'parent', opts: [['parent', 'Ibu Bapa'], ['coach', 'Coach'], ['admin', 'Admin']], full: true })}
    </div>
    <div id="roleExtra" style="margin-top:14px"><div class="f"><span>Pautkan anak</span>${studentChecklist()}</div></div>`,
    onSubmit: async d => {
      await inviteUser({ email: d.email.trim(), full_name: val(d.full_name), role: d.role, student_ids: d.role === 'parent' ? [].concat(d.student_ids || []) : [], staff_id: d.role === 'coach' ? val(d.staff_id) : null });
      toast(S.mode === 'demo' ? 'Pengguna ditambah (demo)' : 'Jemputan dihantar'); app.render();
    },
  });
  f.elements.role.addEventListener('change', e => {
    const r = e.target.value;
    f.querySelector('#roleExtra').innerHTML = r === 'parent' ? `<div class="f"><span>Pautkan anak</span>${studentChecklist()}</div>` : r === 'coach' ? F('Pautkan rekod staf', 'staff_id', { opts: staffOpts() }) : '';
  });
};

ACTIONS['user-edit'] = id => {
  const p = byId('profiles', id), self = id === S.profile.id;
  const kids = T('students').filter(s => s.guardian_id === id).map(s => s.id), sf = T('staff').find(s => s.profile_id === id);
  const f = openModal({
    title: 'Edit Pengguna', wide: true,
    body: `<div class="form-grid">
      ${F('Nama', 'full_name', { value: p.full_name })}
      ${F('Telefon', 'phone', { value: p.phone })}
      ${F('Peranan', 'role', { value: p.role, opts: [['admin', 'Admin'], ['coach', 'Coach'], ['parent', 'Ibu Bapa']] })}
      <label class="f" style="justify-content:flex-end"><span style="flex-direction:row;display:flex;align-items:center;gap:8px;height:40px"><input type="checkbox" name="active" value="1" ${p.active ? 'checked' : ''} style="width:auto;height:auto"> Akaun aktif</span></label>
    </div>
    ${p.role === 'parent' && T('parent_tax_info').find(x => x.id === id) ? (t => `<div class="hint" style="margin-top:10px"><b>Maklumat cukai (diisi ibu bapa):</b> ${esc(t.legal_name || '')} · ${esc(t.id_type || '').toUpperCase()} ${esc(t.id_no || '')}${t.tin ? ' · TIN ' + esc(t.tin) : ''}${t.address ? '<br>' + esc(t.address) : ''}</div>`)(T('parent_tax_info').find(x => x.id === id)) : ''}
    ${self ? '<div class="hint warn" style="margin-top:10px">Anda tidak boleh menukar peranan atau menyahaktifkan akaun sendiri.</div>' : ''}
    <div id="roleExtra" style="margin-top:14px">${p.role === 'parent' ? `<div class="f"><span>Anak yang dipautkan</span>${studentChecklist(kids, id)}</div>` : p.role === 'coach' ? F('Rekod staf dipautkan', 'staff_id', { value: sf?.id || '', opts: staffOpts(id) }) : ''}</div>`,
    onSubmit: async d => {
      const role = self ? p.role : d.role, active = self ? true : d.active === '1';
      const otherAdmins = T('profiles').filter(x => x.id !== id && x.role === 'admin' && x.active).length;
      if (p.role === 'admin' && (role !== 'admin' || !active) && !otherAdmins) throw new Error('Mesti ada sekurang-kurangnya seorang admin aktif.');
      await update('profiles', id, { full_name: d.full_name.trim(), phone: val(d.phone), role, active });
      if (role === 'parent') {
        const sel = [].concat(d.student_ids || []);
        for (const s of T('students').filter(s => s.guardian_id === id && !sel.includes(s.id))) await update('students', s.id, { guardian_id: null });
        for (const sid of sel) if (byId('students', sid).guardian_id !== id) await update('students', sid, { guardian_id: id });
      } else for (const s of T('students').filter(s => s.guardian_id === id)) await update('students', s.id, { guardian_id: null });
      if (role === 'coach') {
        const want = val(d.staff_id);
        for (const s of T('staff').filter(s => s.profile_id === id && s.id !== want)) await update('staff', s.id, { profile_id: null });
        if (want && byId('staff', want).profile_id !== id) await update('staff', want, { profile_id: id });
      } else for (const s of T('staff').filter(s => s.profile_id === id)) await update('staff', s.id, { profile_id: null });
      toast('Pengguna dikemas kini'); app.render();
    },
  });
  if (!self) f.elements.role.addEventListener('change', e => {
    const r = e.target.value;
    f.querySelector('#roleExtra').innerHTML = r === 'parent' ? `<div class="f"><span>Anak yang dipautkan</span>${studentChecklist(kids, id)}</div>` : r === 'coach' ? F('Rekod staf dipautkan', 'staff_id', { value: sf?.id || '', opts: staffOpts(id) }) : '';
  });
  else f.elements.role.disabled = true, f.elements.active.disabled = true;
};

/* =====================================================================
   TETAPAN
   ===================================================================== */
/* Pautan borang pendaftaran online (untuk dikongsi di WhatsApp / Instagram / poster) */
const regUrl = () => new URL('daftar.html', location.href.split('#')[0]).href;
const regCard = () => `<div class="card card-pad mb" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
  <div style="width:110px;flex:none;background:#fff;border-radius:10px;padding:6px">${qrSvg(regUrl(), { size: 98 })}</div>
  <div style="flex:1;min-width:220px"><b>Borang pendaftaran online</b><div class="muted" style="font-size:12.5px;margin-top:4px">Kongsi pautan ini kepada ibu bapa atau pelajar dewasa. Pendaftaran masuk ke <b>Pendaftaran</b> dengan status Menunggu Semakan, dan anda menerima notifikasi.</div>
  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input readonly value="${esc(regUrl())}" style="flex:1;min-width:200px" onclick="this.select()"><button type="button" class="btn sm" data-action="reg-copy">Salin pautan</button><a class="btn sm" href="${esc(regUrl())}" target="_blank" rel="noopener">Buka borang</a></div></div></div>`;
ACTIONS['reg-copy'] = async () => { try { await navigator.clipboard.writeText(regUrl()); toast('Pautan disalin'); } catch { toast(regUrl()); } };

/* ---- Notifikasi admin boleh diubah (setiap admin sendiri) ---- */
export const NOTIF_KINDS = [['booking', 'Tempahan baharu daripada ibu bapa'], ['enrolment', 'Pendaftaran online baharu'], ['payment', 'Bayaran / bukti bayaran baharu'], ['payment_ok', 'Bayaran disahkan'],
  ['renewal', 'Invois pembaharuan pakej dijana'], ['student', 'Pelajar baharu ditambah'], ['leave', 'Permohonan cuti staf']];
const myProfile = () => T('profiles').find(p => p.id === S.profile.id) || S.profile;
const notifCard = () => { const off = new Set(myProfile().notify_off || []); return `<div class="card card-pad mb"><h3 style="font-size:14.5px;margin-bottom:4px">${ic('bell', 'sm')} Notifikasi saya</h3>
  <p class="muted" style="font-size:12.5px;margin-bottom:10px">Pilih notifikasi loceng yang anda mahu terima. Setiap admin boleh pilih sendiri.</p>
  <div class="langchk" style="flex-direction:column;gap:8px">${NOTIF_KINDS.map(([k, l]) => `<label><input type="checkbox" data-on-change="notif-tog" data-key="${k}" ${off.has(k) ? '' : 'checked'}> ${l}</label>`).join('')}</div></div>`; };
const ageCard = () => `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="font-size:14.5px">Kategori umur (sesi kumpulan)</h3><button class="btn sm" data-action="age-edit">${ic('edit', 'sm')} Ubah</button></div>
  <p class="muted" style="font-size:12.5px;margin:4px 0 10px">Pelajar yang menempah / hadir sesi kumpulan diletakkan automatik ke kategori ikut umur pada tarikh sesi. Admin hanya tetapkan coach & court setiap kategori.</p>
  <div class="chips" style="margin:0">${ageGroups().map(g => `<span class="chip">${esc(g.code)} · ${g.min}–${g.max} thn</span>`).join('')}</div></div>`;
INPUTS['notif-tog'] = async (v, el) => {
  const p = myProfile(), off = new Set(p.notify_off || []), k = el.dataset.key;
  if (el.checked) off.delete(k); else off.add(k);
  const arr = [...off];
  if (S.mode === 'supabase') await rpc('set_notify_off', { p_kinds: arr });
  p.notify_off = arr; S.profile.notify_off = arr; toast('Tetapan notifikasi disimpan');
};
ACTIONS['age-edit'] = () => openModal({ title: 'Kategori umur', body: `<p class="muted" style="font-size:12.5px;margin-bottom:10px">Satu baris setiap kategori: <b>KOD, umur min, umur max</b> (cth. U12, 9, 12).</p>
  ${F('Kategori', 'rows', { type: 'textarea', full: true, value: ageGroups().map(g => `${g.code}, ${g.min}, ${g.max}`).join('\n') })}`,
  onSubmit: async d => {
    const rows = String(d.rows || '').split('\n').map(l => l.split(',').map(x => x.trim())).filter(r => r[0]).map(([code, min, max]) => ({ code, min: Number(min) || 0, max: Number(max) || 99 }));
    if (!rows.length) throw new Error('Isi sekurang-kurangnya satu kategori.');
    await saveSetting('age_groups', rows); toast('Kategori umur disimpan'); app.render();
  } });

VIEWS.tetapan = () => {
  const a = academy(), b = billing();
  return `
  ${pageHead('Tetapan', 'Profil akademi, caj dan senarai rujukan (lokasi & program).', `<span class="muted" style="font-size:12.5px">Bahasa</span>${langSwitch()}<span class="muted" style="font-size:12.5px">Tema</span>${themeSwitch()}`)}
  ${regCard()}
  ${notifCard()}
  ${ageCard()}
  <div class="grid g-2 mb">
    <div class="card card-pad"><h3 style="font-size:14.5px;margin-bottom:14px">Profil Akademi</h3>
      <div class="form-grid">
        ${F('Nama akademi (jenama)', 'name', { value: a.name, id: 'setName', full: true })}
        ${F('Nama sah syarikat / pertubuhan (seperti SSM)', 'legal_name', { value: a.legal_name, id: 'setLegal', full: true })}
        ${F('No. pendaftaran SSM', 'registration_no', { value: a.registration_no ?? 'LA0064386-M', id: 'setReg' })}
        ${F('No. TIN (LHDN)', 'tin', { value: a.tin, id: 'setTin', ph: 'cth. C1234567890' })}
        ${F('Kod MSIC', 'msic', { value: a.msic, id: 'setMsic', ph: 'cth. 85410' })}
        ${F('No. SST (jika ada)', 'sst_no', { value: a.sst_no, id: 'setSst' })}
        ${F('No. daftar Pesuruhjaya Sukan', 'sports_reg_no', { value: a.sports_reg_no, id: 'setSports', full: true, ph: 'Diperlukan ibu bapa untuk tuntutan pelepasan cukai sukan' })}
        ${F('Alamat berdaftar / alamat invois', 'address', { type: 'textarea', value: a.address, id: 'setAddr', full: true })}
        ${F('Tagline (atas invois)', 'tagline', { value: a.tagline, id: 'setTag', full: true })}
        ${F('Telefon (atas invois)', 'phones', { value: a.phones, id: 'setPhones', full: true, ph: '011-62781291 | 012-4965324' })}
        ${F('WhatsApp admin', 'whatsapp', { value: a.whatsapp, id: 'setWa', ph: '60124965324' })}
        ${F('E-mel', 'email', { value: a.email, id: 'setEmail' })}
        ${F('Instagram', 'instagram', { value: a.instagram, id: 'setIg', full: true })}
      </div><p class="muted" style="font-size:12.5px;margin-top:10px">Maklumat syarikat/TIN/SSM dipaparkan pada invois dan resit. Ibu bapa memerlukannya untuk e-invois dan tuntutan pelepasan cukai sukan.</p>
      <div style="margin-top:14px"><button class="btn primary" data-action="save-academy">Simpan Profil</button></div></div>
    <div class="card card-pad"><h3 style="font-size:14.5px;margin-bottom:14px">Bil & Polisi</h3>
      <div class="form-grid">
        ${F('Tempoh bayaran (hari selepas invois)', 'due_days', { type: 'number', min: 1, max: 60, value: b.due_days ?? 7, id: 'setDue' })}
        ${F('Notis pembatalan (jam)', 'cancel', { type: 'number', min: 0, value: b.cancel_notice_hours ?? 48, id: 'setCancel' })}
        ${F('Bank', 'bank_name', { value: b.bank_name, id: 'setBank', ph: 'cth. Maybank' })}
        ${F('No. akaun', 'bank_account', { value: b.bank_account, id: 'setAcc' })}
        ${F('Nama pemegang akaun', 'bank_holder', { value: b.bank_holder, id: 'setHolder', full: true })}
        ${F('Pautan bayaran Billplz (pilihan)', 'billplz_url', { value: b.billplz_url, id: 'setBpUrl', full: true, ph: 'cth. https://www.billplz.com/maxxima (halaman koleksi terbuka)' })}
        <label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="setQrDuit" ${b.qr_duitnow === false ? '' : 'checked'} style="width:auto;height:auto"> Papar QR DuitNow/Maybank &amp; Touch 'n Go pada invois</label>
        <label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="setQrBp" ${b.qr_billplz === false ? '' : 'checked'} style="width:auto;height:auto"> Papar QR pautan Billplz pada invois (jika pautan diisi)</label>
        <label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="setPolOn" ${b.policy_on === false ? '' : 'checked'} style="width:auto;height:auto"> Papar polisi tempahan &amp; pembatalan pada invois personal / sewa court</label>
        ${F('Teks polisi (kosongkan untuk guna teks asal)', 'policy_text', { type: 'textarea', value: b.policy_text, id: 'setPol', full: true })}
        ${F('Nota DuitNow / arahan bayaran', 'duitnow_note', { value: b.duitnow_note, id: 'setNote', full: true, ph: 'cth. DuitNow ID 012-xxx. Letak nama pelajar sebagai rujukan.' })}
      </div><p class="muted" style="font-size:12.5px;margin-top:10px">Maklumat bank dipaparkan kepada ibu bapa semasa menghantar bukti bayaran.</p><p class="muted" style="font-size:12.5px;margin-top:10px">Pembatalan lewat atau tidak hadir biasanya dikira sebagai sesi yang telah digunakan.</p>
      <div style="margin-top:14px"><button class="btn primary" data-action="save-billing">Simpan</button></div>
      <hr style="border:0;border-top:1px solid var(--line-2);margin:18px 0">
      <div class="muted" style="font-size:12.5px">Mod: <b style="color:var(--ink)">${S.mode === 'demo' ? 'Demo (data tidak disimpan)' : 'Supabase (data kekal)'}</b><br>Log masuk sebagai: <b style="color:var(--ink)">${esc(S.profile.email || S.profile.full_name)}</b></div></div>
  </div>
  <div class="grid g-2">
    <div class="card"><div class="card-head"><h3>Lokasi Latihan</h3><button class="btn sm primary" data-action="venue-add">${ic('plus', 'sm')} Tambah</button></div>
      <ul class="list">${T('venues').map(v => `<li class="list-item"><div class="kpi-ico t-info" style="display:grid;width:32px;height:32px">${ic('pin', 'sm')}</div><div class="li-main"><div class="li-title">${esc(v.name)}</div><div class="li-sub">${esc(v.area || '')} · ${T('classes').filter(c => c.venue_id === v.id && c.active).length} kelas · ${T('students').filter(s => s.venue_id === v.id && s.status === 'active').length} pelajar</div></div>${v.active ? '' : badge('paused', 'Tidak aktif')}<button class="btn sm" data-action="venue-edit" data-id="${v.id}">${ic('edit', 'sm')}</button></li>`).join('')}</ul></div>
    <div class="card"><div class="card-head"><h3>Program</h3><button class="btn sm primary" data-action="prog-add">${ic('plus', 'sm')} Tambah</button></div>
      <ul class="list">${T('programmes').slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map(p => `<li class="list-item"><div class="kpi-ico t-purple" style="display:grid;width:32px;height:32px">${ic('award', 'sm')}</div><div class="li-main"><div class="li-title">${esc(p.name)}</div><div class="li-sub">${p.kind === 'personal' ? 'Personal' : 'Kumpulan'}${p.description ? ' · ' + esc(p.description) : ''}</div></div>${p.active ? '' : badge('paused', 'Tidak aktif')}<button class="btn sm" data-action="prog-edit" data-id="${p.id}">${ic('edit', 'sm')}</button></li>`).join('')}</ul></div>
  </div>`;
};

const activeBox = on => `<label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="active" value="1" ${on ? 'checked' : ''} style="width:auto;height:auto"> Aktif</label>`;
const langBox = V => `<div class="f full">Coach mesti bertutur (kosong = tiada syarat)<div class="langchk">${LANGS_ALL.map(([k, l]) => `<label><input type="checkbox" name="required_langs" value="${k}" ${(V?.required_langs || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>`;
Object.assign(ACTIONS, {
  'save-academy': async () => { const g = i => $(i).value.trim(); await saveSetting('academy', { ...academy(), name: g('#setName'), legal_name: g('#setLegal'), registration_no: g('#setReg'), tin: g('#setTin').toUpperCase(), msic: g('#setMsic'), sst_no: g('#setSst'), sports_reg_no: g('#setSports'), address: g('#setAddr'), tagline: g('#setTag'), phones: g('#setPhones'), whatsapp: $('#setWa').value.replace(/\D/g, ''), email: g('#setEmail'), instagram: g('#setIg') }); toast('Profil disimpan'); app.render(); },
  'save-billing': async () => { await saveSetting('billing', { ...billing(), due_days: Number($('#setDue').value) || 7, cancel_notice_hours: Number($('#setCancel').value) || 0, bank_name: $('#setBank').value.trim(), bank_account: $('#setAcc').value.trim(), bank_holder: $('#setHolder').value.trim(), duitnow_note: $('#setNote').value.trim(), billplz_url: $('#setBpUrl').value.trim(), qr_duitnow: $('#setQrDuit').checked, qr_billplz: $('#setQrBp').checked, policy_on: $('#setPolOn').checked, policy_text: $('#setPol').value.trim() }); toast('Tetapan disimpan'); app.render(); },

  'venue-add': () => openModal({ title: 'Lokasi Baharu', submit: 'Tambah', body: `<div class="form-grid">${F('Nama lokasi', 'name', { req: true, full: true })}${F('Kawasan', 'area', { full: true })}${langBox(null)}</div>`, onSubmit: async d => { await insert('venues', { name: d.name.trim(), area: val(d.area), active: true, required_langs: [].concat(d.required_langs || []).filter(Boolean) }); toast('Lokasi ditambah'); app.render(); } }),
  'venue-edit': id => { const v = byId('venues', id); openModal({
    title: 'Edit Lokasi', body: `<div class="form-grid">${F('Nama lokasi', 'name', { value: v.name, req: true, full: true })}${F('Kawasan', 'area', { value: v.area, full: true })}${langBox(v)}${activeBox(v.active)}</div><div style="margin-top:14px"><button type="button" class="btn sm danger-o" data-action="venue-del" data-id="${id}">${ic('trash', 'sm')} Padam</button></div>`,
    onSubmit: async d => { await update('venues', id, { name: d.name.trim(), area: val(d.area), active: d.active === '1', required_langs: [].concat(d.required_langs || []).filter(Boolean) }); toast('Lokasi dikemas kini'); app.render(); } }); },
  'venue-del': id => confirmModal({ title: 'Padam lokasi?', message: `Semua kelas di <b>${esc(venueName(id))}</b> akan turut dipadam. Pertimbangkan "Tidak aktif" sahaja.`, ok: 'Padam', danger: true, onOk: async () => { await remove('venues', id); toast('Lokasi dipadam'); app.render(); } }),

  'prog-add': () => openModal({ title: 'Program Baharu', submit: 'Tambah', body: progForm(), onSubmit: async d => { await insert('programmes', progPatch(d)); toast('Program ditambah'); app.render(); } }),
  'prog-edit': id => openModal({
    title: 'Edit Program', body: progForm(byId('programmes', id)) + `<div style="margin-top:14px"><button type="button" class="btn sm danger-o" data-action="prog-del" data-id="${id}">${ic('trash', 'sm')} Padam</button></div>`,
    onSubmit: async d => { await update('programmes', id, progPatch(d, true)); toast('Program dikemas kini'); app.render(); } }),
  'prog-del': id => confirmModal({ title: 'Padam program?', message: 'Program yang masih digunakan oleh kelas tidak boleh dipadam — gunakan "Tidak aktif".', ok: 'Padam', danger: true, onOk: async () => { await remove('programmes', id); toast('Program dipadam'); app.render(); } }),
});
const progForm = p => `<div class="form-grid">${F('Nama program', 'name', { value: p?.name, req: true, full: true })}${F('Jenis', 'kind', { value: p?.kind || 'group', opts: [['group', 'Kumpulan'], ['personal', 'Personal']] })}${F('Susunan', 'sort', { type: 'number', value: p?.sort ?? 0 })}${F('Keterangan', 'description', { type: 'textarea', value: p?.description, full: true })}${p ? activeBox(p.active) : ''}</div>`;
const progPatch = (d, edit) => ({ name: d.name.trim(), kind: d.kind, sort: num(d.sort) || 0, description: val(d.description), active: edit ? d.active === '1' : true });
