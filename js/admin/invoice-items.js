// Editor item invois: unit sesi/jam/bulan/unit, kuantiti perpuluhan, diskaun baris, baris diskaun & kredit pelarasan (negatif).
import { ACTIONS } from '../registry.js';
import { S, insert, update, remove } from '../data.js';
import { esc, RM, toast } from '../ui.js';
import { T } from './helpers.js';

export const UNITS = [['sesi', 'Sesi'], ['jam', 'Jam'], ['bulan', 'Bulan'], ['unit', 'Unit'], ['kali', 'Kali']];
export const KINDS = [['package', 'Yuran pakej'], ['fee', 'Yuran latihan'], ['court', 'Sewa court'], ['registration', 'Pendaftaran'], ['jersey', 'Jersi'], ['other', 'Lain-lain'], ['discount', 'Diskaun (tolak)'], ['credit', 'Kredit pelarasan (tolak)']];
export const NEG = k => k === 'discount' || k === 'credit';
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const lineAmount = it => r2((NEG(it.kind) ? -1 : 1) * (Number(it.qty) * Number(it.unit_price) - (NEG(it.kind) ? 0 : Number(it.discount || 0))));
export const itemsOf = invId => T('invoice_items').filter(i => i.invoice_id === invId).sort((a, b) => a.sort - b.sort);
export const itemsTotal = items => r2(items.reduce((t, i) => t + Number(i.amount), 0));

