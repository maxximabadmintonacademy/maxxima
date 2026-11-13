// v22 (admin): Maklum balas ibu bapa, permintaan pakej (lanjut / sahkan tarikh tamat), link maklum balas trial.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, update, rpc } from '../data.js';
import { ic, esc, F, UI, app, toast, openModal, pageHead, fmtShort, fmtDate, todayISO, addDays, avatar } from '../ui.js';
import { T, byId, studentName, staffName, progName, venueName, EXTRA_TASKS } from './helpers.js';

const stars = n => `<span style="color:#f5b301;letter-spacing:1px">${'★'.repeat(n)}</span><span style="color:#d1d5db">${'★'.repeat(5 - n)}</span>`;
const who = f => f.student_id ? studentName(f.student_id) : (byId('leads', f.lead_id)?.child_name || '—');
const sessLbl = f => { const s = byId('class_sessions', f.session_id), c = s && byId('classes', s.class_id); return s ? `${fmtShort(s.session_date)} · ${progName(c?.programme_id)} · ${venueName(c?.venue_id)}` : ''; };

/* ---------------- MAKLUM BALAS ---------------- */
VIEWS.maklumbalas = () => {
  const k = UI.fbK || '', co = UI.fbC || '';
  const L = T('feedback').filter(f => (!k || f.kind === k) && (!co || f.coach_id === co)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const avg = L.length ? (L.reduce((n, f) => n + f.rating, 0) / L.length).toFixed(1) : '—';
  const byCoach = {}; T('feedback').filter(f => f.coach_id).forEach(f => { (byCoach[f.coach_id] ||= []).push(f.rating); });
  return `${pageHead('Maklum Balas', 'Penilaian & komen ibu bapa selepas sesi dan selepas trial. Coach sesi juga menerima maklum balas untuk sesi mereka.')}
  <div class="grid kpis"><div class="card kpi"><div class="kpi-top"><span class="kpi-label">Purata</span></div><div class="kpi-val">${avg} ★</div><div class="kpi-foot">${L.length} maklum balas</div></div>
    ${Object.entries(byCoach).slice(0, 3).map(([id, r]) => `<div class="card kpi"><div class="kpi-top"><span class="kpi-label">${esc(staffName(id))}</span></div><div class="kpi-val">${(r.reduce((a, b) => a + b, 0) / r.length).toFixed(1)} ★</div><div class="kpi-foot">${r.length} penilaian</div></div>`).join('')}</div>
  <div class="card card-pad mb"><div class="filters"><label class="field"><select data-on-change="fb-k"><option value="">Semua jenis</option>${[['session', 'Selepas sesi'], ['trial', 'Selepas trial'], ['general', 'Umum']].map(([v, l]) => `<option value="${v}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><select data-on-change="fb-c"><option value="">Semua coach</option>${T('staff').filter(s => s.active).map(s => `<option value="${s.id}" ${co === s.id ? 'selected' : ''}>${esc(s.full_name)}</option>`).join('')}</select></label></div></div>
  <div class="card"><ul class="list">${L.map(f => `<li class="list-item" style="flex-wrap:wrap;${f.status === 'new' ? 'background:var(--accent-soft,#f4fbe6)' : ''}">${avatar(who(f))}<div class="li-main"><div class="li-title">${esc(who(f))} ${stars(f.rating)} <span class="badge b-muted">${{ session: 'Sesi', trial: 'Trial', general: 'Umum' }[f.kind]}</span></div>
    <div class="li-sub">${esc(sessLbl(f))}${f.coach_id ? ' · Coach ' + esc(staffName(f.coach_id)) : ''} · ${fmtShort((f.created_at || '').slice(0, 10))}</div>${f.comment ? `<div style="font-size:13.5px;margin-top:4px;white-space:pre-line">“${esc(f.comment)}”</div>` : ''}${f.admin_note ? `<div class="li-sub">Nota admin: ${esc(f.admin_note)}</div>` : ''}</div>
    <div class="actions">${f.status === 'new' ? `<button class="btn sm" data-action="fb-read" data-id="${f.id}">Tanda dibaca</button>` : ''}<button class="btn sm" data-action="fb-note" data-id="${f.id}">Nota</button></div></li>`).join('') || '<li class="empty">Belum ada maklum balas. Ibu bapa boleh beri bintang selepas sesi di portal; untuk trial, hantar "Link maklum balas" dari Leads.</li>'}</ul></div>`;
};
INPUTS['fb-k'] = v => { UI.fbK = v; app.render(); };
INPUTS['fb-c'] = v => { UI.fbC = v; app.render(); };
Object.assign(ACTIONS, {
  'fb-read': async id => { await update('feedback', id, { status: 'read' }); app.render(); },
  'fb-note': id => { const f = byId('feedback', id); openModal({ title: 'Nota dalaman', body: F('Nota (tidak dilihat ibu bapa)', 'n', { type: 'textarea', value: f.admin_note || '', full: true }), onSubmit: async d => { await update('feedback', id, { admin_note: d.n || null, status: 'read' }); app.render(); } }); },
  'lead-fb': id => {
    const l = byId('leads', id); if (!l.trial_token) return toast('Lead ini belum ada link trial.', true);
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'trial.html?t=' + l.trial_token + '&fb=1';
    const msg = `Salam ${l.guardian_name || ''}, terima kasih kerana membawa ${l.child_name} ke sesi trial Maxxima Badminton Academy 🏸\n\nBoleh kongsikan pendapat anda (1 minit)?\n${url}\n\nTerima kasih!`;
    openModal({ title: `Maklum balas trial — ${esc(l.child_name)}`, cancel: 'Tutup', body: `<textarea style="width:100%;min-height:120px" data-noi18n>${esc(msg)}</textarea>
      <div class="actions" style="margin-top:10px">${l.phone ? `<a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/${String(l.phone).replace(/\D/g, '').replace(/^0/, '60')}?text=${encodeURIComponent(msg)}">${ic('msg', 'sm')} Hantar WhatsApp</a>` : ''}<button type="button" class="btn" data-action="copy-text" data-id="${esc(url)}">Salin link</button></div>` });
  },
});

/* ---------------- PERMINTAAN PAKEJ ---------------- */
const reqCard = () => {
  const L = T('package_requests').filter(r => r.status === 'new').sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  if (!L.length) return '';
  return `<div class="card mb" style="border-color:var(--warn)"><div class="card-head"><div><h3>Permintaan ibu bapa</h3><div class="sub">Lanjut tempoh pakej / sahkan tarikh tamat</div></div><span class="badge b-warn">${L.length}</span></div><ul class="list">
  ${L.map(r => { const p = byId('student_packages', r.student_package_id); return `<li class="list-item" style="flex-wrap:wrap"><div class="li-main"><div class="li-title">${esc(studentName(r.student_id))} · ${esc(p?.name || '')}</div>
    <div class="li-sub">${r.kind === 'extend' ? `<b>Lanjut ${r.days} hari</b> · tamat sekarang ${p?.expires_on ? fmtDate(p.expires_on) : '—'}` : '<b>Sahkan tarikh tamat</b> (belum bayar tetapi sudah hadir)'}${r.reason ? ' · “' + esc(r.reason) + '”' : ''} · ${fmtShort((r.created_at || '').slice(0, 10))}</div></div>
    <div class="actions"><button class="btn sm primary" data-action="pr-ok" data-id="${r.id}">Lulus</button><button class="btn sm danger-o" data-action="pr-no" data-id="${r.id}">Tolak</button></div></li>`; }).join('')}</ul></div>`;
};
const origPakej = VIEWS.pakej;
VIEWS.pakej = () => { const h = origPakej(), i = h.indexOf('<div class="chips">'); return i < 0 ? reqCard() + h : h.slice(0, i) + reqCard() + h.slice(i); };
async function handleReq(id, ok, note, exp) {
  const r = byId('package_requests', id), p = byId('student_packages', r.student_package_id);
  if (S.mode === 'supabase') { await rpc('admin_handle_pkg_request', { p_id: id, p_approve: ok, p_note: note || null, p_expires: exp || null }); }
  else {
    if (ok && r.kind === 'extend') { p.extended_days = Number(p.extended_days || 0) + r.days; if (p.expires_on) p.expires_on = addDays(p.expires_on, r.days); }
    if (ok && r.kind === 'confirm_expiry') { p.expires_on = exp; p.auto_start = false; p.starts_on ||= todayISO(); }
    Object.assign(r, { status: ok ? 'approved' : 'rejected', admin_note: note || null, handled_at: new Date().toISOString() });
  }
  if (S.mode === 'supabase') { const { refresh } = await import('../data.js'); await refresh(['package_requests', 'student_packages']); }
  toast(ok ? 'Diluluskan — ibu bapa dimaklumkan' : 'Ditolak — ibu bapa dimaklumkan'); app.render();
}
Object.assign(ACTIONS, {
  'pr-ok': id => { const r = byId('package_requests', id), p = byId('student_packages', r.student_package_id);
    if (r.kind === 'extend') return handleReq(id, true);
    const first = T('attendance').filter(a => a.student_id === r.student_id && !a.student_package_id && a.session_date).map(a => a.session_date).sort()[0];
    openModal({ title: 'Sahkan tarikh tamat pakej', submit: 'Sahkan', body: `<p class="muted" style="font-size:13px;margin-bottom:10px">${esc(p.name)} · sah ${p.valid_days} hari${first ? ` · sesi pertama tanpa pakej: <b>${fmtDate(first)}</b>` : ''}</p>
      <div class="form-grid">${F('Tarikh tamat', 'exp', { type: 'date', req: true, value: first ? addDays(first, Number(p.valid_days)) : addDays(todayISO(), Number(p.valid_days)) })}${F('Nota kepada ibu bapa (pilihan)', 'note', { full: true })}</div>`,
      onSubmit: d => handleReq(id, true, d.note, d.exp) }); },
  'pr-no': id => openModal({ title: 'Tolak permintaan', submit: 'Tolak', body: F('Sebab (dihantar kepada ibu bapa)', 'note', { type: 'textarea', full: true }), onSubmit: d => handleReq(id, false, d.note) }),
});
EXTRA_TASKS.push(add => add(T('package_requests').filter(r => r.status === 'new').length, 'wallet', 't-warn', '{n} permintaan pakej (lanjut / sahkan tarikh tamat)', 'pakej'));
EXTRA_TASKS.push(add => add(T('feedback').filter(f => f.status === 'new' && f.rating <= 3).length, 'msg', 't-bad', '{n} maklum balas rendah (≤3★) belum dibaca', 'maklumbalas'));
