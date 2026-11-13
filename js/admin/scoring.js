// v25: Skor Langsung — paparan mesra telefon untuk urus setia & pengadil: pilih court, tekan perlawanan, masukkan skor.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { esc, UI, app, pageHead, hm, todayISO } from '../ui.js';
import { T, byId, entryLabel } from './helpers.js';
import { standings, GROUP_NAMES } from '../tn-core.js';

const tnList = () => T('tournaments').filter(t => !t.archived_at && ['open', 'closed', 'ongoing'].includes(t.status)).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
const pickTn = () => { const l = tnList(); return l.find(t => t.id === UI.skTn) || l.find(t => t.status === 'ongoing') || l.find(t => t.start_date >= todayISO()) || l[0]; };

VIEWS.skor = () => {
  const t = pickTn();
  if (!t) return `${pageHead('Skor Langsung', 'Masukkan skor perlawanan kejohanan dari telefon.')}<div class="card empty">Tiada kejohanan aktif. Tukar status kejohanan kepada "Dibuka", "Ditutup" atau "Berlangsung".</div>`;
  const cats = T('tournament_categories').filter(c => c.tournament_id === t.id), cid = new Set(cats.map(c => c.id));
  const all = T('tournament_matches').filter(m => cid.has(m.category_id) && m.entry_a && m.entry_b);
  const courts = [...new Set(all.map(m => m.court).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const ct = UI.skCourt || '', show = UI.skShow || 'pending', cf = UI.skCat || '';
  const list = all.filter(m => (!ct || m.court === ct) && (!cf || m.category_id === cf) && (show === 'all' || (show === 'pending' ? m.status === 'pending' : m.status !== 'pending')))
    .sort((a, b) => (a.play_time || '99').localeCompare(b.play_time || '99') || String(a.court || '').localeCompare(String(b.court || ''), undefined, { numeric: true }) || a.round_no - b.round_no);
  const done = all.filter(m => m.status !== 'pending').length;
  const E = id => byId('tournament_entries', id), cat = id => byId('tournament_categories', id);
  const card = m => { const a = E(m.entry_a), b = E(m.entry_b), act = t.format === 'rr_groups' ? 'rr-score' : 'match-edit';
    const stage = m.stage === 'group' ? 'Kumpulan ' + GROUP_NAMES[(m.group_no || 1) - 1] : m.stage === 'final' ? 'Pusingan akhir' : (m.round_label || 'Pusingan ' + m.round_no);
    return `<button class="sk-card ${m.status !== 'pending' ? 'done' : ''}" data-action="${act}" data-id="${m.id}">
      <div class="sk-meta"><b>${m.play_time ? hm(m.play_time) : '—'}</b>${m.court ? `<span class="sk-court">C${esc(m.court)}</span>` : ''}<span>${esc(cat(m.category_id)?.name || '')} · ${stage} · R${m.round_no}</span></div>
      <div class="sk-vs"><span class="${m.winner === a?.id ? 'w' : ''}">${esc(entryLabel(a))}</span><em>${m.status === 'pending' ? 'lwn' : m.status === 'walkover' ? 'WO' : `${m.score_a ?? ''}–${m.score_b ?? ''}`}</em><span class="${m.winner === b?.id ? 'w' : ''}">${esc(entryLabel(b))}</span></div>
      ${m.status === 'pending' ? '<div class="sk-go">Masukkan skor →</div>' : ''}</button>`; };
  return `${pageHead('Skor Langsung', `${esc(t.name)} · ${done}/${all.length} perlawanan selesai`, tnList().length > 1 ? `<select class="btn" data-on-change="sk-tn">${tnList().map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : '')}
  ${!all.length ? `<div class="card empty">Cabutan belum dijana. Buka <a href="#kejohanan/${t.id}">Kejohanan</a> → Cabutan & Keputusan → "Cabut kumpulan & jana jadual".</div>` : `
  <div class="chips">${[['', 'Semua court'], ...courts.map(c => [c, 'Court ' + c])].map(([k, l]) => `<button class="chip ${ct === k ? 'on' : ''}" data-action="sk-court" data-id="${esc(k)}">${esc(l)}</button>`).join('')}</div>
  <div class="chips">${[['pending', 'Belum main'], ['done', 'Selesai'], ['all', 'Semua']].map(([k, l]) => `<button class="chip ${show === k ? 'on' : ''}" data-action="sk-show" data-id="${k}">${l}</button>`).join('')}
    <select class="chip" data-on-change="sk-cat"><option value="">Semua kategori</option>${cats.map(c => `<option value="${c.id}" ${cf === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
  <div class="sk-grid">${list.map(card).join('') || '<div class="card empty">Tiada perlawanan untuk tapisan ini.</div>'}</div>
  ${cf ? standingsBox(t, cat(cf)) : ''}`}
  <p class="muted" style="font-size:12px;margin-top:12px">Skor dikemas kini terus di halaman awam & portal peserta${t.draw_public ? '' : ' (selepas "Terbitkan cabutan & jadual" ditanda)'}. Satu game hingga ${t.points_to || 21} mata.</p>`;
};

function standingsBox(t, c) {
  const ms = T('tournament_matches').filter(m => m.category_id === c.id && m.stage === 'group');
  const groups = [...new Set(ms.map(m => m.group_no))].sort((a, b) => a - b); if (!groups.length) return '';
  return `<h3 style="margin:18px 0 8px">Kedudukan — ${esc(c.name)}</h3><div class="grid g-2">${groups.map(g => { const gm = ms.filter(m => m.group_no === g), ids = [...new Set(gm.flatMap(m => [m.entry_a, m.entry_b]).filter(Boolean))];
    return `<div class="card card-pad"><b>Kumpulan ${GROUP_NAMES[g - 1]}</b><div class="table-wrap"><table class="rr-table"><tbody>${standings(ids, gm).map((r, i) => `<tr><td>${i + 1}. ${esc(entryLabel(byId('tournament_entries', r.id)))}</td><td>${r.w}M</td><td>${r.l}K</td><td>${r.pf - r.pa > 0 ? '+' : ''}${r.pf - r.pa}</td></tr>`).join('')}</tbody></table></div></div>`; }).join('')}</div>`;
}

Object.assign(ACTIONS, {
  'sk-court': id => { UI.skCourt = id || ''; app.render(); },
  'sk-show': id => { UI.skShow = id; app.render(); },
});
Object.assign(INPUTS, {
  'sk-tn': v => { UI.skTn = v; UI.skCourt = ''; UI.skCat = ''; app.render(); },
  'sk-cat': v => { UI.skCat = v; app.render(); },
});
