// Coach dan HR & Staf.
import { VIEWS, ACTIONS } from '../registry.js';
import { S, insert, update, remove } from '../data.js';
import { ic, esc, F, RM, sum, num, val, badge, avatar, app, toast, openModal, confirmModal, pageHead, fmtShort, fmtDate, todayISO, LABEL, DAYS, hm } from '../ui.js';
import { T, byId, venueName, progName, staffName, classHours, enrolledIn } from './helpers.js';

const thisMonth = () => todayISO().slice(0, 7);

/** Jam mengajar bulan ini (sesi yang telah selesai) bagi seorang staf. */
function hoursThisMonth(staffId) {
  return sum(T('class_sessions').filter(s => s.status === 'held' && s.session_date.startsWith(thisMonth())), s => {
    const c = byId('classes', s.class_id); return c && (s.coach_id || c.coach_id) === staffId ? classHours(c) : 0;
  });
}

/* =====================================================================
   COACH
   ===================================================================== */
VIEWS.coach = () => {
  const coaches = T('staff').filter(s => s.active && (/jurulatih|coach/i.test(s.position) || T('classes').some(c => c.coach_id === s.id)));
  return `
  ${pageHead('Coach', `${coaches.length} jurulatih aktif`, `<a class="btn" href="#hr">${ic('briefcase', 'sm')} HR & Gaji</a><button class="btn primary" data-action="staff-add">${ic('plus', 'sm')} Tambah Staf</button>`)}
  <div class="grid g-3">${coaches.map(c => {
    const cls = T('classes').filter(k => k.active && k.coach_id === c.id), hrs = sum(cls, classHours);
    const studs = new Set(cls.flatMap(k => enrolledIn(k.id).map(e => e.student_id)));
    const venues = [...new Set(cls.map(k => venueName(k.venue_id)))];
    const acct = c.profile_id ? byId('profiles', c.profile_id) : null;
    return `<div class="card coach-card">
      <div class="coach-top">${avatar(c.full_name, 'lg')}<div style="flex:1;min-width:0"><h4>${esc(c.full_name)}</h4><div class="muted" style="font-size:12.5px">${esc(c.position)}${c.certification ? ' · ' + esc(c.certification) : ''}</div></div><button class="btn sm" data-action="staff-edit" data-id="${c.id}">${ic('edit', 'sm')}</button></div>
      <div class="stats3"><div><b>${cls.length}</b><small>Kelas/minggu</small></div><div><b>${Math.round(hrs * 10) / 10}</b><small>Jam/minggu</small></div><div><b>${studs.size}</b><small>Pelajar</small></div></div>
      <div class="muted" style="font-size:12.5px;display:flex;gap:8px;align-items:flex-start">${ic('pin', 'sm')}<span>${venues.length ? esc(venues.join(', ')) : 'Belum ada kelas'}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center">${acct ? `<span class="badge b-ok">Akaun portal aktif</span>` : `<span class="badge b-muted">Belum ada akaun portal</span>`}${c.phone ? `<span class="muted" style="font-size:12.5px">${esc(c.phone)}</span>` : ''}</div>
    </div>`; }).join('') || `<div class="card empty" style="grid-column:1/-1">Belum ada coach.</div>`}</div>`;
};

/* =====================================================================
   HR & STAF
   ===================================================================== */