/* Pelajar dalam invois semasa (invois keluarga = lebih daripada seorang). Ditetapkan oleh borang invois. */
let KIDS = [];
export const getKids = () => KIDS;
const kidSel = v => KIDS.length > 1 ? `<label class="it-stu">Pelajar<select name="it_stu">${KIDS.map(k => `<option value="${k.id}" ${k.id === (v || KIDS[0].id) ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>` : `<input type="hidden" name="it_stu" value="${esc(v || KIDS[0]?.id || '')}">`;
/** Tukar senarai pelajar; pilihan pelajar pada setiap baris dikemas kini tanpa hilang nilai. */
export function setKids(list, root = document) {
  KIDS = list;
  root.querySelectorAll('.it-row').forEach(row => { const cur = row.querySelector('[name=it_stu]')?.value; const old = row.querySelector('.it-stu') || row.querySelector('input[name=it_stu]'); old?.insertAdjacentHTML('afterend', kidSel(KIDS.some(k => k.id === cur) ? cur : KIDS[0]?.id)); old?.remove(); });
}
const sel = (name, opts, v, cls = '') => `<select name="${name}" class="${cls}">${opts.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
export const itemRow = (it = {}) => {
  const kind = it.kind || 'fee', neg = NEG(kind);
  return `<div class="it-row ${neg ? 'neg' : ''}">
    <div class="it-top">${sel('it_kind', KINDS, kind, 'it-kind')}<input name="it_desc" class="it-desc" placeholder="Tajuk item (cth. Personal Head Coach / Sewa court)" value="${esc(it.description || '')}"><button type="button" class="icon-btn it-x" data-action="it-del" title="Buang baris" aria-label="Buang baris">×</button></div>
    <textarea name="it_det" class="it-det" rows="1" placeholder="Butiran (pilihan): tarikh sesi, pecahan kiraan…">${esc(it.details || '')}</textarea>
    ${kidSel(it.student_id)}
    <div class="it-nums">
      <label>Kuantiti<input name="it_qty" type="number" step="0.25" min="0.25" value="${it.qty ?? 1}"></label>
      <label>Unit${sel('it_unit', UNITS, it.unit || 'unit')}</label>
      <label>Harga seunit (RM)<input name="it_price" type="number" step="0.01" min="0" value="${it.unit_price ?? ''}" placeholder="0.00"></label>
      <label class="it-d">Diskaun (RM)<input name="it_disc" type="number" step="0.01" min="0" value="${it.discount || ''}" placeholder="0.00"></label>
      <div class="it-tot"><span>Jumlah</span><b>${RM(it.amount ?? 0)}</b></div>
    </div></div>`;
};
export const itemsEditor = (items, { locked = false, note = '' } = {}) => `
  <style>.it-rows{display:flex;flex-direction:column;gap:10px}.it-row{border:1px solid var(--line,#e3e5ee);border-radius:10px;padding:10px;background:var(--bg,#fafbfe)}.it-row.neg{background:#fff6f4;border-color:#f3c9c0}
  .it-top{display:flex;gap:8px;align-items:center}.it-top .it-kind{width:190px;flex:none}.it-top .it-desc{flex:1;min-width:0}.it-x{flex:none;font-size:20px;line-height:1}
  .it-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:8px;align-items:end}.it-nums label{font-size:11.5px;color:var(--muted,#667);display:flex;flex-direction:column;gap:3px}.it-nums input,.it-nums select{width:100%}
  .it-det{width:100%;margin-top:6px;min-height:34px;resize:vertical;font-size:12.5px}.it-stu{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:11.5px;color:var(--muted,#667)}.it-stu select{flex:1}
  .it-row.neg .it-d{opacity:.4}.it-row.neg .it-d input{pointer-events:none}.it-tot{text-align:right;font-size:11.5px;color:var(--muted,#667)}.it-tot b{display:block;font-size:15px;color:var(--ink,#111)}.it-row.neg .it-tot b{color:#b42318}
  .it-foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.it-sum{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:12px 14px;border-radius:10px;background:var(--brand-soft,#eef2ff);font-weight:700}.it-sum b{font-size:18px}
  @media(max-width:560px){.it-top{flex-wrap:wrap}.it-top .it-kind{width:100%}}</style>
  <div class="it-rows" id="itRows">${items.map(itemRow).join('')}</div>
  <div class="it-foot"><button type="button" class="btn sm" data-action="it-add" data-id="fee">+ Item</button><button type="button" class="btn sm" data-action="it-add" data-id="court">+ Sewa court</button><button type="button" class="btn sm" data-action="it-add" data-id="registration">+ Pendaftaran</button><button type="button" class="btn sm" data-action="it-add" data-id="discount">+ Diskaun</button><button type="button" class="btn sm" data-action="it-add" data-id="credit">+ Pelarasan kredit</button><button type="button" class="btn sm it-copy" data-action="it-copy" style="${KIDS.length > 1 ? '' : 'display:none'}">Salin item untuk setiap anak</button></div>
  <div class="it-sum"><span>Jumlah invois</span><b id="itTotal">${RM(itemsTotal(items))}</b></div>${note ? `<p class="muted" style="margin-top:8px;font-size:12.5px">${note}</p>` : ''}`;

const PRESET = { fee: { kind: 'fee', unit: 'jam', description: '' }, court: { kind: 'court', unit: 'jam', description: 'Sewa court' }, registration: { kind: 'registration', unit: 'unit', description: 'Yuran pendaftaran', unit_price: 35 }, discount: { kind: 'discount', unit: 'unit', description: 'Diskaun' }, credit: { kind: 'credit', unit: 'unit', description: 'Pelarasan kredit (cth. coach diganti / sesi dibatalkan)' } };
const rowsBox = () => document.getElementById('itRows');
/** Kira semula jumlah baris & jumlah invois (dipanggil pada setiap input). */
export function recalcItems(root = document) {
  let total = 0;
  root.querySelectorAll('.it-row').forEach(row => {
    const g = n => row.querySelector(`[name=${n}]`), kind = g('it_kind').value;
    row.classList.toggle('neg', NEG(kind));
    const a = lineAmount({ kind, qty: g('it_qty').value || 0, unit_price: g('it_price').value || 0, discount: g('it_disc').value || 0 });
    total += a; row.querySelector('.it-tot b').textContent = (a < 0 ? '-' : '') + RM(Math.abs(a));
  });
  const el = root.querySelector('#itTotal'); if (el) el.textContent = (total < 0 ? '-' : '') + RM(Math.abs(r2(total)));
}
export const bindItems = f => { f.addEventListener('input', e => { if (e.target.closest('.it-row')) recalcItems(f); }); f.addEventListener('change', e => { if (e.target.closest('.it-row')) recalcItems(f); }); };
Object.assign(ACTIONS, {
  'it-add': k => { const box = rowsBox(); if (!box) return; box.insertAdjacentHTML('beforeend', itemRow(PRESET[k] || PRESET.fee)); recalcItems(box.closest('form')); box.lastElementChild.querySelector('.it-desc').focus(); },
  'it-copy': () => {
    const box = rowsBox(); if (!box || KIDS.length < 2) return;
    const first = KIDS[0].id, rows = [...box.querySelectorAll('.it-row')].filter(r => (r.querySelector('[name=it_stu]')?.value || first) === first);
    if (!rows.length) return toast('Tiada item untuk ' + KIDS[0].name, true);
    for (const k of KIDS.slice(1)) for (const r of rows) {
      const c = r.cloneNode(true); [...r.querySelectorAll('select')].forEach((s0, i) => { c.querySelectorAll('select')[i].value = s0.value; });
      const st = c.querySelector('[name=it_stu]'); if (st) st.value = k.id; box.appendChild(c);
    }
    recalcItems(box.closest('form')); toast('Item disalin untuk setiap anak');
  },
  'it-del': (id, el) => { const box = rowsBox(); if (box.children.length <= 1) return toast('Sekurang-kurangnya satu item diperlukan', true); el.closest('.it-row').remove(); recalcItems(box.closest('form')); },
});
/** Baca item daripada data borang (nama berulang). Baris kosong diabaikan. */
export function readItems(d) {
  const A = k => [].concat(d[k] ?? []);
  const kinds = A('it_kind'), descs = A('it_desc'), qtys = A('it_qty'), units = A('it_unit'), prices = A('it_price'), discs = A('it_disc'), dets = A('it_det'), stus = A('it_stu'), out = [];
  descs.forEach((desc, i) => {
    const it = { kind: kinds[i] || 'fee', description: (desc || '').trim(), unit: units[i] || 'unit', qty: Number(qtys[i] || 1), unit_price: Number(prices[i] || 0), discount: NEG(kinds[i]) ? 0 : Number(discs[i] || 0), details: (dets[i] || '').trim() || null, student_id: stus[i] || null };
    if (!it.description && !it.unit_price) return;
    if (!it.description) throw new Error(`Baris ${i + 1}: sila isi keterangan.`);
    if (!(it.qty > 0)) throw new Error(`Baris ${i + 1}: kuantiti mesti lebih daripada 0.`);
    if (it.unit_price < 0 || it.discount < 0) throw new Error(`Baris ${i + 1}: gunakan jenis "Diskaun" atau "Pelarasan kredit" untuk tolakan, bukan nombor negatif.`);
    if (it.discount > it.qty * it.unit_price + 0.001) throw new Error(`Baris ${i + 1}: diskaun melebihi jumlah baris.`);
    it.amount = lineAmount(it); out.push(it);
  });
  if (!out.length) throw new Error('Masukkan sekurang-kurangnya satu item.');
  const total = itemsTotal(out); if (total < 0) throw new Error('Jumlah invois tidak boleh negatif.');
  return out;
}
/** Simpan item bagi invois (ganti semua) dan selaraskan jumlah invois. Pulangkan jumlah. */
export async function saveItems(invId, items, extraPatch = {}) {
  for (const old of itemsOf(invId)) await remove('invoice_items', old.id);
  if (items.length) await insert('invoice_items', items.map((it, i) => ({ invoice_id: invId, sort: i + 1, kind: it.kind, description: it.description, unit: it.unit, qty: it.qty, unit_price: it.unit_price, discount: it.discount, amount: it.amount, details: it.details || null, student_id: it.student_id || null })));
  const total = itemsTotal(items); await update('invoices', invId, { amount: total, ...extraPatch }); return total;
}
/** Item awal untuk invois lama (tanpa item): satu baris daripada keterangan & amaun. */
export function legacyItems(inv, pkg) {
  const title = String(inv.description || '').split('\n').map(x => x.trim()).filter(x => x && !x.startsWith('[Import'))[0] || ({ package: 'Yuran latihan', registration: 'Yuran pendaftaran', jersey: 'Jersi', personal: 'Personal coaching', tournament: 'Kejohanan', other: 'Yuran' }[inv.kind] || 'Yuran');
  const kind = pkg ? 'package' : ({ registration: 'registration', jersey: 'jersey', personal: 'fee', tournament: 'other' }[inv.kind] || 'fee');
  return [{ kind, description: title, unit: 'unit', qty: 1, unit_price: Number(inv.amount), discount: 0, amount: Number(inv.amount), student_id: inv.student_id }];
}
