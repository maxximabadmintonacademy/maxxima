// Invois & Bayaran, Pakej (katalog + pakej pelajar).
import { msgInvoiceReminder, msgPackageLow, msgModal } from './messages.js';
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove } from '../data.js';
import { ic, esc, F, RM, sum, num, val, badge, avatar, UI, app, toast, openModal, closeModal, confirmModal, pageHead, fmtDate, fmtShort, todayISO, addDays, monthKey, monthLabel, LABEL, waLink, $ } from '../ui.js';
import { T, byId, venueName, progName, studentName, invStatus, paidOf, creditOf, billing, academy, pkgRemaining, studentPackages, catalogFor, pendingPayments, unallocated, daysLeft, lowPackages, expiringPackages, enrolledIn } from './helpers.js';
import { openReceipt } from '../receipt.js';
import { openInvoice, openCreditNote } from '../invoice.js';
import { itemsEditor, bindItems, readItems, saveItems, itemsOf, legacyItems, itemsTotal, lineAmount, recalcItems, setKids, getKids, itemRow } from './invoice-items.js';

const METHODS = Object.entries({ duitnow: 'DuitNow QR', fpx: 'FPX', transfer: 'Pindahan Bank', cash: 'Tunai', card: 'Kad', other: 'Lain-lain' });
const adminId = () => (S.mode === 'demo' ? null : S.profile.id);

function remindText(inv) {
  const s = byId('students', inv.student_id), bal = Number(inv.amount) - creditOf(inv) - paidOf(inv);
  return msgInvoiceReminder({ guardian: s?.guardian_name, student: s?.full_name, item: inv.description || LABEL[inv.kind], amount: RM(bal), number: inv.number, due: fmtDate(inv.due_date), academy: academy().name });
}

/* =====================================================================
   JUAL PAKEJ = satu invois + pakej "menunggu bayaran" (digunakan juga oleh Pendaftaran)
   Pakej aktif secara automatik apabila bayaran disahkan.
   ===================================================================== */
export async function sellPackage({ studentId, pkg, price, mode, due, reg, jersey, discount, pending }) {
  const disc = Number(discount) || 0, items = [{ kind: 'package', description: pkg.name, unit: 'unit', qty: 1, unit_price: Number(price), discount: 0 }];
  if (num(reg)) items.push({ kind: 'registration', description: 'Yuran pendaftaran', unit: 'unit', qty: 1, unit_price: Number(reg), discount: 0 });
  if (num(jersey)) items.push({ kind: 'jersey', description: 'Jersi akademi', unit: 'unit', qty: 1, unit_price: Number(jersey), discount: 0 });
  if (disc > 0) items.push({ kind: 'discount', description: 'Diskaun', unit: 'unit', qty: 1, unit_price: disc, discount: 0 });
  items.forEach(it => { it.amount = lineAmount(it); });
  const total = itemsTotal(items); if (total < 0) throw new Error('Diskaun melebihi jumlah invois.');
  const pkgPrice = Math.max(Number(price) - disc, 0);
  const inv = await insert('invoices', { student_id: studentId, issued_on: todayISO(), due_date: due, status: 'issued', kind: 'package', amount: total, description: pkg.name });
  await saveItems(inv.id, items);
  if (pending) await update('student_packages', pending.id, { invoice_id: inv.id, package_id: pkg.id, programme_id: pkg.programme_id, name: pkg.name, sessions_total: pkg.sessions, price: pkgPrice, valid_days: pkg.valid_days, schedule_mode: mode });
  else await insert('student_packages', { student_id: studentId, package_id: pkg.id, programme_id: pkg.programme_id, name: pkg.name, sessions_total: pkg.sessions, price: pkgPrice, valid_days: pkg.valid_days, schedule_mode: mode, status: 'pending', invoice_id: inv.id });
  return inv;
}
export const dueDefault = () => addDays(todayISO(), billing().due_days ?? 7);
/* ---------- Invois keluarga: adik-beradik dalam satu invois ---------- */
const nPh = v => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('60')) d = d.slice(2); if (d.startsWith('0')) d = d.slice(1); return d; };
export function siblingsOf(id) {
  const s = byId('students', id); if (!s) return [];
  const ph = nPh(s.guardian_phone), gph = new Set(T('guardians').filter(g => g.student_id === id).map(g => nPh(g.phone)).filter(x => x.length >= 8)); if (ph.length >= 8) gph.add(ph);
  const famPh = x => nPh(x.guardian_phone).length >= 8 && gph.has(nPh(x.guardian_phone)) || T('guardians').some(g => g.student_id === x.id && gph.has(nPh(g.phone)));
  return T('students').filter(x => x.id !== id && x.status !== 'left' && ((s.family_ref && x.family_ref === s.family_ref) || (s.guardian_id && x.guardian_id === s.guardian_id) || famPh(x))).sort((a, b) => a.full_name.localeCompare(b.full_name));
}
const kidsOfInvoice = inv => { const ids = [inv.student_id, ...itemsOf(inv.id).map(i => i.student_id)].filter(Boolean); return [...new Set(ids)].map(id => byId('students', id)).filter(Boolean); };
export const invoiceStudentIds = inv => [...new Set([inv.student_id, ...itemsOf(inv.id).map(i => i.student_id)].filter(Boolean))];
const autoBill = kids => kids.length > 1 ? kids.map(k => k.full_name.split(' ')[0]).join(' & ') + ' ' + (kids[0].full_name.split(' ').length > 1 ? kids[0].full_name.split(' ').slice(-1)[0] : '') : '';
const famBoxHtml = () => `<div class="f full" id="famBox"><span>Pelajar dalam invois ini</span><div id="famChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
  <input type="hidden" name="merge_ids" value=""><div id="famMerge" style="margin-top:6px"></div></div>`;
