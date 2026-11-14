/* Gabung beberapa profil pelajar ke satu profil utama, dengan semakan data bertindih dahulu. */
import { INPUTS } from '../registry.js';
import { S, rpc, refresh } from '../data.js';
import { esc, toast, openModal, fmtShort, LABEL, app } from '../ui.js';
import { T, byId, progName, venueName, ageOf } from './helpers.js';

const digits = p => String(p || '').replace(/\D/g, '').slice(-9);
const month = d => String(d || '').slice(0, 7);
const counts = id => ({ attendance: T('attendance').filter(r => r.student_id === id).length, invoices: T('invoices').filter(r => r.student_id === id && r.status !== 'void').length,
  packages: T('student_packages').filter(r => r.student_id === id).length, guardians: T('guardians').filter(r => r.student_id === id).length });

/** Semakan dalam pelayar (mod demo / sandaran jika RPC belum dipasang). */
function localPreview(main, others) {
  const m = byId('students', main), mAtt = T('attendance').filter(a => a.student_id === main), mInv = T('invoices').filter(i => i.student_id === main && i.status !== 'void');
  const off = ['excused', 'late_cancel'];
  return { main: { id: m.id, name: m.full_name }, others: others.filter(id => id !== main).map(id => { const o = byId('students', id), att = T('attendance').filter(a => a.student_id === id);
    return { id, name: o.full_name, status: o.status, counts: counts(id),
      same_session: att.flatMap(a => { const b = mAtt.find(x => x.session_id === a.session_id); return b ? [{ date: a.session_date, main: b.status, other: a.status }] : []; }),
      same_date: [...new Set(att.filter(a => !off.includes(a.status) && mAtt.some(b => b.session_date === a.session_date && b.session_id !== a.session_id && !off.includes(b.status))).map(a => a.session_date))],
      same_month_invoices: T('invoices').filter(i => i.student_id === id && i.status !== 'void').flatMap(i => { const j = mInv.filter(x => month(x.issued_on) === month(i.issued_on)); return j.length ? [{ month: month(i.issued_on), other: `${i.number} RM${i.amount}`, main: j.map(x => `${x.number} RM${x.amount}`).join(', ') }] : []; }),
      double_packages: T('student_packages').filter(p => p.student_id === id && p.status === 'active' && T('student_packages').some(q => q.student_id === main && q.status === 'active' && q.programme_id === p.programme_id)).map(p => progName(p.programme_id)),
      birth_diff: o.birth_date && m.birth_date && o.birth_date !== m.birth_date ? { main: m.birth_date, other: o.birth_date } : null,
      phone_diff: digits(o.guardian_phone) && digits(m.guardian_phone) && digits(o.guardian_phone) !== digits(m.guardian_phone) ? { main: m.guardian_phone, other: o.guardian_phone } : null,
      account_diff: !!(o.guardian_id && m.guardian_id && o.guardian_id !== m.guardian_id) }; }) };
}
async function preview(main, others) {
  if (S.mode === 'supabase') { try { return await rpc('admin_merge_preview', { p_main: main, p_others: others }); } catch (e) { if (!/admin_merge_preview|function/i.test(e.message)) throw e; } }
  return localPreview(main, others);
}
const issueCount = o => o.same_session.length + o.same_date.length + o.same_month_invoices.length + o.double_packages.length + (o.birth_diff ? 1 : 0) + (o.phone_diff ? 1 : 0) + (o.account_diff ? 1 : 0);
function reviewHtml(p) {
  const total = p.others.reduce((n, o) => n + issueCount(o), 0);
  return `<div class="mg-head ${total ? 'warn' : 'ok'}">${total ? `⚠ ${total} perkara perlu disemak sebelum digabung` : '✓ Tiada data bertindih — selamat digabung'}</div>` + p.others.map(o => {
    const c = o.counts, rows = [];
    if (o.same_session.length) rows.push(`<li><b>Sesi sama dalam kedua-dua profil (${o.same_session.length})</b> — rekod profil utama dikekalkan, rekod "${esc(o.name)}" dibuang:<div class="mg-list">${o.same_session.map(x => `${fmtShort(x.date)}: utama <i>${esc(LABEL[x.main] || x.main)}</i> / lain <i>${esc(LABEL[x.other] || x.other)}</i>`).join('<br>')}</div></li>`);
    if (o.same_date.length) rows.push(`<li><b>Tarikh sama, sesi berbeza (${o.same_date.length})</b> — mungkin ditempah dua kali: ${o.same_date.map(fmtShort).join(', ')}</li>`);
    if (o.same_month_invoices.length) rows.push(`<li><b>Invois bulan sama</b> — mungkin dibil dua kali:<div class="mg-list">${o.same_month_invoices.map(x => `${esc(x.month)}: lain ${esc(x.other)} · utama ${esc(x.main)}`).join('<br>')}</div></li>`);
    if (o.double_packages.length) rows.push(`<li><b>Dua pakej aktif untuk program sama:</b> ${o.double_packages.map(esc).join(', ')}</li>`);
    if (o.birth_diff) rows.push(`<li><b>Tarikh lahir berbeza:</b> utama ${fmtShort(o.birth_diff.main)} · lain ${fmtShort(o.birth_diff.other)} — pastikan orang yang sama</li>`);
    if (o.phone_diff) rows.push(`<li><b>No. telefon ibu bapa berbeza:</b> utama ${esc(o.phone_diff.main)} · lain ${esc(o.phone_diff.other)}</li>`);
    if (o.account_diff) rows.push(`<li><b>Dipautkan ke akaun ibu bapa berbeza</b> — akaun profil utama dikekalkan</li>`);
    return `<div class="mg-o"><div class="mg-n">${esc(o.name)} <span class="muted">→ dipindah: ${c.attendance} kehadiran · ${c.invoices} invois · ${c.packages} pakej · ${c.guardians} penjaga</span></div>${rows.length ? `<ul>${rows.join('')}</ul>` : '<div class="muted" style="font-size:12.5px">Tiada pertindihan.</div>'}</div>`;
  }).join('');
}
let ctx = null;
async function showReview() {
  const el = document.getElementById('mg-review'); if (!el || !ctx) return;
  el.innerHTML = '<div class="muted">Menyemak…</div>';
  try { const p = await preview(ctx.main, ctx.ids.filter(i => i !== ctx.main)); ctx.issues = p.others.reduce((n, o) => n + issueCount(o), 0); el.innerHTML = reviewHtml(p);
    const ack = document.getElementById('mg-ack'); if (ack) ack.style.display = ctx.issues ? '' : 'none'; }
  catch (e) { el.innerHTML = `<div class="mg-head warn">${esc(e.message)}</div>`; }
}
INPUTS['mg-main'] = v => { if (ctx) { ctx.main = v; showReview(); } };

