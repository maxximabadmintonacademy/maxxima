// v26: Admin — Check-in & Tugasan coach, sunting SOP sesi, jalankan peringatan secara manual.
import { VIEWS, ACTIONS } from '../registry.js';
import { S, update, saveSetting, rpc } from '../data.js';
import { esc, UI, app, toast, openModal, pageHead, todayISO, addDays, fmtShort, hm, DAYS } from '../ui.js';
import { T, byId, staffName, venueName, progName } from './helpers.js';
import { calItems, sTime, sCoach, groupsOf } from './sessions.js';
import { sop } from '../coach/v26.js';

const fmtT = iso => new Date(iso).toLocaleTimeString('ms-MY', { hour: 'numeric', minute: '2-digit' });
const ST = { pending: ['Menunggu', 'b-warn'], accepted: ['Diterima', 'b-ok'], rejected: ['Ditolak', 'b-bad'], expired: ['Tiada respons', 'b-bad'], cancelled: ['Dibatalkan', 'b-muted'] };
const asgLabel = a => { const s = byId('class_sessions', a.session_id), c = byId('classes', a.class_id || s?.class_id); if (!c) return '—';
  return a.kind === 'class' ? `Kelas tetap · setiap ${DAYS[c.weekday]} ${hm(c.start_time)} · ${progName(c.programme_id)} · ${venueName(c.venue_id)}`
    : `${s ? DAYS[new Date(s.session_date + 'T00:00').getDay()] + ', ' + fmtShort(s.session_date) + ' ' + sTime(s, c)[0] : ''} · ${progName(c.programme_id)} · ${venueName(c.venue_id)}${a.kind === 'group' ? ' · kumpulan' : ''}`; };

