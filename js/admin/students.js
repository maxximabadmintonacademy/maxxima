// Leads, Kelas Percubaan (trial), Pendaftaran (kemasukan), Senarai Pelajar.
import { withLang, getLang } from '../i18n.js';
import { langOf } from '../lang-of.js';
import { msgLeadThanks, msgTrialReminder, msgEnrolEnquiry, msgEnrolInvoice } from './messages.js';
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove, refresh, rpc } from '../data.js';
import { ic, esc, F, RM, sum, num, val, badge, avatar, UI, app, toast, openModal, closeModal, confirmModal, pageHead, fmtDate, fmtShort, hm, todayISO, addDays, monthKey, monthLabel, DAYS, waLink, LABEL, barColor } from '../ui.js';
import { T, byId, venueName, progName, staffName, studentName, invStatus, paidOf, attRate, classLabel, enrolledIn, ageOf, billing, academy, livePackages, studentPackages, pkgRemaining, catalogFor, daysLeft } from './helpers.js';
import { sellPackage, dueDefault } from './finance.js';

const venueOpts = (blank = '— Pilih lokasi —') => [['', blank], ...T('venues').filter(v => v.active).map(v => [v.id, v.name])];
const progOpts = (blank = '— Pilih program —') => [['', blank], ...T('programmes').filter(p => p.active).map(p => [p.id, p.name])];
const coachOpts = (blank = '— Pilih coach —') => [['', blank], ...T('staff').filter(s => s.active).map(s => [s.id, s.full_name])];
const SOURCES = ['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Rujukan', 'Laman Web', 'Walk-in', 'Lain-lain'];

/* =====================================================================
   LEADS
   ===================================================================== */
const LEAD_STATUSES = ['all', 'new', 'contacted', 'trial_scheduled', 'trial_done', 'requested', 'enrolled', 'lost'];

VIEWS.leads = () => {
  const f = UI.leadFilter || 'all';
  const leads = T('leads');
  const rows = leads.filter(l => f === 'all' || l.status === f).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const next = l => ({
    new: `<button class="btn sm primary" data-action="lead-form" data-id="${l.id}">${ic('msg', 'sm')} Hantar borang trial</button> <button class="btn sm" data-action="lead-contacted" data-id="${l.id}">Tandakan Dihubungi</button>`,
    contacted: `<button class="btn sm primary" data-action="lead-form" data-id="${l.id}">${ic('msg', 'sm')} Hantar borang trial</button> <button class="btn sm" data-action="lead-trial" data-id="${l.id}">Jadual Trial</button> <button class="btn sm" data-action="lead-enrol" data-id="${l.id}">Mohon Daftar</button>`,
    trial_scheduled: `<a class="btn sm" href="#trial">Lihat Trial</a>`,
    trial_done: `<button class="btn sm accent" data-action="lead-enrol" data-id="${l.id}">Mohon Daftar</button>`,
    requested: `<a class="btn sm" href="#kemasukan">Lihat Pendaftaran</a>`,
  }[l.status] || '<span class="muted">—</span>');
  return `
  ${pageHead('Leads', 'Pertanyaan ibu bapa — susuli sehingga trial dan permohonan daftar.', `<button class="btn primary" data-action="lead-add">${ic('plus', 'sm')} Lead Baharu</button>`)}
  <div class="chips">${LEAD_STATUSES.map(s => `<button class="chip ${f === s ? 'on' : ''}" data-action="lead-filter" data-id="${s}">${s === 'all' ? 'Semua' : LABEL[s]}<span class="n">${s === 'all' ? leads.length : leads.filter(l => l.status === s).length}</span></button>`).join('')}</div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Bakal Pelajar</th><th>Ibu Bapa</th><th>Sumber</th><th>Minat</th><th>Tarikh</th><th>Status</th><th>Tindakan</th><th></th></tr></thead>
    <tbody>${rows.map(l => `<tr>
      <td><div class="cell-person">${avatar(l.child_name)}<div><b>${esc(l.child_name)}</b><span>${l.child_age ? l.child_age + ' tahun' : '—'}</span></div></div></td>
      <td>${esc(l.guardian_name || '—')}<div class="muted" style="font-size:12px">${esc(l.phone || '')}</div></td>
      <td>${esc(l.source || '—')}</td>
      <td>${l.programme_id ? esc(progName(l.programme_id)) : '—'}<div class="muted" style="font-size:12px">${l.venue_id ? esc(venueName(l.venue_id)) : ''}</div></td>
      <td class="num">${fmtShort((l.created_at || '').slice(0, 10))}</td>
      <td>${badge(l.status)}</td><td style="white-space:nowrap">${next(l)}</td>
      <td style="white-space:nowrap">${l.phone ? `<a class="btn sm" href="${waLink(l.phone, msgLeadThanks({ guardian: l.guardian_name, child: l.child_name }))}" target="_blank" rel="noopener" title="WhatsApp">${ic('msg', 'sm')}</a>` : ''}
        <button class="btn sm" data-action="lead-edit" data-id="${l.id}" title="Edit">${ic('edit', 'sm')}</button></td></tr>`).join('') || `<tr><td colspan="8" class="empty">Tiada lead dalam kategori ini.</td></tr>`}</tbody>
  </table></div></div>`;
};

const leadForm = l => `<div class="form-grid">
  ${F('Nama anak', 'child_name', { value: l?.child_name, req: true })}
  ${F('Umur', 'child_age', { type: 'number', value: l?.child_age, min: 3, max: 60 })}
  ${F('Nama ibu bapa / penjaga', 'guardian_name', { value: l?.guardian_name })}
  ${F('No. telefon (WhatsApp)', 'phone', { value: l?.phone, req: true, ph: '012-345 6789' })}
  ${F('Sumber', 'source', { value: l?.source || 'WhatsApp', opts: SOURCES })}
  ${F('Minat program', 'programme_id', { value: l?.programme_id, opts: progOpts('— Belum pasti —') })}
  ${F('Lokasi pilihan', 'venue_id', { value: l?.venue_id, opts: venueOpts('— Belum pasti —'), full: true })}
  ${F('Catatan', 'notes', { type: 'textarea', value: l?.notes, full: true })}
</div>`;
const leadPatch = d => ({ child_name: d.child_name.trim(), child_age: num(d.child_age), guardian_name: val(d.guardian_name), phone: val(d.phone), source: d.source, programme_id: val(d.programme_id), venue_id: val(d.venue_id), notes: val(d.notes) });