/** Pengurus pelajar dalam invois (cip + tambah adik-beradik + gabung invois belum bayar). */
function bindFamily(f, mainId, { invId = null, locked = false } = {}) {
  const box = f.querySelector('#famBox'); if (!box) return;
  let kids = invId ? kidsOfInvoice(byId('invoices', invId)) : (mainId ? [byId('students', mainId)].filter(Boolean) : []);
  let lastAuto = autoBill(kids);
  const merged = new Map();   // invoiceId -> sibling id
  const sync = () => {
    setKids(kids.map(k => ({ id: k.id, name: k.full_name })), f);
    f.querySelector('.it-copy') && (f.querySelector('.it-copy').style.display = kids.length > 1 ? '' : 'none');
    const bt = f.elements.bill_to; if (bt && (!bt.value || bt.value === lastAuto)) { lastAuto = autoBill(kids); bt.value = lastAuto; }
    const allSibs = kids[0] ? siblingsOf(kids[0].id) : [], sibs = allSibs.filter(x => !kids.some(k => k.id === x.id));
    f.querySelector('#famChips').innerHTML = kids.map((k, i) => `<span class="badge b-info" style="font-size:12.5px;padding:5px 10px">${esc(k.full_name)}${i && !locked ? ` <button type="button" data-rm="${k.id}" style="border:0;background:none;cursor:pointer;font-weight:700">×</button>` : ''}</span>`).join('')
      + (locked || !kids.length ? '' : sibs.length ? `<select id="famAdd" style="width:auto;min-width:200px"><option value="">+ Tambah adik-beradik…</option>${sibs.map(x => `<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}</select>` : allSibs.length ? '' : `<span class="muted" style="font-size:12px;align-self:center">Tiada adik-beradik dijumpai (kod keluarga / no. telefon penjaga)</span>`);
    f.querySelector('#famAdd')?.addEventListener('change', e => { const x = byId('students', e.target.value); if (x) { kids.push(x); sync(); offerMerge(x); } });
    f.querySelectorAll('#famChips [data-rm]').forEach(b => b.onclick = () => {
      const id = b.dataset.rm; kids = kids.filter(k => k.id !== id);
      f.querySelectorAll(`.it-row[data-merge]`).forEach(r => { if (merged.get(r.dataset.merge) === id) r.remove(); });
      for (const [k, v] of merged) if (v === id) merged.delete(k);
      f.elements.merge_ids.value = [...merged.keys()].join(','); f.querySelector('#famMerge').innerHTML = ''; sync(); recalcItems(f);
    });
  };
  const offerMerge = x => {
    const open = T('invoices').filter(i => i.student_id === x.id && i.id !== invId && i.status === 'issued' && paidOf(i) === 0 && creditOf(i) === 0);
    const el = f.querySelector('#famMerge');
    el.innerHTML = open.length ? `<div class="hint" style="font-size:12.5px">Invois belum bayar untuk ${esc(x.full_name)} — tandakan untuk gabungkan ke dalam invois ini (invois asal akan dibatalkan):${open.map(i => `<label style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" data-mi="${i.id}" style="width:auto"> ${esc(i.number)} · ${esc(String(i.description || '').split('\n')[0])} · <b>${RM(i.amount)}</b></label>`).join('')}</div>`
      : `<div class="muted" style="font-size:12.5px">Tambah item untuk ${esc(x.full_name)}, atau tekan <b>Salin item untuk setiap anak</b>.</div>`;
    el.querySelectorAll('[data-mi]').forEach(cb => cb.onchange = () => {
      const iid = cb.dataset.mi, rows = f.querySelector('#itRows');
      if (cb.checked) {
        const inv = byId('invoices', iid), its = itemsOf(iid).length ? itemsOf(iid) : legacyItems(inv, T('student_packages').some(p => p.invoice_id === iid));
        merged.set(iid, x.id);
        rows.insertAdjacentHTML('beforeend', its.map(it => itemRow({ ...it, student_id: x.id })).join(''));
        [...rows.children].slice(-its.length).forEach(r => (r.dataset.merge = iid));
      } else { merged.delete(iid); rows.querySelectorAll(`[data-merge="${iid}"]`).forEach(r => r.remove()); }
      f.elements.merge_ids.value = [...merged.keys()].join(','); recalcItems(f);
    });
  };
  f._famReset = id => { kids = id ? [byId('students', id)].filter(Boolean) : []; merged.clear(); f.elements.merge_ids.value = ''; f.querySelector('#famMerge').innerHTML = ''; f.querySelectorAll('.it-row[data-merge]').forEach(r => r.remove()); sync(); };
  sync();
}
/** Selepas simpan: invois yang digabung dibatalkan dan pakejnya dipindah ke invois keluarga. */
async function applyMerges(d, invId, number) {
  for (const mid of String(d.merge_ids || '').split(',').filter(Boolean)) {
    const m = byId('invoices', mid); if (!m || m.status !== 'issued' || paidOf(m) > 0) continue;
    for (const sp of T('student_packages').filter(p => p.invoice_id === mid)) await update('student_packages', sp.id, { invoice_id: invId });
    await update('invoices', mid, { status: 'void', description: (m.description || '') + `\nDigabung ke invois keluarga ${number}` });
  }
}

/* Pemilih pelajar bertapis: Lokasi -> Program -> carian nama, supaya senarai pelajar pendek. */
const stuProgs = s => new Set([s.programme_id, ...T('student_programmes').filter(x => x.student_id === s.id).map(x => x.programme_id)].filter(Boolean));
const stuVenues = s => new Set([s.venue_id, ...T('student_programmes').filter(x => x.student_id === s.id).map(x => x.venue_id)].filter(Boolean));
function studentPicker(studs, pre) {
  const st = pre && byId('students', pre), cnt = (arr, fn) => arr.map(x => [x, studs.filter(s => fn(s).has(x.id)).length]).filter(x => x[1]);
  const vens = cnt(T('venues').slice().sort((a, b) => a.name.localeCompare(b.name)), stuVenues), progs = cnt(T('programmes').slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)), stuProgs);
  const noVen = studs.filter(s => !stuVenues(s).size).length, noProg = studs.filter(s => !stuProgs(s).size).length;
  return `${F('1. Lokasi', 'f_venue', { opts: [['', `Semua lokasi (${studs.length})`], ...vens.map(([v, n]) => [v.id, `${v.name} (${n})`]), ...(noVen ? [['none', `Tiada lokasi (${noVen})`]] : [])] })}
    ${F('2. Program', 'f_prog', { value: st?.programme_id || '', opts: [['', 'Semua program'], ...progs.map(([p, n]) => [p.id, `${p.name} (${n})`]), ...(noProg ? [['none', `Tiada program (${noProg})`]] : [])] })}
    <label class="f full"><span>3. Pelajar <span class="muted" id="stuCount" style="font-weight:500"></span></span>
      <input name="f_q" type="search" placeholder="Taip nama untuk tapis…" autocomplete="off" style="margin-bottom:6px">
      <select name="student_id" required></select></label>`;
}
function bindPicker(f, studs, pre, onChange) {
  const E = f.elements, hit = (set, v) => !v || (v === 'none' ? !set.size : set.has(v));
  const fill = () => {
    const q = E.f_q.value.trim().toLowerCase(), cur = E.student_id.value || pre || '';
    const list = studs.filter(s => hit(stuVenues(s), E.f_venue.value) && hit(stuProgs(s), E.f_prog.value) && (!q || s.full_name.toLowerCase().includes(q)));
    E.student_id.innerHTML = `<option value="">— Pilih pelajar (${list.length}) —</option>` + list.map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.full_name)}${s.fee_exempt ? ' (tiada yuran)' : ''}</option>`).join('');
    if (list.length === 1 && q) E.student_id.value = list[0].id;
    f.querySelector('#stuCount').textContent = `· ${list.length} daripada ${studs.length}`;
    onChange?.();
  };
  E.f_venue.addEventListener('change', fill); E.f_prog.addEventListener('change', fill); E.f_q.addEventListener('input', fill);
  E.f_q.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  E.student_id.addEventListener('change', () => onChange?.());
  fill();
}
const pkgOptions = (selected, only) => T('programmes').filter(p => p.active && (!only || !only.size || only.has(p.id))).map(pr => {
  const list = catalogFor(pr.id); if (!list.length) return '';
  return `<optgroup label="${esc(pr.name)}">${list.map(p => `<option value="${p.id}" ${selected === p.id ? 'selected' : ''}>${esc(p.name)} — ${RM(p.price)}</option>`).join('')}</optgroup>`;
}).join('');

/* =====================================================================
   INVOIS & BAYARAN
   ===================================================================== */
