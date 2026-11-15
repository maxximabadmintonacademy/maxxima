/* Kesan kemungkinan profil pelajar berganda (cth. "Naufal", "Aydan Naufal", "Aydan Naufal bin Abdul Muhaimin"). */
import { ACTIONS } from '../registry.js';
import { S, saveSetting, setting } from '../data.js';
import { esc, toast, openModal, closeModal, app, LABEL } from '../ui.js';
import { T, byId, progName, venueName } from './helpers.js';
import { openMerge } from './merge.js';

const STOP = new Set(['bin', 'binti', 'bt', 'bte', 'b', 'a/l', 'a/p', 'al', 'ap', 'mohd', 'muhammad', 'muhd', 'md', 'nur', 'nurul', 'siti', 'abdul', 'abd']);
const toks = n => String(n || '').toLowerCase().replace(/[^a-z0-9À-ɏ一-鿿/ ]+/g, ' ').split(/\s+/).filter(Boolean);
const core = n => toks(n).filter(t => !STOP.has(t));
const phone9 = p => String(p || '').replace(/\D/g, '').slice(-9);
const key = ids => [...ids].sort().join('|');
/** Nama pendek terkandung sepenuhnya dalam nama panjang (abaikan bin/binti/mohd dsb.), atau sama tepat. */
function similar(a, b) {
  const A = core(a), B = core(b); if (!A.length || !B.length) return false;
  if (A.join(' ') === B.join(' ')) return true;
  const [s, l] = A.length <= B.length ? [A, B] : [B, A];
  return s.every(t => l.includes(t)) && (s.length >= 2 || l.indexOf(s[0]) <= 1);   // satu perkataan: mesti nama pertama/kedua
}
let _c = null;
export function findDupes() {
  const sig = T('students').length + ':' + T('students').reduce((n, s) => n + (s.merged_into ? 1 : 0) + (s.archived_at ? 2 : 0), 0) + ':' + JSON.stringify(setting('dupe_ignore', {}));
  if (_c && _c.sig === sig && _c.ref === S.t.students) return _c.res;
  const res = _find(); _c = { sig, ref: S.t.students, res }; return res;
}
function _find() {
  const ign = new Set(setting('dupe_ignore', { keys: [] }).keys || []);
  const st = T('students').filter(s => !s.merged_into && !s.archived_at), C = new Map(st.map(s => [s.id, core(s.full_name).join(' ')]));
  const par = new Map(st.map(s => [s.id, s.id])), f = x => par.get(x) === x ? x : (par.set(x, f(par.get(x))), par.get(x));
  const why = new Map();
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
    const a = st[i], b = st[j];
    const sameAcct = a.guardian_id && a.guardian_id === b.guardian_id, samePhone = phone9(a.guardian_phone).length === 9 && phone9(a.guardian_phone) === phone9(b.guardian_phone);
    const exact = C.get(a.id) && C.get(a.id) === C.get(b.id);
    if (!(exact || ((sameAcct || samePhone) && similar(a.full_name, b.full_name)))) continue;
    if (a.birth_date && b.birth_date && a.birth_date !== b.birth_date && !exact) continue;   // tarikh lahir berbeza = adik-beradik
    par.set(f(a.id), f(b.id)); why.set(key([a.id, b.id]), exact ? 'nama sama' : sameAcct ? 'akaun ibu bapa sama' : 'no. telefon sama');
  }
  const groups = new Map(); for (const s of st) { const r = f(s.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s); }
  return [...groups.values()].filter(g => g.length > 1 && !ign.has(key(g.map(s => s.id))))
    .map(g => ({ ids: g.map(s => s.id), list: g, reasons: [...new Set([...why].filter(([k]) => k.split('|').every(id => g.some(s => s.id === id))).map(([, v]) => v))] }));
}
const cnt = id => T('attendance').filter(a => a.student_id === id).length;
function body() {
  const G = findDupes();
  if (!G.length) return '<div class="empty" style="padding:28px">Tiada kemungkinan profil berganda. 🎉</div>';
  return `<p style="font-size:13.5px;margin-top:0">${G.length} kumpulan profil yang mungkin orang yang sama — dikesan dari nama yang serupa <b>dan</b> akaun ibu bapa / no. telefon yang sama, atau nama yang sama tepat. Adik-beradik (tarikh lahir berbeza) tidak disenaraikan.</p>` +
    G.map(g => `<div class="dp-g"><div class="dp-h"><span class="muted">${esc(g.reasons.join(' · '))}</span><span><button type="button" class="btn sm primary" data-action="dupe-merge" data-id="${g.ids.join(',')}">Gabung…</button> <button type="button" class="btn sm ghost" data-action="dupe-ignore" data-id="${g.ids.join(',')}">Bukan orang sama</button></span></div>
      ${g.list.map(s => `<div class="dp-r"><b>${esc(s.full_name)}</b><span>${esc([LABEL[s.status] || s.status, progName(s.programme_id), venueName(s.venue_id), s.birth_date ? 'lahir ' + s.birth_date : '', s.guardian_id ? 'ada akaun ibu bapa' : '', cnt(s.id) + ' kehadiran'].filter(x => x && x !== '—').join(' · '))}</span></div>`).join('')}</div>`).join('');
}
export const dupeCount = () => findDupes().length;
ACTIONS['dupe-open'] = () => openModal({ title: 'Kemungkinan profil berganda', wide: true, body: `<div id="dp-body">${body()}</div>` });
ACTIONS['dupe-merge'] = ids => { closeModal(); openMerge(ids.split(','), { after: () => {} }); };
ACTIONS['dupe-ignore'] = async ids => { const cur = setting('dupe_ignore', { keys: [] }); await saveSetting('dupe_ignore', { keys: [...new Set([...(cur.keys || []), key(ids.split(','))])] }); toast('Ditanda bukan orang sama'); const el = document.getElementById('dp-body'); if (el) el.innerHTML = body(); app.render(); };
