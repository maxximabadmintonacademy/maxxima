// v29: Penalti coach (lewat / tidak hadir / batal lewat) — semakan admin, rayuan, tetapan; ditolak dalam gaji.
import { ACTIONS, INPUTS } from '../registry.js';
import { S, update, saveSetting } from '../data.js';
import { esc, UI, app, toast, openModal, F, fmtShort, RM, todayISO } from '../ui.js';
import { T, staffName } from './helpers.js';
import { CK_TABS } from './v26.js';

export const PEN_KIND = { late: 'Lewat', no_show: 'Tidak hadir', late_cancel: 'Batal lewat', other: 'Lain-lain' };
export const PEN_ST = { pending: ['Menunggu semakan', 'b-warn'], approved: ['Disahkan', 'b-bad'], waived: ['Dikecualikan', 'b-muted'], appealed: ['Rayuan', 'b-info'] };
export const penCfg = () => ({ enabled: true, warn_first: true, late_after_start_min: 0, late_cancel_hours: 24, full_time: { late: 50, no_show: 100, late_cancel: 0 }, part_time: { late: 10, no_show: 30, late_cancel: 0 },
  ...((S.t.settings || []).find(x => x.key === 'penalty')?.value || {}) });
const ckCfg = () => ({ alert: true, coach_nudge_min: 20, admin_alert_min: 10, ...((S.t.settings || []).find(x => x.key === 'checkin')?.value || {}) });
/** Jumlah penalti disahkan untuk coach dalam bulan (YYYY-MM). */
export const penaltyTotal = (staffId, M) => T('coach_penalties').filter(p => p.staff_id === staffId && p.status === 'approved' && (p.session_date || '').startsWith(M)).reduce((n, p) => n + Number(p.amount || 0), 0);

CK_TABS.penalti = () => penTab();

