// Perbelanjaan akademi (sewa court, gaji coach, peralatan dll.) + ringkasan kutipan vs perbelanjaan.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { insert, update, remove } from '../data.js';
import { ic, esc, F, RM, sum, num, val, UI, app, toast, openModal, confirmModal, pageHead, fmtShort, todayISO, monthKey, monthLabel } from '../ui.js';
import { T, byId, venueName, studentName } from './helpers.js';

export const EXP_CATS = [['court', 'Sewa court'], ['coach', 'Gaji / upah coach'], ['equipment', 'Peralatan'], ['shuttle', 'Bulu tangkis (shuttle)'], ['transport', 'Pengangkutan'], ['tournament', 'Kejohanan'], ['marketing', 'Pemasaran'], ['admin', 'Pentadbiran / utiliti'], ['other', 'Lain-lain']];
const CAT = Object.fromEntries(EXP_CATS);

VIEWS.perbelanjaan = () => {
  const all = T('expenses'), mk = UI.expMonth === undefined ? monthKey(todayISO()) : UI.expMonth, cat = UI.expCat || 'all', q = (UI.expQ || '').toLowerCase();
  const months = [...new Set([monthKey(todayISO()), ...all.map(e => monthKey(e.spent_on))])].sort().reverse();
  const inM = all.filter(e => !mk || monthKey(e.spent_on) === mk);
  const rows = inM.filter(e => (cat === 'all' || e.category === cat) && (!q || `${e.description} ${e.reference || ''} ${studentName(e.student_id)} ${venueName(e.venue_id)}`.toLowerCase().includes(q))).sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  const spent = sum(inM, e => e.amount), income = sum(T('payments').filter(p => p.status === 'confirmed' && (!mk || monthKey(p.paid_on) === mk)), p => p.amount);
  const byCat = EXP_CATS.map(([k, l]) => [k, l, sum(inM.filter(e => e.category === k), e => e.amount)]).filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]);
  const net = income - spent;
  return `
  ${pageHead('Perbelanjaan', 'Rekod kos operasi: sewa court, gaji coach, peralatan. Dibandingkan dengan kutipan yuran.', `<button class="btn" data-action="exp-csv">${ic('file', 'sm')} CSV</button><button class="btn primary" data-action="exp-add">${ic('plus', 'sm')} Tambah Perbelanjaan</button>`)}
  <div class="grid g-3 mb">
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Kutipan (disahkan)</span><span class="kpi-ico t-ok">${ic('trend')}</span></div><div class="kpi-val" style="color:var(--ok)">${RM(income)}</div><div class="kpi-foot">${mk ? monthLabel(mk) : 'semua bulan'}</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Perbelanjaan</span><span class="kpi-ico t-bad">${ic('wallet')}</span></div><div class="kpi-val" style="color:var(--bad)">${RM(spent)}</div><div class="kpi-foot"><b>${inM.length}</b> rekod</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Lebihan / (Kurangan) kasar</span><span class="kpi-ico t-info">${ic('tag')}</span></div><div class="kpi-val" style="color:${net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${net < 0 ? '-' : ''}${RM(Math.abs(net))}</div><div class="kpi-foot">kutipan tolak perbelanjaan</div></div>
  </div>
  ${byCat.length ? `<div class="card card-pad mb"><b style="font-size:13.5px">Mengikut kategori</b>${byCat.map(([k, l, v]) => `<div style="display:flex;align-items:center;gap:10px;margin-top:9px;font-size:13px"><span style="width:170px">${esc(l)}</span><div class="bar" style="flex:1"><span style="width:${Math.round(v / spent * 100)}%;background:var(--brand,#5b3cc4)"></span></div><b class="num" style="width:96px;text-align:right">${RM(v)}</b></div>`).join('')}</div>` : ''}
  <div class="card">
    <div class="toolbar">
      <label class="field grow">${ic('search', 'sm')}<input data-on-input="exp-q" placeholder="Cari keterangan, rujukan, pelajar…" value="${esc(UI.expQ || '')}"></label>
      <label class="field"><select data-on-change="exp-month"><option value="">Semua bulan</option>${months.map(m => `<option value="${m}" ${mk === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></label>
      <label class="field"><select data-on-change="exp-cat"><option value="all">Semua kategori</option>${EXP_CATS.map(([k, l]) => `<option value="${k}" ${cat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Tarikh</th><th>Kategori</th><th>Keterangan</th><th>Rujukan</th><th>Amaun</th><th></th></tr></thead>
    <tbody>${rows.map(e => `<tr><td class="num">${fmtShort(e.spent_on)}</td><td><span class="badge b-muted">${esc(CAT[e.category] || e.category)}</span></td>
      <td>${esc(e.description)}<div class="muted" style="font-size:12px">${[e.venue_id && venueName(e.venue_id), e.student_id && 'untuk ' + studentName(e.student_id), e.staff_id && byId('staff', e.staff_id)?.full_name].filter(Boolean).map(esc).join(' · ')}</div></td>
      <td class="muted">${esc(e.reference || '')}</td><td class="num"><b>${RM(e.amount)}</b></td>
      <td style="white-space:nowrap"><button class="btn sm" data-action="exp-edit" data-id="${e.id}">${ic('edit', 'sm')}</button> <button class="btn sm danger-o" data-action="exp-del" data-id="${e.id}">${ic('trash', 'sm')}</button></td></tr>`).join('') || `<tr><td colspan="6" class="empty">Tiada perbelanjaan${mk ? ' untuk ' + monthLabel(mk) : ''}. Tekan <b>Tambah Perbelanjaan</b> untuk rekod sewa court dan kos lain.</td></tr>`}</tbody></table></div>
  </div>`;
};
Object.assign(INPUTS, { 'exp-q': v => { UI.expQ = v; app.render(); }, 'exp-month': v => { UI.expMonth = v; app.render(); }, 'exp-cat': v => { UI.expCat = v; app.render(); } });

const form = (e = {}) => {
  const studs = T('students').filter(s => s.status !== 'left' || s.id === e.student_id).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return `<div class="form-grid">
    ${F('Tarikh', 'spent_on', { type: 'date', value: e.spent_on || todayISO(), req: true })}
    ${F('Kategori', 'category', { value: e.category || 'court', opts: EXP_CATS })}
    ${F('Keterangan', 'description', { value: e.description, req: true, full: true, ph: 'cth. Sewa court Bukit Puchong 2 jam' })}
    ${F('Amaun (RM)', 'amount', { type: 'number', step: '0.01', min: 0, value: e.amount, req: true })}
    ${F('No. rujukan / tempahan', 'reference', { value: e.reference })}
    ${F('Lokasi', 'venue_id', { value: e.venue_id || '', opts: [['', '—'], ...T('venues').map(v => [v.id, v.name])] })}
    ${F('Untuk pelajar (pilihan)', 'student_id', { value: e.student_id || '', opts: [['', '—'], ...studs.map(s => [s.id, s.full_name + (s.fee_exempt ? ' (tiada yuran)' : '')])] })}
    ${F('Staf / coach (pilihan)', 'staff_id', { value: e.staff_id || '', opts: [['', '—'], ...T('staff').filter(s => s.active !== false).map(s => [s.id, s.full_name])], full: true })}
    ${F('Catatan', 'notes', { type: 'textarea', value: e.notes, full: true })}
  </div>`;
};
const patch = d => ({ spent_on: d.spent_on, category: d.category, description: d.description.trim(), amount: Number(d.amount), reference: val(d.reference), venue_id: val(d.venue_id), student_id: val(d.student_id), staff_id: val(d.staff_id), notes: val(d.notes) });

Object.assign(ACTIONS, {
  'exp-add': () => openModal({ title: 'Tambah Perbelanjaan', submit: 'Simpan', wide: true, body: form(), onSubmit: async d => { await insert('expenses', patch(d)); toast('Perbelanjaan direkod'); app.render(); } }),
  'exp-edit': id => openModal({ title: 'Edit Perbelanjaan', submit: 'Simpan', wide: true, body: form(byId('expenses', id)), onSubmit: async d => { await update('expenses', id, patch(d)); toast('Perbelanjaan dikemas kini'); app.render(); } }),
  'exp-del': id => confirmModal({ title: 'Padam perbelanjaan?', message: `<b>${esc(byId('expenses', id).description)}</b> (${RM(byId('expenses', id).amount)}) akan dipadam.`, ok: 'Padam', danger: true, onOk: async () => { await remove('expenses', id); toast('Dipadam'); app.render(); } }),
  'exp-csv': () => {
    const mk = UI.expMonth === undefined ? monthKey(todayISO()) : UI.expMonth, rows = T('expenses').filter(e => !mk || monthKey(e.spent_on) === mk).sort((a, b) => a.spent_on.localeCompare(b.spent_on));
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, csv = ['Tarikh,Kategori,Keterangan,Rujukan,Lokasi,Pelajar,Amaun', ...rows.map(e => [e.spent_on, CAT[e.category], e.description, e.reference, e.venue_id && venueName(e.venue_id), e.student_id && studentName(e.student_id), e.amount].map(q).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `perbelanjaan-${(mk || 'semua').slice(0, 7)}.csv`; a.click();
  },
});