VIEWS.yuran = () => {
  const invsAll = T('invoices');
  const mk = UI.invMonth === undefined ? monthKey(todayISO()) : UI.invMonth;       // '' = semua
  const monthOf = i => monthKey(i.issued_on);
  const months = [...new Set(invsAll.map(monthOf).filter(Boolean))];
  const f = UI.invFilter || 'all', q = (UI.invQ || '').toLowerCase();
  const inMonth = invsAll.filter(i => !mk || monthOf(i) === mk);
  const live = inMonth.filter(i => i.status !== 'void');
  const rows = inMonth.filter(i => {
    const st = invStatus(i);
    return (f === 'all' ? i.status !== 'void' : f === 'issued' ? st === 'issued' : st === f)
      && (!q || (invoiceStudentIds(i).map(studentName).join(' ') + ' ' + (i.bill_to || '') + ' ' + i.number).toLowerCase().includes(q));
  }).sort((a, b) => (b.issued_on || '').localeCompare(a.issued_on || '') || b.number.localeCompare(a.number));
  const total = sum(live, i => Number(i.amount) - creditOf(i)), paid = sum(live.filter(i => i.status === 'paid'), i => Number(i.amount) - creditOf(i));
  const overdue = live.filter(i => invStatus(i) === 'overdue');
  const cnt = s => inMonth.filter(i => (s === 'all' ? i.status !== 'void' : invStatus(i) === s)).length;
  const monthOpts = [...new Set([monthKey(todayISO()), ...months])].sort().reverse();
  const pend = pendingPayments();

  return `
  ${pageHead('Invois & Bayaran', 'Invois pakej, bayaran ibu bapa, pengesahan dan resit.',
    `<button class="btn" data-action="inv-manual">${ic('plus', 'sm')} Invois Manual</button><button class="btn primary" data-action="sell">${ic('tag', 'sm')} Jual Pakej</button>`)}
  ${pend.length ? `<div class="card mb" style="border-color:var(--warn)">
    <div class="card-head"><div><h3>Bayaran Menunggu Pengesahan</h3><div class="sub">Dihantar oleh ibu bapa — semak bukti, kemudian sahkan. Resit dijana selepas disahkan.</div></div><span class="badge b-warn">${pend.length}</span></div>
    <ul class="list">${pend.map(p => { const inv = byId('invoices', p.invoice_id); return `<li class="list-item" style="flex-wrap:wrap">${avatar(studentName(inv?.student_id))}
      <div class="li-main"><div class="li-title">${esc(studentName(inv?.student_id))} · <span class="num">${RM(p.amount)}</span></div><div class="li-sub">${esc(inv?.number || '')} · ${esc(LABEL[p.method] || p.method)}${p.reference ? ' · ' + esc(p.reference) : ''} · ${fmtShort(p.paid_on)}</div></div>
      <div class="actions">${p.proof_path ? `<button class="btn sm" data-action="pay-proof" data-id="${p.id}">Lihat bukti</button>` : '<span class="muted" style="font-size:12px">tiada bukti</span>'}<button class="btn sm primary" data-action="pay-confirm" data-id="${p.id}">Sahkan</button><button class="btn sm danger-o" data-action="pay-reject" data-id="${p.id}">Tolak</button></div></li>`; }).join('')}</ul></div>` : ''}
  <div class="grid g-3 mb">
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Jumlah Invois</span><span class="kpi-ico t-info">${ic('wallet')}</span></div><div class="kpi-val">${RM(total)}</div><div class="kpi-foot"><b>${live.length}</b> invois · ${mk ? monthLabel(mk) : 'semua bulan'}</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Telah Dikutip</span><span class="kpi-ico t-ok">${ic('trend')}</span></div><div class="kpi-val" style="color:var(--ok)">${RM(paid)}</div><div class="kpi-foot"><b>${total ? Math.round(paid / total * 100) : 0}%</b> daripada jumlah</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Baki Tertunggak</span><span class="kpi-ico t-bad">${ic('alert')}</span></div><div class="kpi-val" style="color:var(--bad)">${RM(total - paid)}</div><div class="kpi-foot"><b>${overdue.length}</b> melepasi tarikh akhir</div></div>
  </div>
  <div class="card">
    <div class="toolbar">
      <label class="field grow">${ic('search', 'sm')}<input id="invSearch" data-on-input="inv-q" placeholder="Cari pelajar atau no. invois…" value="${esc(UI.invQ || '')}"></label>
      <label class="field"><select data-on-change="inv-month"><option value="">Semua bulan</option>${monthOpts.map(m => `<option value="${m}" ${mk === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></label>
    </div>
    <div class="chips" style="padding:12px 20px 0;margin:0">${[['all', 'Semua'], ['issued', 'Belum Bayar'], ['overdue', 'Lewat'], ['paid', 'Dibayar'], ['void', 'Dibatalkan']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-action="inv-filter" data-id="${k}">${l}<span class="n">${cnt(k)}</span></button>`).join('')}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Pelajar</th><th>Invois</th><th>Amaun</th><th>Tarikh akhir</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(i => {
        const st = invStatus(i), part = paidOf(i), receipts = T('payments').filter(p => p.invoice_id === i.id && p.status === 'confirmed');
        const hasPend = T('payments').some(p => p.invoice_id === i.id && p.status === 'pending');
        return `<tr>
          <td><div class="cell-person">${avatar(studentName(i.student_id))}<div><b>${esc(studentName(i.student_id))}</b>${invoiceStudentIds(i).length > 1 ? ` <span class="badge b-info" title="${esc(invoiceStudentIds(i).map(studentName).join(', '))}">+${invoiceStudentIds(i).length - 1} adik-beradik</span>` : ''}<span>${esc(byId('students', i.student_id)?.guardian_name || '')}</span></div></div></td>
          <td><span class="num">${esc(i.number)}</span><div class="muted" style="font-size:12px">${esc(i.description || LABEL[i.kind])}</div></td>
          <td class="num"><b>${RM(i.amount)}</b>${creditOf(i) > 0 ? `<div class="muted" style="font-size:12px">kredit -${RM(creditOf(i))}</div>` : ''}${part > 0 && i.status === 'issued' ? `<div class="muted" style="font-size:12px">dibayar ${RM(part)}</div>` : ''}</td>
          <td class="num">${fmtShort(i.due_date)}</td>
          <td>${badge(st)}${hasPend ? '<div style="margin-top:2px"><span class="badge b-info">bayaran dihantar</span></div>' : ''}${i.status === 'paid' && i.paid_on ? `<div class="muted" style="font-size:12px;margin-top:2px">${fmtShort(i.paid_on)}</div>` : ''}</td>
          <td style="white-space:nowrap">${i.status === 'issued' ? `<button class="btn sm primary" data-action="inv-pay" data-id="${i.id}">Rekod Bayaran</button> <button class="btn sm" data-action="inv-remind" data-id="${i.id}" title="Peringatan WhatsApp">${ic('msg', 'sm')}</button>` : ''}<button class="btn sm" data-action="inv-edit" data-id="${i.id}" title="Edit invois">${ic('edit', 'sm')}</button> ${i.status === 'void' && !creditOf(i) ? `<button class="btn sm" data-action="inv-restore" data-id="${i.id}" title="Aktifkan semula">Aktifkan</button> ` : ''}${i.status !== 'void' ? ` <button class="btn sm" data-action="inv-print" data-id="${i.id}" title="Cetak / PDF invois">${ic('file', 'sm')} Invois</button> <button class="btn sm danger-o" data-action="inv-credit" data-id="${i.id}" title="Keluarkan nota kredit (invois tidak dipadam)">Nota Kredit</button>` : ''}${T('payments').some(p => p.invoice_id === i.id) ? `<button class="btn sm" data-action="pay-manage" data-id="${i.id}" title="Urus rekod bayaran">Bayaran</button> ` : ''}${receipts.map(p => `<button class="btn sm" data-action="receipt" data-id="${p.id}" title="Resit ${esc(p.receipt_no)}">${ic('file', 'sm')} Resit</button>`).join(' ')}</td></tr>`;
      }).join('') || `<tr><td colspan="6" class="empty">Tiada invois${mk ? ' untuk ' + monthLabel(mk) : ''}. Invois dikeluarkan melalui <b>Jual Pakej</b>, atau automatik apabila baki pakej tinggal 1 sesi.</td></tr>`}</tbody>
    </table></div>
  </div>
  ${T('credit_notes').length ? `<div class="card mt"><div class="card-head"><div><h3>Nota Kredit</h3><div class="sub">Invois asal kekal dalam sistem dan boleh dicari menggunakan nombornya.</div></div><span class="badge b-muted">${T('credit_notes').length}</span></div>
    <div class="table-wrap"><table><thead><tr><th>No. nota kredit</th><th>Pelajar</th><th>Invois</th><th>Amaun</th><th>Sebab</th><th></th></tr></thead><tbody>${T('credit_notes').slice().sort((a, b) => (b.issued_on || '').localeCompare(a.issued_on || '') || b.number.localeCompare(a.number)).filter(c => !q || (c.number + ' ' + (byId('invoices', c.invoice_id)?.number || '') + ' ' + studentName(byId('invoices', c.invoice_id)?.student_id)).toLowerCase().includes(q)).map(c => { const iv = byId('invoices', c.invoice_id); return `<tr><td><span class="num">${esc(c.number)}</span><div class="muted" style="font-size:12px">${fmtDate(c.issued_on)}</div></td><td>${esc(studentName(iv?.student_id))}</td><td class="num">${esc(iv?.number || '')}</td><td class="num"><b>-${RM(c.amount)}</b></td><td class="muted">${esc(c.reason || '')}</td><td><button class="btn sm" data-action="cn-print" data-id="${c.id}">${ic('file', 'sm')} Cetak</button></td></tr>`; }).join('')}</tbody></table></div></div>` : ''}`;
};

Object.assign(INPUTS, {
  'inv-q': v => { UI.invQ = v; app.render(); },
  'inv-month': v => { UI.invMonth = v; app.render(); },
});

const payForm = (inv, bal) => `<p class="muted" style="margin-bottom:12px">${esc(inv.number)} · ${esc(inv.description || LABEL[inv.kind])} · jumlah ${RM(inv.amount)}</p>
  <div class="form-grid">
    ${F('Amaun diterima (RM)', 'amount', { type: 'number', step: '0.01', min: 0.01, value: bal, req: true })}
    ${F('Tarikh bayaran', 'paid_on', { type: 'date', value: todayISO(), req: true })}
    ${F('Kaedah', 'method', { opts: METHODS })}
    ${F('No. rujukan', 'reference')}
  </div><p class="muted" style="margin-top:10px;font-size:12.5px">Bayaran separa dibenarkan; invois menjadi "Dibayar" (dan pakej aktif) apabila jumlah penuh diterima.</p>`;

Object.assign(ACTIONS, {
  'inv-filter': id => { UI.invFilter = id; app.render(); },

  'inv-pay': id => {
    const inv = byId('invoices', id), bal = Number(inv.amount) - creditOf(inv) - paidOf(inv);
    openModal({
      title: `Rekod Bayaran — ${esc(studentName(inv.student_id))}`, submit: 'Sahkan Bayaran', body: payForm(inv, bal),
      onSubmit: async d => { await insert('payments', { invoice_id: id, amount: Number(d.amount), method: d.method, paid_on: d.paid_on, reference: val(d.reference), status: 'confirmed', verified_by: adminId() }); toast('Bayaran direkod · resit dijana'); app.render(); },
    });
  },
  'pay-confirm': id => {
    const p = byId('payments', id), inv = byId('invoices', p.invoice_id);
    confirmModal({ title: 'Sahkan bayaran?', message: `<b>${RM(p.amount)}</b> daripada penjaga <b>${esc(studentName(inv.student_id))}</b> untuk ${esc(inv.number)}. Resit akan dijana dan ibu bapa dimaklumkan.`, ok: 'Sahkan',
      onOk: async () => { await update('payments', id, { status: 'confirmed', verified_by: adminId() }); toast('Bayaran disahkan'); app.render(); } });
  },
  'pay-reject': id => openModal({
    title: 'Tolak Bayaran', submit: 'Tolak Bayaran',
    body: `${F('Sebab (dilihat oleh ibu bapa)', 'note', { full: true, req: true, ph: 'cth. Bukti tidak jelas / amaun tidak sepadan' })}`,
    onSubmit: async d => { await update('payments', id, { status: 'rejected', note: d.note, verified_by: adminId() }); toast('Bayaran ditolak · ibu bapa dimaklumkan'); app.render(); },
  }),
  'pay-proof': async id => {
    const p = byId('payments', id);
    if (S.mode === 'demo') return toast('Mod demo: tiada fail bukti sebenar. Dalam Supabase, bukti dibuka di tab baharu.');
    const { data, error } = await S.client.storage.from('payment-proofs').createSignedUrl(p.proof_path, 300);
    if (error) throw error; window.open(data.signedUrl, '_blank', 'noopener');
  },
  'receipt': id => openReceipt(id),
  'inv-print': id => openInvoice(id),
  'inv-edit': id => {
    const inv = byId('invoices', id), paid = paidOf(inv), cr = creditOf(inv), pkgs = T('student_packages').filter(x => x.invoice_id === id), hasPkg = pkgs.length > 0, lockStu = paid > 0 || hasPkg || cr > 0;
    const lockItems = inv.status === 'paid', cur = itemsOf(id), items = cur.length ? cur : legacyItems(inv, hasPkg);
    const studs = T('students').slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
    const kids0 = kidsOfInvoice(inv); setKids(kids0.map(k => ({ id: k.id, name: k.full_name })));
    const canSplit = kids0.length > 1 && paidOf(inv) === 0 && cr === 0 && inv.status === 'issued';
    const f = openModal({
      title: `Edit Invois — ${esc(inv.number)}`, submit: 'Simpan Perubahan', wide: true,
      body: `<div class="form-grid">
        <label class="f full">Pelajar<select name="student_id" ${lockStu ? 'disabled' : ''}>${studs.map(s => `<option value="${s.id}" ${s.id === inv.student_id ? 'selected' : ''}>${esc(s.full_name)}</option>`).join('')}</select></label>
        ${F('No. invois', 'number', { value: inv.number, req: true })}
        ${F('Jenis', 'kind', { value: inv.kind, opts: [['package', 'Pakej sesi'], ['registration', 'Pendaftaran'], ['jersey', 'Jersi'], ['personal', 'Personal Coaching'], ['tournament', 'Kejohanan'], ['other', 'Lain-lain']] })}
        ${F('Tarikh invois', 'issued_on', { type: 'date', value: inv.issued_on, req: true })}
        ${F('Tarikh akhir bayaran', 'due_date', { type: 'date', value: inv.due_date, req: true })}
        ${F('Nama pada invois (adik-beradik / keluarga, pilihan)', 'bill_to', { value: inv.bill_to, full: true, ph: 'cth. Tia & Zen. Kosongkan untuk guna nama pelajar' })}
        ${pkgs.length === 1 ? F('Jumlah sesi pakej', 'sessions_total', { type: 'number', min: 1, step: 1, value: pkgs[0].sessions_total, req: true }) : ''}
        ${famBoxHtml()}
        ${canSplit ? `<div class="f full"><button type="button" class="btn sm" data-action="inv-split" data-id="${id}">Pisahkan ikut anak (satu invois setiap anak)</button></div>` : ''}
      </div>
      <h4 style="font-size:13.5px;margin:16px 0 8px">Item invois</h4>
      ${lockItems ? `<div class="hint warn" style="margin-bottom:8px">Invois sudah dibayar penuh, jadi item dikunci. Gunakan <b>Nota Kredit</b> untuk mengurangkan, atau keluarkan invois baharu untuk tambahan.</div><fieldset disabled style="border:0;padding:0;margin:0">${itemsEditor(items)}</fieldset>` : itemsEditor(items, { note: `${paid > 0 ? `Telah dibayar ${RM(paid)}: jumlah baharu mesti lebih besar daripada ini. ` : ''}Pakej sesi, yuran pendaftaran, sewa court, diskaun dan pelarasan kredit boleh digabung dalam satu invois. Perubahan tidak mengubah resit yang telah dikeluarkan.` })}
      ${F('Tajuk / keterangan tambahan (pilihan)', 'description', { type: 'textarea', value: String(inv.description || '').split('\n').filter(x => !x.startsWith('[Import')).join('\n'), full: true })}`,
      onSubmit: async d => {
        const patch = { number: d.number.trim(), kind: d.kind, issued_on: d.issued_on, due_date: d.due_date, bill_to: val(d.bill_to), description: val(d.description) };
        if (!lockStu && d.student_id) patch.student_id = d.student_id;
        if (!lockItems) {
          const its = readItems(d), amt = itemsTotal(its);
          if (paid > 0 && amt <= paid + 0.001) throw new Error(`Jumlah mesti lebih besar daripada jumlah yang telah dibayar (${RM(paid)}).`);
          if (amt < cr - 0.001) throw new Error(`Jumlah tidak boleh kurang daripada nota kredit (${RM(cr)}).`);
          if (!patch.description) patch.description = its[0].description;
          await saveItems(id, its, patch); await applyMerges(d, id, patch.number);
          const pkgAmt = its.filter(x => x.kind === 'package').reduce((t, x) => t + x.amount, 0);
          if (pkgAmt > 0 && invoiceStudentIds({ ...inv, id }).length < 2) for (const sp of T('student_packages').filter(x => x.invoice_id === id && x.status === 'pending')) await update('student_packages', sp.id, { price: pkgAmt });
        } else await update('invoices', id, patch);
        if (pkgs.length === 1 && d.sessions_total && Number(d.sessions_total) !== Number(pkgs[0].sessions_total)) {
          const tot = Number(d.sessions_total), sp = pkgs[0], used = Number(sp.sessions_used || 0), pp = { sessions_total: tot };
          if (sp.status === 'completed' && used < tot) pp.status = 'active'; if (sp.status === 'active' && used >= tot) pp.status = 'completed';
          await update('student_packages', sp.id, pp);
        }
        toast('Invois dikemas kini'); app.render();
      },
    });
    if (!lockItems) bindItems(f);
    bindFamily(f, inv.student_id, { invId: id, locked: lockItems || lockStu && false });
  },
  'inv-split': id => {
    const inv = byId('invoices', id), kids = kidsOfInvoice(inv).filter(k => k.id !== inv.student_id);
    confirmModal({ title: 'Pisahkan invois?', message: `Invois <b>${esc(inv.number)}</b> akan dipisahkan: item setiap anak dipindah ke invois baharu (${kids.map(k => esc(k.full_name)).join(', ')}). Pakej setiap anak ikut sekali. Perubahan yang belum disimpan dalam borang edit akan hilang.`, ok: 'Pisahkan',
      onOk: async () => {
        for (const k of kids) {
          const its = itemsOf(id).filter(i => i.student_id === k.id); if (!its.length) continue;
          const amt = itemsTotal(its);
          const ni = await insert('invoices', { student_id: k.id, kind: inv.kind, amount: amt, description: (String(inv.description || '').split('\n')[0] || its[0].description) + `\nDipisahkan daripada invois keluarga ${inv.number}`, due_date: inv.due_date, issued_on: inv.issued_on, status: 'issued' });
          for (const it of its) await update('invoice_items', it.id, { invoice_id: ni.id });
          for (const sp of T('student_packages').filter(p => p.invoice_id === id && p.student_id === k.id)) await update('student_packages', sp.id, { invoice_id: ni.id });
        }
        await update('invoices', id, { amount: itemsTotal(itemsOf(id)), bill_to: null });
        toast('Invois dipisahkan ikut anak'); app.render();
      } });
  },
  'inv-restore': id => confirmModal({ title: 'Aktifkan semula invois?', message: `Invois <b>${esc(byId('invoices', id).number)}</b> akan kembali menjadi "Belum Bayar".`, ok: 'Aktifkan', onOk: async () => { await update('invoices', id, { status: 'issued' }); toast('Invois diaktifkan semula'); app.render(); } }),
  'pay-manage': id => {
    const inv = byId('invoices', id), pays = T('payments').filter(p => p.invoice_id === id).sort((a, b) => (a.paid_on || '').localeCompare(b.paid_on || ''));
    openModal({ title: `Rekod Bayaran — ${esc(inv.number)}`, cancel: 'Tutup', body: `<ul class="list" style="margin:0 -20px">${pays.map(p => `<li class="list-item" style="flex-wrap:wrap;padding:12px 20px"><div class="li-main"><div class="li-title">${RM(p.amount)} · ${badge(p.status)}</div><div class="li-sub">${fmtDate(p.paid_on)} · ${esc(LABEL[p.method] || p.method)}${p.reference ? ' · ' + esc(p.reference) : ''}${p.receipt_no ? ' · ' + esc(p.receipt_no) : ''}${p.note ? ' · ' + esc(p.note) : ''}</div></div>
      <div class="actions"><button class="btn sm" data-action="pay-edit" data-id="${p.id}">${ic('edit', 'sm')} Edit</button><button class="btn sm danger-o" data-action="pay-del" data-id="${p.id}">${ic('trash', 'sm')} Padam</button></div></li>`).join('') || '<li class="empty">Tiada bayaran.</li>'}</ul>` });
  },
  'pay-edit': id => {
    const p = byId('payments', id);
    openModal({ title: 'Edit Rekod Bayaran', submit: 'Simpan', body: `<div class="form-grid">
      ${F('Tarikh bayaran', 'paid_on', { type: 'date', value: p.paid_on, req: true })}
      ${F('Kaedah', 'method', { value: p.method, opts: METHODS })}
      ${F('No. rujukan', 'reference', { value: p.reference || '' })}
      ${F('Nota', 'note', { value: p.note || '' })}
    </div><p class="muted" style="margin-top:10px;font-size:12.5px">Amaun tidak boleh diubah. Jika salah, padam rekod ini dan rekod bayaran baharu.</p>`,
      onSubmit: async d => { await update('payments', id, { paid_on: d.paid_on, method: d.method, reference: val(d.reference), note: val(d.note) }); toast('Bayaran dikemas kini'); app.render(); } });
  },
  'pay-del': id => {
    const p = byId('payments', id), inv = byId('invoices', p.invoice_id);
    confirmModal({ title: 'Padam rekod bayaran?', message: `Bayaran <b>${RM(p.amount)}</b> untuk ${esc(inv.number)} akan dipadam${p.receipt_no ? ` (resit ${esc(p.receipt_no)} tidak sah lagi)` : ''}. ${inv.status === 'paid' ? 'Invois akan kembali "Belum Bayar" jika jumlah bayaran kurang. Pakej yang sudah diaktifkan tidak diubah.' : ''}`, ok: 'Padam Bayaran', danger: true,
      onOk: async () => {
        await remove('payments', id);
        const left = paidOf(inv);
        if (inv.status === 'paid' && left < Number(inv.amount) - creditOf(inv) - 0.001) await update('invoices', inv.id, { status: 'issued', paid_on: null });
        toast('Bayaran dipadam'); app.render();
      } });
  },
  'sp-edit': id => {
    const sp = byId('student_packages', id);
    openModal({ title: `Laras Pakej — ${esc(studentName(sp.student_id))}`, submit: 'Simpan', wide: true, body: `<div class="form-grid">
      ${F('Nama pakej', 'name', { value: sp.name, req: true, full: true })}
      ${F('Jumlah sesi', 'sessions_total', { type: 'number', min: 1, step: 1, value: sp.sessions_total, req: true })}
      <label class="f">Sesi telah digunakan<input value="${esc(sp.sessions_used)}" disabled></label>
      ${F('Tarikh mula', 'starts_on', { type: 'date', value: sp.starts_on || '' })}
      ${F('Tarikh tamat', 'expires_on', { type: 'date', value: sp.expires_on || '' })}
      ${F('Status', 'status', { value: sp.status, opts: [['pending', 'Menunggu bayaran'], ['active', 'Aktif'], ['completed', 'Sesi habis'], ['expired', 'Tamat tempoh'], ['cancelled', 'Dibatalkan']] })}
    </div><p class="muted" style="margin-top:10px;font-size:12.5px">Baki = jumlah sesi − sesi digunakan. "Sesi digunakan" dikira automatik daripada kehadiran; ubah <b>jumlah sesi</b> atau <b>tarikh tamat</b> untuk menambah baki atau melanjutkan tempoh.</p>`,
      onSubmit: async d => {
        const total = Number(d.sessions_total), used = Number(sp.sessions_used || 0); let st = d.status;
        if (st === 'active' && used >= total) st = 'completed'; if (st === 'completed' && used < total) st = 'active';
        const patch = { name: d.name, sessions_total: total, starts_on: val(d.starts_on), expires_on: val(d.expires_on), status: st };
        if (total - used > 1) patch.renewal_sent = false;
        await update('student_packages', id, patch); toast('Pakej dikemas kini'); app.render();
      } });
  },
  'cn-print': id => openCreditNote(id),
  'inv-credit': id => {
    const inv = byId('invoices', id), room = Math.max(Number(inv.amount) - creditOf(inv), 0);
    if (room <= 0) return toast('Invois ini sudah dikreditkan sepenuhnya.', true);
    openModal({
      title: `Nota Kredit — ${esc(inv.number)}`, submit: 'Keluarkan Nota Kredit',
      body: `<p class="muted" style="margin-bottom:12px">${esc(studentName(inv.student_id))} · ${esc(inv.description?.split('\n')[0] || LABEL[inv.kind])} · invois ${RM(inv.amount)}${paidOf(inv) > 0 ? ` · telah dibayar ${RM(paidOf(inv))}` : ''}</p>
      <div class="form-grid">
        ${F('Amaun kredit (RM)', 'amount', { type: 'number', step: '0.01', min: 0.01, max: room, value: room, req: true })}
        ${F('Tarikh', 'issued_on', { type: 'date', value: todayISO(), req: true })}
        ${F('Sebab', 'reason', { full: true, req: true, ph: 'cth. Berhenti mulai bulan depan / invois salah / diskaun' })}
      </div><p class="muted" style="margin-top:10px;font-size:12.5px">Invois <b>tidak dipadam</b>: nombornya kekal untuk carian dan audit. Jika dikreditkan penuh dan belum dibayar, invois ditandakan Dibatalkan.${paidOf(inv) > 0 ? ' Bayaran yang sudah diterima tidak dipulangkan secara automatik; uruskan bayaran balik secara berasingan.' : ''}</p>`,
      onSubmit: async d => {
        const amt = Number(d.amount); if (!(amt > 0) || amt > room + 0.001) throw new Error(`Amaun mesti antara RM0.01 dan ${RM(room)}.`);
        await insert('credit_notes', { invoice_id: id, amount: amt, reason: d.reason, issued_on: d.issued_on, created_by: adminId() });
        toast('Nota kredit dikeluarkan'); app.render();
      },
    });
  },

  'inv-remind': id => {
    const inv = byId('invoices', id), s = byId('students', inv.student_id);
    msgModal({ title: 'Peringatan Bayaran', student: s, build: () => remindText(inv) });
  },
  'copy-remind': async () => { try { await navigator.clipboard.writeText($('#remindText').textContent); toast('Mesej disalin'); } catch { toast('Tidak dapat menyalin — pilih teks secara manual', true); } },
  'inv-void': id => confirmModal({ title: 'Batalkan invois?', message: `Invois <b>${esc(byId('invoices', id).number)}</b> akan ditandakan "Dibatalkan" dan tidak dikira sebagai tunggakan.`, ok: 'Batalkan Invois', danger: true, onOk: async () => { await update('invoices', id, { status: 'void' }); toast('Invois dibatalkan'); app.render(); } }),

  'inv-manual': (id) => {
    const studs = T('students').filter(s => s.status !== 'left').sort((a, b) => a.full_name.localeCompare(b.full_name)), pre = id && byId('students', id) ? id : '';
    setKids(pre ? [{ id: pre, name: byId('students', pre).full_name }] : []);
    const f = openModal({
      title: 'Invois Manual', submit: 'Keluarkan Invois', wide: true,
      body: `<div class="form-grid">
        ${studentPicker(studs, pre)}
        ${famBoxHtml()}
        ${F('Jenis', 'kind', { opts: [['personal', 'Personal Coaching'], ['jersey', 'Jersi'], ['registration', 'Pendaftaran'], ['tournament', 'Kejohanan'], ['other', 'Lain-lain']] })}
        ${F('Nama pada invois (adik-beradik, pilihan)', 'bill_to', { ph: 'cth. Tia & Zen' })}
        ${F('Tarikh akhir', 'due', { type: 'date', value: dueDefault(), req: true })}
      </div>
      <h4 style="font-size:13.5px;margin:16px 0 8px">Item invois</h4>
      ${itemsEditor([{ kind: 'fee', unit: 'jam', qty: 1, description: '', amount: 0 }], { note: 'Pilih unit <b>jam</b> untuk personal coaching atau sewa court, <b>sesi</b> untuk kelas, <b>bulan</b> untuk yuran bulanan. Tambah baris diskaun atau pelarasan kredit jika perlu.' })}
      ${F('Tajuk / keterangan tambahan (pilihan)', 'description', { type: 'textarea', full: true, ph: 'cth. Personal Training — November 2026' })}
      <p class="muted" style="margin-top:8px;font-size:12.5px">Untuk pakej sesi, gunakan <b>Jual Pakej</b> (boleh juga tambah pendaftaran & diskaun di situ).</p>`,
      onSubmit: async d => {
        const its = readItems(d), amt = itemsTotal(its);
        const inv = await insert('invoices', { student_id: d.student_id, kind: d.kind, amount: amt, bill_to: val(d.bill_to), description: val(d.description) || its[0].description, due_date: d.due, issued_on: todayISO(), status: 'issued' });
        await saveItems(inv.id, its); await applyMerges(d, inv.id, inv.number); toast('Invois dikeluarkan'); app.render();
      },
    });
    bindItems(f); bindFamily(f, pre || null); bindPicker(f, studs, pre, () => { const v = f.elements.student_id.value; if (v !== f._famMain) { f._famMain = v; f._famReset(v); } });
  },

  /* ---- Jual pakej: Lokasi -> Program -> Pelajar -> Pakej ---- */
  'sell': (id) => {
    const preStudent = id && byId('students', id) ? id : '';
    const studs = T('students').filter(s => ['active', 'awaiting_payment', 'paused'].includes(s.status)).sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (!T('packages').some(p => p.active)) return toast('Belum ada pakej. Tetapkan katalog pakej dahulu.', true);
    const firstPkg = (() => { const sp = preStudent && byId('students', preStudent)?.programme_id; return (sp && catalogFor(sp)[0]) || T('packages').find(p => p.active); })();
    const f = openModal({
      title: 'Jual Pakej', submit: 'Keluarkan Invois', wide: true,
      body: `<div class="form-grid">
        ${studentPicker(studs, preStudent)}
        <label class="f full">4. Pakej<select name="package_id" required>${pkgOptions(firstPkg?.id)}</select></label>
        ${F('Cara latihan', 'mode', { value: firstPkg?.schedule_mode || 'fixed', opts: [['fixed', 'Jadual tetap (didaftar ke kelas)'], ['flexible', 'Fleksibel (ibu bapa tempah sendiri)']] })}
        ${F('Harga (RM)', 'price', { type: 'number', step: '0.01', min: 0, value: firstPkg?.price ?? '', req: true })}
        ${F('Yuran pendaftaran (RM)', 'reg', { type: 'number', step: '0.01', min: 0, ph: 'Kosongkan jika tiada' })}
        ${F('Jersi (RM)', 'jersey', { type: 'number', step: '0.01', min: 0, ph: 'Kosongkan jika tiada' })}
        ${F('Diskaun (RM)', 'discount', { type: 'number', step: '0.01', min: 0, ph: 'Kosongkan jika tiada' })}
        ${F('Tarikh akhir bayaran', 'due', { type: 'date', value: dueDefault(), req: true })}
      </div><div id="sellNote" class="muted" style="margin-top:10px;font-size:12.5px"></div>`,
      onSubmit: async d => {
        const pkg = byId('packages', d.package_id), s = byId('students', d.student_id);
        await sellPackage({ studentId: d.student_id, pkg, price: Number(d.price), mode: d.mode, due: d.due, reg: d.reg, jersey: d.jersey, discount: d.discount });
        toast(`Invois dikeluarkan untuk ${s.full_name}`); app.render();
      },
    });
    const note = () => {
      const fd = new FormData(f), pkg = byId('packages', fd.get('package_id')), sid = fd.get('student_id');
      const enrolled = sid ? T('class_enrolments').some(e => e.student_id === sid) : true, prev = sid && pkg ? studentPackages(sid).find(p => p.programme_id === pkg.programme_id && p.status === 'active') : null;
      f.querySelector('#sellNote').innerHTML = `${prev ? `<div class="hint warn">Pelajar masih ada pakej aktif ${esc(prev.name)} (baki ${pkgRemaining(prev)}). Pakej baharu akan aktif selepas bayaran dan dipakai selepas yang lama habis.</div>` : ''}${fd.get('mode') === 'fixed' && sid && !enrolled ? `<div class="hint warn">Pelajar belum ditempatkan dalam kelas tetap. Tetapkan di <a href="#jadual" data-action="close-modal">Jadual Kelas</a>.</div>` : ''}Pakej aktif secara automatik apabila bayaran disahkan; tempoh sah bermula dari tarikh bayaran. Kadar boleh diubah untuk pelajar lama yang kekal harga lama.`;
    };
    const syncPkg = () => { const pkg = byId('packages', f.elements.package_id.value); if (pkg) { f.elements.price.value = pkg.price; f.elements.mode.value = pkg.schedule_mode; } };
    /* Senarai pakej ikut program yang ditapis; jika tiada tapisan, ikut program pelajar yang dipilih */
    const pkgFilter = () => {
      const E = f.elements, st = byId('students', E.student_id.value), fp = E.f_prog.value;
      const only = fp && fp !== 'none' ? new Set([fp]) : st ? stuProgs(st) : new Set();
      const key = [...only].sort().join(','); if (f.dataset.pk === key) return note();
      f.dataset.pk = key; const cur = E.package_id.value;
      let html = pkgOptions(cur, only); if (!html) html = pkgOptions(cur);
      E.package_id.innerHTML = html;
      if (E.package_id.value !== cur) syncPkg();
      note();
    };
    f.elements.package_id.addEventListener('change', () => { syncPkg(); note(); });
    f.elements.mode.addEventListener('change', note);
    bindPicker(f, studs, preStudent, pkgFilter);
  },
});

/* =====================================================================
   PAKEJ  (tab: Pakej Pelajar | Katalog)
   ===================================================================== */
const SP_FILTERS = [['active', 'Aktif'], ['low', 'Hampir habis'], ['expiring', 'Hampir tamat'], ['pending', 'Menunggu bayaran'], ['done', 'Selesai / Tamat']];
const spMatch = (p, f) => f === 'active' ? p.status === 'active' : f === 'low' ? p.status === 'active' && pkgRemaining(p) <= 1 : f === 'expiring' ? p.status === 'active' && p.expires_on && daysLeft(p) <= 7 : f === 'pending' ? p.status === 'pending' : ['completed', 'expired', 'cancelled'].includes(p.status);

VIEWS.pakej = () => {
  const tab = UI.pkgTab || 'student';
  const all = T('student_packages');
  const un = unallocated();
  return `
  ${pageHead('Pakej', 'Katalog pakej dan baki sesi pelajar. Invois pembaharuan dikeluarkan automatik apabila baki tinggal 1 sesi.',
    tab === 'catalog' ? `<button class="btn primary" data-action="pkg-add">${ic('plus', 'sm')} Pakej Baharu</button>` : `<button class="btn primary" data-action="sell">${ic('tag', 'sm')} Jual Pakej</button>`)}
  <div class="chips">${[['student', 'Pakej Pelajar'], ['catalog', 'Katalog Pakej']].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-action="pkg-tab" data-id="${k}">${l}</button>`).join('')}</div>
  ${tab === 'catalog' ? catalogView() : `
  <div class="grid kpis mb" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${[['Aktif', all.filter(p => spMatch(p, 'active')).length, 't-ok', 'tag'], ['Hampir habis', lowPackages().length, 't-info', 'alert'], ['Tamat ≤ 7 hari', expiringPackages().length, 't-warn', 'clock'], ['Menunggu bayaran', all.filter(p => p.status === 'pending').length, 't-purple', 'wallet']].map(([l, v, tone, icon]) => `<div class="card kpi"><div class="kpi-top"><span class="kpi-label">${l}</span><span class="kpi-ico ${tone}">${ic(icon)}</span></div><div class="kpi-val">${v}</div></div>`).join('')}
  </div>
  ${un.length ? `<div class="card mb" style="border-color:var(--bad)"><div class="card-head"><div><h3>Kehadiran belum dipadankan dengan pakej</h3><div class="sub">Sesi dihadiri tetapi pelajar tiada pakej aktif. Jual pakej — kehadiran ini akan dipadankan secara automatik selepas bayaran.</div></div><span class="badge b-bad">${un.length}</span></div>
    <ul class="list">${[...new Set(un.map(a => a.student_id))].map(sid => `<li class="list-item">${avatar(studentName(sid))}<div class="li-main"><div class="li-title">${esc(studentName(sid))}</div><div class="li-sub">${un.filter(a => a.student_id === sid).length} sesi belum dipadankan</div></div><button class="btn sm primary" data-action="sell" data-id="${sid}">Jual Pakej</button></li>`).join('')}</ul></div>` : ''}
  ${studentView()}`}`;
};

function studentView() {
  const f = UI.spFilter || 'active', q = (UI.spQ || '').toLowerCase();
  const rows = T('student_packages').filter(p => spMatch(p, f) && (!q || studentName(p.student_id).toLowerCase().includes(q)))
    .sort((a, b) => (a.status === 'active' ? pkgRemaining(a) : 99) - (b.status === 'active' ? pkgRemaining(b) : 99) || studentName(a.student_id).localeCompare(studentName(b.student_id)));
  return `<div class="card">
    <div class="toolbar"><label class="field grow">${ic('search', 'sm')}<input id="spSearch" data-on-input="sp-q" placeholder="Cari pelajar…" value="${esc(UI.spQ || '')}"></label></div>
    <div class="chips" style="padding:12px 20px 0;margin:0">${SP_FILTERS.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-action="sp-filter" data-id="${k}">${l}<span class="n">${T('student_packages').filter(p => spMatch(p, k)).length}</span></button>`).join('')}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Pelajar</th><th>Pakej</th><th>Baki sesi</th><th>Tamat</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(p => {
        const rem = pkgRemaining(p), used = Number(p.sessions_used || 0), pct = Math.round(used / p.sessions_total * 100), dl = daysLeft(p), inv = byId('invoices', p.invoice_id), s = byId('students', p.student_id);
        return `<tr>
          <td><div class="cell-person">${avatar(studentName(p.student_id))}<div><b>${esc(studentName(p.student_id))}</b><span>${esc(s?.guardian_name || '')}</span></div></div></td>
          <td>${esc(p.name)}<div class="muted" style="font-size:12px">${LABEL[p.schedule_mode]} · ${RM(p.price)}</div></td>
          <td style="min-width:140px">${p.status === 'pending' ? '<span class="muted">—</span>' : `<div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><span style="width:${pct}%;background:${rem <= 1 ? 'var(--bad)' : 'var(--brand)'}"></span></div><b class="num" style="font-size:12.5px;color:${rem <= 1 ? 'var(--bad)' : 'var(--ink)'}">${rem}</b></div><div class="muted" style="font-size:11.5px">${used}/${p.sessions_total} digunakan</div>`}</td>
          <td class="num">${p.expires_on ? fmtShort(p.expires_on) + `<div class="muted" style="font-size:11.5px;color:${dl != null && dl <= 7 && p.status === 'active' ? 'var(--bad)' : ''}">${p.status === 'active' ? (dl < 0 ? 'lewat ' + -dl + ' hari' : dl + ' hari lagi') : ''}</div>` : '—'}</td>
          <td>${badge(p.status === 'pending' ? 'pending' : p.status, p.status === 'pending' ? 'Menunggu bayaran' : p.status === 'completed' ? 'Sesi habis' : undefined)}${inv && inv.status === 'issued' ? `<div class="muted" style="font-size:11.5px">${esc(inv.number)}${invStatus(inv) === 'overdue' ? ' · lewat' : ''}</div>${p.status === 'active' ? `<span class="badge b-warn" style="margin-top:3px">Bayaran separa · baki ${RM(Number(inv.amount) - creditOf(inv) - paidOf(inv))}</span>` : ''}` : ''}</td>
          <td style="white-space:nowrap">${p.status === 'active' && rem <= 1 && s?.guardian_phone ? `<button class="btn sm" data-action="sp-remind" data-id="${p.id}" title="Peringatan WhatsApp">${ic('msg', 'sm')}</button> ` : ''}${(p.status !== 'active' || rem <= 3) && ['active', 'completed', 'expired'].includes(p.status) && !T('student_packages').some(x => x.renewal_of === p.id) && !T('student_packages').some(x => x.student_id === p.student_id && x.status === 'pending') ? `<button class="btn sm" data-action="sell" data-id="${p.student_id}">Perbaharui</button> ` : ''}<button class="btn sm" data-action="sp-edit" data-id="${p.id}" title="Laras pakej">${ic('edit', 'sm')}</button> ${['pending', 'active'].includes(p.status) ? `<button class="btn sm" data-action="sp-cancel" data-id="${p.id}" title="Batalkan pakej">${ic('x', 'sm')}</button>` : ''}</td></tr>`;
      }).join('') || `<tr><td colspan="6" class="empty">Tiada pakej dalam paparan ini.</td></tr>`}</tbody>
    </table></div></div>`;
}

function catalogView() {
  const progs = T('programmes').slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return progs.map(pr => {
    const list = T('packages').filter(p => p.programme_id === pr.id).sort((a, b) => a.sort - b.sort || a.sessions - b.sessions);
    const hasClass = T('classes').some(c => c.programme_id === pr.id && c.active);
    return `<div class="card mb"><div class="card-head"><div><h3>${esc(pr.name)}</h3><div class="sub">${T('classes').filter(c => c.programme_id === pr.id && c.active).length} kelas · ${list.filter(p => p.active).length} pakej aktif</div></div><button class="btn sm" data-action="pkg-add" data-id="${pr.id}">${ic('plus', 'sm')} Pakej</button></div>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Pakej</th><th>Sesi</th><th>Harga</th><th>Per sesi</th><th>Sah</th><th>Cara</th><th></th></tr></thead><tbody>${list.map(p => `<tr>
        <td><b>${esc(p.name)}</b>${p.active ? '' : ' ' + badge('paused', 'Tidak aktif')}</td><td class="num">${p.sessions}</td><td class="num"><b>${RM(p.price)}</b></td><td class="num muted">${RM(p.price / p.sessions)}</td><td class="num">${p.valid_days} hari</td><td>${LABEL[p.schedule_mode]}</td>
        <td><button class="btn sm" data-action="pkg-edit" data-id="${p.id}">${ic('edit', 'sm')}</button></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty" style="padding:18px">${hasClass ? '<b style="color:var(--bad)">Program ini ada kelas tetapi belum ada pakej</b> — pelajar tidak boleh didaftarkan.' : 'Belum ada pakej.'}</div>`}</div>`;
  }).join('');
}

Object.assign(INPUTS, { 'sp-q': v => { UI.spQ = v; app.render(); } });

const pkgForm = (p, progId) => `<div class="form-grid">
  ${F('Program', 'programme_id', { value: p?.programme_id || progId, req: true, opts: [['', '— Pilih —'], ...T('programmes').filter(x => x.active).map(x => [x.id, x.name])] })}
  ${F('Nama pakej', 'name', { value: p?.name, ph: 'cth. Foundation · 8 sesi (kosong = automatik)', full: true })}
  ${F('Bilangan sesi', 'sessions', { type: 'number', min: 1, value: p?.sessions ?? 8, req: true })}
  ${F('Harga (RM)', 'price', { type: 'number', step: '0.01', min: 0, value: p?.price, req: true })}
  ${F('Sah (hari)', 'valid_days', { type: 'number', min: 1, value: p?.valid_days ?? 62, req: true })}
  ${F('Cara latihan lalai', 'schedule_mode', { value: p?.schedule_mode || 'fixed', opts: [['fixed', 'Jadual tetap'], ['flexible', 'Fleksibel (tempah sendiri)']] })}
  ${p ? `<label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="active" value="1" ${p.active ? 'checked' : ''} style="width:auto;height:auto"> Pakej aktif (boleh dijual)</label>` : ''}
</div><p class="muted" style="font-size:12.5px;margin-top:10px">Pakej terpakai kepada semua kelas dalam program yang sama. Menukar harga tidak mengubah pakej yang sudah dijual.</p>`;
const pkgPatch = (d, edit) => ({ programme_id: d.programme_id, name: (d.name || '').trim() || `${progName(d.programme_id)} · ${d.sessions} sesi`, sessions: Number(d.sessions), price: Number(d.price), valid_days: Number(d.valid_days), schedule_mode: d.schedule_mode, active: edit ? d.active === '1' : true });

Object.assign(ACTIONS, {
  'pkg-tab': id => { UI.pkgTab = id; app.render(); },
  'sp-filter': id => { UI.spFilter = id; app.render(); },
  'pkg-add': progId => openModal({ title: 'Pakej Baharu', submit: 'Tambah', body: pkgForm(null, progId), onSubmit: async d => { await insert('packages', { ...pkgPatch(d), sort: T('packages').filter(p => p.programme_id === d.programme_id).length + 1 }); toast('Pakej ditambah'); app.render(); } }),
  'pkg-edit': id => openModal({
    title: 'Edit Pakej', body: pkgForm(byId('packages', id)) + `<div style="margin-top:14px"><button type="button" class="btn sm danger-o" data-action="pkg-del" data-id="${id}">${ic('trash', 'sm')} Padam pakej</button></div>`,
    onSubmit: async d => { await update('packages', id, pkgPatch(d, true)); toast('Pakej dikemas kini'); app.render(); },
  }),
  'pkg-del': id => confirmModal({ title: 'Padam pakej?', message: 'Pakej yang sudah dijual kepada pelajar kekal (salinan disimpan). Pertimbangkan "Tidak aktif" sahaja.', ok: 'Padam', danger: true, onOk: async () => { await remove('packages', id); closeModal(); toast('Pakej dipadam'); app.render(); } }),
  'sp-remind': id => {
    const p = byId('student_packages', id), s = byId('students', p.student_id);
    msgModal({ title: 'Peringatan Pakej', student: s, build: () => msgPackageLow({ guardian: s.guardian_name, student: s.full_name, pkg: p.name, left: pkgRemaining(p), until: p.expires_on ? fmtDate(p.expires_on) : '', academy: academy().name }) });
  },
  'sp-cancel': id => confirmModal({ title: 'Batalkan pakej?', message: 'Pakej tidak lagi digunakan. Invois berkaitan perlu dibatalkan secara berasingan jika belum dibayar.', ok: 'Batalkan Pakej', danger: true, onOk: async () => { await update('student_packages', id, { status: 'cancelled' }); toast('Pakej dibatalkan'); app.render(); } }),
});
