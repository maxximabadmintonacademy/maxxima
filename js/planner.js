// Pelan latihan (coaching planner) — dikongsi Portal Coach & admin.
import { S, insert, update, remove } from './data.js';
import { esc, F, val, toast, openModal, todayISO, hm, fmtShort } from './ui.js';
import { T, byId, progName, venueName, staffName } from './admin/helpers.js';

export const BLOCKS = [
  ['warmup', 'Warm up', 'Lari ringan, mobiliti sendi, regangan dinamik'],
  ['dynamic', 'Dynamic workout', 'Skipping, high knees, lunges, shuttle run'],
  ['shadow', 'Shadow footwork', 'Shadow 4 penjuru / 6 penjuru'],
  ['feeding1', 'Feeding 1 — teknikal', 'cth. Backhand clear'],
  ['feeding2', 'Feeding 2', 'cth. Backhand tap & net'],
  ['multi', 'Multi-shuttle / drill', 'Drill pantas berpasangan'],
  ['physical', 'Latihan fizikal', 'Core, kekuatan kaki, ketangkasan'],
  ['sparring', 'Sparring / game', 'cth. 2 lawan 1, game 11 mata'],
  ['cooldown', 'Cool down', 'Regangan statik, pernafasan'],
];
export const blockName = k => (BLOCKS.find(b => b[0] === k) || [k, k])[1];
export const LEVELS = ['Asas', 'Pertengahan', 'Lanjutan', 'Kompetitif'];
const mins = p => (p.blocks || []).reduce((n, b) => n + (Number(b.minutes) || 0), 0);

export function planCard(p, { canEdit = true } = {}) {
  return `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>${esc(p.title)}</b>${p.is_template ? ' <span class="badge b-purple">Templat</span>' : ''}
    <div class="muted" style="font-size:12.5px">${[p.plan_date ? fmtShort(p.plan_date) : '', p.start_time ? hm(p.start_time) + (p.end_time ? '–' + hm(p.end_time) : '') : '', p.level, progName(p.programme_id), p.venue_id ? venueName(p.venue_id) : '', p.coach_id ? staffName(p.coach_id) : ''].filter(x => x && x !== '—').map(esc).join(' · ')} · ${(p.blocks || []).length} blok · ${mins(p)} min</div></div>
    <div class="actions"><button class="btn sm" data-action="lp-view" data-id="${p.id}">Lihat</button>${canEdit ? `<button class="btn sm" data-action="lp-edit" data-id="${p.id}">Edit</button>` : ''}<button class="btn sm" data-action="lp-copy" data-id="${p.id}">Salin</button></div></div></div>`;
}

export function planView(p) {
  return `<div class="muted" style="font-size:13px">${[p.level, progName(p.programme_id), p.venue_id ? venueName(p.venue_id) : '', p.plan_date ? fmtShort(p.plan_date) : ''].filter(x => x && x !== '—').map(esc).join(' · ')}</div>
  ${p.objective ? `<p style="margin-top:8px"><b>Objektif:</b> ${esc(p.objective)}</p>` : ''}
  <ol style="margin:12px 0 0 18px;line-height:1.6">${(p.blocks || []).map(b => `<li style="margin-bottom:8px"><b>${esc(b.title || blockName(b.kind))}</b>${b.minutes ? ` · ${b.minutes} min` : ''}${b.sets ? ` · ${esc(b.sets)} set` : ''}${b.reps ? ` × ${esc(b.reps)}` : ''}${b.details ? `<div style="white-space:pre-line;font-size:13px">${esc(b.details)}</div>` : ''}</li>`).join('')}</ol>
  ${p.observation ? `<p style="margin-top:10px"><b>Pemerhatian:</b><br><span style="white-space:pre-line">${esc(p.observation)}</span></p>` : ''}
  ${p.to_improve ? `<p style="margin-top:8px"><b>Perlu diperbaiki:</b><br><span style="white-space:pre-line">${esc(p.to_improve)}</span></p>` : ''}
  ${p.next_plan ? `<p style="margin-top:8px"><b>Rancangan kelas seterusnya:</b><br><span style="white-space:pre-line">${esc(p.next_plan)}</span></p>` : ''}`;
}

