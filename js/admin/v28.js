// v28: Laporan Bulanan Pemilik — pelajar, jualan, kewangan, operasi & coach, banding bulan lepas, tindakan dicadangkan, cetak / PDF.
import { VIEWS, ACTIONS } from '../registry.js';
import { S, rpc } from '../data.js';
import { esc, UI, app, pageHead, todayISO, RM } from '../ui.js';
import { T, byId } from './helpers.js';
import { openDoc } from '../docview.js';

const MON = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const mKey = d => d.slice(0, 7) + '-01';
const shift = (k, n) => { const d = new Date(k + 'T00:00:00'); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const label = k => { const d = new Date(k + 'T00:00:00'); return `${MON[d.getMonth()]} ${d.getFullYear()}`; };
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const CACHE = {};

async function load(k) {
  if (CACHE[k]) return CACHE[k];
  CACHE[k] = S.mode === 'supabase' ? await rpc('admin_monthly_report', { p_month: k }) : demoReport(k);
  return CACHE[k];
}

VIEWS.bulanan = () => {
  const k = UI.rpMonth ||= mKey(todayISO()), p = shift(k, -1);
  if (!CACHE[k] || !CACHE[p]) { Promise.all([load(k), load(p)]).then(() => app.render()).catch(e => { CACHE[k] = { error: e.message }; app.render(); }); }
  const head = pageHead('Laporan Bulanan', 'Gambaran pemilik: pelajar, jualan, kutipan, operasi dan prestasi coach — dibanding bulan lepas.',
    `<div class="actions"><button class="btn" data-action="rp-mon" data-id="-1">‹</button><b style="min-width:130px;text-align:center;align-self:center">${label(k)}</b><button class="btn" data-action="rp-mon" data-id="1" ${k >= mKey(todayISO()) ? 'disabled' : ''}>›</button>
     <button class="btn primary" data-action="rp-print">Cetak / PDF</button><button class="btn" data-action="rp-refresh">Muat semula</button></div>`);
  const R = CACHE[k], P = CACHE[p];
  if (!R || !P) return head + '<div class="card empty">Mengira laporan…</div>';
  if (R.error) return head + `<div class="card card-pad"><b>Laporan tidak dapat dijana.</b><p class="muted">${esc(R.error)} — pastikan fail SQL 31 sudah dijalankan.</p></div>`;
  return head + body(R, P, k, false);
};

function delta(a, b, money, invert) {
  if (b == null) return '';
  const d = Number(a || 0) - Number(b || 0); if (!d) return '<span class="rp-d">= bulan lepas</span>';
  const good = invert ? d < 0 : d > 0;
  return `<span class="rp-d ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${money ? RM(Math.abs(d)) : Math.abs(Math.round(d * 10) / 10)}</span>`;
}
const bars = (list, key, val, money) => { const mx = Math.max(1, ...list.map(x => Number(x[val]) || 0));
  return list.length ? `<div class="rp-bars">${list.map(x => `<div class="rp-bar"><span>${esc(x[key])}</span><i style="width:${Math.max(3, (Number(x[val]) || 0) / mx * 100)}%"></i><b>${money ? RM(x[val]) : x[val]}</b></div>`).join('')}</div>` : '<p class="muted">Tiada data.</p>'; };

function actions(R, P) {
  const s = R.students, f = R.funnel, m = R.money, o = R.ops, out = [];
  const churn = pct(s.left, s.active_start);
  if (churn >= 5) out.push(`Kadar berhenti ${churn}% (${s.left} pelajar). Hubungi ibu bapa pelajar yang berhenti untuk tahu sebabnya, dan semak coach/lokasi mereka.`);
  if (f.trials && pct(f.enrolled, f.trials) < 50) out.push(`Hanya ${pct(f.enrolled, f.trials)}% trial menjadi pelajar. Susuli semua trial dalam 24 jam dengan cadangan program & tawaran pakej.`);
  if (f.leads && f.trials < f.leads * 0.5) out.push(`${f.leads} leads tetapi hanya ${f.trials} trial dijalankan. Admin perlu membalas leads lebih cepat (sasaran: dalam 1 jam).`);
  if (m.outstanding > Math.max(1000, m.collected * 0.2)) out.push(`Tunggakan ${RM(m.outstanding)} (${m.outstanding_n} invois). Jalankan peringatan bayaran dan hubungi ibu bapa yang tertunggak lebih 30 hari (${RM(m.overdue30)}).`);
  if (o.unmarked) out.push(`${o.unmarked} sesi tanpa rekod kehadiran. Kehadiran mempengaruhi baki pakej dan invois — minta coach lengkapkan.`);
  if (o.pkg_expiring_next) out.push(`${o.pkg_expiring_next} pakej tamat bulan depan. Hantar invois pembaharuan awal untuk elak pelajar terputus.`);
  if (o.rating_n && o.rating_avg < 4.3) out.push(`Purata rating ibu bapa ${o.rating_avg}/5. Baca maklum balas rendah dan bincang dengan coach berkenaan.`);
  const late = (R.coaches || []).filter(c => c.checkins && c.late / c.checkins >= 0.2);
  if (late.length) out.push(`Coach kerap lewat (≥20% sesi): ${late.map(c => esc(c.name)).join(', ')}.`);
  if (P && m.collected < P.money.collected * 0.9) out.push(`Kutipan turun ${RM(P.money.collected - m.collected)} berbanding bulan lepas. Semak invois belum dibayar dan pakej yang belum diperbaharui.`);
  return out;
}

function body(R, P, k, print) {
  const s = R.students, f = R.funnel, m = R.money, o = R.ops, ps = P?.students, pf = P?.funnel, pm = P?.money, po = P?.ops;
  const churn = pct(s.left, s.active_start), pchurn = ps ? pct(ps.left, ps.active_start) : null;
  const attRate = pct(o.att_present, o.att_present + o.att_absent), pAtt = po ? pct(po.att_present, po.att_present + po.att_absent) : null;
  const conv = pct(f.enrolled, f.trials), pconv = pf ? pct(pf.enrolled, pf.trials) : null;
  const net = Number(m.collected) - Number(m.expenses) - Number(m.refunds || 0);
  const tiles = [
    ['Pelajar aktif (akhir bulan)', s.active_end, delta(s.active_end, ps?.active_end)], ['Pelajar baharu', s.new, delta(s.new, ps?.new)],
    ['Berhenti', `${s.left} <small>(${churn}%)</small>`, delta(churn, pchurn, false, true)], ['Kutipan', RM(m.collected), delta(m.collected, pm?.collected, true)],
    ['Tunggakan semasa', RM(m.outstanding), `<span class="rp-d">${m.outstanding_n} invois</span>`], ['Trial → daftar', `${conv}%`, delta(conv, pconv)],
    ['Kadar kehadiran', `${attRate}%`, delta(attRate, pAtt)], ['Rating ibu bapa', o.rating_n ? `${o.rating_avg}<small>/5</small>` : '—', `<span class="rp-d">${o.rating_n} maklum balas</span>`]];
  const acts = actions(R, P);
  return `<div class="rp ${print ? 'print' : ''}">
  <div class="rp-tiles">${tiles.map(([l, v, d]) => `<div class="rp-tile"><small>${l}</small><b>${v}</b>${d}</div>`).join('')}</div>
  ${acts.length ? `<div class="card card-pad rp-sec rp-act"><h3>Tindakan dicadangkan</h3><ol>${acts.map(a => `<li>${a}</li>`).join('')}</ol></div>` : `<div class="card card-pad rp-sec"><b>👍 Tiada isu besar bulan ini.</b></div>`}
  <div class="rp-grid">
    <div class="card card-pad rp-sec"><h3>Pelajar</h3>
      <table class="rp-t"><tr><td>Aktif awal bulan</td><td>${s.active_start}</td></tr><tr><td>+ Baharu</td><td>${s.new}</td></tr><tr><td>− Berhenti</td><td>${s.left}</td></tr><tr><td><b>Aktif akhir bulan</b></td><td><b>${s.active_end}</b></td></tr><tr><td>Digantung (semasa)</td><td>${s.paused}</td></tr></table>
      <h4>Mengikut lokasi kelas</h4>${bars(s.by_venue, 'venue', 'n')}<h4>Mengikut program</h4>${bars(s.by_programme, 'programme', 'n')}
      ${s.left_names?.length ? `<h4>Pelajar berhenti</h4><p class="muted" style="font-size:13px">${s.left_names.map(esc).join(', ')}</p>` : ''}</div>
    <div class="card card-pad rp-sec"><h3>Jualan (leads → pelajar)</h3>
      <div class="rp-funnel">${[['Pelawat laman web', f.web_views], ['Leads', f.leads], ['Trial dijalankan', f.trials], ['Mendaftar', f.enrolled]].map(([l, v], i, a) => `<div style="--w:${Math.max(18, a[0][1] ? v / Math.max(...a.map(x => x[1] || 0)) * 100 : 100)}%"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
      <p class="muted" style="font-size:12.5px;margin-top:6px">Trial tidak hadir: ${f.trials_noshow} · Leads dari laman web: ${f.leads_web}</p>
      <h4>Sumber leads</h4>${bars(f.by_source, 'source', 'n')}</div>
    <div class="card card-pad rp-sec"><h3>Kewangan</h3>
      <table class="rp-t"><tr><td>Kutipan (bayaran disahkan)</td><td>${RM(m.collected)}</td></tr><tr><td>Invois dikeluarkan</td><td>${RM(m.invoiced)}</td></tr><tr><td>− Perbelanjaan direkod</td><td>${RM(m.expenses)}</td></tr>${Number(m.refunds) ? `<tr><td>− Pulangan kejohanan</td><td>${RM(m.refunds)}</td></tr>` : ''}
        <tr><td><b>Baki bersih (sebelum gaji)</b></td><td><b>${RM(net)}</b></td></tr><tr><td>Tunggakan (semua)</td><td>${RM(m.outstanding)}</td></tr><tr><td>Tertunggak &gt; 30 hari</td><td style="color:var(--bad)">${RM(m.overdue30)}</td></tr></table>
      <h4>Kutipan mengikut lokasi</h4>${bars(m.by_venue, 'venue', 'amount', true)}<h4>Kaedah bayaran</h4>${bars(m.by_method, 'method', 'amount', true)}
      ${m.expenses_by?.length ? `<h4>Perbelanjaan</h4>${bars(m.expenses_by, 'category', 'amount', true)}` : ''}</div>
    <div class="card card-pad rp-sec"><h3>Operasi</h3>
      <table class="rp-t"><tr><td>Sesi dijalankan</td><td>${o.sessions}</td></tr><tr><td>Sesi dibatalkan</td><td>${o.cancelled}</td></tr><tr><td>Kehadiran (hadir / tidak hadir / cuti)</td><td>${o.att_present} / ${o.att_absent} / ${o.att_excused}</td></tr>
        <tr><td>Sesi tanpa rekod kehadiran</td><td style="${o.unmarked ? 'color:var(--bad)' : ''}">${o.unmarked}</td></tr><tr><td>Pakej tamat bulan depan</td><td>${o.pkg_expiring_next}</td></tr></table>
      ${o.low_ratings?.length ? `<h4>Maklum balas rendah (≤3★)</h4><ul class="rp-fb">${o.low_ratings.map(x => `<li><b>${'★'.repeat(x.rating)}</b> ${esc(x.coach || '')}${x.comment ? ` — “${esc(x.comment)}”` : ''}</li>`).join('')}</ul>` : ''}</div>
  </div>
  <div class="card card-pad rp-sec"><h3>Prestasi coach</h3><div class="table-wrap"><table><thead><tr><th>Coach</th><th>Sesi</th><th>Pelajar diajar</th><th>Check in</th><th>Lewat</th><th>Rating</th><th>Tolak / tiada respons</th><th>Minta ganti</th></tr></thead><tbody>
    ${(R.coaches || []).map(c => `<tr><td><b>${esc(c.name)}</b><div class="muted" style="font-size:11.5px">${esc(c.position || '')}</div></td><td>${c.sessions}</td><td>${c.students}</td><td>${c.checkins}${c.sessions ? ` <span class="muted">(${pct(c.checkins, c.sessions)}%)</span>` : ''}</td>
      <td style="${c.checkins && c.late / c.checkins >= 0.2 ? 'color:var(--bad);font-weight:700' : ''}">${c.late}</td><td>${c.rating ? `${c.rating} <span class="muted">(${c.rating_n})</span>` : '—'}</td><td>${c.rejected || 0}</td><td>${c.covers || 0}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Tiada data coach.</td></tr>'}</tbody></table></div>
    <p class="muted" style="font-size:12px;margin-top:8px">"Check in" dikira mulai bulan ciri check in digunakan. "Berhenti" dikira daripada tarikh status ditukar kepada Berhenti (direkod mulai SQL 31).</p></div>
  </div>`;
}

const PRINT_CSS = `body{font:13px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b1f4d;margin:0;background:#fff}.wrap{max-width:1000px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0}h3{font-size:15px;margin:0 0 8px}h4{font-size:12.5px;margin:12px 0 6px;color:#56657f}.muted{color:#56657f}
.card{border:1px solid #dfe6e3;border-radius:12px;padding:14px;margin-bottom:12px;break-inside:avoid}table{width:100%;border-collapse:collapse}td,th{padding:5px 6px;border-bottom:1px solid #eef1f0;text-align:left;font-size:12.5px}
.rp-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.rp-tile{border:1px solid #dfe6e3;border-radius:10px;padding:10px}.rp-tile small{display:block;color:#56657f;font-size:11px}.rp-tile b{font-size:20px;display:block}
.rp-d{font-size:11px;color:#56657f}.rp-d.up{color:#138a5a}.rp-d.down{color:#c2410c}.rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rp-bars{display:grid;gap:4px}.rp-bar{display:grid;grid-template-columns:130px 1fr 80px;gap:8px;align-items:center;font-size:12px}.rp-bar i{display:block;height:8px;background:#0e5a4a;border-radius:4px}.rp-bar b{text-align:right}
.rp-funnel div{width:var(--w);background:#e6f2ee;border-radius:6px;padding:5px 8px;margin-bottom:4px;display:flex;justify-content:space-between;font-size:12.5px}
.rp-t td:last-child{text-align:right}.rp-act{border-color:#f5d97a;background:#fffbea}.rp-act ol{margin:0;padding-left:18px}.rp-fb{padding-left:16px;margin:0}
@page{size:A4;margin:12mm}@media print{.wrap{padding:0}}`;

Object.assign(ACTIONS, {
  'rp-mon': n => { UI.rpMonth = shift(UI.rpMonth || mKey(todayISO()), Number(n)); app.render(); },
  'rp-refresh': () => { Object.keys(CACHE).forEach(k => delete CACHE[k]); app.render(); },
  'rp-print': () => { const k = UI.rpMonth, R = CACHE[k], P = CACHE[shift(k, -1)]; if (!R || R.error) return;
    const ac = (S.t.settings || []).find(x => x.key === 'academy')?.value?.name || 'Maxxima Badminton Academy';
    openDoc(`<!doctype html><html><head><meta charset="utf-8"><title>Laporan Bulanan ${label(k)}</title><style>${PRINT_CSS}</style></head><body><div class="wrap">
      <h1>Laporan Bulanan — ${label(k)}</h1><p class="muted">${esc(ac)} · dijana ${new Date().toLocaleString('ms-MY')}</p>${body(R, P, k, true)}</div></body></html>`, `laporan-${k.slice(0, 7)}.html`); },
});

/* ---------- Mod demo: anggaran ringkas daripada data tempatan ---------- */
function demoReport(k) {
  const m1 = k, m2 = shift(k, 1), inM = d => d && d >= m1 && d < m2, st = T('students');
  const pay = T('payments').filter(p => p.status === 'confirmed' && inM(p.paid_on)), att = T('attendance').filter(a => inM(a.session_date)), ses = T('class_sessions').filter(x => inM(x.session_date));
  const cnt = (arr, f) => { const o = {}; arr.forEach(x => { const kk = f(x); if (kk) o[kk] = (o[kk] || 0) + 1; }); return Object.entries(o).map(([a, n]) => ({ a, n })).sort((x, y) => y.n - x.n); };

  return {
    month: k,
    students: { active_start: st.filter(x => x.status !== 'pending' && (x.joined_on || '0') < m1).length, active_end: st.filter(x => x.status === 'active').length, active_now: st.filter(x => x.status === 'active').length, paused: st.filter(x => x.status === 'paused').length,
      new: st.filter(x => inM(x.joined_on)).length, left: st.filter(x => inM(x.left_on)).length, left_names: st.filter(x => inM(x.left_on)).map(x => x.full_name),
      by_venue: cnt(T('class_enrolments'), e => byId('venues', byId('classes', e.class_id)?.venue_id)?.name).map(x => ({ venue: x.a, n: x.n })), by_programme: cnt(T('class_enrolments'), e => byId('programmes', byId('classes', e.class_id)?.programme_id)?.name).map(x => ({ programme: x.a, n: x.n })) },
    funnel: { leads: T('leads').filter(l => inM((l.created_at || '').slice(0, 10))).length, leads_web: 0, by_source: cnt(T('leads').filter(l => inM((l.created_at || '').slice(0, 10))), l => l.source || '—').map(x => ({ source: x.a, n: x.n })),
      trials: T('trials').filter(x => x.status === 'done' && inM(x.trial_date)).length, trials_noshow: T('trials').filter(x => x.status === 'no_show' && inM(x.trial_date)).length, enrolled: st.filter(x => x.lead_id && inM(x.joined_on)).length, web_views: 0 },
    money: { collected: pay.reduce((n, p) => n + Number(p.amount), 0), collected_n: pay.length, by_method: cnt(pay, p => p.method || '—').map(x => ({ method: x.a, amount: pay.filter(p => (p.method || '—') === x.a).reduce((n, p) => n + Number(p.amount), 0) })),
      by_venue: [], invoiced: T('invoices').filter(i => i.status !== 'void' && inM(i.issued_on)).reduce((n, i) => n + Number(i.amount), 0),
      outstanding: T('invoices').filter(i => i.status === 'issued').reduce((n, i) => n + Number(i.amount), 0), outstanding_n: T('invoices').filter(i => i.status === 'issued').length,
      overdue30: T('invoices').filter(i => i.status === 'issued' && i.due_date && i.due_date < shift(m2, 0).slice(0, 10)).reduce((n, i) => n + Number(i.amount), 0) * 0.3,
      expenses: T('expenses').filter(e => inM(e.spent_on)).reduce((n, e) => n + Number(e.amount), 0), expenses_by: [], refunds: 0 },
    ops: { sessions: ses.filter(x => x.status !== 'cancelled').length, cancelled: ses.filter(x => x.status === 'cancelled').length, att_present: att.filter(a => ['present', 'late'].includes(a.status)).length,
      att_absent: att.filter(a => a.status === 'absent').length, att_excused: att.filter(a => ['excused', 'late_cancel'].includes(a.status)).length, unmarked: 0,
      pkg_expiring_next: T('student_packages').filter(p => p.status === 'active' && p.expires_on >= m2 && p.expires_on < shift(m2, 1)).length,
      rating_avg: (() => { const f = T('feedback').filter(x => inM((x.created_at || '').slice(0, 10))); return f.length ? Math.round(f.reduce((n, x) => n + x.rating, 0) / f.length * 100) / 100 : null; })(),
      rating_n: T('feedback').filter(x => inM((x.created_at || '').slice(0, 10))).length, low_ratings: [] },
    coaches: T('staff').filter(x => x.active).map(x => ({ name: x.full_name, position: x.position, sessions: ses.filter(s => (s.coach_id || byId('classes', s.class_id)?.coach_id) === x.id && s.status !== 'cancelled').length,
      checkins: T('coach_checkins').filter(c => c.staff_id === x.id && c.kind === 'in' && inM(c.session_date)).length, late: 0, rating: null, rating_n: 0, rejected: 0, covers: 0, students: 0 })).filter(c => c.sessions),
  };

}