Object.assign(ACTIONS, {
  'lead-filter': id => { UI.leadFilter = id; app.render(); },
  'lead-add': () => openModal({ title: 'Lead Baharu', submit: 'Tambah Lead', body: leadForm(), onSubmit: async d => { await insert('leads', { ...leadPatch(d), status: 'new' }); toast('Lead ditambah'); app.render(); } }),
  'lead-edit': id => {
    const l = byId('leads', id);
    openModal({
      title: 'Edit Lead', body: leadForm(l) + `<div style="margin-top:14px"><button type="button" class="btn sm" data-action="lead-lost" data-id="${id}">Tandakan tidak berminat</button> <button type="button" class="btn sm danger-o" data-action="lead-del" data-id="${id}">${ic('trash', 'sm')} Padam</button></div>`,
      onSubmit: async d => { await update('leads', id, leadPatch(d)); toast('Lead dikemas kini'); app.render(); },
    });
  },
  'lead-contacted': async id => { await update('leads', id, { status: 'contacted' }); toast('Ditandakan: dihubungi'); app.render(); },
  'lead-lost': async id => { await update('leads', id, { status: 'lost' }); closeModal(); toast('Ditandakan: tidak berminat'); app.render(); },
  'lead-del': id => confirmModal({ title: 'Padam lead?', message: `Padam <b>${esc(byId('leads', id).child_name)}</b>? Tindakan ini tidak boleh dibatalkan.`, ok: 'Padam', danger: true, onOk: async () => { await remove('leads', id); toast('Lead dipadam'); app.render(); } }),

  /* Link borang trial peribadi (WhatsApp) — ibu bapa isi butiran anak & pilih slot sesi kumpulan */
  'lead-form': async id => {
    const l = byId('leads', id);
    let tok = l.trial_token;
    if (!tok) { tok = Array.from(crypto.getRandomValues(new Uint8Array(18)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); await update('leads', id, { trial_token: tok, status: l.status === 'new' ? 'contacted' : l.status }); }
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'trial.html?t=' + tok;
    const msg = `Salam ${l.guardian_name || ''}, terima kasih kerana berminat dengan Maxxima Badminton Academy 🏸\n\nSila isi borang ringkas ini dan pilih slot trial untuk ${l.child_name}:\n${url}\n\nSlot akan disahkan terus selepas borang dihantar. Terima kasih!`;
    openModal({ title: `Borang trial — ${esc(l.child_name)}`, cancel: 'Tutup', body: `<p class="muted" style="font-size:13px">Link ini khas untuk lead ini sahaja. Bila ibu bapa hantar, lead bertukar ke Trial Dijadual dan muncul di Kelas Percubaan & panel sesi coach.</p>
      <textarea style="width:100%;min-height:140px;margin-top:10px" data-noi18n>${esc(msg)}</textarea>
      <div class="actions" style="margin-top:10px">${l.phone ? `<a class="btn primary" target="_blank" rel="noopener" href="${waLink(l.phone, msg)}">${ic('msg', 'sm')} Hantar WhatsApp</a>` : ''}<button type="button" class="btn" data-action="copy-text" data-id="${esc(url)}">Salin link</button></div>` });
    app.render();
  },
  'copy-text': async v => { try { await navigator.clipboard.writeText(v); toast('Disalin'); } catch { toast('Tidak dapat menyalin', true); } },
  'lead-trial': id => {
    const l = byId('leads', id);
    openModal({
      title: `Jadual Trial — ${esc(l.child_name)}`, submit: 'Jadualkan',
      body: `<p class="muted" style="margin-bottom:12px">Percubaan percuma: satu sesi kumpulan 2 jam untuk pelajar baharu. Personal coaching memerlukan sesi pengenalan berbayar.</p>
      <div class="form-grid">
        ${F('Jenis', 'kind', { opts: [['group_trial', 'Trial percuma (kumpulan, 2 jam)'], ['personal_intro', 'Sesi pengenalan personal (60 min, berbayar)']], full: true })}
        ${F('Lokasi', 'venue_id', { value: l.venue_id, opts: venueOpts() })}
        ${F('Coach', 'coach_id', { opts: coachOpts('— Tentukan kemudian —') })}
        ${F('Tarikh', 'trial_date', { type: 'date', value: addDays(todayISO(), 3), req: true })}
        ${F('Masa', 'trial_time', { type: 'time', value: '17:00' })}
      </div>`,
      onSubmit: async d => {
        await insert('trials', { lead_id: id, kind: d.kind, venue_id: val(d.venue_id), coach_id: val(d.coach_id), trial_date: d.trial_date, trial_time: val(d.trial_time), status: 'scheduled' });
        await update('leads', id, { status: 'trial_scheduled' }); toast('Trial dijadualkan'); app.render();
      },
    });
  },

  'lead-enrol': id => {
    const l = byId('leads', id), tr = T('trials').filter(t => t.lead_id === id && t.status === 'done').pop();
    openModal({
      title: `Mohon Daftar — ${esc(l.child_name)}`, submit: 'Hantar ke Pendaftaran',
      body: `<div class="form-grid">
        ${F('Nama penuh pelajar', 'full_name', { value: l.child_name, req: true, full: true })}
        ${F('Tarikh lahir', 'birth_date', { type: 'date' })}
        ${F('Jantina', 'gender', { opts: [['', '—'], ['male', 'Lelaki'], ['female', 'Perempuan']] })}
        ${F('Program', 'programme_id', { value: tr?.recommended_programme_id || l.programme_id, opts: progOpts(), req: true })}
        ${F('Lokasi pilihan', 'venue_id', { value: l.venue_id, opts: venueOpts('— Belum pasti —') })}
        ${F('Kod keluarga (adik-beradik)', 'family_ref', { ph: 'cth. KELUARGA-RAHMAN' })}
      </div>`,
      onSubmit: async d => {
        await insert('students', { full_name: d.full_name.trim(), birth_date: val(d.birth_date), gender: val(d.gender), guardian_name: l.guardian_name, guardian_phone: l.phone, family_ref: val(d.family_ref), programme_id: d.programme_id, venue_id: val(d.venue_id), status: 'pending', lead_id: id });
        await update('leads', id, { status: 'requested' }); toast('Dihantar ke Pendaftaran'); location.hash = 'kemasukan'; app.render();
      },
    });
  },
});

/* =====================================================================
   KELAS PERCUBAAN (TRIAL)
   ===================================================================== */
VIEWS.trial = () => {
  const today = todayISO();
  const trials = T('trials');
  const card = t => {
    const l = byId('leads', t.lead_id); if (!l) return '';
    const late = t.status === 'scheduled' && t.trial_date < today;
    return `<div class="card coach-card">
      <div class="coach-top">${avatar(l.child_name, t.status === 'done' ? 'lime' : '')}<div style="flex:1;min-width:0"><h4>${esc(l.child_name)}</h4><div class="muted" style="font-size:12px">${l.child_age ? l.child_age + ' tahun · ' : ''}${esc(l.guardian_name || '')}</div></div>${late ? badge('overdue', 'Perlu keputusan') : badge(t.status)}</div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
        <div style="display:flex;gap:8px;align-items:center">${ic('calendar', 'sm')} ${fmtDate(t.trial_date)}${t.trial_time ? ', ' + hm(t.trial_time) : ''}</div>
        <div style="display:flex;gap:8px;align-items:center">${ic('pin', 'sm')} ${esc(venueName(t.venue_id))}</div>
        <div style="display:flex;gap:8px;align-items:center">${ic('award', 'sm')} ${esc(staffName(t.coach_id))} <span class="badge b-muted" style="margin-left:auto">${LABEL[t.kind]}</span></div>
      </div>
      ${t.status === 'done' ? `<div style="background:var(--bg);border-radius:10px;padding:10px 12px;font-size:12.5px"><b>Cadangan: ${esc(progName(t.recommended_programme_id))}</b><div class="muted">${esc(t.notes || '')}</div></div>
        ${l.status === 'trial_done' ? `<button class="btn accent" data-action="lead-enrol" data-id="${l.id}">${ic('userplus', 'sm')} Mohon Daftar</button>` : ''}`
        : `<div class="actions"><button class="btn primary" style="flex:1" data-action="trial-result" data-id="${t.id}">${ic('tick', 'sm')} Rekod Keputusan</button>
           ${l.phone ? `<a class="btn" href="${waLink(l.phone, msgTrialReminder({ guardian: l.guardian_name, child: l.child_name, date: fmtDate(t.trial_date), time: t.trial_time ? hm(t.trial_time) : '', venue: venueName(t.venue_id) }))}" target="_blank" rel="noopener" title="Peringatan WhatsApp">${ic('msg', 'sm')}</a>` : ''}
           <button class="btn" data-action="trial-cancel" data-id="${t.id}" title="Batal">${ic('x', 'sm')}</button></div>`}
    </div>`;
  };
  const upcoming = trials.filter(t => t.status === 'scheduled').sort((a, b) => a.trial_date.localeCompare(b.trial_date));
  const done = trials.filter(t => t.status === 'done').sort((a, b) => b.trial_date.localeCompare(a.trial_date)).slice(0, 9);
  return `
  ${pageHead('Kelas Percubaan (Trial)', 'Sesi percubaan percuma untuk pelajar baharu dan keputusan penilaian coach.')}
  <h3 style="font-size:14px;margin-bottom:10px">Dijadualkan <span class="muted">(${upcoming.length})</span></h3>
  <div class="grid g-3 mb">${upcoming.map(card).join('') || `<div class="card empty" style="grid-column:1/-1">Tiada trial dijadualkan. Jadualkan daripada halaman <a href="#leads" style="color:var(--info)">Leads</a>.</div>`}</div>
  <h3 style="font-size:14px;margin-bottom:10px">Selesai <span class="muted">(terkini)</span></h3>
  <div class="grid g-3">${done.map(card).join('') || `<div class="card empty" style="grid-column:1/-1">Belum ada.</div>`}</div>`;
};

Object.assign(ACTIONS, {
  'trial-result': id => {
    const t = byId('trials', id), l = byId('leads', t.lead_id);
    openModal({
      title: `Keputusan Trial — ${esc(l.child_name)}`, submit: 'Simpan Keputusan',
      body: `<div class="form-grid">
        ${F('Hasil', 'status', { opts: [['done', 'Hadir — trial selesai'], ['no_show', 'Tidak hadir']], full: true })}
        ${F('Program dicadangkan', 'recommended_programme_id', { value: l.programme_id, opts: progOpts('— Tiada —'), full: true })}
        ${F('Catatan coach', 'notes', { type: 'textarea', ph: 'Kekuatan, kelemahan, cadangan…', full: true })}
      </div>`,
      onSubmit: async d => {
        await update('trials', id, { status: d.status, recommended_programme_id: d.status === 'done' ? val(d.recommended_programme_id) : null, notes: val(d.notes) });
        await update('leads', t.lead_id, { status: d.status === 'done' ? 'trial_done' : 'contacted' });
        toast('Keputusan direkod'); app.render();
      },
    });
  },
  'trial-cancel': id => confirmModal({ title: 'Batalkan trial?', message: 'Lead akan dikembalikan ke status "Dihubungi".', ok: 'Batalkan Trial', onOk: async () => { const t = byId('trials', id); await update('trials', id, { status: 'cancelled' }); await update('leads', t.lead_id, { status: 'contacted' }); toast('Trial dibatalkan'); app.render(); } }),
});

/* =====================================================================
   PENDAFTARAN (kemasukan): Semakan → Invois → Bayaran → Aktif
   Mengikut proses akademi: permohonan tidak mengesahkan tempat; slot hanya
   dijamin selepas bayaran penuh disahkan.
   ===================================================================== */
const latestPkg = sid => studentPackages(sid).filter(p => p.status !== 'cancelled').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0] || null;
function enrolState(s) {
  const enr = T('class_enrolments').filter(e => e.student_id === s.id);
  const invs = T('invoices').filter(i => (i.student_id === s.id || T('invoice_items').some(it => it.invoice_id === i.id && it.student_id === s.id)) && i.status !== 'void');
  const sp = latestPkg(s.id);
  const placed = !!(s.programme_id && sp && (sp.schedule_mode === 'flexible' || enr.length));
  const issued = !!(sp && sp.invoice_id);
  const allPaid = issued && invs.every(i => i.status === 'paid');
  const step = !placed ? 2 : !issued ? 3 : !allPaid ? 4 : 5;
  return { enr, invs, sp, placed, issued, allPaid, step, owing: sum(invs.filter(i => i.status === 'issued'), i => i.amount) };
}
const STEPS = ['Permohonan', 'Penempatan', 'Invois', 'Bayaran', 'Aktif'];

