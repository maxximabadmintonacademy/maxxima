// Jadual Kelas (templat mingguan) dan Kehadiran (sesi bertarikh).
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove } from '../data.js';
import { ic, esc, F, num, val, badge, avatar, UI, app, toast, openModal, closeModal, confirmModal, pageHead, fmtDate, hm, todayISO, addDays, parseISO, iso, monthKey, monthLabel, DAYS, LABEL, barColor, $ } from '../ui.js';
import { T, byId, venueName, progName, staffName, studentName, progColor, enrolledIn, classLabel, attRate, activeStudents, livePackages, pkgRemaining } from './helpers.js';
import { ageGroups, langWarn, langGap, langName } from './sessions.js';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/* =====================================================================
   JADUAL KELAS
   ===================================================================== */
VIEWS.jadual = () => {
  const vf = UI.schedVenue || '', today = new Date().getDay();
  const t0 = todayISO(), t14 = addDays(t0, 14);
  const persNames = c => { const ids = new Set(enrolledIn(c.id).map(e => e.student_id)); T('class_sessions').filter(s => s.class_id === c.id && s.session_date >= t0 && s.session_date <= t14).forEach(s => T('attendance').filter(a => a.session_id === s.id).forEach(a => ids.add(a.student_id))); return [...ids].map(studentName); };
  const persActive = c => !c.active && byId('programmes', c.programme_id)?.kind === 'personal' && T('class_sessions').some(s => s.class_id === c.id && s.status !== 'cancelled' && s.session_date >= t0 && s.session_date <= t14);
  const classes = T('classes').filter(c => (c.active || (UI.showPers !== false && persActive(c))) && (!vf || c.venue_id === vf));
  const seats = classes.reduce((t, c) => t + enrolledIn(c.id).length, 0), cap = classes.reduce((t, c) => t + c.capacity, 0);
  return `
  ${pageHead('Jadual Kelas', `${classes.length} kelas seminggu · penggunaan kapasiti ${cap ? Math.round(seats / cap * 100) : 0}%`, `<a class="btn" href="#kalendar">${ic('calendar', 'sm')} Kalendar Sesi</a><button class="btn primary" data-action="class-add">${ic('plus', 'sm')} Tambah Kelas</button>`)}
  <div class="toolbar card" style="margin-bottom:14px;border-radius:var(--radius)">
    <label class="field">${ic('pin', 'sm')}<select data-on-change="sched-venue"><option value="">Semua lokasi</option>${T('venues').filter(v => v.active).map(v => `<option value="${v.id}" ${vf === v.id ? 'selected' : ''}>${esc(v.name)} — ${esc(v.area || '')}</option>`).join('')}</select></label>
    <button class="chip ${UI.showPers !== false ? 'on' : ''}" style="cursor:pointer" data-action="sched-pers">Slot personal (14 hari)</button>
    ${T('programmes').filter(p => p.active).map(p => `<span class="chip"><span style="width:10px;height:10px;border-radius:3px;background:${progColor(p.id)}"></span>${esc(p.name)}</span>`).join('')}
  </div>
  <div class="week">${WEEK.map(d => {
    const cs = classes.filter(c => c.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
    return `<div class="day-col ${d === today ? 'today' : ''}">
      <div class="day-head"><b>${DAYS[d]}</b>${d === today ? '<span class="tag">Hari ini</span>' : `<span class="muted" style="font-size:11.5px">${cs.length} kelas</span>`}</div>
      <div class="day-body">${cs.map(c => { const n = enrolledIn(c.id).length; if (!c.active) return `
        <button class="slot" data-action="class-view" data-id="${c.id}" style="border-left-color:${progColor(c.programme_id)};border-left-style:dashed">
          <b>${hm(c.start_time)}–${hm(c.end_time)}</b>
          <div style="font-weight:600">${esc(persNames(c).join(', ') || progName(c.programme_id))}</div>
          <div class="meta">${esc(progName(c.programme_id))} · ${esc(staffName(c.coach_id))}</div>
          <div class="meta">${vf ? '' : esc(venueName(c.venue_id))}</div>
        </button>`; return `
        <button class="slot" data-action="class-view" data-id="${c.id}" style="border-left-color:${progColor(c.programme_id)}">
          <b>${hm(c.start_time)}–${hm(c.end_time)}</b>
          <div style="font-weight:600">${esc(progName(c.programme_id))}</div>
          <div class="meta">${esc(staffName(c.coach_id))}</div>
          ${(c.categories || []).length ? `<div class="meta">${c.categories.map(esc).join(' · ')}</div>` : ''}
          ${!c.coach_id || !c.court ? `<div class="warnline">${ic('alert', 'sm')} ${[!c.coach_id && 'tiada coach', !c.court && 'tiada court'].filter(Boolean).join(' · ')}</div>` : langGap(c.coach_id, c.venue_id).length ? `<div class="warnline">${ic('alert', 'sm')} bahasa coach</div>` : ''}
          <div class="meta">${vf ? '' : esc(venueName(c.venue_id)) + '<br>'}${esc(c.court || '')} · <span style="color:${n >= c.capacity ? 'var(--warn)' : 'inherit'};font-weight:600">${n}/${c.capacity}</span></div>
        </button>`; }).join('') || '<div class="muted" style="font-size:12px;padding:6px">Tiada kelas</div>'}</div>
    </div>`; }).join('')}</div>`;
};
INPUTS['sched-venue'] = v => { UI.schedVenue = v; app.render(); };
ACTIONS['sched-pers'] = () => { UI.showPers = UI.showPers === false; app.render(); };

