// Perlu Semak: semua rekod import lama yang ditanda perlu disahkan admin. Simpan = sah, Padam = buang.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, update, remove, loadAll } from '../data.js';
import { ic, esc, app, toast, confirmModal, pageHead, fmtDate, RM, UI, friendlyError } from '../ui.js';
import { T, byId, studentName } from './helpers.js';

const TABS = [
  ['students', 'Pelajar'], ['classes', 'Kelas'], ['student_packages', 'Pakej'], ['invoices', 'Invois'],
  ['payments', 'Bayaran'], ['attendance', 'Kehadiran'], ['legacy_records', 'Rekod Lama'],
];
const LIMIT = 100;
const rev = () => (S.rev ||= { loaded: false, loading: false, attendance: null, legacy_records: [] });

async function loadReview() {
  const R = rev(); if (R.loading || R.loaded) return;
  R.loading = true;
  try {
    if (S.mode === 'demo') { R.attendance = (S.t.attendance || []).filter(a => a.needs_review); R.legacy_records = []; }
    else {
      for (const t of ['attendance', 'legacy_records']) {
        const out = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await S.client.from(t).select('*').eq('needs_review', true).order('id').range(from, from + 999);
          if (error) throw error;
          out.push(...data); if (data.length < 1000) break;
        }
        R[t] = out;
      }
    }
    R.loaded = true;
  } catch (e) { toast(friendlyError ? friendlyError(e) : e.message, true); }
  R.loading = false; app.render();
}

const rows = t => (t === 'attendance' || t === 'legacy_records') ? (rev()[t] || []) : T(t).filter(r => r.needs_review);
export const reviewCount = () => ['students', 'classes', 'student_packages', 'invoices', 'payments'].reduce((n, t) => n + rows(t).length, 0) + (rev().loaded ? rows('attendance').length + rows('legacy_records').length : 0);

const text = (t, r) => {
  const kid = id => studentName ? studentName(id) : '';
  switch (t) {
    case 'students': return [r.full_name, [r.guardian_name, r.guardian_phone, LABELS[r.status] || r.status].filter(Boolean).join(' · ')];
    case 'classes': { const v = byId('venues', r.venue_id), p = byId('programmes', r.programme_id); return [`${p?.name || ''} · ${v?.name || ''}`, `Hari ${r.weekday} · ${String(r.start_time).slice(0, 5)}-${String(r.end_time).slice(0, 5)}`]; }
    case 'student_packages': return [`${kid(r.student_id)} · ${r.name}`, `${r.sessions_used}/${r.sessions_total} sesi · ${RM(r.price)} · ${r.status}`];
    case 'invoices': return [`${r.number} · ${kid(r.student_id)}`, `${RM(r.amount)} · ${r.status} · ${fmtDate(r.issued_on)}`];
    case 'payments': { const i = byId('invoices', r.invoice_id); return [`${RM(r.amount)} · ${i?.number || ''} · ${kid(i?.student_id)}`, `${r.method} · ${fmtDate(r.paid_on)}`]; }
    case 'attendance': return [`${kid(r.student_id)} · ${fmtDate(r.session_date)}`, r.status];
    default: return [r.title, `${r.kind}${r.ref_date ? ' · ' + fmtDate(r.ref_date) : ''}${r.detail ? ' · ' + r.detail : ''}`];
  }
};
const LABELS = { active: 'Aktif', left: 'Berhenti', paused: 'Tangguh' };