VIEWS.hr = () => {
  const staff = T('staff').slice().sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name));
  const est = s => (s.pay_rate == null ? null : s.pay_basis === 'hourly' ? hoursThisMonth(s.id) * Number(s.pay_rate) : s.pay_basis === 'monthly' ? Number(s.pay_rate) : null);
  const totalEst = sum(staff.filter(s => s.active), s => est(s) ?? 0);
  const leaves = T('leave_requests').slice().sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.from_date.localeCompare(a.from_date));
  return `
  ${pageHead('HR & Staf', 'Maklumat kakitangan, kadar bayaran dan permohonan cuti.', `<button class="btn" data-action="leave-add">${ic('calendar', 'sm')} Rekod Cuti</button><button class="btn primary" data-action="staff-add">${ic('plus', 'sm')} Tambah Staf</button>`)}
  <div class="grid g-3 mb">
    <div class="card kpi hero"><div class="kpi-top"><span class="kpi-label">Staf Aktif</span><span class="kpi-ico">${ic('briefcase')}</span></div><div class="kpi-val">${staff.filter(s => s.active).length}</div><div class="kpi-foot">${staff.filter(s => s.active && s.employment_type === 'full_time').length} sepenuh masa · ${staff.filter(s => s.active && s.employment_type === 'part_time').length} sambilan</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Anggaran Gaji Bulan Ini</span><span class="kpi-ico t-info">${ic('wallet')}</span></div><div class="kpi-val">${RM(totalEst)}</div><div class="kpi-foot">hanya staf yang kadar gajinya telah diisi</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Cuti Menunggu</span><span class="kpi-ico t-purple">${ic('calendar')}</span></div><div class="kpi-val">${leaves.filter(l => l.status === 'pending').length}</div><div class="kpi-foot">memerlukan kelulusan</div></div>
  </div>
  <div class="grid g-2">
    <div class="card"><div class="card-head"><h3>Kakitangan</h3><span class="sub">Anggaran sahaja — bukan slip gaji</span></div><div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Jawatan</th><th>Jenis</th><th>Kadar</th><th>Jam (bulan ini)</th><th>Anggaran</th><th></th></tr></thead>
      <tbody>${staff.map(s => `<tr style="${s.active ? '' : 'opacity:.55'}">
        <td><div class="cell-person">${avatar(s.full_name)}<div><b>${esc(s.full_name)}</b>${s.active ? '' : '<span>Tidak aktif</span>'}</div></div></td>
        <td>${esc(s.position)}</td><td>${s.employment_type ? badge(s.employment_type) : '—'}</td>
        <td class="num">${s.pay_rate == null ? '<span class="muted">—</span>' : RM(s.pay_rate) + (s.pay_basis === 'hourly' ? ' / jam' : ' / bulan')}</td>
        <td class="num">${Math.round(hoursThisMonth(s.id) * 10) / 10}</td>
        <td class="num">${est(s) == null ? '<span class="muted">—</span>' : '<b>' + RM(est(s)) + '</b>'}</td>
        <td><button class="btn sm" data-action="staff-edit" data-id="${s.id}">${ic('edit', 'sm')}</button></td></tr>`).join('')}</tbody>
    </table></div></div>
    <div class="card"><div class="card-head"><h3>Permohonan Cuti</h3></div>
      <ul class="list">${leaves.map(v => `<li class="list-item" style="flex-wrap:wrap">
        ${avatar(staffName(v.staff_id))}<div class="li-main"><div class="li-title">${esc(staffName(v.staff_id))} · ${esc(v.leave_type)}</div><div class="li-sub">${fmtShort(v.from_date)}${v.to_date !== v.from_date ? ' – ' + fmtShort(v.to_date) : ''}${v.note ? ' · ' + esc(v.note) : ''}</div></div>
        ${v.status === 'pending' ? `<div class="actions"><button class="btn sm" data-action="leave-decide" data-id="${v.id}|rejected">Tolak</button><button class="btn sm primary" data-action="leave-decide" data-id="${v.id}|approved">Lulus</button></div>` : badge(v.status)}
        <button class="btn sm danger-o" data-action="leave-del" data-id="${v.id}" title="Padam rekod cuti">${ic('trash', 'sm')}</button>
      </li>`).join('') || '<li class="empty">Tiada permohonan cuti.</li>'}</ul></div>
  </div>`;
};