const classForm = c => `<div class="form-grid">
  ${F('Lokasi', 'venue_id', { value: c?.venue_id || UI.schedVenue, req: true, opts: [['', '— Pilih —'], ...T('venues').filter(v => v.active).map(v => [v.id, v.name])] })}
  ${F('Program', 'programme_id', { value: c?.programme_id, req: true, opts: [['', '— Pilih —'], ...T('programmes').filter(p => p.active).map(p => [p.id, p.name])] })}
  ${F('Hari', 'weekday', { value: c?.weekday ?? 1, opts: WEEK.map(d => [d, DAYS[d]]) })}
  ${F('Gelanggang', 'court', { value: c?.court, ph: 'cth. Gelanggang 1' })}
  ${F('Mula', 'start_time', { type: 'time', value: hm(c?.start_time) || '16:30', req: true })}
  ${F('Tamat', 'end_time', { type: 'time', value: hm(c?.end_time) || '18:30', req: true })}
  ${F('Coach', 'coach_id', { value: c?.coach_id, opts: [['', '— Tentukan kemudian —'], ...T('staff').filter(s => s.active).map(s => [s.id, s.full_name])] })}
  ${F('Kapasiti', 'capacity', { type: 'number', value: c?.capacity ?? 12, min: 1, req: true })}
  <div class="f full">Kategori umur dalam sesi ini (kosong = satu kumpulan)<div class="langchk">${ageGroups().map(g => `<label><input type="checkbox" name="categories" value="${esc(g.code)}" ${(c?.categories || []).includes(g.code) ? 'checked' : ''}> ${esc(g.code)} <span class="muted">(${g.min}–${g.max})</span></label>`).join('')}</div><span class="hint">Pelajar diletakkan automatik ikut umur. Coach & court setiap kategori ditetapkan pada sesi (Kalendar Sesi).</span></div>
  ${F('Cara bil pelajar tanpa pakej', 'billing', { value: c?.billing || 'package', opts: [['package', 'Pakej (lalai)'], ['walkin', 'Walk-in setiap sesi'], ['monthly', 'Bil bulanan ikut sesi']] })}
  ${F('Kadar walk-in / coach per jam (RM)', 'rate_coach', { type: 'number', step: '0.01', min: 0, value: c?.rate_coach ?? '' })}
  ${F('Kadar court per jam (RM, personal)', 'rate_court', { type: 'number', step: '0.01', min: 0, value: c?.rate_court ?? '' })}
  <div class="full" id="clsWarn">${c?.coach_id ? langWarn(c.coach_id, c.venue_id) : ''}</div>
  ${c ? `<label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="active" value="1" ${c.active ? 'checked' : ''} style="width:auto;height:auto"> Kelas aktif (nyahtanda untuk sembunyikan tanpa padam sejarah)</label>` : ''}
</div>`;
const classPatch = (d, isEdit) => {
  if (d.end_time <= d.start_time) throw new Error('Masa tamat mesti selepas masa mula.');
  return { venue_id: d.venue_id, programme_id: d.programme_id, weekday: Number(d.weekday), start_time: d.start_time, end_time: d.end_time, court: val(d.court), coach_id: val(d.coach_id), capacity: Number(d.capacity), categories: [].concat(d.categories || []).filter(Boolean), billing: d.billing || 'package', rate_coach: num(d.rate_coach), rate_court: num(d.rate_court), ...(isEdit ? { active: d.active === '1' } : { active: true }) };
};