VIEWS.kemasukan = () => {
  const list = T('students').filter(s => ['pending', 'awaiting_payment'].includes(s.status)).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  return `
  ${pageHead('Pendaftaran Pelajar', 'Semak penempatan → keluarkan invois → sahkan bayaran → aktifkan. Tempat hanya dijamin selepas bayaran disahkan.', `<button class="btn primary" data-action="enrol-new">${ic('plus', 'sm')} Permohonan Baharu</button>`)}
  ${list.length ? list.map(s => {
    const st = enrolState(s), sp = st.sp;
    return `<div class="card mb enrol-card">
      <div class="enrol-head">
        <div class="cell-person" style="min-width:230px">${avatar(s.full_name)}<div><b>${esc(s.full_name)}</b>${/^Daftar online/.test(s.notes || '') ? ' <span class="badge b-info">Daftar online</span>' : ''}<span>${s.birth_date ? ageOf(s.birth_date) + ' thn · ' : ''}${esc(s.guardian_name || '—')} · ${esc(s.guardian_phone || '')}</span></div></div>
        <div class="muted" style="font-size:12.5px;flex:1;min-width:200px">${esc(progName(s.programme_id))}${sp ? ` · ${esc(sp.name)} (${LABEL[sp.schedule_mode]}) · <b style="color:var(--ink)">${RM(sp.price)}</b>` : ' · <span style="color:var(--warn)">pakej belum dipilih</span>'}</div>
        <div class="actions">
          ${s.guardian_phone ? `<a class="btn sm" href="${waLink(s.guardian_phone, withLang(langOf(s), () => msgEnrolEnquiry({ guardian: s.guardian_name, student: s.full_name })))}" target="_blank" rel="noopener">${ic('msg', 'sm')}</a>` : ''}
          <button class="btn sm" data-action="student-edit" data-id="${s.id}">${ic('edit', 'sm')}</button>
          <button class="btn sm danger-o" data-action="enrol-drop" data-id="${s.id}" title="Tolak / batalkan permohonan">${ic('x', 'sm')} Tolak</button>
        </div>
      </div>
      <div class="stepper">${STEPS.map((l, i) => { const n = i + 1, cls = n < st.step ? 'done' : n === st.step ? 'now' : ''; return `<div class="step ${cls}"><span class="dot">${n < st.step ? ic('tick', 'sm') : n}</span><span class="lbl">${l}</span></div>`; }).join('<span class="step-line"></span>')}</div>
      <div class="enrol-body">
        ${/^Daftar online/.test(s.notes || '') && st.step <= 2 ? `<div class="enrol-msg" style="font-size:12.5px">${esc(s.notes)}${T('student_programmes').some(x => x.student_id === s.id) ? `<br>Minat: <b>${esc(T('student_programmes').filter(x => x.student_id === s.id).map(x => progName(x.programme_id)).join(', '))}</b>` : ''}${s.venue_id ? ` · Lokasi: <b>${esc(venueName(s.venue_id))}</b>` : ''}</div>` : ''}
        ${st.step === 2 ? `<div class="enrol-msg">Semak maklumat, kemudian terima dengan memilih pakej dan kelas (atau mod fleksibel). Jika tidak sesuai, tekan <b>Tolak</b>.</div><button class="btn primary" data-action="enrol-place" data-id="${s.id}">${ic('tick', 'sm')} Terima & Tetapkan Penempatan</button>` : ''}
        ${st.step === 3 ? `<div class="enrol-msg">${esc(st.sp.name)}: ${st.sp.schedule_mode === 'flexible' ? '<span class="badge b-info">Fleksibel — ibu bapa tempah sendiri</span>' : st.enr.map(e => { const c = byId('classes', e.class_id); return c ? `<span class="badge b-muted">${DAYS[c.weekday].slice(0, 3)} ${hm(c.start_time)} · ${esc(venueName(c.venue_id))}</span>` : ''; }).join(' ')} <button class="btn sm ghost" data-action="enrol-place" data-id="${s.id}">ubah</button></div><button class="btn primary" data-action="enrol-invoice" data-id="${s.id}">${ic('file', 'sm')} Keluarkan Invois</button>` : ''}
        ${st.step === 4 ? `<div class="enrol-msg">Invois dikeluarkan — menunggu pembayaran: ${st.invs.map(i => `<span class="badge b-${i.status === 'paid' ? 'ok' : invStatus(i) === 'overdue' ? 'bad' : 'warn'}">${esc(i.number)} · ${RM(i.amount)}</span>`).join(' ')}</div>
          <div class="actions"><button class="btn primary" data-action="enrol-pay" data-id="${s.id}">${ic('wallet', 'sm')} Sahkan Bayaran (${RM(st.owing)})</button>${s.guardian_phone ? `<a class="btn" href="${waLink(s.guardian_phone, withLang(langOf(s), () => msgEnrolInvoice({ guardian: s.guardian_name, student: s.full_name, amount: RM(st.owing), numbers: st.invs.filter(i => i.status === 'issued').map(i => i.number).join(', ') })))}" target="_blank" rel="noopener">${ic('msg', 'sm')} Peringatan</a>` : ''}</div>` : ''}
        ${st.step === 5 ? `<div class="enrol-msg" style="color:var(--ok)"><b>Bayaran penuh disahkan.</b> Tempat pelajar boleh dijamin.</div><button class="btn accent" data-action="enrol-activate" data-id="${s.id}">${ic('tick', 'sm')} Aktifkan Pelajar</button>` : ''}
      </div>
    </div>`; }).join('') : `<div class="card empty">Tiada permohonan menunggu. Permohonan datang daripada <a href="#leads" style="color:var(--info)">Leads</a> (selepas trial) atau tambah terus.</div>`}`;
};

/* Borang penempatan: program -> pakej (katalog) + kelas (jika jadual tetap). Tiada data diisi dua kali. */
const sortCls = (a, b) => a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time));
function placementInner(s, prog, venue, mode, selectedClasses, pkgId, price) {
  const catalog = catalogFor(prog), pkg = catalog.find(p => p.id === pkgId) || catalog[0];
  const classes = T('classes').filter(c => c.active && c.programme_id === prog && (!venue || c.venue_id === venue)).sort(sortCls);
  return `
    <div class="form-grid">
      <label class="f full">Pakej
        <select name="package_id" required>${catalog.map(p => `<option value="${p.id}" ${pkg?.id === p.id ? 'selected' : ''}>${esc(p.name)} — ${RM(p.price)} · sah ${p.valid_days} hari</option>`).join('')}</select>
        ${catalog.length ? '' : `<span class="hint warn">Tiada pakej untuk program ini. Tetapkan di <a href="#pakej" data-action="close-modal">Pakej</a>.</span>`}
      </label>
      ${F('Harga (RM) — ubah untuk kadar lama pelajar sedia ada', 'price', { type: 'number', step: '0.01', min: 0, value: price ?? pkg?.price ?? '', req: true, full: true })}
    </div>
    ${mode === 'flexible' ? `<div class="hint" style="margin-top:14px">Mod fleksibel: tiada kelas tetap. Ibu bapa menempah sesi sendiri daripada kelas program <b>${esc(progName(prog))}</b> (${T('classes').filter(c => c.active && c.programme_id === prog).length} kelas) di Portal Ibu Bapa.</div>`
    : `<div class="f" style="margin-top:14px"><span>Kelas tetap${pkg ? ` (pakej ${pkg.sessions} sesi)` : ''}</span>
      <div class="checklist">${classes.map(c => { const n = enrolledIn(c.id).filter(e => e.student_id !== s.id).length, full = n >= c.capacity; return `<label class="check-row ${full ? 'full' : ''}"><input type="checkbox" name="class_ids" value="${c.id}" ${selectedClasses.includes(c.id) ? 'checked' : ''} ${full && !selectedClasses.includes(c.id) ? 'disabled' : ''}><span>${DAYS[c.weekday]} ${hm(c.start_time)}–${hm(c.end_time)} · ${esc(venueName(c.venue_id))} · ${esc(staffName(c.coach_id))}</span><em>${n}/${c.capacity}${full ? ' penuh' : ''}</em></label>`; }).join('') || `<div class="muted" style="padding:10px">Tiada kelas ${esc(progName(prog))}${venue ? ' di ' + esc(venueName(venue)) : ''}. Cipta di <a href="#jadual" data-action="close-modal">Jadual Kelas</a>.</div>`}</div></div>`}`;
}

async function syncEnrolments(studentId, classIds) {
  const current = T('class_enrolments').filter(e => e.student_id === studentId);
  for (const e of current.filter(e => !classIds.includes(e.class_id))) await remove('class_enrolments', e.id);
  for (const cid of classIds.filter(cid => !current.some(e => e.class_id === cid))) {
    const c = byId('classes', cid);
    if (enrolledIn(cid).length >= c.capacity) throw new Error(`Kelas ${classLabel(c)} sudah penuh.`);
    await insert('class_enrolments', { class_id: cid, student_id: studentId });
  }
}