const staffForm = s => `<div class="form-grid">
  ${F('Nama penuh', 'full_name', { value: s?.full_name, req: true, full: true })}
  ${F('Jawatan', 'position', { value: s?.position || 'Jurulatih', req: true })}
  ${F('Telefon', 'phone', { value: s?.phone })}
  ${F('Jenis pekerjaan', 'employment_type', { value: s?.employment_type || '', opts: [['', '—'], ['full_time', 'Sepenuh masa'], ['part_time', 'Sambilan']] })}
  ${F('Asas bayaran', 'pay_basis', { value: s?.pay_basis || '', opts: [['', '—'], ['monthly', 'Bulanan'], ['hourly', 'Per jam']] })}
  ${F('Kadar (RM)', 'pay_rate', { type: 'number', step: '0.01', min: 0, value: s?.pay_rate ?? '' })}
  ${F('Sijil / kelayakan', 'certification', { value: s?.certification })}
  ${s ? `<label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="active" value="1" ${s.active ? 'checked' : ''} style="width:auto;height:auto"> Staf aktif</label>` : ''}
</div>`;
const staffPatch = (d, edit) => ({ full_name: d.full_name.trim(), position: d.position, phone: val(d.phone), employment_type: val(d.employment_type), pay_basis: val(d.pay_basis), pay_rate: num(d.pay_rate), certification: val(d.certification), active: edit ? d.active === '1' : true });

Object.assign(ACTIONS, {
  'staff-add': () => openModal({ title: 'Tambah Staf', submit: 'Tambah', body: staffForm(), onSubmit: async d => { await insert('staff', staffPatch(d)); toast('Staf ditambah'); app.render(); } }),
  'staff-edit': id => openModal({
    title: 'Edit Staf', body: staffForm(byId('staff', id)) + `<div style="margin-top:14px"><button type="button" class="btn sm danger-o" data-action="staff-del" data-id="${id}">${ic('trash', 'sm')} Padam staf</button></div>`,
    onSubmit: async d => { await update('staff', id, staffPatch(d, true)); toast('Staf dikemas kini'); app.render(); },
  }),
  'staff-del': id => confirmModal({ title: 'Padam staf?', message: `Kelas yang dikendalikan <b>${esc(staffName(id))}</b> akan tinggal tanpa coach. Pertimbangkan menyahaktifkan staf sahaja.`, ok: 'Padam', danger: true, onOk: async () => { await remove('staff', id); toast('Staf dipadam'); app.render(); } }),

  'leave-add': () => openModal({
    title: 'Rekod Cuti', submit: 'Simpan',
    body: `<div class="form-grid">
      ${F('Staf', 'staff_id', { req: true, full: true, opts: [['', '— Pilih —'], ...T('staff').filter(s => s.active).map(s => [s.id, s.full_name])] })}
      ${F('Jenis cuti', 'leave_type', { opts: ['Cuti Tahunan', 'Cuti Sakit', 'Cuti Kecemasan', 'Cuti Tanpa Gaji'], full: true })}
      ${F('Dari', 'from_date', { type: 'date', value: todayISO(), req: true })}
      ${F('Hingga', 'to_date', { type: 'date', value: todayISO(), req: true })}
      ${F('Catatan', 'note', { full: true })}</div>`,
    onSubmit: async d => {
      if (d.to_date < d.from_date) throw new Error('Tarikh tamat mesti selepas tarikh mula.');
      await insert('leave_requests', { staff_id: d.staff_id, leave_type: d.leave_type, from_date: d.from_date, to_date: d.to_date, note: val(d.note), status: 'approved', decided_by: S.mode === 'demo' ? null : S.profile.id }); toast('Cuti direkod'); app.render();
    },
  }),
  'leave-del': id => confirmModal({ title: 'Padam rekod cuti?', message: 'Rekod cuti ini akan dipadam.', ok: 'Padam', danger: true, onOk: async () => { await remove('leave_requests', id); toast('Rekod cuti dipadam'); app.render(); } }),
  'leave-decide': async key => { const [id, st] = key.split('|'); await update('leave_requests', id, { status: st, decided_by: S.mode === 'demo' ? null : S.profile.id }); toast(st === 'approved' ? 'Cuti diluluskan' : 'Cuti ditolak'); app.render(); },
});