const bindLang = f => { const chk = () => { f.querySelector('#clsWarn').innerHTML = f.coach_id.value && f.venue_id.value ? langWarn(f.coach_id.value, f.venue_id.value) : ''; }; f.coach_id.addEventListener('change', chk); f.venue_id.addEventListener('change', chk); return f; };
Object.assign(ACTIONS, {
  'class-add': () => bindLang(openModal({ title: 'Tambah Kelas', submit: 'Tambah ke Jadual', wide: true, body: classForm(), onSubmit: async d => { await insert('classes', classPatch(d)); toast('Kelas ditambah'); app.render(); } })),
  'class-edit': id => bindLang(openModal({ title: 'Edit Kelas', wide: true, body: classForm(byId('classes', id)), onSubmit: async d => { await update('classes', id, classPatch(d, true)); toast('Kelas dikemas kini'); app.render(); } })),
  'class-del': id => confirmModal({ title: 'Padam kelas?', message: 'Semua sesi dan rekod kehadiran kelas ini akan turut dipadam. Pertimbangkan menyahaktifkan kelas (Edit) untuk menyimpan sejarah.', ok: 'Padam Kelas', danger: true, onOk: async () => { await remove('classes', id); toast('Kelas dipadam'); app.render(); } }),

  'class-view': id => {
    const c = byId('classes', id), roster = enrolledIn(id), ids = new Set(roster.map(e => e.student_id));
    const addable = activeStudents().filter(s => !ids.has(s.id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
    openModal({
      title: esc(progName(c.programme_id)), cancel: 'Tutup', wide: true,
      body: `<div class="muted" style="margin-bottom:14px">${esc(classLabel(c))}<br>${esc(staffName(c.coach_id))}${c.court ? ' · ' + esc(c.court) : ''}</div>
      <h4 style="font-size:13.5px;margin-bottom:6px">Pelajar (${roster.length}/${c.capacity})</h4>
      <ul class="list" style="margin:0 -20px">${roster.map(e => { const s = byId('students', e.student_id); return s ? `<li class="list-item" style="padding:9px 20px">${avatar(s.full_name)}<div class="li-main"><div class="li-title">${esc(s.full_name)}</div><div class="li-sub">${esc(s.guardian_name || '')}</div></div><button type="button" class="btn sm" data-action="class-unenrol" data-id="${e.id}|${id}" title="Keluarkan daripada kelas">${ic('x', 'sm')}</button></li>` : ''; }).join('') || '<li class="empty">Belum ada pelajar.</li>'}</ul>
      ${roster.length < c.capacity ? `<div style="display:flex;gap:8px;margin-top:12px"><label class="field grow"><select id="enrolSel"><option value="">+ Tambah pelajar ke kelas…</option>${addable.map(s => `<option value="${s.id}">${esc(s.full_name)}</option>`).join('')}</select></label><button type="button" class="btn primary" data-action="class-enrol" data-id="${id}">Tambah</button></div>` : '<div class="badge b-warn" style="margin-top:12px">Kelas penuh</div>'}
      <div class="actions" style="margin-top:18px"><button type="button" class="btn" data-action="class-edit" data-id="${id}">${ic('edit', 'sm')} Edit kelas</button><button type="button" class="btn danger-o" data-action="class-del" data-id="${id}">${ic('trash', 'sm')} Padam</button></div>`,
    });
  },
  'class-enrol': async id => {
    const sid = $('#enrolSel')?.value; if (!sid) return toast('Pilih pelajar dahulu', true);
    const c = byId('classes', id); if (enrolledIn(id).length >= c.capacity) return toast('Kelas sudah penuh', true);
    await insert('class_enrolments', { class_id: id, student_id: sid }); toast('Pelajar ditambah'); ACTIONS['class-view'](id); app.render();
  },
  'class-unenrol': async key => { const [eid, cid] = key.split('|'); await remove('class_enrolments', eid); toast('Pelajar dikeluarkan'); ACTIONS['class-view'](cid); app.render(); },
});

/* =====================================================================
   KEHADIRAN
   ===================================================================== */
const ATT_OPTS = ['present', 'late', 'absent', 'excused', 'late_cancel'];
/* Baki pakej: kehadiran ini menolak 1 sesi (kecuali "Dimaafkan"). */
const pkgChip = (studentId, a) => {
  const sp = a?.student_package_id ? byId('student_packages', a.student_package_id) : livePackages(studentId)[0];
  if (!sp) return `<div class="li-sub" style="color:var(--bad)">tiada pakej aktif — sesi tidak dapat ditolak</div>`;
  const rem = pkgRemaining(sp);
  return `<div class="li-sub" style="color:${rem <= 1 ? 'var(--bad)' : ''}">baki ${rem}/${sp.sessions_total} sesi${rem <= 1 ? ' · invois pembaharuan auto' : ''}</div>`;
};

VIEWS.kehadiran = () => {
  const date = UI.attDate || todayISO();
  const sessions = T('class_sessions').filter(s => s.session_date === date).map(s => ({ s, c: byId('classes', s.class_id) })).filter(x => x.c)
    .sort((a, b) => a.c.start_time.localeCompare(b.c.start_time));
  const weekdayClasses = T('classes').filter(c => c.active && c.weekday === parseISO(date).getDay());
  const dateLabel = `${DAYS[parseISO(date).getDay()]}, ${fmtDate(date)}`;

  const students = activeStudents();
  const rates = students.map(s => ({ s, r: attRate(s.id) })).filter(x => x.r != null);
  const avg = rates.length ? Math.round(rates.reduce((t, x) => t + x.r, 0) / rates.length) : 0;
  const low = rates.filter(x => x.r < 75).sort((a, b) => a.r - b.r);
  const byProg = T('programmes').filter(p => p.active).map(p => { const rs = rates.filter(x => x.s.programme_id === p.id); return [p, rs.length ? Math.round(rs.reduce((t, x) => t + x.r, 0) / rs.length) : null]; });

  return `
  ${pageHead('Kehadiran', 'Rekod kehadiran harian (coach mengisi melalui Portal Coach; admin boleh semak & betulkan).', `<button class="btn" data-action="sess-add">${ic('plus', 'sm')} Tambah Sesi</button><button class="btn primary" data-action="sess-generate">${ic('calendar', 'sm')} Jana Sesi Bulanan</button>`)}
  <div class="grid kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
    <div class="card kpi hero"><div class="kpi-top"><span class="kpi-label">Purata Kehadiran (60 hari)</span><span class="kpi-ico">${ic('check')}</span></div><div class="kpi-val">${avg}%</div><div class="kpi-foot">${rates.length} pelajar ada rekod</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Perlu Susulan</span><span class="kpi-ico t-bad">${ic('alert')}</span></div><div class="kpi-val">${low.length}</div><div class="kpi-foot">pelajar di bawah 75%</div></div>
    <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Sesi ${date === todayISO() ? 'Hari Ini' : 'Dipilih'}</span><span class="kpi-ico t-info">${ic('calendar')}</span></div><div class="kpi-val">${sessions.length}</div><div class="kpi-foot">${esc(dateLabel)}</div></div>
  </div>

  <div class="date-nav card card-pad mb">
    <button class="btn sm" data-action="att-day" data-id="-1">${ic('back', 'sm')}</button>
    <input type="date" value="${date}" data-on-change="att-date" class="date-input">
    <button class="btn sm" data-action="att-day" data-id="1">${ic('arrow', 'sm')}</button>
    ${date !== todayISO() ? `<button class="btn sm" data-action="att-today">Hari ini</button>` : ''}
    <span class="muted" style="margin-left:auto;font-size:13px">${esc(dateLabel)}</span>
  </div>

  ${sessions.length ? sessions.map(({ s, c }) => {
    const marked = T('attendance').filter(a => a.session_id === s.id);
    const rosterIds = new Set([...enrolledIn(c.id).map(e => e.student_id), ...marked.map(a => a.student_id)]);   // tetap + tempahan fleksibel
    const roster = [...rosterIds].map(id => byId('students', id)).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
    return `<div class="card mb">
      <div class="card-head" style="flex-wrap:wrap">
        <div><h3>${hm(c.start_time)}–${hm(c.end_time)} · ${esc(progName(c.programme_id))}</h3><div class="sub">${esc(venueName(c.venue_id))}${c.court ? ' · ' + esc(c.court) : ''} · ${esc(staffName(s.coach_id || c.coach_id))}</div></div>
        <div class="actions">${badge(s.status === 'scheduled' ? 'scheduled' : s.status)}<button class="btn sm" data-action="sess-open" data-id="${s.id}">${ic('users', 'sm')} Panel sesi</button>
          ${s.status !== 'cancelled' ? `<button class="btn sm" data-action="att-all" data-id="${s.id}">Semua hadir</button>` : ''}
          ${s.status === 'scheduled' ? `<button class="btn sm" data-action="sess-held" data-id="${s.id}">Tandakan selesai</button>` : ''}
          ${s.status !== 'cancelled' ? `<button class="btn sm" data-action="sess-cancel" data-id="${s.id}">Batal sesi</button>` : `<button class="btn sm" data-action="sess-reopen" data-id="${s.id}">Buka semula</button>`}
        </div>
      </div>
      ${s.status === 'cancelled' ? `<div class="empty" style="padding:18px">Sesi dibatalkan${s.cancel_reason ? ': ' + esc(s.cancel_reason) : ''}.</div>` : `
      <div class="att-summary muted">${marked.length}/${roster.length} direkod${s.lesson_plan ? ' · <b style="color:var(--ink)">Pelan kelas:</b> ' + esc(s.lesson_plan) : ''}</div>
      <ul class="list">${roster.map(st => { const a = marked.find(x => x.student_id === st.id); return `<li class="list-item" style="padding:9px 20px">${avatar(st.full_name)}<div class="li-main"><div class="li-title">${esc(st.full_name)}${a?.status === 'booked' ? ' <span class="badge b-info">ditempah</span>' : ''}</div>${pkgChip(st.id, a)}${a?.parent_confirmed ? `<div class="li-sub" style="color:var(--ok)">${ic('tick', 'sm')} disahkan ibu bapa</div>` : ''}</div>
        <select class="att-select ${a ? 'a-' + a.status : ''}" data-on-change="att-set" data-key="${s.id}|${st.id}"><option value="">${a?.status === 'booked' ? 'ditempah — belum direkod' : '— belum direkod —'}</option>${ATT_OPTS.map(o => `<option value="${o}" ${a?.status === o ? 'selected' : ''}>${LABEL[o]}</option>`).join('')}</select></li>`; }).join('') || '<li class="empty">Tiada pelajar dalam kelas ini.</li>'}</ul>`}
    </div>`; }).join('') : `<div class="card empty mb">${weekdayClasses.length ? `Ada ${weekdayClasses.length} kelas dijadualkan pada hari ini tetapi sesi belum dijana.<br><button class="btn primary" style="margin-top:10px" data-action="sess-generate">Jana sesi bulan ini</button>` : 'Tiada kelas pada hari ini.'}</div>`}

  <div class="grid g-even">
    <div class="card card-pad"><h3 style="font-size:14.5px;margin-bottom:12px">Kehadiran Mengikut Program</h3>
      ${byProg.map(([p, v]) => `<div class="funnel-row"><span class="lbl">${esc(p.name)}</span><div class="track"><div class="fill" style="width:${v ?? 0}%;background:${progColor(p.id)}"></div></div><span class="v num">${v == null ? '—' : v + '%'}</span></div>`).join('')}</div>
    <div class="card"><div class="card-head"><h3>Pelajar Perlu Susulan</h3><span class="sub">Kehadiran &lt; 75%</span></div>
      <ul class="list">${low.map(({ s, r }) => `<li class="list-item">${avatar(s.full_name)}<div class="li-main"><div class="li-title">${esc(s.full_name)}</div><div class="li-sub">${esc(progName(s.programme_id))} · ${esc(s.guardian_name || '')}</div></div><b style="color:var(--bad)">${r}%</b>${s.guardian_phone ? `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${(s.guardian_phone || '').replace(/\D/g, '').replace(/^0/, '60')}">${ic('msg', 'sm')}</a>` : ''}</li>`).join('') || '<li class="empty">Semua pelajar melepasi 75%. 🎉</li>'}</ul></div>
  </div>`;
};

Object.assign(INPUTS, {
  'att-date': v => { if (v) { UI.attDate = v; app.render(); } },
  'att-set': async (v, el) => {
    const [sid, stid] = el.dataset.key.split('|');
    const rec = T('attendance').find(a => a.session_id === sid && a.student_id === stid);
    if (!v) { if (rec && rec.status !== 'booked') await remove('attendance', rec.id); }
    else if (rec) await update('attendance', rec.id, { status: v, marked_by: markedBy() });
    else await insert('attendance', { session_id: sid, student_id: stid, status: v, marked_by: markedBy() });
    app.render();
  },
});
const markedBy = () => (S.mode === 'demo' ? null : S.profile.id);

Object.assign(ACTIONS, {
  'att-day': n => { UI.attDate = addDays(UI.attDate || todayISO(), Number(n)); app.render(); },
  'att-today': () => { UI.attDate = todayISO(); app.render(); },
  'att-all': async sid => {
    const s = byId('class_sessions', sid);
    const ids = new Set([...enrolledIn(s.class_id).map(e => e.student_id), ...T('attendance').filter(a => a.session_id === sid && a.status === 'booked').map(a => a.student_id)]);
    for (const stid of ids) {
      const rec = T('attendance').find(a => a.session_id === sid && a.student_id === stid);
      if (!rec) await insert('attendance', { session_id: sid, student_id: stid, status: 'present', marked_by: markedBy() });
      else if (rec.status === 'booked') await update('attendance', rec.id, { status: 'present', marked_by: markedBy() });
    }
    toast('Semua pelajar yang belum direkod ditandakan hadir'); app.render();
  },
  'sess-held': async id => { await update('class_sessions', id, { status: 'held' }); toast('Sesi ditandakan selesai'); app.render(); },
  'sess-reopen': async id => { await update('class_sessions', id, { status: 'scheduled', cancel_reason: null }); app.render(); },
  'sess-cancel': id => openModal({
    title: 'Batalkan Sesi', submit: 'Batalkan Sesi',
    body: F('Sebab (cth. cuaca, gelanggang tidak tersedia)', 'reason', { full: true }),
    onSubmit: async d => { await update('class_sessions', id, { status: 'cancelled', cancel_reason: val(d.reason) }); toast('Sesi dibatalkan'); app.render(); },
  }),
  'sess-add': () => {
    const cls = T('classes').filter(c => c.active).sort((a, b) => a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time)));
    openModal({ title: 'Tambah Sesi', submit: 'Tambah', body: `<div class="form-grid">
      ${F('Kelas', 'class_id', { req: true, full: true, opts: [['', '— Pilih kelas —'], ...cls.map(c => [c.id, `${DAYS[c.weekday]} ${hm(c.start_time)} · ${progName(c.programme_id)} · ${venueName(c.venue_id)}`])] })}
      ${F('Tarikh', 'session_date', { type: 'date', value: todayISO(), req: true, full: true })}
    </div><p class="muted" style="margin-top:10px;font-size:12.5px">Untuk sesi tambahan atau ganti di luar jadual biasa. Tarikh boleh pada mana-mana hari.</p>`,
      onSubmit: async d => { if (T('class_sessions').some(s => s.class_id === d.class_id && s.session_date === d.session_date)) throw new Error('Sesi untuk kelas dan tarikh ini sudah wujud.'); await insert('class_sessions', { class_id: d.class_id, session_date: d.session_date, status: 'scheduled' }); toast('Sesi ditambah'); app.render(); } });
  },
  'sess-generate': () => openModal({
    title: 'Jana Sesi Bulanan', submit: 'Jana Sesi',
    body: `<p class="muted" style="margin-bottom:12px">Sesi bertarikh dijana daripada jadual mingguan untuk semua kelas aktif. Sesi sedia ada tidak diganti.</p>${F('Bulan', 'month', { type: 'month', value: todayISO().slice(0, 7), req: true })}`,
    onSubmit: async d => {
      const first = parseISO(d.month + '-01'), y = first.getFullYear(), m = first.getMonth();
      const have = new Set(T('class_sessions').map(s => s.class_id + '|' + s.session_date));
      const rows = [];
      for (let day = 1; day <= new Date(y, m + 1, 0).getDate(); day++) {
        const dt = new Date(y, m, day), date = iso(dt);
        for (const c of T('classes').filter(c => c.active && c.weekday === dt.getDay())) if (!have.has(c.id + '|' + date)) rows.push({ class_id: c.id, session_date: date, status: 'scheduled' });
      }
      if (rows.length) await insert('class_sessions', rows);
      toast(rows.length ? `${rows.length} sesi dijana untuk ${monthLabel(d.month + '-01')}` : 'Semua sesi bulan ini sudah wujud'); app.render();
    },
  }),
});
