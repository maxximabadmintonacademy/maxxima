// Penggunaan pakej: senarai sesi yang ditolak daripada satu pakej, dengan kiraan berjalan (1/8, 2/8 …).
// Dikongsi oleh portal admin & ibu bapa supaya kedua-duanya nampak angka yang sama.
import { ACTIONS, INPUTS } from './registry.js';
import { S, update, remove, refresh, loadStudentHistory } from './data.js';
import { esc, openModal, closeModal, confirmModal, toast, app, fmtShort, DAYS, LABEL } from './ui.js';
import { t } from './i18n.js';
import { T, byId, venueName, progName, pkgRemaining } from './admin/helpers.js';

const CONS = ['present', 'late', 'absent', 'late_cancel'];
const toMin = x => { const [h, m] = String(x || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const hrsOf = a => { if (a.hours != null && a.hours !== '') return Number(a.hours);
  const s = byId('class_sessions', a.session_id), c = s && byId('classes', s.class_id);
  const st = s?.start_time || c?.start_time, en = s?.end_time || c?.end_time; return st && en ? Math.max((toMin(en) - toMin(st)) / 60, 0) : 1; };

/** Rekod kehadiran yang ditolak daripada pakej p (ikut tarikh), dengan jumlah berjalan. */
export function pkgUsage(p) {
  const jam = p.unit === 'jam', off = Number(p.used_offset || 0);
  let cum = off;
  const rows = T('attendance').filter(a => a.student_package_id === p.id && CONS.includes(a.status))
    .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))
    .map(a => { const amt = jam ? hrsOf(a) : 1; cum += amt; const s = byId('class_sessions', a.session_id), c = s && byId('classes', s.class_id);
      return { a, c, amt, cum: Math.round(cum * 100) / 100 }; });
  return { rows, off, jam, total: Number(p.sessions_total || 0), used: Math.round(cum * 100) / 100 };
}

/* Kawalan edit (admin sahaja): status · pindah pakej · lepaskan · tukar kelas · padam */
const ST_OPTS = ['present', 'late', 'absent', 'late_cancel', 'excused', 'trial'];
function editCtl(a, p) {
  const others = T('student_packages').filter(x => x.student_id === p.student_id && x.id !== p.id && x.status !== 'cancelled');
  return `<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap">
    <select class="att-select a-${a.status}" data-on-change="pu-status" data-key="${a.id}|${p.id}" style="min-width:120px">${ST_OPTS.map(o => `<option value="${o}" ${a.status === o ? 'selected' : ''}>${esc(LABEL[o] || o)}</option>`).join('')}</select>
    <select data-on-change="pu-move" data-key="${a.id}|${p.id}" title="Pindah ke pakej lain" style="max-width:150px"><option value="">Pindah pakej…</option>${others.map(x => `<option value="${x.id}">${esc(x.name)} · baki ${pkgRemaining(x)}</option>`).join('')}<option value="-">— Lepaskan dari pakej —</option></select>
    <button type="button" class="btn sm" data-action="pu-class" data-id="${a.id}" title="Tukar kelas (tarikh sama)">Kelas</button>
    <button type="button" class="btn sm danger-o" data-action="pu-del" data-id="${a.id}|${p.id}" title="Padam rekod kehadiran">✕</button></div>`;
}
const reopen = async pkId => { if (S.mode === 'supabase') { try { await refresh(['student_packages']); await loadStudentHistory(byId('student_packages', pkId)?.student_id, true); } catch (_) {} } app.render?.(); setTimeout(() => ACTIONS['pkg-usage'](pkId), 40); };
INPUTS['pu-status'] = async (v, el) => { const [aid, pk] = el.dataset.key.split('|');
  try { await update('attendance', aid, { status: v, ...(CONS.includes(v) ? {} : { student_package_id: null }) }); toast(`Ditanda: ${LABEL[v] || v}${CONS.includes(v) ? '' : ' — dikeluarkan dari pakej (tidak ditolak)'}`); } catch (e) { toast(e.message || String(e), true); }
  reopen(pk); };