function penTab() {
  const M = UI.penM || todayISO().slice(0, 7), c = penCfg(), k = ckCfg();
  const L = T('coach_penalties').filter(x => (x.session_date || '').startsWith(M) || ['pending', 'appealed'].includes(x.status)).sort((a, b) => (['pending', 'appealed'].includes(b.status) - ['pending', 'appealed'].includes(a.status)) || (b.created_at || '').localeCompare(a.created_at || ''));
  const by = {}; T('coach_penalties').filter(x => x.status === 'approved' && (x.session_date || '').startsWith(M)).forEach(x => { by[x.staff_id] = (by[x.staff_id] || 0) + Number(x.amount); });
  return `<div class="card card-pad mb" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between">
    <div style="font-size:13px;line-height:1.7"><b>Peraturan semasa</b>${c.enabled ? '' : ' <span class="badge b-muted">dimatikan</span>'}<br>
      Lewat = check in selepas sesi bermula${c.late_after_start_min ? ` + ${c.late_after_start_min} min` : ''}. Sasaran: check in ${k.admin_alert_min} min sebelum sesi.<br>
      Sepenuh masa: lewat ${RM(c.full_time.late)} · tidak hadir ${RM(c.full_time.no_show)}${c.full_time.late_cancel ? ` · batal lewat ${RM(c.full_time.late_cancel)}` : ''}<br>
      Sambilan: lewat ${RM(c.part_time.late)} · tidak hadir ${RM(c.part_time.no_show)}${c.part_time.late_cancel ? ` · batal lewat ${RM(c.part_time.late_cancel)}` : ''}${c.warn_first ? '<br>Lewat pertama setiap bulan = amaran sahaja.' : ''}</div>
    <div class="actions"><input type="month" value="${M}" data-on-change="pen-m" class="btn"><button class="btn" data-action="pen-cfg">Tetapan penalti</button><button class="btn" data-action="pen-add">+ Rekod manual</button></div></div>
  ${Object.keys(by).length ? `<div class="kv-mini mb">${Object.entries(by).map(([id, a]) => `<div><b>${RM(a)}</b><small>${esc(staffName(id))}</small></div>`).join('')}</div>` : ''}
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Tarikh</th><th>Coach</th><th>Jenis</th><th>Butiran</th><th class="num">Amaun</th><th>Status</th><th></th></tr></thead><tbody>
  ${L.map(x => { const [l, b] = PEN_ST[x.status] || [x.status, 'b-muted'];
    return `<tr><td style="white-space:nowrap">${fmtShort(x.session_date)}</td><td><b>${esc(staffName(x.staff_id))}</b></td><td>${PEN_KIND[x.kind] || x.kind}${x.minutes ? ` <span class="muted">(${x.minutes} min)</span>` : ''}</td>
      <td style="font-size:12.5px;max-width:320px">${esc(x.note || '')}${x.appeal ? `<div style="margin-top:4px"><b>Rayuan:</b> ${esc(x.appeal)}</div>` : ''}</td><td class="num"><b>${RM(x.amount)}</b></td><td><span class="badge ${b}">${l}</span></td>
      <td style="white-space:nowrap">${x.status === 'approved' || x.status === 'waived' ? `<button class="btn sm" data-action="pen-edit" data-id="${x.id}">Ubah</button>` : `<button class="btn sm primary" data-action="pen-ok" data-id="${x.id}">Sahkan</button> <button class="btn sm" data-action="pen-waive" data-id="${x.id}">Kecualikan</button> <button class="btn sm" data-action="pen-edit" data-id="${x.id}">Ubah</button>`}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Tiada rekod penalti.</td></tr>'}</tbody></table></div></div>
  <p class="muted" style="font-size:12px;margin-top:8px">Penalti "Disahkan" ditolak dalam Gaji Coach bulan berkenaan. Semak rayuan sebelum mengesahkan (cth. kemalangan, kecemasan, coach sebenarnya hadir tetapi terlupa check in).</p>`;
}

Object.assign(ACTIONS, {
  'pen-ok': async id => { await update('coach_penalties', id, { status: 'approved', decided_at: new Date().toISOString(), decided_by: S.profile.id }); toast('Penalti disahkan — ditolak dalam gaji'); app.render(); },
  'pen-waive': id => openModal({ title: 'Kecualikan penalti', submit: 'Kecualikan', body: `<label class="f full">Sebab<input name="r" placeholder="cth. kemalangan, coach hadir tetapi telefon rosak"></label>`,
    onSubmit: async d => { const x = T('coach_penalties').find(p => p.id === id); await update('coach_penalties', id, { status: 'waived', note: [x.note, d.r ? 'Dikecualikan: ' + d.r : ''].filter(Boolean).join(' — '), decided_at: new Date().toISOString(), decided_by: S.profile.id }); toast('Dikecualikan'); app.render(); } }),
  'pen-edit': id => { const x = T('coach_penalties').find(p => p.id === id);
    openModal({ title: 'Ubah penalti', submit: 'Simpan', body: `<div class="form-grid">${F('Amaun (RM)', 'amount', { type: 'number', value: x.amount })}${F('Status', 'status', { value: x.status, opts: Object.entries(PEN_ST).map(([k, v]) => [k, v[0]]) })}${F('Catatan', 'note', { value: x.note, full: true })}</div>`,
      onSubmit: async d => { await update('coach_penalties', id, { amount: Number(d.amount) || 0, status: d.status, note: d.note, decided_at: new Date().toISOString(), decided_by: S.profile.id }); toast('Disimpan'); app.render(); } }); },
  'pen-add': () => openModal({ title: 'Rekod penalti manual', submit: 'Simpan', body: `<div class="form-grid">${F('Coach', 'staff_id', { opts: T('staff').filter(s => s.active).map(s => [s.id, s.full_name]), full: true })}
      ${F('Tarikh', 'date', { type: 'date', value: todayISO() })}${F('Jenis', 'kind', { opts: Object.entries(PEN_KIND) })}${F('Amaun (RM)', 'amount', { type: 'number', value: 0 })}${F('Butiran', 'note', { full: true, ph: 'cth. guna telefon semasa sesi (aduan ibu bapa)' })}</div>`,
    onSubmit: async d => { const { insert } = await import('../data.js'); await insert('coach_penalties', { staff_id: d.staff_id, session_date: d.date, kind: d.kind, amount: Number(d.amount) || 0, note: d.note, status: 'approved', decided_at: new Date().toISOString(), decided_by: S.profile.id }); toast('Direkod'); app.render(); } }),
  'pen-cfg': () => { const c = penCfg(), k = ckCfg();
    openModal({ title: 'Tetapan penalti & amaran check in', wide: true, submit: 'Simpan', body: `<div class="form-grid">
      <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="enabled" value="1" ${c.enabled ? 'checked' : ''} style="width:auto;height:auto"> Penalti automatik dihidupkan</label>
      <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="warn_first" value="1" ${c.warn_first ? 'checked' : ''} style="width:auto;height:auto"> Lewat pertama setiap bulan = amaran sahaja (RM0)</label>
      ${F('Peringatan kepada coach (minit sebelum sesi)', 'nudge', { type: 'number', value: k.coach_nudge_min })}${F('Amaran kepada admin jika belum check in (minit sebelum sesi)', 'alert', { type: 'number', value: k.admin_alert_min })}
      ${F('Dikira lewat jika check in selepas sesi bermula + (minit)', 'grace', { type: 'number', value: c.late_after_start_min })}${F('"Tidak dapat hadir" kurang dari (jam) = batal lewat', 'lch', { type: 'number', value: c.late_cancel_hours })}
      <div class="f full"><b style="font-size:13px">Coach sepenuh masa (RM)</b></div>${F('Lewat', 'ft_late', { type: 'number', value: c.full_time.late })}${F('Tidak hadir', 'ft_ns', { type: 'number', value: c.full_time.no_show })}${F('Batal lewat', 'ft_lc', { type: 'number', value: c.full_time.late_cancel })}
      <div class="f full"><b style="font-size:13px">Coach sambilan / ikut sesi (RM)</b></div>${F('Lewat', 'pt_late', { type: 'number', value: c.part_time.late })}${F('Tidak hadir', 'pt_ns', { type: 'number', value: c.part_time.no_show })}${F('Batal lewat', 'pt_lc', { type: 'number', value: c.part_time.late_cancel })}</div>
      <p class="muted" style="font-size:12px;margin-top:10px">Semua penalti automatik bermula sebagai "Menunggu semakan". Admin sahkan atau kecualikan; coach boleh merayu dalam app.</p>`,
      onSubmit: async d => { const n = v => Math.max(0, Number(v) || 0);
        await saveSetting('penalty', { ...c, enabled: d.enabled === '1', warn_first: d.warn_first === '1', late_after_start_min: n(d.grace), late_cancel_hours: n(d.lch) || 24,
          full_time: { late: n(d.ft_late), no_show: n(d.ft_ns), late_cancel: n(d.ft_lc) }, part_time: { late: n(d.pt_late), no_show: n(d.pt_ns), late_cancel: n(d.pt_lc) } });
        await saveSetting('checkin', { ...k, coach_nudge_min: n(d.nudge) || 20, admin_alert_min: n(d.alert) || 10 }); toast('Tetapan disimpan'); app.render(); } }); },
});
INPUTS['pen-m'] = v => { if (v) { UI.penM = v; app.render(); } };