const blockRow = (b, i) => `<div class="card card-pad mb lp-b" style="padding:10px 12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
  <b style="min-width:20px">${i + 1}.</b><select name="b_kind" style="max-width:200px">${BLOCKS.map(([k, l]) => `<option value="${k}" ${b.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
  <input name="b_title" placeholder="Tajuk (pilihan)" value="${esc(b.title || '')}" style="flex:1;min-width:140px">
  <input name="b_min" type="number" min="0" placeholder="min" value="${esc(b.minutes ?? '')}" style="width:70px"><input name="b_sets" placeholder="set" value="${esc(b.sets ?? '')}" style="width:60px"><input name="b_reps" placeholder="ulang/org" value="${esc(b.reps ?? '')}" style="width:80px">
  <button type="button" class="btn sm" data-lpb="up">↑</button><button type="button" class="btn sm danger-o" data-lpb="rm">✕</button></div>
  <textarea name="b_det" placeholder="Butiran: corak, fokus teknik, nota setiap pelajar…" style="margin-top:6px;min-height:52px">${esc(b.details || '')}</textarea></div>`;

/** Editor pelan latihan. coachId: id staf pemilik (coach) */
export function openPlanEditor(p, { coachId = null, onSaved } = {}) {
  const blocks = p?.blocks?.length ? p.blocks : BLOCKS.filter(b => ['warmup', 'dynamic', 'shadow', 'feeding1', 'feeding2', 'physical', 'sparring'].includes(b[0])).map(([k, l, d]) => ({ kind: k, title: '', details: '', minutes: k === 'warmup' ? 10 : k === 'sparring' ? 20 : 15 }));
  const f = openModal({ title: p?.id ? 'Edit Pelan Latihan' : 'Pelan Latihan Baharu', submit: 'Simpan', wide: true, body: `<div class="form-grid">
    ${F('Tajuk', 'title', { value: p?.title, req: true, full: true, ph: 'cth. Backhand & net — Foundation U12' })}
    ${F('Tahap', 'level', { value: p?.level || '', opts: [['', '—'], ...LEVELS.map(l => [l, l])] })}
    ${F('Program', 'programme_id', { value: p?.programme_id || '', opts: [['', '—'], ...T('programmes').filter(x => x.active).map(x => [x.id, x.name])] })}
    ${F('Lokasi', 'venue_id', { value: p?.venue_id || '', opts: [['', '—'], ...T('venues').filter(x => x.active).map(x => [x.id, x.name])] })}
    ${F('Tarikh', 'plan_date', { type: 'date', value: p?.plan_date || todayISO() })}
    ${F('Mula', 'start_time', { type: 'time', value: hm(p?.start_time) })}${F('Tamat', 'end_time', { type: 'time', value: hm(p?.end_time) })}
    ${F('Objektif sesi', 'objective', { type: 'textarea', value: p?.objective, full: true })}
  </div><h3 style="font-size:14px;margin:14px 0 8px">Aktiviti</h3><div id="lpBlocks">${blocks.map(blockRow).join('')}</div>
  <button type="button" class="btn sm" id="lpAdd">+ Tambah aktiviti</button>
  <div class="form-grid" style="margin-top:14px">${F('Pemerhatian', 'observation', { type: 'textarea', value: p?.observation, full: true })}${F('Perlu diperbaiki', 'to_improve', { type: 'textarea', value: p?.to_improve, full: true })}${F('Rancangan kelas seterusnya', 'next_plan', { type: 'textarea', value: p?.next_plan, full: true })}
  <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="is_template" value="1" ${p?.is_template ? 'checked' : ''} style="width:auto;height:auto"> Simpan sebagai templat (boleh disalin semula)</label></div>`,
    onSubmit: async d => {
      const box = f.querySelector('#lpBlocks'), rows = [...box.querySelectorAll('.lp-b')].map(r => ({ kind: r.querySelector('[name=b_kind]').value, title: r.querySelector('[name=b_title]').value.trim() || null, minutes: Number(r.querySelector('[name=b_min]').value) || null, sets: r.querySelector('[name=b_sets]').value.trim() || null, reps: r.querySelector('[name=b_reps]').value.trim() || null, details: r.querySelector('[name=b_det]').value.trim() || null }));
      const row = { title: d.title.trim(), level: val(d.level), programme_id: val(d.programme_id), venue_id: val(d.venue_id), plan_date: val(d.plan_date), start_time: val(d.start_time), end_time: val(d.end_time), objective: val(d.objective), blocks: rows, observation: val(d.observation), to_improve: val(d.to_improve), next_plan: val(d.next_plan), is_template: d.is_template === '1' };
      if (p?.id) await update('lesson_plans', p.id, row); else await insert('lesson_plans', { ...row, coach_id: coachId });
      toast('Pelan latihan disimpan'); onSaved?.();
    } });
  const box = f.querySelector('#lpBlocks'), renum = () => box.querySelectorAll('.lp-b').forEach((r, i) => { r.querySelector('b').textContent = i + 1 + '.'; });
  f.querySelector('#lpAdd').addEventListener('click', () => { box.insertAdjacentHTML('beforeend', blockRow({ kind: 'feeding1' }, box.children.length)); });
  box.addEventListener('click', e => { const b = e.target.closest('[data-lpb]'); if (!b) return; const r = b.closest('.lp-b'); if (b.dataset.lpb === 'rm') r.remove(); else if (r.previousElementSibling) r.parentNode.insertBefore(r, r.previousElementSibling); renum(); });
  return f;
}
export async function copyPlan(p, coachId) {
  const { id, created_at, ...rest } = p;
  return insert('lesson_plans', { ...rest, title: p.title + ' (salinan)', is_template: false, plan_date: todayISO(), observation: null, to_improve: null, coach_id: coachId ?? p.coach_id });
}
