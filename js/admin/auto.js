// v21: Jana invois bulanan, peringatan bayaran, gaji coach.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, rpc, loadRange } from '../data.js';
import { ic, esc, F, RM, UI, app, toast, openModal, confirmModal, pageHead, todayISO, addDays, monthKey, monthLabel, fmtShort } from '../ui.js';
import { T, byId, progName, studentName, staffName, billing, EXTRA_TASKS } from './helpers.js';
import { sellPackage } from './finance.js';
import { itemsOf, saveItems, lineAmount } from './invoice-items.js';
import { sTime, sHours, isPersonal, groupsOf, sCoach } from './sessions.js';

/* =====================================================================
   JANA INVOIS BULANAN
   ===================================================================== */
const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
export const defaultRunMonth = () => { const t = todayISO(); return Number(t.slice(8, 10)) >= 20 ? nextMonth(t.slice(0, 7)) : t.slice(0, 7); };
const spInvMonth = sp => (byId('invoices', sp.invoice_id)?.issued_on || sp.created_at || '').slice(0, 7);

/** Calon invois bulan M: pakej terkini setiap pelajar+program yang belum dibil untuk bulan M. */
export function monthlyCandidates(M) {
  const out = [];
  for (const st of T('students').filter(s => s.status === 'active')) {
    const sps = T('student_packages').filter(p => p.student_id === st.id);
    for (const prog of [...new Set(sps.map(p => p.programme_id))]) {
      const L = sps.filter(p => p.programme_id === prog).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      if (L.some(p => p.status === 'pending')) continue;                                // invois belum dibayar sudah ada
      if (L.some(p => spInvMonth(p) === M)) continue;                                   // sudah dibil untuk bulan ini
      const last = L.find(p => ['active', 'completed', 'expired'].includes(p.status)); if (!last) continue;
      if (last.status === 'expired' && last.expires_on && last.expires_on < addDays(todayISO(), -45)) continue;   // sudah lama berhenti
      const kind = byId('programmes', prog)?.kind;
      if (st.fee_exempt && kind !== 'personal') continue;                               // tajaan: latihan kumpulan percuma
      const pkg = byId('packages', last.package_id), price = Number(pkg?.price ?? last.price ?? 0);
      const adj = T('billing_adjustments').filter(a => a.status === 'pending' && a.student_id === st.id && (!a.apply_month || a.apply_month <= M));
      const adjSum = adj.reduce((n, a) => n + (a.kind === 'credit' ? -1 : 1) * Number(a.amount), 0);
      out.push({ st, sp: last, pkg, price, adj, total: Math.max(price + adjSum, 0), fixed: last.schedule_mode !== 'flexible' });
    }
  }
  return out.sort((a, b) => a.st.full_name.localeCompare(b.st.full_name));
}
async function runOne(x, due) {
  const pkg = x.pkg || { id: x.sp.package_id, name: x.sp.name, programme_id: x.sp.programme_id, sessions: x.sp.sessions_total, unit: x.sp.unit, valid_days: x.sp.valid_days, schedule_mode: x.sp.schedule_mode };
  const inv = await sellPackage({ studentId: x.st.id, pkg, price: x.price, mode: x.sp.schedule_mode || 'fixed', due });
  const neu = T('student_packages').find(p => p.invoice_id === inv.id);
  if (neu) await update('student_packages', neu.id, { renewal_of: x.sp.id });
  await update('student_packages', x.sp.id, { renewal_sent: true });
  if (x.adj.length) {
    const items = itemsOf(inv.id).map(i => ({ ...i }));
    let total = items.reduce((n, i) => n + Number(i.amount), 0); const used = [];
    for (const a of x.adj) {
      const it = { kind: a.kind === 'credit' ? 'credit' : 'other', description: (a.kind === 'credit' ? 'Kredit: ' : 'Caj: ') + a.reason, unit: 'unit', qty: 1, unit_price: Number(a.amount), discount: 0, student_id: a.student_id };
      it.amount = lineAmount(it); if (total + it.amount < 0) continue;
      total += it.amount; items.push(it); used.push(a);
    }
    await saveItems(inv.id, items);
    for (const a of used) await update('billing_adjustments', a.id, { status: 'applied', invoice_id: inv.id, applied_at: new Date().toISOString() });
  }
  return inv;
}
Object.assign(ACTIONS, {
  'inv-monthly': () => {
    const M = UI.runMonth || defaultRunMonth(), L = monthlyCandidates(M), due = `${M}-${String(Math.min(Number(billing().due_days ?? 7), 28)).padStart(2, '0')}`;
    const f = openModal({ title: 'Jana Invois Bulanan', submit: `Jana invois`, wide: true, body: `<div class="form-grid">
      ${F('Bulan invois', 'month', { type: 'month', value: M, req: true })}${F('Tarikh akhir bayaran', 'due', { type: 'date', value: due < todayISO() ? addDays(todayISO(), 7) : due, req: true })}</div>
      <p class="muted" style="font-size:12.5px;margin:10px 0">Pakej terkini setiap pelajar aktif yang belum dibil untuk ${esc(monthLabel(M + '-01'))}. Harga ikut katalog pakej semasa. Pelarasan bil (kredit/caj) yang tertunda dimasukkan terus. Pelajar tajaan tidak dibil untuk latihan kumpulan. Jadual fleksibel tidak ditanda secara lalai.</p>
      <div style="display:flex;gap:8px;margin-bottom:8px"><button type="button" class="btn sm" id="imAll">Tanda semua</button><button type="button" class="btn sm" id="imNone">Kosongkan</button><span class="muted" id="imSum" style="font-size:13px;align-self:center"></span></div>
      <div style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:10px"><table class="table"><thead><tr><th></th><th>Pelajar</th><th>Pakej</th><th class="num">Harga</th><th>Pelarasan</th><th class="num">Jumlah</th></tr></thead><tbody>
      ${L.map((x, i) => `<tr><td><input type="checkbox" name="pick" value="${i}" ${x.fixed ? 'checked' : ''} style="width:auto;height:auto"></td><td>${esc(x.st.full_name)}</td><td>${esc(x.sp.name)}<div class="muted" style="font-size:11.5px">${esc(progName(x.sp.programme_id))} · ${x.fixed ? 'tetap' : 'fleksibel'} · terakhir ${esc(spInvMonth(x.sp) || '—')}</div></td><td class="num">${RM(x.price)}</td><td style="font-size:12px">${x.adj.map(a => `${a.kind === 'credit' ? '−' : '+'}${RM(a.amount)} ${esc(a.reason)}`).join('<br>') || '—'}</td><td class="num"><b>${RM(x.total)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Tiada calon — semua pelajar sudah dibil untuk bulan ini.</td></tr>'}
      </tbody></table></div>`,
      onSubmit: async d => {
        if (d.month !== M) { UI.runMonth = d.month; setTimeout(() => ACTIONS['inv-monthly'](), 0); return; }
        const picks = [].concat(d.pick || []).map(Number).map(i => L[i]).filter(Boolean);
        if (!picks.length) throw new Error('Tiada pelajar dipilih.');
        let n = 0, tot = 0;
        for (const x of picks) { const inv = await runOne(x, d.due); n++; tot += Number(byId('invoices', inv.id)?.amount || 0); }
        toast(`${n} invois dijana · jumlah ${RM(tot)}`); UI.invMonth = ''; app.render();
      } });
    const sumUp = () => { const ps = [...f.querySelectorAll('[name=pick]:checked')].map(x => L[Number(x.value)]); f.querySelector('#imSum').textContent = `${ps.length} dipilih · ${RM(ps.reduce((n, x) => n + x.total, 0))}`; };
    f.addEventListener('change', e => { if (e.target.name === 'month') { UI.runMonth = e.target.value; f.querySelector('[data-action=close-modal]')?.click(); setTimeout(() => ACTIONS['inv-monthly'](), 0); } else sumUp(); });
    f.querySelector('#imAll').onclick = () => { f.querySelectorAll('[name=pick]').forEach(x => { x.checked = true; }); sumUp(); };
    f.querySelector('#imNone').onclick = () => { f.querySelectorAll('[name=pick]').forEach(x => { x.checked = false; }); sumUp(); };
    sumUp();
  },
  'remind-run': async () => {
    if (S.mode !== 'supabase') return toast('Mod demo: peringatan dihantar kepada ibu bapa yang ada akaun (simulasi).');
    try { const n = await rpc('run_daily_reminders'); toast(n ? `${n} peringatan dihantar ke portal ibu bapa` : 'Tiada invois yang perlu diingatkan hari ini'); }
    catch (e) { toast(e.message, true); }
  },
});
EXTRA_TASKS.push(add => {
  const d = Number(todayISO().slice(8, 10)); if (d < 22) return;
  const M = defaultRunMonth(), n = monthlyCandidates(M).filter(x => x.fixed).length;
  add(n, 'wallet', 't-warn', `{n} pelajar belum dibil untuk ${monthLabel(M + '-01')} — tekan "Jana Invois Bulanan" di Invois & Bayaran`, 'yuran');
});

/* =====================================================================
   GAJI COACH
   ===================================================================== */
const monthRange = M => { const from = M + '-01', to = addDays(nextMonth(M) + '-01', -1); return [from, to]; };
export function payroll(M) {
  const [from, to] = monthRange(M), rows = new Map();
  const row = id => { if (!rows.has(id)) rows.set(id, { id, gH: 0, pH: 0, gN: 0, pN: 0, list: [] }); return rows.get(id); };
  for (const s of T('class_sessions').filter(x => x.session_date >= from && x.session_date <= to && x.status !== 'cancelled' && x.session_date <= todayISO())) {
    const c = byId('classes', s.class_id); if (!c) continue;
    const h = sHours(s, c), pers = isPersonal(c), gs = groupsOf(s.id).filter(g => g.coach_id);
    const coaches = gs.length ? [...new Set(gs.map(g => g.coach_id))] : [sCoach(s, c)].filter(Boolean);
    if (pers && !T('attendance').some(a => a.session_id === s.id && ['present', 'late', 'late_cancel'].includes(a.status)) && s.status !== 'held') continue;
    for (const id of coaches) { const r = row(id); if (pers) { r.pH += h; r.pN++; } else { r.gH += h; r.gN++; } r.list.push({ s, c, h, pers }); }
  }
  return T('staff').filter(st => st.active !== false || rows.has(st.id)).map(st => {
    const r = rows.get(st.id) || { id: st.id, gH: 0, pH: 0, gN: 0, pN: 0, list: [] };
    const rate = Number(st.pay_rate || 0), rp = Number(st.rate_personal || st.pay_rate || 0);
    const pay = st.pay_basis === 'monthly' ? rate : st.pay_basis === 'hourly' ? r.gH * rate + r.pH * rp : null;
    const paid = T('expenses').find(e => e.staff_id === st.id && e.category === 'coach' && e.reference === 'GAJI-' + M);
    return { st, ...r, rate, rp, pay, paid };
  }).filter(x => x.list.length || x.st.pay_basis === 'monthly').sort((a, b) => a.st.full_name.localeCompare(b.st.full_name));
}
VIEWS.gaji = () => {
  const M = UI.payM || todayISO().slice(0, 7), [from] = monthRange(M);
  if (!UI['payLoaded' + M]) { UI['payLoaded' + M] = 1; loadRange(from, addDays(nextMonth(M) + '-01', -1)).then(ch => { if (ch) app.render(); }).catch(e => console.warn(e)); }
  const L = payroll(M), tot = L.reduce((n, x) => n + (x.pay || 0), 0);
  return `${pageHead('Gaji Coach', 'Dikira daripada sesi yang telah berlangsung: coach sesi / coach setiap kategori, jam sesi, dan kadar dalam profil coach (bulanan, sejam, atau kadar personal).',
    `<button class="btn" data-action="pay-csv">${ic('file', 'sm')} Muat turun CSV</button>`)}
  <div class="card card-pad mb"><div class="filters"><label class="field">${ic('calendar', 'sm')}<input type="month" value="${M}" data-on-change="pay-m"></label><b>${esc(monthLabel(M + '-01'))}</b> · <span>Anggaran jumlah: <b>${RM(tot)}</b></span></div>
    <div class="muted" style="font-size:12px;margin-top:8px">Sesi personal hanya dikira jika ada kehadiran (hadir / lewat / batal lewat) atau ditanda selesai. Tetapkan kadar di Pasukan → Coach.</div></div>
  <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Coach</th><th class="num">Sesi kumpulan</th><th class="num">Jam kumpulan</th><th class="num">Sesi personal</th><th class="num">Jam personal</th><th>Kadar</th><th class="num">Bayaran</th><th></th></tr></thead><tbody>
  ${L.map(x => `<tr><td><b>${esc(x.st.full_name)}</b></td><td class="num">${x.gN}</td><td class="num">${x.gH.toFixed(1)}</td><td class="num">${x.pN}</td><td class="num">${x.pH.toFixed(1)}</td>
    <td style="font-size:12px">${x.st.pay_basis === 'monthly' ? RM(x.rate) + ' / bulan' : x.st.pay_basis === 'hourly' ? RM(x.rate) + ' / jam' + (x.st.rate_personal ? ` · personal ${RM(x.rp)}` : '') : '<span style="color:var(--warn)">belum ditetapkan</span>'}</td>
    <td class="num"><b>${x.pay == null ? '—' : RM(x.pay)}</b></td>
    <td><div class="actions"><button class="btn sm" data-action="pay-detail" data-id="${x.st.id}">Butiran</button>${x.paid ? '<span class="badge b-ok">Dibayar</span>' : x.pay ? `<button class="btn sm primary" data-action="pay-record" data-id="${x.st.id}">Rekod bayaran</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Tiada sesi untuk bulan ini.</td></tr>'}
  </tbody></table></div></div>`;
};
INPUTS['pay-m'] = v => { if (v) { UI.payM = v; app.render(); } };
Object.assign(ACTIONS, {
  'pay-detail': id => { const x = payroll(UI.payM || todayISO().slice(0, 7)).find(r => r.st.id === id);
    openModal({ title: `Butiran sesi — ${esc(x.st.full_name)}`, cancel: 'Tutup', wide: true, body: `<table class="table"><thead><tr><th>Tarikh</th><th>Masa</th><th>Kelas</th><th>Jenis</th><th class="num">Jam</th></tr></thead><tbody>${x.list.sort((a, b) => a.s.session_date.localeCompare(b.s.session_date)).map(r => `<tr><td>${fmtShort(r.s.session_date)}</td><td>${sTime(r.s, r.c).join('–')}</td><td>${esc(progName(r.c.programme_id))}${r.pers ? ' · ' + esc(T('attendance').filter(a => a.session_id === r.s.id).map(a => studentName(a.student_id)).join(', ')) : ''}</td><td>${r.pers ? 'Personal' : 'Kumpulan'}</td><td class="num">${r.h.toFixed(2)}</td></tr>`).join('')}</tbody></table>` }); },
  'pay-record': id => { const M = UI.payM || todayISO().slice(0, 7), x = payroll(M).find(r => r.st.id === id);
    confirmModal({ title: 'Rekod bayaran gaji?', message: `${esc(x.st.full_name)} · ${esc(monthLabel(M + '-01'))} · ${RM(x.pay)} — direkod dalam Perbelanjaan (kategori Coach).`, ok: 'Rekod', onOk: async () => {
      await insert('expenses', { spent_on: todayISO(), category: 'coach', description: `Gaji coach ${monthLabel(M + '-01')} — ${x.st.full_name} (${x.gN + x.pN} sesi, ${(x.gH + x.pH).toFixed(1)} jam)`, amount: Math.round(x.pay * 100) / 100, staff_id: id, reference: 'GAJI-' + M });
      toast('Bayaran gaji direkod'); app.render(); } }); },
  'pay-csv': () => { const M = UI.payM || todayISO().slice(0, 7), L = payroll(M);
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [['Coach', 'Sesi kumpulan', 'Jam kumpulan', 'Sesi personal', 'Jam personal', 'Asas', 'Kadar', 'Kadar personal', 'Bayaran', 'Status'].map(q).join(','),
      ...L.map(x => [x.st.full_name, x.gN, x.gH.toFixed(2), x.pN, x.pH.toFixed(2), x.st.pay_basis || '', x.rate, x.rp, x.pay == null ? '' : x.pay.toFixed(2), x.paid ? 'Dibayar' : ''].map(q).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `gaji-coach-${M}.csv`; a.click(); },
});
