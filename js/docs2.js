// v21: Sijil penyertaan kejohanan & Laporan progres bulanan (dokumen boleh cetak / simpan PDF).
import { LOGO_DATA } from './logo-data.js';
import { S } from './data.js';
import { getLang } from './i18n.js';
import { esc, fmtDate, todayISO, DAYS, hm, LABEL } from './ui.js';
import { T, byId, progName, venueName, staffName } from './admin/helpers.js';

function openDoc(html, filename) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) { const el = document.createElement('a'); el.href = url; el.download = filename; el.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const academyName = () => (S.t.settings || []).find(s => s.key === 'academy')?.value?.name || 'Maxxima Badminton Academy';

/* ---------------- SIJIL ---------------- */
export const entryName = e => e ? (e.player_name || byId('students', e.student_id)?.full_name || '') + (e.partner_id ? ' / ' + (byId('students', e.partner_id)?.full_name || '') : '') : '';
/** Kedudukan peserta dalam kategori: 1 = juara, 2 = naib, 3 = separuh akhir. */
export function placements(catId) {
  const M = T('tournament_matches').filter(m => m.category_id === catId), out = {};
  let fin = M.find(m => m.stage === 'final' && m.winner);
  if (!fin) { const ko = M.filter(m => !m.stage || m.stage === 'ko'); const maxR = Math.max(0, ...ko.map(m => m.round_no)); const last = ko.filter(m => m.round_no === maxR); if (last.length === 1 && last[0].winner) fin = last[0];
    if (fin) ko.filter(m => m.round_no === maxR - 1 && m.winner).forEach(m => { const l = m.winner === m.entry_a ? m.entry_b : m.entry_a; if (l) out[l] = 3; }); }
  else M.filter(m => m.stage === 'semi' && m.winner).forEach(m => { const l = m.winner === m.entry_a ? m.entry_b : m.entry_a; if (l) out[l] = 3; });
  if (fin) { out[fin.winner] = 1; const l = fin.winner === fin.entry_a ? fin.entry_b : fin.entry_a; if (l) out[l] = 2; }
  return out;
}
const PLACE = { 1: 'JUARA', 2: 'NAIB JUARA', 3: 'TEMPAT KETIGA' };
export function openCertificates(entries, tn) {
  const dates = tn.start_date ? fmtDate(tn.start_date) + (tn.end_date && tn.end_date !== tn.start_date ? ' – ' + fmtDate(tn.end_date) : '') : fmtDate(todayISO());
  const place = {}; [...new Set(entries.map(e => e.category_id))].forEach(cid => Object.assign(place, placements(cid)));
  const pages = entries.map(e => { const cat = byId('tournament_categories', e.category_id), p = place[e.id];
    return `<section class="cert ${p ? 'win' : ''}"><div class="in">
      <img src="${LOGO_DATA}" class="logo" alt="">
      <div class="kicker">${p ? 'SIJIL PENCAPAIAN' : 'SIJIL PENYERTAAN'}</div>
      <div class="title">${p ? 'Certificate of Achievement' : 'Certificate of Participation'}</div>
      <div class="pre">Dengan ini disahkan bahawa</div>
      <div class="name">${esc(entryName(e))}</div>
      <div class="pre">${p ? `telah meraih <b>${PLACE[p]}</b> dalam kategori` : 'telah menyertai kategori'} <b>${esc(cat?.name || '')}</b></div>
      <div class="event">${esc(tn.name)}</div>
      <div class="pre">${esc(dates)}${tn.venue_id ? ' · ' + esc(venueName(tn.venue_id)) : tn.venue_note ? ' · ' + esc(tn.venue_note) : ''}</div>
      <div class="sign"><div><span></span>Ketua Jurulatih</div><div><span></span>Pengarah Kejohanan</div></div>
      <div class="foot">${esc(academyName())}${e.ref_code ? ' · ' + esc(e.ref_code) : ''}</div></div></section>`; }).join('');
  openDoc(`<!doctype html><html><head><meta charset="utf-8"><title>Sijil — ${esc(tn.name)}</title><style>
  @page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Georgia,'Times New Roman',serif;background:#ddd;color:#1b1b2f}
  .bar{position:sticky;top:0;background:#1b1b2f;color:#fff;padding:10px 16px;font:14px system-ui;display:flex;gap:12px;align-items:center}.bar button{font:inherit;padding:6px 14px;border-radius:8px;border:0;background:#C6F432;cursor:pointer}
  .cert{width:297mm;height:210mm;margin:10px auto;background:#fff;padding:12mm;page-break-after:always;position:relative}
  .in{height:100%;border:3px solid #1b1b2f;outline:1px solid #C6A84A;outline-offset:-9px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10mm 18mm}
  .win .in{border-color:#a8841c}.logo{width:70px;height:70px;object-fit:contain;margin-bottom:6px}
  .kicker{letter-spacing:.35em;font:700 13px system-ui;color:#6b6b80}.title{font-size:34px;margin:4px 0 14px;font-style:italic}
  .pre{font-size:17px;margin:6px 0;color:#333}.name{font-size:40px;font-weight:700;margin:6px 0 4px;border-bottom:2px solid #C6A84A;padding:0 24px 4px}
  .event{font-size:24px;font-weight:700;margin:10px 0 2px}.sign{display:flex;gap:80px;margin-top:26px;font:13px system-ui;color:#555}.sign span{display:block;width:180px;border-bottom:1px solid #333;height:34px;margin-bottom:6px}
  .foot{position:absolute;bottom:20mm;font:11px system-ui;color:#888}
  @media print{body{background:#fff}.bar{display:none}.cert{margin:0}}</style></head><body>
  <div class="bar"><b>${entries.length} sijil</b><button onclick="print()">Cetak / Simpan PDF</button><span style="opacity:.7">Pilih "Save as PDF" dan orientasi Landscape.</span></div>${pages}</body></html>`, 'sijil.html');
}

/* ---------------- LAPORAN PROGRES BULANAN ---------------- */
const SK = [['footwork', 'Gerak kaki'], ['strokes', 'Pukulan'], ['tactics', 'Taktikal'], ['fitness', 'Fizikal'], ['attitude', 'Sikap']];
export function monthlyData(studentId, M) {
  const [y, m] = M.split('-').map(Number), from = M + '-01', to = `${M}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const att = T('attendance').filter(a => a.student_id === studentId && (a.session_date || byId('class_sessions', a.session_id)?.session_date || '') >= from && (a.session_date || byId('class_sessions', a.session_id)?.session_date || '') <= to)
    .map(a => { const s = byId('class_sessions', a.session_id), c = s && byId('classes', s.class_id); return { a, s, c, date: a.session_date || s?.session_date, plan: T('lesson_plans').find(p => p.session_id === a.session_id) }; })
    .sort((x, y2) => (x.date || '').localeCompare(y2.date || ''));
  const cnt = k => att.filter(x => x.a.status === k).length;
  const recs = T('progress_records').filter(r => r.student_id === studentId && (r.recorded_on || '') >= from && (r.recorded_on || '') <= to).sort((a, b) => (a.recorded_on || '').localeCompare(b.recorded_on || ''));
  const prev = T('progress_records').filter(r => r.student_id === studentId && (r.recorded_on || '') < from).sort((a, b) => (b.recorded_on || '').localeCompare(a.recorded_on || ''))[0];
  return { from, to, att, recs, prev, present: cnt('present') + cnt('late'), late: cnt('late'), absent: cnt('absent'), excused: cnt('excused'), lateCancel: cnt('late_cancel'), booked: cnt('booked') };
}
export function openMonthlyReport(studentId, M, tt = x => x) {
  const st = byId('students', studentId), D = monthlyData(studentId, M), last = D.recs[D.recs.length - 1];
  const mLbl = new Date(M + '-01T00:00:00').toLocaleDateString({ ms: 'ms-MY', en: 'en-GB', zh: 'zh-CN' }[getLang()] || 'ms-MY', { month: 'long', year: 'numeric' });
  const done = D.att.filter(x => x.a.status !== 'booked'), rate = done.length ? Math.round(D.present / done.length * 100) : null;
  const bar = (v, p) => `<div class="sk"><div class="bar"><i style="width:${(v || 0) * 20}%"></i></div><b>${v || '–'}/5</b>${p && v ? `<small class="${v > p ? 'up' : v < p ? 'dn' : ''}">${v > p ? '▲' : v < p ? '▼' : '='}</small>` : ''}</div>`;
  openDoc(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(tt('Laporan Bulanan'))} — ${esc(st?.full_name || '')}</title><style>
  @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font:13px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1b2f;background:#eee}
  .page{max-width:210mm;margin:12px auto;background:#fff;padding:14mm}.bar0{position:sticky;top:0;background:#1b1b2f;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center}.bar0 button{font:inherit;padding:6px 14px;border-radius:8px;border:0;background:#C6F432;cursor:pointer}
  header{display:flex;gap:14px;align-items:center;border-bottom:3px solid #C6F432;padding-bottom:10px}header img{width:56px;height:56px;object-fit:contain}h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#555}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.k{border:1px solid #e3e3ea;border-radius:10px;padding:8px 10px}.k b{display:block;font-size:22px}.k span{color:#666;font-size:11.5px}
  table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #eee;padding:5px 6px;text-align:left;vertical-align:top}th{font-size:11px;color:#777;text-transform:uppercase}
  .sk{display:flex;align-items:center;gap:8px}.bar{flex:1;height:8px;background:#eee;border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:#4caf50}.up{color:#2e7d32}.dn{color:#c62828}
  .note{white-space:pre-line;background:#f7f7fa;border-radius:8px;padding:8px 10px;margin-top:6px}.muted{color:#777}
  @media print{body{background:#fff}.bar0{display:none}.page{margin:0;padding:0;max-width:none}}</style></head><body>
  <div class="bar0"><b>${esc(tt('Laporan Bulanan'))}</b><button onclick="print()">${esc(tt('Cetak / Simpan PDF'))}</button></div>
  <div class="page"><header><img src="${LOGO_DATA}" alt=""><div><h1>${esc(tt('Laporan Progres Bulanan'))}</h1><div>${esc(st?.full_name || '')} · ${esc(progName(st?.programme_id))} · <b>${esc(mLbl)}</b></div><div class="muted">${esc(academyName())}</div></div></header>
  <h2>${esc(tt('Kehadiran'))}</h2><div class="kpis"><div class="k"><b>${D.present}</b><span>${esc(tt('Hadir'))}${D.late ? ` (${D.late} ${esc(tt('lewat'))})` : ''}</span></div><div class="k"><b>${D.absent + D.lateCancel}</b><span>${esc(tt('Tidak hadir / batal lewat'))}</span></div><div class="k"><b>${D.excused}</b><span>${esc(tt('Dimaafkan'))}</span></div><div class="k"><b>${rate == null ? '–' : rate + '%'}</b><span>${esc(tt('Kadar kehadiran'))}</span></div></div>
  <table style="margin-top:10px"><thead><tr><th>${esc(tt('Tarikh'))}</th><th>${esc(tt('Sesi'))}</th><th>${esc(tt('Status'))}</th><th>${esc(tt('Fokus latihan'))}</th></tr></thead><tbody>
  ${D.att.map(x => `<tr><td>${x.date ? esc(DAYS[new Date(x.date + 'T00:00:00').getDay()]) + ', ' + esc(fmtDate(x.date)) : ''}</td><td>${x.c ? esc(hm(x.s?.start_time || x.c.start_time)) + ' · ' + esc(progName(x.c.programme_id)) + ' · ' + esc(venueName(x.c.venue_id)) : ''}</td><td>${esc(tt(LABEL[x.a.status] || x.a.status))}</td><td>${x.plan ? '<b>' + esc(x.plan.title) + '</b>' + (x.plan.objective ? '<br><span class="muted">' + esc(x.plan.objective) + '</span>' : '') : x.s?.lesson_plan ? esc(x.s.lesson_plan) : '<span class="muted">—</span>'}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">${esc(tt('Tiada sesi direkodkan bulan ini.'))}</td></tr>`}</tbody></table>
  <h2>${esc(tt('Penilaian jurulatih'))}</h2>
  ${last ? `<table><tbody>${SK.map(([f, l]) => `<tr><td style="width:120px">${esc(tt(l))}</td><td>${bar(last[f], D.prev?.[f])}</td></tr>`).join('')}</tbody></table>
    ${D.recs.map(r => (r.title || r.notes) ? `<div class="note"><b>${esc(fmtDate(r.recorded_on))}${r.coach_id ? ' · ' + esc(staffName(r.coach_id)) : ''}</b>${r.title ? '<br>' + esc(r.title) : ''}${r.notes ? '<br>' + esc(r.notes) : ''}</div>` : '').join('')}
    ${D.prev ? `<p class="muted" style="font-size:11.5px">▲▼ ${esc(tt('berbanding penilaian sebelum'))} (${esc(fmtDate(D.prev.recorded_on))})</p>` : ''}` : `<p class="muted">${esc(tt('Belum ada penilaian jurulatih bulan ini.'))}</p>`}
  ${(() => { const pl = D.att.map(x => x.plan).filter(Boolean).slice(-1)[0]; return pl && (pl.to_improve || pl.next_plan) ? `<h2>${esc(tt('Fokus seterusnya'))}</h2>${pl.to_improve ? `<div class="note"><b>${esc(tt('Perlu diperbaiki'))}:</b> ${esc(pl.to_improve)}</div>` : ''}${pl.next_plan ? `<div class="note"><b>${esc(tt('Rancangan kelas seterusnya'))}:</b> ${esc(pl.next_plan)}</div>` : ''}` : ''; })()}
  <p class="muted" style="margin-top:22px;font-size:11px">${esc(tt('Dijana pada'))} ${esc(fmtDate(todayISO()))}.</p></div></body></html>`, 'laporan-bulanan.html');
}