VIEWS.semak = () => {
  const R = rev(); if (!R.loaded && !R.loading) setTimeout(loadReview, 0);
  const tab = UI.rvTab || 'students', q = (UI.rvQ || '').toLowerCase();
  const all = rows(tab);
  const list = all.filter(r => !q || (text(tab, r).join(' ') + ' ' + (r.review_note || '')).toLowerCase().includes(q));
  const lazy = (tab === 'attendance' || tab === 'legacy_records') && !R.loaded;
  return `
  ${pageHead('Perlu Semak', 'Rekod import lama yang belum pasti. Tekan Simpan jika betul, atau Padam jika tidak mahu. Rekod yang disimpan hilang dari senarai ini.')}
  <div class="chips mb">${TABS.map(([k, l]) => { const n = ((k === 'attendance' || k === 'legacy_records') && !R.loaded) ? '…' : rows(k).length; return `<button class="chip ${tab === k ? 'on' : ''}" data-action="rv-tab" data-id="${k}">${l}<span class="n">${n}</span></button>`; }).join('')}</div>
  <div class="card">
    <div class="toolbar">
      <label class="field grow">${ic('search', 'sm')}<input data-on-input="rv-q" placeholder="Cari nama, nota…" value="${esc(UI.rvQ || '')}"></label>
      <button class="btn sm" data-action="rv-all-keep" ${list.length ? '' : 'disabled'}>Simpan semua (${list.length})</button>
      <button class="btn sm danger-o" data-action="rv-all-del" ${list.length ? '' : 'disabled'}>Padam semua (${list.length})</button>
    </div>
    ${lazy ? '<div class="empty">Memuatkan…</div>' : list.length ? `<ul class="list">${list.slice(0, LIMIT).map(r => { const [a, b] = text(tab, r); return `<li class="list-item" style="flex-wrap:wrap;align-items:flex-start">
      <div class="li-main" style="min-width:220px"><div class="li-title">${esc(a)}</div><div class="li-sub">${esc(b)}</div>${r.review_note ? `<div class="li-sub" style="color:var(--warn);margin-top:3px">⚠ ${esc(r.review_note)}</div>` : ''}</div>
      <div class="actions"><button class="btn sm primary" data-action="rv-keep" data-id="${r.id}">Simpan</button><button class="btn sm danger-o" data-action="rv-del" data-id="${r.id}">Padam</button></div></li>`; }).join('')}</ul>${list.length > LIMIT ? `<div class="muted" style="padding:12px 20px;font-size:13px">Menunjukkan ${LIMIT} pertama daripada ${list.length}. Gunakan carian, atau selesaikan yang di atas dahulu.</div>` : ''}` : '<div class="empty">Tiada rekod perlu semak di sini. 🎉</div>'}
  </div>`;
};

const cur = () => { const tab = UI.rvTab || 'students', q = (UI.rvQ || '').toLowerCase(); return { tab, list: rows(tab).filter(r => !q || (text(tab, r).join(' ') + ' ' + (r.review_note || '')).toLowerCase().includes(q)) }; };
const dropLocal = (tab, ids) => {
  const set = new Set(ids);
  if (tab === 'attendance' || tab === 'legacy_records') rev()[tab] = rev()[tab].filter(r => !set.has(r.id));
};
async function bulk(tab, ids, op) {
  if (S.mode === 'demo') {
    if (op === 'keep') ids.forEach(id => { const r = S.t[tab]?.find(x => x.id === id); if (r) { r.needs_review = false; r.review_note = null; } });
    else for (const id of ids) await remove(tab, id);
  } else {
    for (let i = 0; i < ids.length; i += 100) {
      const part = ids.slice(i, i + 100);
      const { error } = op === 'keep' ? await S.client.from(tab).update({ needs_review: false, review_note: null }).in('id', part) : await S.client.from(tab).delete().in('id', part);
      if (error) throw error;
    }
  }
  if (tab === 'attendance' || tab === 'legacy_records') dropLocal(tab, ids);
  else if (S.mode === 'supabase') { await loadAll(); S.rev = null; }
}
const run = async (fn, okMsg) => { try { await fn(); toast(okMsg); } catch (e) { toast(friendlyError ? friendlyError(e) : e.message, true); } app.render(); };

ACTIONS['rv-tab'] = id => { UI.rvTab = id; app.render(); };
ACTIONS['rv-keep'] = id => run(() => bulk(UI.rvTab || 'students', [id], 'keep'), 'Disimpan');
ACTIONS['rv-del'] = id => { const tab = UI.rvTab || 'students'; confirmModal({ title: 'Padam rekod ini?', message: 'Rekod ini akan dipadam kekal (termasuk rekod berkaitan seperti invois pelajar).', ok: 'Padam', danger: true, onOk: () => run(() => bulk(tab, [id], 'del'), 'Dipadam') }); };
ACTIONS['rv-all-keep'] = () => { const { tab, list } = cur(); confirmModal({ title: `Simpan ${list.length} rekod?`, message: 'Semua rekod yang dipaparkan ditanda sebagai sah.', ok: 'Simpan semua', onOk: () => run(() => bulk(tab, list.map(r => r.id), 'keep'), 'Disimpan') }); };
ACTIONS['rv-all-del'] = () => { const { tab, list } = cur(); confirmModal({ title: `Padam ${list.length} rekod?`, message: 'Semua rekod yang dipaparkan dipadam <b>kekal</b>, termasuk invois/pakej/kehadiran pelajar berkaitan. Tidak boleh dibatalkan.', ok: 'Padam semua', danger: true, onOk: () => run(() => bulk(tab, list.map(r => r.id), 'del'), 'Dipadam') }); };
INPUTS['rv-q'] = v => { UI.rvQ = v; app.render(); };