INPUTS['pu-move'] = async (v, el) => { if (!v) return; const [aid, pk] = el.dataset.key.split('|');
  try { await update('attendance', aid, { student_package_id: v === '-' ? null : v }); toast(v === '-' ? 'Sesi dilepaskan dari pakej' : 'Sesi dipindah ke ' + (byId('student_packages', v)?.name || 'pakej lain')); } catch (e) { toast(e.message || String(e), true); }
  reopen(pk); };
ACTIONS['pu-class'] = id => ACTIONS['sq-att-move']?.(id);
/* Padam pakej (cth. pakej berganda dari import lama): pindahkan sesinya ke pakej lain atau lepaskan, kemudian padam */
ACTIONS['pkg-del'] = async id => {
  const p = byId('student_packages', id); if (!p) return;
  try { await loadStudentHistory(p.student_id); } catch (_) {}
  const att = T('attendance').filter(a => a.student_package_id === id), inv = byId('invoices', p.invoice_id);
  const others = T('student_packages').filter(x => x.student_id === p.student_id && x.id !== id && x.status !== 'cancelled');
  openModal({ title: 'Padam pakej?', submit: 'Padam pakej',
    body: `<p style="margin-top:0"><b>${esc(p.name)}</b> · ${esc(progName(p.programme_id))} · ${Number(p.sessions_used || 0)}/${p.sessions_total} digunakan</p>
      ${att.length ? `<label class="f full">${att.length} sesi dalam pakej ini<select name="to"><option value="">Lepaskan (sesi kekal, tidak ditolak mana-mana pakej)</option>${others.map(x => `<option value="${x.id}">Pindah ke: ${esc(x.name)} · baki ${pkgRemaining(x)}</option>`).join('')}</select></label>` : '<p class="muted">Tiada sesi dalam pakej ini.</p>'}
      ${inv ? `<div class="hint warn" style="margin-top:10px">Pakej ini dipautkan kepada invois ${esc(inv.number)} (${esc(inv.status)}). Invois tidak dipadam — batalkan invois secara berasingan jika perlu.</div>` : ''}
      <p class="muted" style="font-size:12.5px">Rekod kehadiran tidak dipadam. Tindakan ini tidak boleh dibatalkan.</p>`,
    onSubmit: async d => {
      for (const a of att) await update('attendance', a.id, { student_package_id: d.to || null });
      await remove('student_packages', id);
      if (S.mode === 'supabase') { try { await refresh(['student_packages']); await loadStudentHistory(p.student_id, true); } catch (_) {} }
      toast('Pakej dipadam' + (att.length ? (d.to ? ` · ${att.length} sesi dipindah` : ` · ${att.length} sesi dilepaskan`) : '')); app.render?.();
      setTimeout(() => ACTIONS['sq-pkg']?.(p.student_id), 60);
    } });
};
ACTIONS['pu-old'] = id => { const p = byId('student_packages', id); if (p) ACTIONS['sq-att-old']?.(p.student_id, p.id); };
ACTIONS['pu-del'] = key => { const [aid, pk] = key.split('|'), a = byId('attendance', aid);
  confirmModal({ title: 'Padam rekod kehadiran?', message: `${fmtShort(a?.session_date)} — rekod ini dipadam dan sesi tidak lagi ditolak daripada pakej. Ibu bapa tidak akan nampak rekod ini.`, ok: 'Padam', danger: true,
    onOk: async () => { await remove('attendance', aid); toast('Rekod dipadam'); reopen(pk); } }); };

