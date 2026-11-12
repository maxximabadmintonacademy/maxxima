// Kalendar Sesi: semua sesi bertarikh (kumpulan + personal) dengan tapisan tarikh, coach, lokasi, program.
// Klik sesi -> panel kehadiran (kategori umur, coach & court setiap kategori).
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, loadRange } from '../data.js';
import { ic, esc, F, val, UI, app, toast, openModal, pageHead, hm, todayISO, addDays, parseISO, iso, fmtDate, fmtShort, DAYS, MONTHS } from '../ui.js';
import { T, byId, venueName, progName, staffName, studentName, progColor, livePackages } from './helpers.js';
import { courtLbl, calItems, sessionAlerts, sTime, sCoach, sCourt, isPersonal, groupsOf, rosterOf, langWarn, ensureSession } from './sessions.js';

const mondayOf = d => { const x = parseISO(d), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return iso(x); };
const C = () => (UI.cal ||= { mode: 'minggu', date: todayISO(), venue: '', coach: '', prog: '', type: '', alert: false });

export function calRange(c = C()) {
  if (c.mode === 'hari') return [c.date, c.date];
  if (c.mode === 'minggu') { const a = mondayOf(c.date); return [a, addDays(a, 6)]; }
  const d = parseISO(c.date), a = iso(new Date(d.getFullYear(), d.getMonth(), 1)), b = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return [mondayOf(a), addDays(mondayOf(b), 6)];
}

const slot = ({ s, c, date }, showDate) => {
  const [a, b] = sTime(s, c), al = sessionAlerts(s, c), n = s ? rosterOf(s, c).length : T('class_enrolments').filter(e => e.class_id === c.id).length;
  const gs = s ? groupsOf(s.id) : [], coaches = [...new Set([sCoach(s, c), ...gs.map(g => g.coach_id)].filter(Boolean))].map(staffName).join(', ');
  const personal = isPersonal(c), who = personal ? rosterOf(s, c).map(x => x.full_name.split(' ').slice(0, 2).join(' ')).join(', ') : '';
  return `<button class="slot ${al.length ? 'alert' : ''} ${s ? '' : 'virtual'} ${s?.status === 'cancelled' ? 'cancel' : ''}" data-action="${s ? 'sess-open' : 'sess-open-v'}" data-id="${s ? s.id : c.id + '|' + date}" style="border-left-color:${progColor(c.programme_id)}">
    <b>${showDate ? fmtShort(date) + ' · ' : ''}${a}–${b} · ${esc(progName(c.programme_id))}</b>
    ${who ? `<div style="font-weight:600">${esc(who)}</div>` : ''}
    <div class="meta">${esc(venueName(c.venue_id))}${sCourt(s, c) ? ' · ' + courtLbl(sCourt(s, c)) : ''}</div>
    <div class="meta">${esc(coaches || '—')} · ${n} pelajar${(c.categories || []).length ? ' · ' + c.categories.map(esc).join('/') : ''}</div>
    ${al.length ? `<div class="warnline">${ic('alert', 'sm')} ${al.map(esc).join(' · ')}</div>` : ''}
  </button>`;
};

