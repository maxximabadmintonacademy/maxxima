import { VIEWS, ACTIONS } from '../registry.js';
import { ic, esc, RM, sum, badge, avatar, DAYS, MONTHS, hm, todayISO, addDays, monthKey, monthLabel, fmtShort, pageHead } from '../ui.js';
import { creditOf, T, byId, venueName, progName, staffName, invStatus, tasks, studentName, progColor, enrolledIn, lowPackages, pkgRemaining, expiringPackages, pendingPayments } from './helpers.js';

VIEWS.dashboard = () => {
  const now = new Date(), h = now.getHours(), today = todayISO(), mk = monthKey(today);
  const greet = h < 12 ? 'Selamat pagi' : h < 14 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam';

  const students = T('students');
  const active = students.filter(s => s.status === 'active');
  const joinedThisMonth = active.filter(s => (s.joined_on || '').startsWith(today.slice(0, 7))).length;
  const inPipeline = students.filter(s => ['pending', 'awaiting_payment'].includes(s.status)).length;
  const upcomingTrials = T('trials').filter(t => t.status === 'scheduled' && t.trial_date >= today && t.trial_date <= addDays(today, 7)).length;

  const invs = T('invoices').filter(i => i.status !== 'void');
  const monthInv = invs.filter(i => monthKey(i.issued_on) === mk);
  const total = sum(monthInv, i => i.amount), paid = sum(monthInv.filter(i => i.status === 'paid'), i => i.amount);
  const pct = total ? Math.round(paid / total * 100) : 0;
  const outstanding = invs.filter(i => i.status === 'issued');
  const overdue = outstanding.filter(i => invStatus(i) === 'overdue');

  // Kelas hari ini
  const sessions = T('class_sessions').filter(s => s.session_date === today);
  const todayClasses = sessions.length
    ? sessions.map(s => ({ c: byId('classes', s.class_id), s })).filter(x => x.c)
    : T('classes').filter(c => c.active && c.weekday === now.getDay()).map(c => ({ c, s: null }));
  todayClasses.sort((a, b) => a.c.start_time.localeCompare(b.c.start_time));

  // Corong leads
  const order = ['new', 'contacted', 'trial_scheduled', 'trial_done', 'requested', 'enrolled'];
  const leads = T('leads').filter(l => l.status !== 'lost');
  const reach = i => leads.filter(l => order.indexOf(l.status) >= i).length;
  const funnel = [['Leads', leads.length], ['Dihubungi', reach(1)], ['Trial', reach(2)], ['Mohon daftar', reach(4)]];
  const fmax = funnel[0][1] || 1;

  const tourn = T('tournaments').filter(t => ['open', 'closed', 'ongoing'].includes(t.status)).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '')).slice(0, 3);
  const todo = tasks();

  return `
  ${pageHead(`${greet}, Admin 👋`, `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()} · Ringkasan operasi akademi`,
    `<button class="btn" data-action="lead-add">${ic('plus', 'sm')} Lead Baharu</button><a class="btn primary" href="#kemasukan">${ic('userplus', 'sm')} Pendaftaran</a>`)}

  <div class="grid kpis">
    <a href="#pelajar" class="card kpi hero">
      <div class="kpi-top"><span class="kpi-label">Pelajar Aktif</span><span class="kpi-ico">${ic('users')}</span></div>
      <div class="kpi-val">${active.length}</div>
      <div class="kpi-foot"><b>+${joinedThisMonth}</b> baharu bulan ini</div>
    </a>
    <a href="#kemasukan" class="card kpi">
      <div class="kpi-top"><span class="kpi-label">Dalam Proses Daftar</span><span class="kpi-ico t-warn">${ic('userplus')}</span></div>
      <div class="kpi-val">${inPipeline}</div>
      <div class="kpi-foot">menunggu semakan / bayaran</div>
    </a>
    <a href="#trial" class="card kpi">
      <div class="kpi-top"><span class="kpi-label">Trial 7 Hari Akan Datang</span><span class="kpi-ico t-purple">${ic('flag')}</span></div>
      <div class="kpi-val">${upcomingTrials}</div>
      <div class="kpi-foot"><b>${T('leads').filter(l => l.status === 'new').length}</b> lead baharu belum dihubungi</div>
    </a>
    <a href="#yuran" class="card kpi">
      <div class="kpi-top"><span class="kpi-label">Yuran Tertunggak</span><span class="kpi-ico t-bad">${ic('alert')}</span></div>
      <div class="kpi-val">${RM(sum(outstanding, i => Number(i.amount) - creditOf(i)))}</div>
      <div class="kpi-foot"><b>${outstanding.length}</b> invois · <b style="color:var(--bad)">${overdue.length}</b> lewat${pendingPayments().length ? ` · <b style="color:var(--warn)">${pendingPayments().length}</b> menunggu sahkan` : ''}</div>
    </a>
  </div>

  <div class="grid g-2 mb">
    <div class="card">
      <div class="card-head"><div><h3>Kelas Hari Ini</h3><div class="sub">${todayClasses.length} sesi${sessions.length ? '' : ' (mengikut jadual mingguan — sesi belum dijana)'}</div></div><a href="#jadual" class="btn sm ghost">Jadual penuh ${ic('arrow', 'sm')}</a></div>
      ${todayClasses.length ? `<ul class="list">${todayClasses.map(({ c, s }) => {
        const n = enrolledIn(c.id).length, coach = staffName(s?.coach_id || c.coach_id);
        return `<li class="list-item">
          <div class="time-pill">${hm(c.start_time)}<small>${hm(c.end_time)}</small></div>
          <span class="lv-stripe" style="background:${progColor(c.programme_id)}"></span>
          <div class="li-main"><div class="li-title">${esc(progName(c.programme_id))}</div><div class="li-sub">${esc(coach)} · ${esc(venueName(c.venue_id))}${c.court ? ' · ' + esc(c.court) : ''}</div></div>
          <div style="width:96px"><div class="li-sub" style="text-align:right;margin-bottom:4px"><b style="color:var(--ink)">${n}</b>/${c.capacity}</div><div class="bar"><span style="width:${Math.min(100, Math.round(n / c.capacity * 100))}%;background:${n >= c.capacity ? 'var(--warn)' : 'var(--brand)'}"></span></div></div>
          ${s && s.status !== 'scheduled' ? badge(s.status) : ''}
        </li>`; }).join('')}</ul>` : `<div class="empty">Tiada kelas hari ini.</div>`}
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div><h3 style="font-size:14.5px">Kutipan Yuran</h3><div class="muted" style="font-size:12px">${monthLabel(mk)}</div></div>
        <a href="#yuran" class="btn sm">Urus yuran</a>
      </div>
      ${total ? `<div class="meter-big">${pct}%</div>
      <div class="bar lg" style="margin-top:8px"><span style="width:${pct}%;background:var(--ok)"></span></div>
      <div class="split">
        <div><small>Dikutip</small><b>${RM(paid)}</b></div>
        <div><small>Baki</small><b style="color:var(--bad)">${RM(total - paid)}</b></div>
        <div><small>Jumlah</small><b>${RM(total)}</b></div>
      </div>` : `<div class="empty" style="padding:22px 0">Belum ada invois bulan ini.<br><a class="btn sm primary" style="margin-top:10px" href="#yuran">Jual pakej</a></div>`}
      ${overdue.length ? `<div style="margin-top:16px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Lewat dibayar</div>
      <ul class="list" style="margin:4px -20px -18px">${overdue.slice(0, 3).map(i => `<li class="list-item" style="padding:10px 20px">${avatar(studentName(i.student_id))}<div class="li-main"><div class="li-title">${esc(studentName(i.student_id))}</div><div class="li-sub">${RM(i.amount)} · ${esc(i.number)}</div></div><button class="btn sm" data-action="inv-remind" data-id="${i.id}" title="Peringatan WhatsApp">${ic('msg', 'sm')}</button></li>`).join('')}</ul>` : ''}
    </div>
  </div>

  ${lowPackages().length ? `<div class="card mb"><div class="card-head"><div><h3>Pakej Hampir Habis</h3><div class="sub">Invois pembaharuan dijana automatik apabila baki tinggal 1 sesi</div></div><a href="#pakej" class="btn sm ghost">Semua ${ic('arrow', 'sm')}</a></div>
    <ul class="list">${lowPackages().slice(0, 5).map(p => `<li class="list-item">${avatar(studentName(p.student_id))}<div class="li-main"><div class="li-title">${esc(studentName(p.student_id))}</div><div class="li-sub">${esc(p.name)} · tamat ${fmtShort(p.expires_on)}</div></div><b style="color:var(--bad)">${pkgRemaining(p)} sesi</b></li>`).join('')}</ul></div>` : ''}
  <div class="grid g-3 mb">
    <div class="card">
      <div class="card-head"><h3>Perlu Tindakan</h3><span class="sub">${todo.length ? todo.length + ' item' : 'Selesai'}</span></div>
      ${todo.length ? `<ul class="list">${todo.map(t => `<li class="list-item"><div class="kpi-ico ${t.tone}" style="width:32px;height:32px;display:grid">${ic(t.icon, 'sm')}</div><div class="li-main" style="font-size:13px">${esc(t.text)}</div><a class="btn sm ghost" href="#${t.href}">${ic('arrow', 'sm')}</a></li>`).join('')}</ul>` : `<div class="empty">Semua beres. 🎉</div>`}
    </div>
    <div class="card card-pad">
      <h3 style="font-size:14.5px;margin-bottom:4px">Corong Pendaftaran</h3>
      <div class="muted" style="font-size:12px;margin-bottom:10px">Leads → Trial → Permohonan daftar</div>
      ${funnel.map(([l, v]) => `<div class="funnel-row"><span class="lbl">${l}</span><div class="track"><div class="fill" style="width:${Math.max(4, v / fmax * 100)}%"></div></div><span class="v num">${v}</span></div>`).join('')}
      <div class="muted" style="font-size:12px;margin-top:8px">Kadar penukaran: <b style="color:var(--ink)">${Math.round(funnel[3][1] / fmax * 100)}%</b></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Kejohanan</h3><a href="#kejohanan" class="btn sm ghost">Semua ${ic('arrow', 'sm')}</a></div>
      ${tourn.length ? `<ul class="list">${tourn.map(t => `<li class="list-item"><div class="kpi-ico t-purple" style="width:32px;height:32px;display:grid">${ic('trophy', 'sm')}</div><div class="li-main"><a href="#kejohanan/${t.id}" class="li-title" style="display:block">${esc(t.name)}</a><div class="li-sub">${fmtShort(t.start_date)} · ${venueName(t.venue_id)}</div></div>${badge(t.status)}</li>`).join('')}</ul>` : `<div class="empty">Tiada kejohanan aktif.<br><a class="btn sm" style="margin-top:10px" href="#kejohanan">Cipta kejohanan</a></div>`}
    </div>
  </div>`;
};