Object.assign(ACTIONS, {
  'enrol-new': () => openModal({
    title: 'Permohonan Baharu', submit: 'Simpan Permohonan',
    body: `<div class="form-grid">
      ${F('Nama penuh pelajar', 'full_name', { req: true, full: true })}
      ${F('Tarikh lahir', 'birth_date', { type: 'date' })}
      ${F('Jantina', 'gender', { opts: [['', '—'], ['male', 'Lelaki'], ['female', 'Perempuan']] })}
      ${F('Nama ibu bapa / penjaga', 'guardian_name', { req: true })}
      ${F('No. telefon (WhatsApp)', 'guardian_phone', { req: true })}
      ${F('Program', 'programme_id', { opts: progOpts(), req: true })}
      ${F('Lokasi pilihan', 'venue_id', { opts: venueOpts('— Belum pasti —') })}
      ${F('Kod keluarga (adik-beradik)', 'family_ref', { ph: 'sama untuk adik-beradik' })}
    </div>`,
    onSubmit: async d => { await insert('students', { full_name: d.full_name.trim(), birth_date: val(d.birth_date), gender: val(d.gender), guardian_name: d.guardian_name, guardian_phone: d.guardian_phone, programme_id: d.programme_id, venue_id: val(d.venue_id), family_ref: val(d.family_ref), status: 'pending' }); toast('Permohonan ditambah'); app.render(); },
  }),

  'enrol-place': id => {
    const s = byId('students', id), sel = T('class_enrolments').filter(e => e.student_id === id).map(e => e.class_id), pend = latestPkg(id);
    const keep = pend && pend.status === 'pending' && !pend.invoice_id ? pend : null;
    const f = openModal({
      title: `Penempatan — ${esc(s.full_name)}`, wide: true, submit: 'Simpan Penempatan',
      body: `<div class="form-grid">
        ${F('Program', 'programme_id', { value: s.programme_id, opts: progOpts(), req: true })}
        ${F('Cara latihan', 'mode', { value: keep?.schedule_mode || 'fixed', opts: [['fixed', 'Jadual tetap (kelas ditetapkan admin)'], ['flexible', 'Fleksibel (ibu bapa tempah sendiri)']] })}
        ${F('Tapis lokasi kelas', 'venue_id', { value: s.venue_id || '', opts: venueOpts('Semua lokasi'), full: true })}
      </div><div id="placeArea" style="margin-top:14px">${placementInner(s, s.programme_id, s.venue_id, keep?.schedule_mode || 'fixed', sel, keep?.package_id, keep?.price)}</div>`,
      onSubmit: async d => {
        const pkg = byId('packages', d.package_id); if (!pkg) { toast('Pilih pakej', true); return false; }
        const ids = [].concat(d.class_ids || []);
        if (d.mode === 'fixed' && !ids.length) { toast('Pilih sekurang-kurangnya satu kelas', true); return false; }
        const venue = d.mode === 'fixed' ? byId('classes', ids[0]).venue_id : val(d.venue_id);
        await update('students', id, { programme_id: d.programme_id, venue_id: venue });
        const row = { package_id: pkg.id, programme_id: pkg.programme_id, name: pkg.name, sessions_total: pkg.sessions, price: Number(d.price), valid_days: pkg.valid_days, schedule_mode: d.mode };
        if (keep) await update('student_packages', keep.id, row); else await insert('student_packages', { ...row, student_id: id, status: 'pending' });
        await syncEnrolments(id, d.mode === 'fixed' ? ids : []); toast('Penempatan disimpan'); app.render();
      },
    });
    const refresh = () => {
      const fd = new FormData(f);
      f.querySelector('#placeArea').innerHTML = placementInner(s, fd.get('programme_id'), fd.get('venue_id'), fd.get('mode'), fd.getAll('class_ids'), fd.get('package_id'), null);
    };
    ['programme_id', 'venue_id', 'mode'].forEach(n => f.elements[n].addEventListener('change', refresh));
    f.addEventListener('change', e => { if (e.target.name === 'package_id') { const pk = byId('packages', e.target.value); if (pk) f.elements.price.value = pk.price; } });
  },

  'enrol-invoice': id => {
    const s = byId('students', id), sp = latestPkg(id);
    openModal({
      title: `Keluarkan Invois — ${esc(s.full_name)}`, submit: 'Keluarkan Invois',
      body: `<p style="margin-bottom:12px"><b>${esc(sp.name)}</b> · ${LABEL[sp.schedule_mode]} · ${sp.sessions_total} sesi · sah ${sp.valid_days} hari selepas bayaran</p>
      <div class="form-grid">
        ${F('Harga pakej (RM)', 'price', { type: 'number', step: '0.01', min: 0, value: sp.price, req: true })}
        ${F('Yuran pendaftaran (RM)', 'reg', { type: 'number', step: '0.01', min: 0, ph: 'Kosongkan jika tiada' })}
        ${F('Jersi (RM)', 'jersey', { type: 'number', step: '0.01', min: 0, ph: 'Kosongkan jika tiada' })}
        ${F('Diskaun (RM)', 'discount', { type: 'number', step: '0.01', min: 0, ph: 'Kosongkan jika tiada' })}
        ${F('Tarikh akhir bayaran', 'due', { type: 'date', value: dueDefault(), req: true })}
      </div><p class="muted" style="margin-top:10px;font-size:12.5px">Pakej, pendaftaran, jersi dan diskaun digabung dalam satu invois. Pakej aktif secara automatik apabila invois pakej dibayar.</p>`,
      onSubmit: async d => {
        const pkg = byId('packages', sp.package_id) || { id: null, programme_id: sp.programme_id, name: sp.name, sessions: sp.sessions_total, valid_days: sp.valid_days };
        await sellPackage({ studentId: id, pkg, price: Number(d.price), mode: sp.schedule_mode, due: d.due, reg: d.reg, jersey: d.jersey, discount: d.discount, pending: sp });
        await update('students', id, { status: 'awaiting_payment' }); toast('Invois dikeluarkan'); app.render();
      },
    });
  },

  'enrol-pay': id => {
    const s = byId('students', id), owing = T('invoices').filter(i => i.student_id === id && i.status === 'issued');
    openModal({
      title: `Sahkan Bayaran — ${esc(s.full_name)}`, submit: 'Sahkan Bayaran',
      body: `<p style="margin-bottom:12px">Invois: ${owing.map(i => `<b>${esc(i.number)}</b> (${RM(i.amount)})`).join(', ')}<br>Jumlah: <b>${RM(sum(owing, i => i.amount))}</b></p>
      <div class="form-grid">
        ${F('Kaedah', 'method', { opts: Object.entries({ duitnow: 'DuitNow QR', fpx: 'FPX', transfer: 'Pindahan Bank', cash: 'Tunai', card: 'Kad', other: 'Lain-lain' }) })}
        ${F('Tarikh bayaran', 'paid_on', { type: 'date', value: todayISO(), req: true })}
        ${F('No. rujukan (pilihan)', 'reference', { full: true })}
      </div>`,
      onSubmit: async d => { for (const i of owing) await insert('payments', { invoice_id: i.id, amount: i.amount, method: d.method, paid_on: d.paid_on, reference: val(d.reference), status: 'confirmed', verified_by: S.profile.id.startsWith('demo') ? null : S.profile.id }); toast('Bayaran disahkan'); app.render(); },
    });
  },

  'enrol-activate': async id => {
    const s = byId('students', id);
    await update('students', id, { status: 'active', joined_on: todayISO() });
    if (s.lead_id) await update('leads', s.lead_id, { status: 'enrolled' });
    toast(`${s.full_name} kini pelajar aktif`); app.render();
  },
  'enrol-drop': id => confirmModal({ title: 'Batalkan permohonan?', message: `Permohonan <b>${esc(byId('students', id).full_name)}</b> akan ditandakan "Berhenti".`, ok: 'Batalkan Permohonan', danger: true, onOk: async () => { await update('students', id, { status: 'left' }); toast('Permohonan dibatalkan'); app.render(); } }),
});


/* ---------- Borang pelajar + penjaga (aliran AOne: pelajar dahulu, kemudian penjaga 1, 2, 3) ---------- */
const RELS = [['father', 'Bapa'], ['mother', 'Ibu'], ['guardian', 'Penjaga'], ['self', 'Diri sendiri (pelajar dewasa)']];
const guardBlock = (g, n) => `<div class="g-block" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13.5px">Penjaga ${n}${n === 1 ? ' (utama)' : ''}</b>${n > 1 ? `<button type="button" class="btn sm danger-o" data-action="guard-remove">${ic('trash', 'sm')}</button>` : ''}</div>
  <input type="hidden" name="g_id" value="${esc(g?.id || '')}">
  <div class="form-grid">
    ${F('Hubungan', 'g_rel', { value: g?.relationship || (n === 1 ? 'mother' : 'father'), opts: RELS })}
    ${F('Nama penuh', 'g_name', { value: g?.full_name, req: n === 1 })}
    ${F('No. WhatsApp', 'g_phone', { value: g?.phone, req: n === 1, ph: '60123456789' })}
    ${F('E-mel', 'g_email', { type: 'email', value: g?.email, ph: 'untuk akaun portal ibu bapa' })}
    ${F('Alamat (pilihan)', 'g_addr', { value: g?.address, full: true })}
    ${F('No. KP (pilihan: untuk resit cukai pendapatan)', 'g_ic', { value: g?.ic_no, full: true })}
  </div></div>`;