VIEWS.kalendar = () => {
  const c = C(), [from, to] = calRange(c), today = todayISO();
  if (S.mode === 'supabase' && !C().loading) { C().loading = true; loadRange(from, to).then(ch => { C().loading = false; if (ch) app.render(); }).catch(e => { C().loading = false; console.warn(e); }); }
  const f = { venue: c.venue, coach: c.coach, prog: c.prog, type: c.type, alert: c.alert };
  const items = calItems(from, to, f), alerts = items.filter(x => x.date >= today && sessionAlerts(x.s, x.c).length).length;
  const title = c.mode === 'hari' ? `${DAYS[parseISO(c.date).getDay()]}, ${fmtDate(c.date)}` : c.mode === 'minggu' ? `${fmtShort(from)} – ${fmtShort(to)}` : `${MONTHS[parseISO(c.date).getMonth()]} ${parseISO(c.date).getFullYear()}`;
  const opt = (list, v, all) => `<option value="">${all}</option>` + list.map(([id, n]) => `<option value="${id}" ${v === id ? 'selected' : ''}>${esc(n)}</option>`).join('');
  let grid;
  if (c.mode === 'bulan') {
    const m = parseISO(c.date).getMonth(), days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    grid = `<div class="mgrid">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="mh">${DAYS[d].slice(0, 3)}</div>`).join('')}${days.map(d => {
      const its = items.filter(x => x.date === d), bad = its.filter(x => d >= today && sessionAlerts(x.s, x.c).length).length;
      return `<button class="mcell ${parseISO(d).getMonth() !== m ? 'out' : ''} ${d === today ? 'today' : ''}" data-action="cal-day" data-id="${d}"><b>${parseISO(d).getDate()}</b>
        <span class="lbl muted">${its.length ? its.length + ' sesi' : ''}</span><span class="dots">${its.slice(0, 12).map(x => `<i style="background:${progColor(x.c.programme_id)}"></i>`).join('')}</span>${bad ? `<span class="bad">${ic('alert', 'sm')}${bad}</span>` : ''}</button>`;
    }).join('')}</div>`;
  } else if (c.mode === 'minggu') {
    grid = `<div class="week">${Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(d => { const its = items.filter(x => x.date === d); return `<div class="day-col ${d === today ? 'today' : ''}">
      <div class="day-head"><b>${DAYS[parseISO(d).getDay()]} ${parseISO(d).getDate()}</b><span class="muted" style="font-size:11.5px">${its.length} sesi</span></div>
      <div class="day-body">${its.map(x => slot(x)).join('') || '<div class="muted" style="font-size:12px;padding:6px">—</div>'}</div></div>`; }).join('')}</div>`;
  } else {
    grid = `<div class="daylist">${items.map(x => slot(x)).join('') || '<div class="card empty">Tiada sesi pada tarikh ini.</div>'}</div>`;
  }
  return `
  ${pageHead('Kalendar Sesi', `${items.length} sesi dalam julat ini${alerts ? ` · <b style="color:var(--bad)">${alerts} sesi belum lengkap (coach/court)</b>` : ''}`,
    `<button class="btn" data-action="cal-personal">${ic('plus', 'sm')} Sesi Personal</button><button class="btn" data-action="sess-add">${ic('plus', 'sm')} Sesi Kumpulan</button><button class="btn primary" data-action="sess-generate">${ic('calendar', 'sm')} Jana Sesi Bulanan</button>`)}
  <div class="card card-pad mb"><div class="filters">
    <div class="seg">${[['hari', 'Hari'], ['minggu', 'Minggu'], ['bulan', 'Bulan']].map(([k, l]) => `<button class="${c.mode === k ? 'on' : ''}" data-action="cal-mode" data-id="${k}">${l}</button>`).join('')}</div>
    <button class="btn sm" data-action="cal-move" data-id="-1">${ic('back', 'sm')}</button>
    <input type="date" class="date-input" value="${c.date}" data-on-change="cal-date">
    <button class="btn sm" data-action="cal-move" data-id="1">${ic('arrow', 'sm')}</button>
    <button class="btn sm" data-action="cal-today">Hari ini</button>
    <b style="margin-left:4px">${esc(title)}</b>
  </div><div class="filters" style="margin-top:10px">
    <label class="field">${ic('pin', 'sm')}<select data-on-change="cal-f" data-key="venue">${opt(T('venues').filter(v => v.active).map(v => [v.id, v.name]), c.venue, 'Semua lokasi')}</select></label>
    <label class="field">${ic('award', 'sm')}<select data-on-change="cal-f" data-key="coach">${opt(T('staff').filter(x => x.active !== false).map(x => [x.id, x.full_name]), c.coach, 'Semua coach')}</select></label>
    <label class="field"><select data-on-change="cal-f" data-key="prog">${opt(T('programmes').filter(p => p.active).map(p => [p.id, p.name]), c.prog, 'Semua program')}</select></label>
    <label class="field"><select data-on-change="cal-f" data-key="type">${opt([['group', 'Kumpulan'], ['personal', 'Personal']], c.type, 'Kumpulan + Personal')}</select></label>
    <button class="chip ${c.alert ? 'on' : ''}" style="cursor:pointer" data-action="cal-alert">${ic('alert', 'sm')} Belum lengkap sahaja</button>
  </div><div class="muted" style="font-size:12px;margin-top:8px">Garis putus-putus = sesi daripada jadual mingguan yang belum dijana (klik untuk buka & tanda kehadiran). Bingkai merah = coach/court belum ditetapkan.</div></div>
  ${grid}`;
};

Object.assign(INPUTS, {
  'cal-date': v => { if (v) { C().date = v; app.render(); } },
  'cal-f': (v, el) => { C()[el.dataset.key] = v; app.render(); },
});
Object.assign(ACTIONS, {
  'cal-mode': m => { C().mode = m; app.render(); },
  'cal-today': () => { C().date = todayISO(); app.render(); },
  'cal-day': d => { Object.assign(C(), { date: d, mode: 'hari' }); app.render(); },
  'cal-alert': () => { C().alert = !C().alert; app.render(); },
  'cal-move': n => { const c = C(); n = Number(n); if (c.mode === 'hari') c.date = addDays(c.date, n); else if (c.mode === 'minggu') c.date = addDays(c.date, 7 * n); else { const d = parseISO(c.date); c.date = iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); } app.render(); },

  /* Sesi personal bertarikh: satu atau beberapa tarikh (ulang mingguan + tarikh tambahan). */
  'cal-personal': (preset = {}) => {
    preset = typeof preset === 'object' && preset ? preset : {};
    const progs = T('programmes').filter(p => p.active && p.kind === 'personal');
    const f = openModal({ title: 'Tambah Sesi Personal', submit: 'Simpan Sesi', wide: true, body: `<div class="form-grid">
      <label class="f full">Pelajar (boleh pilih lebih seorang untuk small group)<select name="students" multiple size="6" required>${T('students').filter(s => s.status === 'active').sort((a, b) => a.full_name.localeCompare(b.full_name)).map(s => `<option value="${s.id}" ${(preset.students || []).includes(s.id) ? 'selected' : ''}>${esc(s.full_name)}</option>`).join('')}</select></label>
      ${F('Program', 'programme_id', { req: true, value: preset.programme_id || progs[0]?.id, opts: progs.map(p => [p.id, p.name]) })}
      ${F('Coach', 'coach_id', { req: true, value: preset.coach_id, opts: [['', '— Pilih —'], ...T('staff').filter(x => x.active !== false).map(x => [x.id, x.full_name])] })}
      ${F('Lokasi', 'venue_id', { req: true, value: preset.venue_id, opts: [['', '— Pilih —'], ...T('venues').filter(v => v.active).map(v => [v.id, v.name])] })}
      ${F('Court no.', 'court', { ph: 'cth. 5' })}
      ${F('Tarikh pertama', 'date', { type: 'date', value: preset.date || todayISO(), req: true })}
      ${F('Ulang setiap minggu (bil. sesi)', 'repeat', { type: 'number', value: 1, min: 1, max: 26 })}
      ${F('Mula', 'start_time', { type: 'time', value: preset.start || '18:00', req: true })}
      ${F('Tamat', 'end_time', { type: 'time', value: preset.end || '19:00', req: true })}
      ${F('Tarikh tambahan (pilihan, pisahkan dengan koma: 2026-12-03, 2026-12-10)', 'extra', { full: true })}
      ${F('Cara bil', 'billing', { value: 'auto', opts: [['auto', 'Automatik: pakej jika ada, jika tiada bil bulanan'], ['monthly', 'Bil bulanan ikut sesi'], ['walkin', 'Walk-in (bayar setiap sesi)'], ['package', 'Pakej']] })}
      ${F('Kadar coach / jam (RM, untuk bil bulanan)', 'rate_coach', { type: 'number', step: '0.01', min: 0 })}
      ${F('Kadar court / jam (RM)', 'rate_court', { type: 'number', step: '0.01', min: 0 })}
    </div><div id="cpWarn"></div>`, onSubmit: async d => {
      const ids = Array.isArray(d.students) ? d.students : [d.students].filter(Boolean);
      if (!ids.length) throw new Error('Pilih sekurang-kurangnya seorang pelajar.');
      if (d.end_time <= d.start_time) throw new Error('Masa tamat mesti selepas masa mula.');
      const dates = new Set(); for (let i = 0; i < Math.max(1, Number(d.repeat) || 1); i++) dates.add(addDays(d.date, 7 * i));
      String(d.extra || '').split(/[,\s]+/).map(x => x.trim()).filter(x => /^\d{4}-\d\d-\d\d$/.test(x)).forEach(x => dates.add(x));
      const billing = d.billing === 'auto' ? (ids.every(id => livePackages(id).some(p => byId('programmes', p.programme_id)?.kind === 'personal')) ? 'package' : 'monthly') : d.billing;
      const wd = parseISO(d.date).getDay();
      let cls = T('classes').find(c => !c.active && c.venue_id === d.venue_id && c.programme_id === d.programme_id && c.coach_id === d.coach_id && c.weekday === wd && hm(c.start_time) === d.start_time && hm(c.end_time) === d.end_time
        && T('class_enrolments').filter(e => e.class_id === c.id).map(e => e.student_id).sort().join() === [...ids].sort().join());
      if (!cls) {
        cls = await insert('classes', { venue_id: d.venue_id, programme_id: d.programme_id, coach_id: d.coach_id, weekday: wd, start_time: d.start_time, end_time: d.end_time, court: val(d.court), capacity: Math.max(ids.length, 1), active: false, billing, rate_coach: val(d.rate_coach), rate_court: val(d.rate_court) });
        await insert('class_enrolments', ids.map(id => ({ class_id: cls.id, student_id: id })));
      }
      let n = 0;
      for (const date of [...dates].sort()) {
        const ex = T('class_sessions').find(s => s.class_id === cls.id && s.session_date === date);
        const s = ex || await insert('class_sessions', { class_id: cls.id, session_date: date, status: date < todayISO() ? 'held' : 'scheduled', coach_id: d.coach_id, court: val(d.court), start_time: d.start_time, end_time: d.end_time });
        for (const id of ids) if (!T('attendance').some(a => a.session_id === s.id && a.student_id === id)) await insert('attendance', { session_id: s.id, student_id: id, status: 'booked' });
        n++;
      }
      toast(`${n} sesi personal disimpan untuk ${ids.map(studentName).join(', ')}`);
      if (preset.onDone) await preset.onDone(cls);
      app.render();
    } });
    const chk = () => { f.querySelector('#cpWarn').innerHTML = f.coach_id.value && f.venue_id.value ? langWarn(f.coach_id.value, f.venue_id.value) : ''; };
    f.coach_id.addEventListener('change', chk); f.venue_id.addEventListener('change', chk);
  },
});
export { ensureSession };