VIEWS.checkin = () => {
  const tab = UI.ckTab || 'hari', today = todayISO();
  const nBad = T('session_assignments').filter(a => ['rejected', 'expired'].includes(a.status) && !a.seen_at).length;
  const tabs = [['hari', 'Check-in hari ini'], ['minggu', '7 hari lepas'], ['tugasan', `Tugasan sesi${nBad ? ` (${nBad})` : ''}`], ['sop', 'SOP sesi']];
  const head = pageHead('Check-in & Tugasan Coach', 'Ketepatan masa coach, gambar check in, tugasan terima / tolak, dan SOP sesi.', `<button class="btn" data-action="ck-run">Jalankan peringatan sekarang</button>`);
  const tabBar = `<div class="chips">${tabs.map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-action="ck-tab" data-id="${k}">${l}</button>`).join('')}</div>`;
  if (tab === 'tugasan') return head + tabBar + asgTab();
  if (tab === 'sop') return head + tabBar + sopTab();
  const from = tab === 'hari' ? today : addDays(today, -7), to = tab === 'hari' ? today : addDays(today, -1);
  const items = calItems(from, to).filter(x => x.s?.status !== 'cancelled');
  const rows = items.flatMap(({ s, c, date }) => { const coaches = [...new Set([sCoach(s, c), ...(s ? groupsOf(s.id).map(g => g.coach_id) : [])].filter(Boolean))];
    return coaches.map(cid => ({ s, c, date, cid, ins: s && T('coach_checkins').find(k => k.session_id === s.id && k.staff_id === cid && k.kind === 'in'), out: s && T('coach_checkins').find(k => k.session_id === s.id && k.staff_id === cid && k.kind === 'out') })); });
  const nIn = rows.filter(r => r.ins).length, nLate = rows.filter(r => r.ins?.late_min > 0).length;
  // ringkasan ketepatan setiap coach (30 hari)
  const since = addDays(today, -30), byCoach = {};
  T('coach_checkins').filter(k => k.kind === 'in' && k.session_date >= since).forEach(k => { const o = (byCoach[k.staff_id] ||= { n: 0, late: 0, sum: 0 }); o.n++; if (k.late_min > 0) { o.late++; o.sum += k.late_min; } });
  return `${head}${tabBar}
  <div class="kv-mini mb"><div><b>${rows.length}</b><small>Tugasan coach</small></div><div><b>${nIn}</b><small>Sudah check in</small></div><div><b style="color:${nLate ? 'var(--bad)' : 'inherit'}">${nLate}</b><small>Lewat</small></div><div><b>${rows.length - nIn}</b><small>Belum / tiada check in</small></div></div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Sesi</th><th>Coach</th><th>Check in</th><th>Check out</th><th>Gambar</th></tr></thead><tbody>
  ${rows.map(({ s, c, date, cid, ins, out }) => { const [a] = sTime(s, c), past = new Date(`${date}T${a}:00`) < new Date();
    return `<tr><td><a href="javascript:void 0" data-action="${s ? 'sess-open' : ''}" data-id="${s?.id || ''}">${tab === 'hari' ? '' : DAYS[new Date(date + 'T00:00').getDay()].slice(0, 3) + ' ' + fmtShort(date) + ' · '}${a} · ${esc(progName(c.programme_id))}</a><div class="muted" style="font-size:12px">${esc(venueName(c.venue_id))}</div></td>
      <td>${esc(staffName(cid))}</td>
      <td>${ins ? `<b>${fmtT(ins.at)}</b> <span class="badge ${ins.late_min > 0 ? 'b-bad' : 'b-ok'}">${ins.late_min > 0 ? `lewat ${ins.late_min}m` : `awal ${-ins.late_min}m`}</span>${ins.distance_m != null ? `<div class="muted" style="font-size:11.5px">${ins.distance_m > (byId('venues', c.venue_id)?.radius_m || 300) ? '⚠️ ' : ''}${ins.distance_m} m dari dewan</div>` : ins.lat == null ? '<div class="muted" style="font-size:11.5px">tiada lokasi</div>' : ''}${ins.note ? `<div class="muted" style="font-size:11.5px">${esc(ins.note)}</div>` : ''}`
        : `<span class="badge ${past ? 'b-bad' : 'b-muted'}">${past ? 'Tiada check in' : 'Belum'}</span>`}</td>
      <td>${out ? fmtT(out.at) : '—'}</td>
      <td>${ins?.photo_path ? `<img data-pmedia="checkins::${esc(ins.photo_path)}" class="ck-thumb" alt="" data-action="ck-photo" data-id="${esc(ins.photo_path)}">` : '—'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">Tiada sesi.</td></tr>'}</tbody></table></div></div>
  ${Object.keys(byCoach).length ? `<div class="card card-pad" style="margin-top:14px"><h3 style="font-size:14.5px;margin-bottom:8px">Ketepatan masa (30 hari)</h3><div class="table-wrap"><table><thead><tr><th>Coach</th><th>Check in</th><th>Lewat</th><th>Purata lewat</th></tr></thead><tbody>
    ${Object.entries(byCoach).sort((a, b) => b[1].late - a[1].late).map(([id, o]) => `<tr><td>${esc(staffName(id))}</td><td>${o.n}</td><td>${o.late} (${Math.round(o.late / o.n * 100)}%)</td><td>${o.late ? Math.round(o.sum / o.late) + ' min' : '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
};
function asgTab() {
  const L = T('session_assignments').slice().sort((a, b) => (b.assigned_at || '').localeCompare(a.assigned_at || '')).slice(0, 150);
  return `<p class="muted" style="font-size:12.5px;margin-bottom:10px">Bila anda tetapkan coach untuk sesi (ganti / kumpulan) atau kelas tetap, coach dimaklumkan dan perlu <b>Terima / Tolak dalam 1 jam</b>. Ditolak atau tiada respons → anda dimaklumkan.</p>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Coach</th><th>Tugasan</th><th>Status</th><th>Ditugaskan</th><th>Jawapan</th><th></th></tr></thead><tbody>
  ${L.map(a => { const [l, b] = ST[a.status] || [a.status, 'b-muted'], bad = ['rejected', 'expired'].includes(a.status);
    return `<tr style="${bad && !a.seen_at ? 'background:var(--bad-soft,#fff1f1)' : ''}"><td><b>${esc(staffName(a.staff_id))}</b></td><td style="font-size:12.5px">${esc(asgLabel(a))}</td><td><span class="badge ${b}">${l}</span></td>
      <td style="font-size:12px">${new Date(a.assigned_at).toLocaleString('ms-MY', { dateStyle: 'short', timeStyle: 'short' })}</td><td style="font-size:12px">${a.responded_at ? new Date(a.responded_at).toLocaleString('ms-MY', { dateStyle: 'short', timeStyle: 'short' }) : '—'}${a.reason ? `<div>${esc(a.reason)}</div>` : ''}</td>
      <td style="white-space:nowrap">${a.session_id ? `<button class="btn sm" data-action="sess-open" data-id="${a.session_id}">Buka sesi</button> ` : ''}${bad && !a.seen_at ? `<button class="btn sm" data-action="asg-seen" data-id="${a.id}">Selesai</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Belum ada tugasan.</td></tr>'}</tbody></table></div></div>`;
}
function sopTab() {
  const o = sop(), coaches = T('staff').filter(s => s.active && s.profile_id);
  return `<div class="grid g-2"><div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="font-size:14.5px">SOP sesi (versi ${o.version})</h3><button class="btn sm" data-action="sop-edit">Ubah</button></div>
    <ol class="sop" style="margin-top:10px">${o.steps.map((x, i) => `<li><div class="sop-n">${esc(x.icon || i + 1)}</div><div><b>${i + 1}. ${esc(x.title)}</b><div class="sop-b">${esc(x.body).replace(/\n/g, '<br>')}</div></div></li>`).join('')}</ol></div>
  <div class="card card-pad"><h3 style="font-size:14.5px;margin-bottom:8px">Pengesahan coach</h3><ul class="list">${coaches.map(s => `<li class="list-item"><div class="li-main"><div class="li-title">${esc(s.full_name)}</div><div class="li-sub">${s.sop_ack_version >= o.version ? `✓ Disahkan ${s.sop_ack_at ? fmtShort(s.sop_ack_at.slice(0, 10)) : ''}` : s.sop_ack_version ? `Versi lama (v${s.sop_ack_version})` : 'Belum baca'}</div></div><span class="badge ${s.sop_ack_version >= o.version ? 'b-ok' : 'b-warn'}">${s.sop_ack_version >= o.version ? 'OK' : 'Belum'}</span></li>`).join('') || '<li class="empty">Tiada coach dengan akaun.</li>'}</ul>
  <p class="muted" style="font-size:12px;margin-top:8px">Coach diminta mengesahkan SOP semasa membuka portal. Bila SOP diubah, versi naik dan semua coach perlu mengesahkan semula.</p></div></div>`;
}
Object.assign(ACTIONS, {
  'ck-tab': id => { UI.ckTab = id; app.render(); },
  'ck-photo': async path => { const { privateUrl } = await import('../media.js'); const u = await privateUrl('checkins::' + path); if (u) openModal({ title: 'Gambar check in', body: `<img src="${u}" style="width:100%;border-radius:12px">`, submit: 'Tutup', onSubmit: () => {} }); },
  'asg-seen': async id => { await update('session_assignments', id, { seen_at: new Date().toISOString() }); toast('Ditanda selesai'); app.render(); },
  'ck-run': async () => { if (S.mode !== 'supabase') return toast('Mod demo: peringatan dijalankan automatik di pelayan setiap 10 minit.');
    const n = await rpc('run_frequent_jobs'); toast(`${n || 0} peringatan / notifikasi dihantar`); },
  'sop-edit': () => { const o = sop();
    openModal({ title: 'Ubah SOP sesi', wide: true, submit: 'Simpan (versi baharu)', body: `<p class="muted" style="font-size:12.5px;margin-bottom:10px">Satu langkah setiap kotak. Baris pertama = tajuk, baris seterusnya = butiran. Mula dengan emoji jika mahu (cth. "⏰ Ketibaan"). Kosongkan kotak untuk buang langkah.</p>
      ${[...o.steps, {}, {}].map((x, i) => `<label class="f full" style="margin-bottom:8px">Langkah ${i + 1}<textarea name="s${i}" rows="4">${x.title ? esc(`${x.icon ? x.icon + ' ' : ''}${x.title}\n${x.body || ''}`) : ''}</textarea></label>`).join('')}
      <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="reack" value="1" checked style="width:auto;height:auto"> Minta semua coach sahkan semula</label>`,
      onSubmit: async d => {
        const steps = Object.keys(d).filter(k => /^s\d+$/.test(k)).sort((a, b) => a.slice(1) - b.slice(1)).map(k => String(d[k] || '').trim()).filter(Boolean).map(t => {
          const [first, ...rest] = t.split('\n'), m = first.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
          return { icon: m ? m[1] : '', title: (m ? m[2] : first).trim(), body: rest.join('\n').trim() }; });
        if (!steps.length) throw new Error('Sekurang-kurangnya satu langkah.');
        await saveSetting('coach_sop', { version: d.reack === '1' ? o.version + 1 : o.version, steps }); toast('SOP disimpan'); app.render(); } }); },
});