/** HTML senarai penggunaan pakej (admin & ibu bapa). */
export function pkgUsageHtml(p, { admin = false } = {}) {
  const u = pkgUsage(p), unit = u.jam ? t('jam') : t('sesi');
  const head = `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px">
      <div><b>${esc(p.name)}</b><div class="muted" style="font-size:12.5px">${esc(progName(p.programme_id))}${p.starts_on ? ' · ' + t('mula') + ' ' + fmtShort(p.starts_on) : ''}${p.expires_on ? ' · ' + t('tamat') + ' ' + fmtShort(p.expires_on) : ''}</div></div>
      <div class="num" style="font-size:15px"><b>${u.used}</b> / ${u.total} ${unit} ${t('digunakan')} · <b>${pkgRemaining(p)}</b> ${t('baki')}</div></div>`;
  const offRow = u.off ? `<li class="list-item" style="padding:8px 14px"><div class="li-main"><div class="li-title">${t('Sesi sebelum sistem digunakan')}</div><div class="li-sub">${t('Direkod oleh admin daripada rekod lama')}</div></div><div class="num"><b>${u.off}</b> ${unit} → ${u.off}/${u.total}</div></li>` : '';
  const rows = u.rows.map((r, i) => `<li class="list-item" style="padding:8px 14px"><div class="li-main">
      <div class="li-title">${u.jam ? '' : `<span class="muted" style="display:inline-block;min-width:28px">#${i + 1 + (u.jam ? 0 : u.off)}</span>`}${DAYS[new Date(r.a.session_date + 'T00:00').getDay()].slice(0, 3)} ${fmtShort(r.a.session_date)} · ${esc(r.c ? progName(r.c.programme_id) : '')}</div>
      <div class="li-sub">${esc(r.c ? venueName(r.c.venue_id) : '')}${r.a.note && admin ? ' · ' + esc(r.a.note) : ''}</div></div>
      <div style="text-align:right">${admin ? editCtl(r.a, p) : `<span class="badge ${r.a.status === 'present' || r.a.status === 'late' ? 'b-ok' : 'b-warn'}">${esc(LABEL[r.a.status] || r.a.status)}</span>`}
      <div class="muted num" style="font-size:12px;margin-top:3px">${u.jam ? `${r.amt} ${t('jam')} · ` : ''}${r.cum}/${u.total}</div></div></li>`).join('');
  const empty = !u.rows.length && !u.off ? `<li class="empty">${t('Belum ada sesi ditolak daripada pakej ini.')}</li>` : '';
  const warn = u.used > u.total ? `<div class="hint warn" style="margin-top:8px">${t('Sesi yang ditolak melebihi jumlah pakej — semak rekod.')}</div>` : '';
  const note = `<p class="muted" style="font-size:12px;margin:8px 0 0">${t('"Tidak hadir" dan "batal lewat" dikira mengikut polisi akademi. Cuti / trial tidak ditolak.')}</p>`;
  return `${head}<ul class="list" style="margin:0 -6px;border:1px solid var(--line);border-radius:12px">${offRow}${rows}${empty}</ul>${warn}${note}`;
}

/** Tetingkap penggunaan pakej. Admin: + butang pautkan sesi / kembali ke senarai pakej. */
ACTIONS['pkg-usage'] = async id => {
  let p = byId('student_packages', id); if (!p) return;
  try { await loadStudentHistory(p.student_id); } catch (_) {}   // kehadiran lama di luar tetingkap 90 hari
  p = byId('student_packages', id);
  const admin = ['admin', 'official'].includes(S.profile?.role);
  const orph = admin ? T('attendance').filter(a => a.student_id === p.student_id && !a.student_package_id && CONS.includes(a.status)).length : 0;
  openModal({ title: t('Sesi dalam pakej'), wide: true, cancel: t('Tutup'),
    body: pkgUsageHtml(p, { admin }) + (admin ? `<div class="actions" style="margin-top:12px">${orph ? `<button type="button" class="btn danger-o" data-action="att-link" data-id="${p.student_id}">Pautkan ${orph} sesi ke pakej</button>` : ''}<button type="button" class="btn primary" data-action="pu-old" data-id="${p.id}">+ Tambah sesi ke pakej ini</button><button type="button" class="btn" data-action="sq-pkg" data-id="${p.student_id}">← Semua pakej</button><button type="button" class="btn danger-o" data-action="pkg-del" data-id="${p.id}">Padam pakej</button></div>` : '') });
};
