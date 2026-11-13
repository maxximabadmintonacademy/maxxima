// v25: maklumat peribadi & ketersediaan coach — dikongsi portal admin dan portal coach.
import { S } from './data.js';
import { F, DAYS } from './ui.js';

const nowISO = () => new Date().toISOString();
const ORDER = [1, 2, 3, 4, 5, 6, 0];   // Isnin dahulu
export const slotsText = av => (av || []).slice().sort((a, b) => ORDER.indexOf(a.d) - ORDER.indexOf(b.d) || String(a.from).localeCompare(b.from)).map(x => `${DAYS[x.d]} ${x.from}–${x.to}`).join(', ');
/** Borang ketersediaan: setiap hari 2 julat masa. */
export const availForm = me => { const av = me?.availability || [], of = d => av.filter(x => x.d === d);
  return `<p class="muted" style="font-size:13px;margin-bottom:10px">Tandakan hari anda boleh mengajar dan julat masa. Admin guna ini semasa menyusun jadual & sesi ganti.</p>
  <div class="avail">${ORDER.map(d => { const [a, b] = of(d); return `<div class="av-row"><label class="av-day"><input type="checkbox" name="d${d}" value="1" ${a ? 'checked' : ''}> ${DAYS[d]}</label>
    <div class="av-t"><input type="time" name="d${d}_af" value="${a?.from || '15:00'}"><span>–</span><input type="time" name="d${d}_at" value="${a?.to || '21:00'}"></div>
    <div class="av-t av-b"><span class="av-or">dan</span><input type="time" name="d${d}_bf" value="${b?.from || ''}" title="Julat kedua (pilihan)"><span>–</span><input type="time" name="d${d}_bt" value="${b?.to || ''}"></div></div>`; }).join('')}</div>
  <p class="muted" style="font-size:12px;margin-top:6px">"dan" = julat masa kedua pada hari sama (pilihan), cth. 9:00–12:00 dan 15:00–21:00.</p>
  <div class="form-grid" style="margin-top:12px">${F('Maksimum jam seminggu (pilihan)', 'max', { type: 'number', min: 0, max: 80, value: me?.max_hours_week ?? '' })}${F('Catatan', 'note', { value: me?.avail_note, ph: 'cth. Cuti semester 1–15 Dis; boleh ganti hujung minggu' })}</div>`; };
export const availFromForm = d => { const out = [];
  for (const k of ORDER) { if (d['d' + k] !== '1') continue;
    if (d[`d${k}_af`] && d[`d${k}_at`]) { if (d[`d${k}_af`] >= d[`d${k}_at`]) throw new Error(`${DAYS[k]}: masa tamat mesti selepas masa mula.`); out.push({ d: k, from: d[`d${k}_af`], to: d[`d${k}_at`] }); }
    if (d[`d${k}_bf`] && d[`d${k}_bt`]) { if (d[`d${k}_bf`] >= d[`d${k}_bt`]) throw new Error(`${DAYS[k]}: julat kedua tidak sah.`); out.push({ d: k, from: d[`d${k}_bf`], to: d[`d${k}_bt`] }); } }
  return out; };

export async function savePrivate(staffId, patch) {
  const row = { staff_id: staffId, ...patch, updated_at: nowISO() };
  if (S.mode === 'supabase') { const { data, error } = await S.client.from('staff_private').upsert(row).select().single(); if (error) throw error; Object.assign(row, data); }
  const L = (S.t.staff_private ||= []), i = L.findIndex(x => x.staff_id === staffId); if (i >= 0) L[i] = { ...L[i], ...row }; else L.push(row);
}
export const privateForm = pv => `<div class="form-grid">
  ${F('Nama bank', 'bank_name', { value: pv?.bank_name, ph: 'cth. Maybank' })}${F('No. akaun bank', 'bank_account', { value: pv?.bank_account, ph: 'untuk bayaran gaji' })}
  ${F('Nama pemegang akaun', 'account_holder', { value: pv?.account_holder, full: true })}
  ${F('Kenalan kecemasan', 'emergency_name', { value: pv?.emergency_name })}${F('No. telefon kecemasan', 'emergency_phone', { value: pv?.emergency_phone })}
  ${F('Hubungan', 'emergency_rel', { value: pv?.emergency_rel, ph: 'cth. Isteri / Ibu' })}${F('Saiz baju (jersi coach)', 'shirt_size', { value: pv?.shirt_size, ph: 'cth. M' })}
  ${F('Alamat', 'address', { type: 'textarea', value: pv?.address, full: true })}</div>
  <p class="muted" style="font-size:12px;margin-top:8px">🔒 Hanya admin dan coach ini sahaja boleh melihat maklumat ini.</p>`;
export const privatePatch = d => Object.fromEntries(['bank_name', 'bank_account', 'account_holder', 'emergency_name', 'emergency_phone', 'emergency_rel', 'shirt_size', 'address'].map(k => [k, (d[k] || '').trim() || null]));