/** Buka tetingkap gabung. ids = semua profil terpilih; main = cadangan profil utama; after(main) dipanggil selepas berjaya. */
export function openMerge(ids, { main, after, title } = {}) {
  ids = [...new Set(ids)].filter(id => byId('students', id));
  if (ids.length < 2) return toast('Pilih sekurang-kurangnya dua profil', true);
  const score = id => { const s = byId('students', id), c = counts(id); return (s.status === 'active' ? 1000 : 0) + c.attendance + c.invoices * 5 + String(s.full_name).length / 100; };
  ctx = { ids, main: main && ids.includes(main) ? main : [...ids].sort((a, b) => score(b) - score(a))[0], issues: 0 };
  const info = s => [progName(s.programme_id), venueName(s.venue_id), s.birth_date ? ageOf(s.birth_date) + ' thn' : '', s.guardian_name, s.status !== 'active' ? LABEL[s.status] || s.status : ''].filter(v => v && v !== '—').join(' · ');
  openModal({ title: title || `Gabung ${ids.length} profil pelajar`, wide: true, submit: 'Gabung profil',
    body: `<p style="font-size:13.5px">Pilih <b>satu profil utama</b>. Semua data profil lain (kehadiran, invois, pakej, kelas, progres, penjaga) dipindahkan ke profil utama, dan profil lain ditanda "Berhenti · digabung".</p>
      <div class="mg-pick">${ids.map(id => { const s = byId('students', id), c = counts(id); return `<label class="mg-r"><input type="radio" name="main" value="${id}" ${id === ctx.main ? 'checked' : ''} data-on-change="mg-main"><span><b>${esc(s.full_name)}</b><em>${esc(info(s))}</em><em>${c.attendance} kehadiran · ${c.invoices} invois · ${c.packages} pakej</em></span><i>Utama</i></label>`; }).join('')}</div>
      <div id="mg-review" class="mg-review"></div>
      <label class="check-row" id="mg-ack" style="display:none;margin-top:10px"><input type="checkbox" name="ack"> Saya telah menyemak perkara di atas dan mahu teruskan</label>`,
    onSubmit: async d => {
      const to = d.main || ctx.main, from = ids.filter(i => i !== to);
      if (ctx.issues && !d.ack) throw new Error('Tandakan "Saya telah menyemak" dahulu.');
      const b = byId('students', to);
      for (const id of from) {
        if (S.mode === 'demo') {
          const a = byId('students', id);
          for (const t of ['attendance', 'class_enrolments', 'invoices', 'student_packages', 'progress_records', 'guardians', 'student_programmes', 'tournament_entries', 'invoice_items', 'booking_requests']) (S.t[t] || []).filter(r => r.student_id === id).forEach(r => {
            const dup = t === 'attendance' ? S.t[t].some(y => y.student_id === to && y.session_id === r.session_id) : t === 'class_enrolments' ? S.t[t].some(y => y.student_id === to && y.class_id === r.class_id)
              : t === 'guardians' ? S.t[t].some(y => y.student_id === to && digits(y.phone) && digits(y.phone) === digits(r.phone)) : false;
            if (dup) S.t[t] = S.t[t].filter(y => y !== r); else r.student_id = to;
          });
          for (const k of ['birth_date', 'gender', 'guardian_id', 'guardian_name', 'guardian_phone', 'family_ref', 'programme_id', 'venue_id']) if (!b[k] && a[k]) b[k] = a[k];
          Object.assign(a, { status: 'left', merged_into: to, guardian_id: null, notes: [a.notes, `DIGABUNG ke "${b.full_name}"`].filter(Boolean).join('\n') });
        } else await rpc('merge_students', { p_from: id, p_to: to });
      }
      if (S.mode !== 'demo') await refresh(['students', 'attendance', 'class_enrolments', 'invoices', 'student_packages', 'progress_records', 'guardians', 'student_programmes', 'invoice_items', 'booking_requests']);
      ctx = null;
      if (after) await after(to);
      toast(`${from.length} profil digabung ke ${b.full_name}`); app.render();
    } });
  showReview();
}