const studentFormHtml = (s, progIds, guards, mode) => `
  <h4 style="font-size:13.5px;margin:0 0 8px">1. Maklumat pelajar</h4>
  <div class="form-grid">
    ${F('Nama penuh pelajar', 'full_name', { value: s?.full_name, req: true, full: true })}
    ${F('Tarikh lahir', 'birth_date', { type: 'date', value: s?.birth_date })}
    ${F('Jantina', 'gender', { value: s?.gender || '', opts: [['', '—'], ['male', 'Lelaki'], ['female', 'Perempuan']] })}
    ${F('Lokasi latihan', 'venue_id', { value: s?.venue_id || '', opts: venueOpts('— Belum ditetapkan —') })}
    ${F('Status', 'status', { value: s?.status || 'active', opts: [['active', 'Aktif'], ['pending', 'Dalam proses'], ['paused', 'Digantung'], ['left', 'Berhenti']] })}
    <div class="f full">Program (boleh pilih lebih daripada satu: contohnya Group + Personal)
      <div class="checklist" style="margin-top:6px">${T('programmes').filter(p => p.active || progIds.includes(p.id)).map(p => `<label class="check-row"><input type="checkbox" name="prog_ids" value="${p.id}" ${progIds.includes(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span><em>${p.kind === 'personal' ? 'Personal' : 'Group'}</em></label>`).join('')}</div></div>
    <div class="f full">Lokasi tambahan (jika berlatih di lebih satu lokasi, cth. Puchong Sport Centre + Michael's BA)
      <div class="langchk" style="margin-top:6px">${T('venues').filter(v => v.active).map(v => `<label><input type="checkbox" name="extra_venues" value="${v.id}" ${s && T('student_programmes').some(x => x.student_id === s.id && x.venue_id === v.id && v.id !== s.venue_id) ? 'checked' : ''}> ${esc(v.name)}</label>`).join('')}</div></div>
    ${F('Kod keluarga (adik-beradik)', 'family_ref', { value: s?.family_ref, ph: 'sama untuk adik-beradik' })}
    <label class="f" style="justify-content:flex-end"><span style="flex-direction:row;display:flex;align-items:center;gap:8px;height:40px"><input type="checkbox" name="fee_exempt" value="1" ${s?.fee_exempt ? 'checked' : ''} style="width:auto;height:auto"> Tajaan: latihan kumpulan percuma (personal bayar court sahaja)</span></label>
    ${F('Nota bil (cth. penajaan tamat, hanya bayar court)', 'billing_note', { value: s?.billing_note })}
    ${F('Bahasa mesej, invois & resit', 'lang', { value: s?.lang || '', opts: [['', 'Auto (ikut akaun ibu bapa)'], ['ms', 'Bahasa Malaysia'], ['en', 'English'], ['zh', '中文']] })}
    ${F('Catatan', 'notes', { type: 'textarea', value: s?.notes, full: true })}
  </div>
  <input type="hidden" name="sib_ids" value="">
  <h4 style="font-size:13.5px;margin:18px 0 8px">2. Ibu bapa / penjaga</h4>
  <div id="famNote"></div>
  <label class="check-row" style="border:1px solid var(--line);border-radius:12px;margin-bottom:10px"><input type="checkbox" name="g_self" value="1" ${guards[0]?.relationship === 'self' ? 'checked' : ''}><span><b>Pelajar dewasa: daftar sebagai diri sendiri</b><br><span class="muted" style="font-size:12.5px">Tiada ibu bapa. No. WhatsApp, e-mel dan alamat di bawah ialah milik pelajar.</span></span></label>
  <div id="guardBlocks">${(guards.length ? guards : [null]).map((g, i) => guardBlock(g, i + 1)).join('')}</div>
  <button type="button" class="btn sm" data-action="guard-more">${ic('plus', 'sm')} Tambah penjaga</button>
  <p class="muted" style="margin-top:8px;font-size:12.5px">Taip no. WhatsApp penjaga: jika sama dengan adik-beradik yang sudah didaftar, maklumat penjaga, kod keluarga dan akaun ibu bapa dipautkan secara automatik.</p>`;

/* ---------- Auto-sambung adik-beradik ikut no. telefon penjaga ---------- */
const normPhone = v => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('60')) d = d.slice(2); if (d.startsWith('0')) d = d.slice(1); return d; };
function findFamilies(phone, selfId) {
  const n = normPhone(phone); if (n.length < 8) return [];
  const sids = new Set([...T('guardians').filter(g => normPhone(g.phone) === n).map(g => g.student_id), ...T('students').filter(x => normPhone(x.guardian_phone) === n).map(x => x.id)]);
  sids.delete(selfId);
  const sibs = [...sids].map(id => byId('students', id)).filter(Boolean).sort((a, b) => (a.status === 'left') - (b.status === 'left') || a.full_name.localeCompare(b.full_name));
  /* kumpul ikut keluarga: kod keluarga, jika tiada ikut nama penjaga utama */
  const groups = new Map();
  for (const x of sibs) { const k = x.family_ref || 'g:' + String(x.guardian_name || '').trim().toLowerCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
  return [...groups.values()].map(list => {
    const ref = list.find(x => x.family_ref)?.family_ref || null;
    const all = [...new Map([...list, ...(ref ? T('students').filter(x => x.family_ref === ref && x.id !== selfId) : [])].map(x => [x.id, x])).values()];
    return { main: list[0], all, ref, guards: guardiansOf(list[0].id), account: all.find(x => x.guardian_id)?.guardian_id || null };
  });
}
const familyCode = st => (st.full_name.trim().split(/\s+/).filter(w => !/^(bin|binti|bt|bte|a\/l|a\/p|al|ap)$/i.test(w)).pop() || st.full_name).toUpperCase().replace(/[^A-Z0-9]/g, '');
function bindFamily(f, selfId) {
  const E = f.elements, note = f.querySelector('#famNote');
  const fill = (blk, g) => { const set = (n, v) => { const el = blk.querySelector(`[name=${n}]`); if (el && v != null && !el.value) el.value = v; };
    set('g_name', g.full_name); set('g_email', g.email); set('g_addr', g.address); set('g_ic', g.ic_no); if (g.relationship) blk.querySelector('[name=g_rel]').value = g.relationship; };
  const apply = (inp, fam) => {
    const n = normPhone(inp.value), blk = inp.closest('.g-block');
    const g = fam.guards.find(x => normPhone(x.phone) === n) || { full_name: fam.main.guardian_name, phone: fam.main.guardian_phone };
    fill(blk, g);
    // penjaga lain keluarga ini (cth. ibu) ditambah jika belum ada dalam borang
    const box = f.querySelector('#guardBlocks'), inForm = () => [...box.querySelectorAll('[name=g_phone]')].map(x => normPhone(x.value));
    for (const o of fam.guards) { if (!o.phone || inForm().includes(normPhone(o.phone)) || box.querySelectorAll('.g-block').length >= 3) continue;
      box.insertAdjacentHTML('beforeend', guardBlock({ ...o, id: null }, box.querySelectorAll('.g-block').length + 1)); }
    if (!E.family_ref.value) E.family_ref.value = fam.ref || familyCode(fam.main);
    if (E.lang && !E.lang.value && fam.main.lang) E.lang.value = fam.main.lang;
    if (E.venue_id && !E.venue_id.value && fam.main.venue_id) E.venue_id.value = fam.main.venue_id;
    E.sib_ids.value = fam.all.map(x => x.id).join(',');
    note.innerHTML = `<div class="hint" style="margin-bottom:10px;border-color:var(--ok);background:var(--ok-soft,#ecfdf3)">${ic('users', 'sm')} Adik-beradik ditemui: <b>${fam.all.map(x => esc(x.full_name)).join(', ')}</b>. Maklumat penjaga dan kod keluarga <b>${esc(E.family_ref.value)}</b> diisi automatik${fam.account ? '; akaun ibu bapa yang sama akan dipautkan' : ''}. <button type="button" class="btn sm" id="famUndo" style="margin-left:6px">Bukan keluarga ini</button></div>`;
    note.querySelector('#famUndo').onclick = () => { E.sib_ids.value = ''; if (!fam.ref || E.family_ref.value === fam.ref || E.family_ref.value === familyCode(fam.main)) E.family_ref.value = ''; note.innerHTML = ''; };
  };
  const run = inp => {
    const key = inp.closest('.g-block') && [...f.querySelectorAll('[name=g_phone]')].indexOf(inp) + ':' + normPhone(inp.value);
    if (f._fk === key) return; f._fk = key;   // nombor sama sudah diproses (cth. blur selepas taip)
    const fams = findFamilies(inp.value, selfId);
    if (!fams.length) return;
    if (fams.length === 1) return apply(inp, fams[0]);
    // lebih daripada satu keluarga guna nombor ini: admin pilih
    note.innerHTML = `<div class="hint warn" style="margin-bottom:10px">${ic('users', 'sm')} No. ini digunakan oleh lebih daripada satu keluarga. Pilih keluarga yang betul:<div class="actions" style="margin-top:8px;flex-wrap:wrap">${fams.map((x, i) => `<button type="button" class="btn sm" data-fi="${i}">${esc(x.all.map(y => y.full_name).join(', '))} (${esc(x.main.guardian_name || '—')})</button>`).join('')}<button type="button" class="btn sm" data-fi="-1">Keluarga baharu</button></div></div>`;
    note.querySelectorAll('[data-fi]').forEach(btn => btn.onclick = () => { const i = Number(btn.dataset.fi); if (i < 0) { note.innerHTML = ''; E.sib_ids.value = ''; } else apply(inp, fams[i]); });
  };
  const selfSync = () => {
    const on = E.g_self?.checked, b1 = f.querySelector('.g-block'); if (!b1) return;
    b1.querySelector('[name=g_rel]').closest('.f').style.display = on ? 'none' : '';
    const nm = b1.querySelector('[name=g_name]'); nm.closest('.f').style.display = on ? 'none' : ''; nm.required = !on;
    if (on) { nm.value = E.full_name.value; b1.querySelector('[name=g_rel]').value = 'self'; } else if (b1.querySelector('[name=g_rel]').value === 'self') b1.querySelector('[name=g_rel]').value = 'mother';
    b1.querySelector('b').textContent = on ? 'Hubungan pelajar (diri sendiri)' : 'Penjaga 1 (utama)';
  };
  E.g_self?.addEventListener('change', selfSync); E.full_name.addEventListener('input', () => { if (E.g_self?.checked) f.querySelector('.g-block [name=g_name]').value = E.full_name.value; });
  selfSync();
  const go = e => { if (e.target.name === 'g_phone' && normPhone(e.target.value).length >= 9) run(e.target); };
  f.addEventListener('change', go); f.addEventListener('input', e => { clearTimeout(f._ft); f._ft = setTimeout(() => go(e), 500); });
}

async function saveStudent(d, sid) {
  const arr = k => [].concat(d[k] ?? []);
  const ids = arr('g_id'), names = arr('g_name'), rels = arr('g_rel'), phones = arr('g_phone'), emails = arr('g_email'), addrs = arr('g_addr'), ics = arr('g_ic');
  if (d.g_self === '1') { names[0] = d.full_name.trim(); rels[0] = 'self'; }
  const gs = names.map((n, i) => ({ id: ids[i] || null, relationship: rels[i], full_name: (n || '').trim(), phone: val(phones[i]), email: val(emails[i]) ? emails[i].trim().toLowerCase() : null, address: val(addrs[i]), ic_no: val(ics[i]) })).filter(g => g.full_name);
  if (!gs.length) { toast('Masukkan sekurang-kurangnya seorang penjaga', true); return false; }
  const progs = arr('prog_ids').filter(Boolean);
  const patch = { full_name: d.full_name.trim(), birth_date: val(d.birth_date), gender: val(d.gender), venue_id: val(d.venue_id), status: d.status, family_ref: val(d.family_ref), fee_exempt: d.fee_exempt === '1', billing_note: val(d.billing_note), lang: val(d.lang), notes: val(d.notes), programme_id: progs[0] || null, guardian_name: gs[0].full_name, guardian_phone: gs[0].phone };
  const sibs = String(d.sib_ids || '').split(',').filter(Boolean).map(x => byId('students', x)).filter(Boolean);
  const acct = sibs.find(x => x.guardian_id)?.guardian_id;
  if (acct && !(sid && byId('students', sid)?.guardian_id)) patch.guardian_id = acct;
  let id = sid;
  if (id) await update('students', id, patch);
  else { const r = await insert('students', { ...patch, joined_on: d.status === 'active' ? todayISO() : null }); id = r?.id; }
  if (!id) return false;
  const have = T('guardians').filter(g => g.student_id === id);
  for (const g of have) if (!gs.some(x => x.id === g.id)) await remove('guardians', g.id);
  for (const [i, g] of gs.entries()) { const row = { sort: i + 1, relationship: g.relationship, full_name: g.full_name, phone: g.phone, email: g.email, address: g.address, ic_no: g.ic_no }; if (g.id) await update('guardians', g.id, row); else await insert('guardians', { ...row, student_id: id }); }
  const hp = T('student_programmes').filter(p => p.student_id === id), vens = [...new Set([patch.venue_id || null, ...arr('extra_venues').filter(Boolean)])];
  const want = progs.flatMap(pid => vens.map(v => [pid, v]));
  for (const p of hp) if (!want.some(([pid, v]) => pid === p.programme_id && v === (p.venue_id || null))) await remove('student_programmes', p.id);
  for (const [pid, v] of want) if (!hp.some(p => p.programme_id === pid && (p.venue_id || null) === v)) await insert('student_programmes', { student_id: id, programme_id: pid, venue_id: v });
  if (patch.family_ref) for (const x of sibs) if (!x.family_ref) await update('students', x.id, { family_ref: patch.family_ref });
  if (S.mode === 'supabase') await refresh(['students', 'guardians', 'student_programmes']);
  return id;
}
const guardiansOf = id => T('guardians').filter(g => g.student_id === id).sort((a, b) => a.sort - b.sort);
const progIdsOf = s => { const x = [...new Set(T('student_programmes').filter(p => p.student_id === s.id).map(p => p.programme_id))]; return x.length ? x : (s.programme_id ? [s.programme_id] : []); };
const progNamesOf = s => progIdsOf(s).map(progName).join(' + ') || '—';

/* =====================================================================
   SENARAI PELAJAR
   ===================================================================== */
VIEWS.pelajar = () => {
  const q = (UI.studentQ || '').toLowerCase(), st = UI.studentStatus || 'active', pg = UI.studentProg || '', vn = UI.studentVenue || '';
  const all = T('students');
  const rows = all.filter(s => (st === 'all' || s.status === st) && (!pg || s.programme_id === pg) && (!vn || s.venue_id === vn) && (!UI.studentLink || !s.guardian_id)
    && (!q || [s.full_name, s.guardian_name, s.guardian_phone, s.family_ref, ...guardiansOf(s.id).map(g => g.email)].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  return `
  ${pageHead('Senarai Pelajar', `${all.filter(s => s.status === 'active').length} pelajar aktif · ${all.length} rekod keseluruhan`, `<button class="btn primary" data-action="student-add">${ic('userplus', 'sm')} Daftar Pelajar</button> <a class="btn" href="#kemasukan">Pendaftaran</a>`)}
  <div class="card">
    <div class="toolbar">
      <label class="field grow">${ic('search', 'sm')}<input id="studentSearch" data-on-input="student-q" placeholder="Cari nama, ibu bapa, telefon…" value="${esc(UI.studentQ || '')}"></label>
      <label class="field"><select data-on-change="student-status">${[['active', 'Aktif'], ['paused', 'Digantung'], ['left', 'Berhenti'], ['pending', 'Dalam proses'], ['all', 'Semua status']].map(([v, l]) => `<option value="${v}" ${st === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><select data-on-change="student-prog"><option value="">Semua program</option>${T('programmes').map(p => `<option value="${p.id}" ${pg === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field"><select data-on-change="student-link"><option value="">Semua akaun</option><option value="1" ${UI.studentLink ? 'selected' : ''}>Belum dipautkan akaun (${all.filter(s => s.status === 'active' && !s.guardian_id).length})</option></select></label>
      <label class="field"><select data-on-change="student-venue"><option value="">Semua lokasi</option>${T('venues').map(v => `<option value="${v.id}" ${vn === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Pelajar</th><th>Program</th><th>Lokasi</th><th>Ibu bapa</th><th>Kehadiran</th><th>Pakej</th></tr></thead>
      <tbody>${rows.map(s => {
        const r = attRate(s.id), lp = livePackages(s.id)[0], pp = studentPackages(s.id).find(p => p.status === 'pending');
        return `<tr class="click" data-action="student-view" data-id="${s.id}">
          <td><div class="cell-person">${avatar(s.full_name)}<div><b>${esc(s.full_name)}</b><span>${s.birth_date ? ageOf(s.birth_date) + ' thn' : '—'}${s.status !== 'active' ? ' · ' + LABEL[s.status] : ''}</span>${s.fee_exempt ? '<span class="badge b-lime" style="margin-top:3px">Tiada yuran</span>' : ''}</div></div></td>
          <td>${esc(progNamesOf(s))}<div class="muted" style="font-size:12px">${lp ? LABEL[lp.schedule_mode] : ''}</div></td>
          <td>${esc(venueName(s.venue_id))}</td>
          <td>${esc(s.guardian_name || '—')}<div class="muted" style="font-size:12px">${esc(s.guardian_phone || '')}${guardiansOf(s.id)[0]?.email ? ' · ' + esc(guardiansOf(s.id)[0].email) : ''}</div>${s.guardian_id ? '' : '<span class="badge b-warn" style="margin-top:3px">Belum dipautkan akaun</span>'}</td>
          <td style="min-width:120px">${r == null ? '<span class="muted">—</span>' : `<div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><span style="width:${r}%;background:${barColor(r)}"></span></div><b class="num" style="font-size:12.5px">${r}%</b></div>`}</td>
          <td style="white-space:nowrap">${lp ? `<b class="num" style="color:${pkgRemaining(lp) <= 1 ? 'var(--bad)' : 'var(--ink)'}">${pkgRemaining(lp)}</b><span class="muted"> / ${lp.sessions_total} sesi</span><div class="muted" style="font-size:11.5px">tamat ${fmtShort(lp.expires_on)}</div>` : pp ? '<span class="badge b-info">menunggu bayaran</span>' : s.status === 'active' ? '<span class="badge b-warn">tiada pakej</span>' : '<span class="muted">—</span>'}</td></tr>`;
      }).join('') || `<tr><td colspan="6" class="empty">Tiada pelajar sepadan.</td></tr>`}</tbody>
    </table></div>
  </div>`;
};

Object.assign(INPUTS, {
  'student-q': v => { UI.studentQ = v; app.render(); },
  'student-status': v => { UI.studentStatus = v; app.render(); },
  'student-prog': v => { UI.studentProg = v; app.render(); },
  'student-venue': v => { UI.studentVenue = v; app.render(); },
  'student-link': v => { UI.studentLink = v; app.render(); },
});

Object.assign(ACTIONS, {
  'student-merge': id => {
    const a = byId('students', id), words = String(a.full_name).toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const cands = T('students').filter(x => x.id !== id && !x.merged_into).map(x => ({ x, sc: words.filter(w => x.full_name.toLowerCase().includes(w)).length })).sort((p, q) => q.sc - p.sc || p.x.full_name.localeCompare(q.x.full_name));
    const cnt = sid => ({ att: T('attendance').filter(r => r.student_id === sid).length, inv: T('invoices').filter(r => r.student_id === sid).length, pk: T('student_packages').filter(r => r.student_id === sid).length });
    const c0 = cnt(id);
    openModal({ title: 'Gabung profil pelajar', submit: 'Gabungkan', body: `<p style="font-size:13.5px">Profil <b>${esc(a.full_name)}</b> (${c0.att} kehadiran · ${c0.inv} invois · ${c0.pk} pakej) akan digabungkan ke profil sebenar di bawah. Semua kehadiran, invois, pakej, kelas, progres dan penjaga dipindahkan — tiada data hilang. Profil ini kemudian ditanda "Berhenti" dengan nota "digabung".</p>
      <label class="f full" style="margin-top:12px">Profil sebenar<select name="to" required><option value="">— Pilih —</option>${cands.map(({ x, sc }) => `<option value="${x.id}">${sc ? '★ ' : ''}${esc(x.full_name)}${x.status !== 'active' ? ' (' + esc(LABEL[x.status] || x.status) + ')' : ''}</option>`).join('')}</select></label>
      <p class="muted" style="font-size:12px;margin-top:8px">★ = nama hampir sama. Rekod bertindih (sesi yang sama) mengekalkan rekod profil sebenar.</p>`,
      onSubmit: async d => {
        if (!d.to) throw new Error('Pilih profil sebenar.');
        const b = byId('students', d.to);
        if (S.mode === 'demo') {
          const tabs = ['attendance', 'class_enrolments', 'invoices', 'student_packages', 'progress_records', 'guardians', 'student_programmes', 'tournament_entries', 'invoice_items', 'expenses', 'booking_requests'];
          for (const t of tabs) (S.t[t] || []).filter(r => r.student_id === id).forEach(r => {
            const dup = t === 'attendance' ? S.t[t].some(y => y.student_id === d.to && y.session_id === r.session_id) : t === 'class_enrolments' ? S.t[t].some(y => y.student_id === d.to && y.class_id === r.class_id) : false;
            if (dup) S.t[t] = S.t[t].filter(y => y !== r); else r.student_id = d.to;
          });
          for (const k of ['birth_date', 'gender', 'guardian_id', 'guardian_name', 'guardian_phone', 'family_ref']) if (!b[k] && a[k]) b[k] = a[k];
          Object.assign(a, { status: 'left', merged_into: d.to, guardian_id: null, notes: [a.notes, `DIGABUNG ke "${b.full_name}"`].filter(Boolean).join('\n') });
        } else {
          await rpc('merge_students', { p_from: id, p_to: d.to });
          await refresh(['students', 'attendance', 'class_enrolments', 'invoices', 'student_packages', 'progress_records', 'guardians', 'student_programmes', 'invoice_items', 'booking_requests']);
        }
        toast(`${a.full_name} digabungkan ke ${b.full_name}`); app.render();
      } });
  },
  'student-view': id => {
    const s = byId('students', id), enr = T('class_enrolments').filter(e => e.student_id === id).map(e => byId('classes', e.class_id)).filter(Boolean);
    const invs = T('invoices').filter(i => (i.student_id === id || T('invoice_items').some(it => it.invoice_id === i.id && it.student_id === id)) && i.status !== 'void').sort((a, b) => (b.issued_on || '').localeCompare(a.issued_on || '')).slice(0, 5);
    const sibs = T('students').filter(x => x.id !== id && ((s.family_ref && x.family_ref === s.family_ref) || (s.guardian_phone && x.guardian_phone === s.guardian_phone)));
    const r = attRate(id), pkgs = studentPackages(id).filter(p => p.status !== 'cancelled').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    openModal({
      title: 'Profil Pelajar', wide: true, cancel: 'Tutup',
      body: `<div class="coach-top" style="margin-bottom:16px">${avatar(s.full_name, 'lg')}<div style="flex:1"><h4 style="font-size:17px">${esc(s.full_name)}</h4><div class="muted">${s.birth_date ? ageOf(s.birth_date) + ' tahun · ' : ''}${s.gender ? LABEL[s.gender] + ' · ' : ''}${badge(s.status)}</div></div></div>
      <dl class="kv">
        <dt>Program</dt><dd>${esc(progNamesOf(s))}</dd>
        <dt>Lokasi</dt><dd>${esc(venueName(s.venue_id))}</dd>
        ${s.medical_notes ? `<dt>Kesihatan</dt><dd style="color:var(--bad)">${esc(s.medical_notes)}</dd>` : ''}
        ${s.emergency_contact ? `<dt>Kecemasan</dt><dd>${esc(s.emergency_contact)}</dd>` : ''}
        ${s.guardian_id && byId('profiles', s.guardian_id) ? `<dt>T&amp;C</dt><dd>${byId('profiles', s.guardian_id).tc_accepted_at ? 'Dipersetujui ' + fmtShort(byId('profiles', s.guardian_id).tc_accepted_at.slice(0, 10)) : '<span class="muted">Belum log masuk / belum setuju</span>'}</dd>` : ''}
        ${guardiansOf(id).length ? guardiansOf(id).map((g, i) => `<dt>Penjaga ${i + 1}</dt><dd>${esc(g.full_name)}${g.relationship ? ' (' + esc((RELS.find(r => r[0] === g.relationship) || [0, g.relationship])[1]) + ')' : ''}<div class="muted" style="font-weight:400;font-size:12.5px">${esc(g.phone || '')}${g.email ? ' · ' + esc(g.email) : ''}${g.address ? '<br>' + esc(g.address) : ''}${g.ic_no ? '<br>No. KP: ' + esc(g.ic_no) : ''}</div>${g.phone ? `<a class="btn sm" href="${waLink(g.phone)}" target="_blank" rel="noopener">${ic('msg', 'sm')} WhatsApp</a>` : ''}</dd>`).join('') : `<dt>Ibu bapa</dt><dd>${esc(s.guardian_name || '—')} · ${esc(s.guardian_phone || '')}</dd>`}
        <dt>Akaun ibu bapa</dt><dd>${s.guardian_id ? `${esc(byId('profiles', s.guardian_id)?.email || 'dipautkan')} <button class="btn sm" data-action="parent-acct" data-id="${s.id}" data-reset="1" style="margin-left:6px">Set semula kata laluan</button>` : `<span class="muted">belum ada akaun</span> <button class="btn sm primary" data-action="parent-acct" data-id="${s.id}" style="margin-left:6px">Cipta akaun ibu bapa</button>`}</dd>
        <dt>Tarikh masuk</dt><dd>${fmtDate(s.joined_on)}</dd>
        <dt>Kehadiran (60 hari)</dt><dd>${r == null ? '—' : r + '%'}</dd>
        ${sibs.length ? `<dt>Adik-beradik</dt><dd>${sibs.map(x => `<a href="#" data-action="student-view" data-id="${x.id}" style="color:var(--info)">${esc(x.full_name)}</a>`).join(', ')}</dd>` : ''}
        ${s.notes ? `<dt>Catatan</dt><dd style="font-weight:400">${esc(s.notes)}</dd>` : ''}
      </dl>
      <h4 style="margin:18px 0 8px;font-size:13.5px">Pakej</h4>
      ${pkgs.length ? pkgs.slice(0, 4).map(p => `<div class="slot" style="border-left-color:${p.status === 'active' ? 'var(--ok)' : 'var(--line)'};margin-bottom:6px"><b>${esc(p.name)}</b> ${badge(p.status === 'pending' ? 'pending' : p.status, p.status === 'pending' ? 'Menunggu bayaran' : p.status === 'completed' ? 'Sesi habis' : undefined)}<div class="meta">${LABEL[p.schedule_mode]} · ${p.status === 'pending' ? 'belum aktif' : `${pkgRemaining(p)} sesi berbaki (${p.sessions_used}/${p.sessions_total})${p.expires_on ? ' · tamat ' + fmtDate(p.expires_on) : ''}`} · ${RM(p.price)}</div></div>`).join('') : '<div class="muted" style="font-size:13px">Belum ada pakej.</div>'}
      <h4 style="margin:18px 0 8px;font-size:13.5px">Kelas</h4>
      ${enr.length ? enr.map(c => `<div class="slot" style="border-left-color:var(--brand);margin-bottom:6px"><b>${esc(classLabel(c))}</b><div class="meta">${esc(staffName(c.coach_id))}${c.court ? ' · ' + esc(c.court) : ''}</div></div>`).join('') : '<div class="muted" style="font-size:13px">Belum ditempatkan dalam kelas.</div>'}
      <h4 style="margin:18px 0 8px;font-size:13.5px">Invois terkini</h4>
      ${invs.length ? `<ul class="list" style="margin:0 -20px">${invs.map(i => `<li class="list-item" style="padding:9px 20px"><div class="li-main"><div class="li-title">${esc(i.description || LABEL[i.kind])}</div><div class="li-sub">${esc(i.number)}</div></div><b class="num">${RM(i.amount)}</b>${badge(invStatus(i))}</li>`).join('')}</ul>` : '<div class="muted" style="font-size:13px">Tiada invois.</div>'}
      <div class="actions" style="margin-top:18px">
        ${['active', 'awaiting_payment', 'paused'].includes(s.status) ? `<button type="button" class="btn primary" data-action="sell" data-id="${id}">${ic('tag', 'sm')} Jual Pakej</button>` : ''}
        <button type="button" class="btn" data-action="student-edit" data-id="${id}">${ic('edit', 'sm')} Edit</button>
        ${['active', 'paused'].includes(s.status) ? `<button type="button" class="btn" data-action="student-status" data-id="${id}|${s.status === 'active' ? 'paused' : 'active'}">${s.status === 'active' ? 'Gantung' : 'Aktifkan semula'}</button>` : ''}
        ${s.status !== 'left' ? `<button type="button" class="btn" data-action="student-status" data-id="${id}|left">Berhenti</button>` : `<button type="button" class="btn" data-action="student-status" data-id="${id}|active">Aktifkan semula</button>`}
        <button type="button" class="btn" data-action="adj-add" data-id="${id}" title="Rekod kredit / caj untuk invois akan datang">${ic('wallet', 'sm')} Pelarasan bil</button>
        <button type="button" class="btn" data-action="student-merge" data-id="${id}" title="Gabungkan profil berganda (cth. nama pendek) ke profil sebenar">${ic('users', 'sm')} Gabung profil</button>
        <button type="button" class="btn danger-o" data-action="student-del" data-id="${id}">${ic('trash', 'sm')} Padam</button>
      </div>`,
    });
  },
  'student-add': () => bindFamily(openModal({ title: 'Daftar Pelajar Baharu', submit: 'Simpan Pelajar', wide: true, body: studentFormHtml(null, [], [], 'add'), onSubmit: async d => { const r = await saveStudent(d, null); if (r === false) return false; toast('Pelajar didaftarkan'); app.render(); } }), null),
  'student-edit': id => {
    const s = byId('students', id);
    bindFamily(openModal({ title: 'Edit Pelajar & Penjaga', submit: 'Simpan', wide: true, body: studentFormHtml(s, progIdsOf(s), guardiansOf(id), 'edit'), onSubmit: async d => { const r = await saveStudent(d, id); if (r === false) return false; toast('Maklumat dikemas kini'); app.render(); } }), id);
  },
  'guard-more': () => {
    const box = document.getElementById('guardBlocks'); const n = box.querySelectorAll('.g-block').length;
    if (n >= 3) return toast('Maksimum 3 penjaga', true);
    box.insertAdjacentHTML('beforeend', guardBlock(null, n + 1));
  },
  'guard-remove': (id, el) => el.closest('.g-block')?.remove(),
  'student-status': async key => {
    const [id, st] = key.split('|'); await update('students', id, { status: st, ...(st === 'active' && !byId('students', id).joined_on ? { joined_on: todayISO() } : {}) });
    closeModal(); toast(`Status: ${LABEL[st]}`); app.render();
  },
  'student-del': id => confirmModal({ title: 'Padam pelajar?', message: `Semua rekod <b>${esc(byId('students', id).full_name)}</b> (kehadiran, invois, penyertaan kejohanan) akan dipadam kekal. Pertimbangkan "Berhenti" jika mahu simpan sejarah.`, ok: 'Padam Kekal', danger: true, onOk: async () => { await remove('students', id); toast('Pelajar dipadam'); app.render(); } }),
});

/* ---------- Akaun portal ibu bapa: cipta / set semula kata laluan, kemudian hantar melalui WhatsApp ---------- */
const portalUrl = () => location.href.split('#')[0].replace(/index\.html$/, '');
const credMsg = ({ name, login, password, kids, url }) => pickL(
  `Salam ${name}, akaun portal ibu bapa Maxxima Badminton Academy untuk ${kids} sudah sedia.\n\nPautan: ${url}\nLog masuk: ${login}\nKata laluan: ${password}\n\nDi portal anda boleh lihat jadual, kehadiran, invois dan resit, serta muat naik bukti bayaran. Sila tukar kata laluan selepas log masuk (Akaun > Tukar kata laluan). Terima kasih! 🏸`,
  `Hi ${name}, your Maxxima Badminton Academy parent portal account for ${kids} is ready.\n\nLink: ${url}\nLogin: ${login}\nPassword: ${password}\n\nIn the portal you can see the schedule, attendance, invoices and receipts, and upload payment proof. Please change your password after logging in (Account > Change password). Thank you! 🏸`,
  `${name} 您好，${kids} 的 Maxxima Badminton Academy 家长平台账户已开通。\n\n链接：${url}\n登录：${login}\n密码：${password}\n\n您可在平台查看课程表、出席、发票和收据，并上传付款凭证。登录后请更改密码（账户 > 更改密码）。谢谢！🏸`);
const pickL = (ms, en, zh) => ({ ms, en, zh }[getLang()] ?? ms);
ACTIONS['parent-acct'] = (id, el) => {
  const s = byId('students', id), reset = el?.dataset.reset === '1';
  confirmModal({ title: reset ? 'Set semula kata laluan ibu bapa?' : 'Cipta akaun portal ibu bapa?',
    message: reset ? 'Kata laluan baharu akan dijana. Kata laluan lama tidak boleh digunakan lagi.' : `Akaun dicipta untuk penjaga utama <b>${esc(s.guardian_name || '')}</b> menggunakan e-mel penjaga, atau no. WhatsApp jika tiada e-mel. Adik-beradik yang sama penjaga dipautkan sekali.`,
    ok: reset ? 'Set semula' : 'Cipta akaun',
    onOk: async () => {
      let r;
      if (S.mode === 'demo') {
        const ph = String(s.guardian_phone || '').replace(/\D/g, ''), login = (T('guardians').find(g => g.student_id === id && g.email)?.email || (ph.startsWith('0') ? '6' + ph : ph) + '@maxxima.app').toLowerCase();
        let pr = T('profiles').find(p => p.id === s.guardian_id) || T('profiles').find(p => p.email === login);
        if (!pr) pr = await insert('profiles', { email: login, full_name: s.guardian_name, role: 'parent', active: true });
        for (const x of [s, ...T('students').filter(x => !x.guardian_id && s.family_ref && x.family_ref === s.family_ref)]) await update('students', x.id, { guardian_id: pr.id });
        r = { login, password: 'demo1234', name: s.guardian_name, children: T('students').filter(x => x.guardian_id === pr.id).length };
      } else {
        const { data, error } = await S.client.rpc('admin_parent_account', { p_student: id, p_reset: reset }); if (error) throw error; r = data;
        if (r?.password) { const { error: e2 } = await S.client.from('profiles').update({ must_change_pw: true }).eq('email', r.login); if (e2) console.warn(e2); }   // wajib tukar kata laluan pada log masuk pertama
        await refresh(['students', 'profiles']);
      }
      app.render();
      const kids = T('students').filter(x => x.guardian_id === s.guardian_id || x.id === id).filter(x => x.guardian_id).map(x => x.full_name.split(' ')[0]);
      if (!r.password) return toast('Akaun sudah wujud dan dipautkan. Tekan "Set semula kata laluan" untuk hantar kata laluan baharu.');
      const msg = withLang(langOf(s), () => credMsg({ name: r.name || s.guardian_name || '', login: r.login, password: r.password, kids: [...new Set(kids)].join(' & ') || s.full_name, url: portalUrl() }));
      const phone = r.phone || s.guardian_phone;
      setTimeout(() => openModal({ title: 'Akaun ibu bapa sedia', cancel: 'Tutup', body: `<div class="hint" style="margin-bottom:12px">Log masuk: <b>${esc(r.login)}</b><br>Kata laluan: <b style="font-size:16px;letter-spacing:.05em">${esc(r.password)}</b><br><span class="muted" style="font-size:12.5px">Kata laluan ini hanya dipaparkan sekali. Hantar kepada ibu bapa sekarang.</span></div>
        <pre class="copybox" id="remindText">${esc(msg)}</pre>
        <div class="actions" style="margin-top:12px">${phone ? `<a class="btn primary" href="${waLink(phone, msg)}" target="_blank" rel="noopener">${ic('msg', 'sm')} Hantar melalui WhatsApp</a>` : ''}<button type="button" class="btn" data-action="copy-remind">Salin mesej</button></div>` }), 60);
    } });
};
