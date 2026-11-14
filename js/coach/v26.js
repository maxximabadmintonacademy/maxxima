// v26: Portal coach — SOP sesi (wajib baca & sahkan), check in / check out bergambar + lokasi,
// tugasan sesi baharu (terima / tolak dalam 1 jam).
import { ACTIONS } from '../registry.js';
import { S, rpc } from '../data.js';
import { esc, app, toast, openModal, todayISO, hm } from '../ui.js';
import { T, byId } from '../admin/helpers.js';
import { uploadMedia } from '../media.js';

const me = () => T('staff').find(s => s.profile_id === S.profile.id) || (S.mode === 'demo' ? (T('staff').find(s => /alvi/i.test(s.full_name)) || T('staff')[0]) : null);
export const sop = () => (S.t.settings || []).find(x => x.key === 'coach_sop')?.value || DEFAULT_SOP;
const DEFAULT_SOP = { version: 1, steps: [
  { icon: '⏰', title: 'Ketibaan & persediaan', body: 'Tiba sekurang-kurangnya 10 minit awal dan CHECK IN di app.\nSediakan shuttle & peralatan latihan.\nPastikan court dan kawasan latihan sedia.' },
  { icon: '👥', title: 'Kumpulkan pelajar', body: 'Kumpulkan dan susun pelajar kumpulan anda.\nPastikan tiada pelajar ditinggalkan atau keliru kumpulan.' },
  { icon: '🤸', title: 'Warm-up & stretching', body: 'Semua pelajar bersama sebagai satu kumpulan besar. Semua coach bantu memantau.' },
  { icon: '🏃', title: 'Dynamic exercises', body: 'Diketuai coach bertugas. Coach lain bantu, pantau & betulkan pergerakan.' },
  { icon: '🏸', title: 'Multi-shuttle training', body: 'Arahan jelas dahulu. 2 pasukan & gilir. Jangan tunggu semua shuttle disusun — mula feeding selepas ~2 baris.' },
  { icon: '📵', title: 'Disiplin coaching', body: 'Jangan guna telefon semasa sesi — ibu bapa beri maklum balas setiap sesi. Beri maklum balas semasa sparring.' },
  { icon: '🗣️', title: 'Fokus pada coaching', body: 'Elak berbual panjang. Kurang menunggu. Lebih latihan. Coaching lebih baik.' },
  { icon: '✅', title: 'Selepas sesi', body: 'Tanda kehadiran & tulis nota latihan. Kemas peralatan & CHECK OUT.' },
] };
export const sopHtml = (o = sop()) => `<ol class="sop">${o.steps.map((x, i) => `<li><div class="sop-n">${esc(x.icon || i + 1)}</div><div><b>${i + 1}. ${esc(x.title)}</b><div class="sop-b">${esc(x.body).replace(/\n/g, '<br>')}</div></div></li>`).join('')}</ol>`;

/* ---------- SOP ---------- */
export const sopCard = () => `<a class="card card-pad mb sop-link" href="#sop"><span style="font-size:22px">📋</span><div style="flex:1"><b>SOP Sesi Coach</b><div class="muted" style="font-size:12.5px">Ketibaan, warm-up, multi-shuttle, disiplin telefon & selepas sesi</div></div><span class="muted">›</span></a>`;
export const CV26 = {
  sop: () => { const m = me(), o = sop(), ok = m?.sop_ack_version >= o.version;
    return `<div class="page-head"><div><h1>SOP Sesi Coach</h1><p>Versi ${o.version}${ok ? ' · ✓ anda sudah mengesahkan' : ''}</p></div></div>
    <div class="card card-pad">${sopHtml(o)}${ok ? '' : `<button class="btn primary" style="margin-top:14px" data-action="c-sop-ack">Saya faham & akan patuh</button>`}</div>`; },
};
/** Paparkan SOP wajib jika coach belum sahkan versi terkini. */
export function sopGate() {
  const m = me(), o = sop(); if (!m || m.sop_ack_version >= o.version) return false;
  if (navigator.webdriver && !/[?&](sop|tour)/.test(location.search)) return false;   // ujian automatik
  openModal({ title: o.version > 1 && m.sop_ack_version ? 'SOP sesi dikemas kini' : 'SOP sesi coach', wide: true, submit: 'Saya faham & akan patuh', cancel: 'Kemudian',
    body: `<p class="muted" style="font-size:13px;margin-bottom:10px">Sila baca prosedur sesi ini. Ibu bapa memberi maklum balas selepas setiap sesi.</p>${sopHtml(o)}`,
    onSubmit: () => ackSop() });
  return true;
}
async function ackSop() { const m = me(), v = sop().version; if (S.mode === 'supabase') await rpc('coach_ack_sop', { p_version: v }); Object.assign(m, { sop_ack_version: v, sop_ack_at: new Date().toISOString() }); toast('Terima kasih — SOP disahkan'); app.render(); }
ACTIONS['c-sop-ack'] = () => ackSop();
/** Sahkan SOP tanpa toast (semasa onboarding). */
export async function ackSopSilent() { const m = me(), v = sop().version; if (!m) return; try { if (S.mode === 'supabase') await rpc('coach_ack_sop', { p_version: v }); Object.assign(m, { sop_ack_version: v, sop_ack_at: new Date().toISOString() }); } catch { /* abaikan */ } }

/* ---------- TUGASAN (terima / tolak) ---------- */
const sessLabel = a => { const s = byId('class_sessions', a.session_id), c = byId('classes', a.class_id || s?.class_id); if (!c) return 'Tugasan';
  const DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const prog = byId('programmes', c.programme_id)?.name || '', ven = byId('venues', c.venue_id)?.name || '';
  return a.kind === 'class' ? `Kelas tetap setiap ${DAYS[c.weekday]} ${hm(c.start_time)} · ${prog} · ${ven}` : `${s ? DAYS[new Date(s.session_date + 'T00:00').getDay()] + ' ' + s.session_date.split('-').reverse().slice(0, 2).join('/') + ' ' + hm(s.start_time || c.start_time) : ''} · ${prog} · ${ven}${a.kind === 'group' ? ' (kumpulan)' : ''}`; };
export function assignBanner() {
  const m = me(); if (!m) return '';
  const L = T('session_assignments').filter(a => a.staff_id === m.id && ['pending', 'expired'].includes(a.status)).sort((a, b) => a.due_at.localeCompare(b.due_at));
  if (!L.length) return '';
  return `<div class="card card-pad mb assign">${L.map(a => { const left = Math.round((new Date(a.due_at) - Date.now()) / 60000);
    return `<div class="assign-row"><div style="flex:1;min-width:200px"><b>🆕 ${a.kind === 'class' ? 'Kelas tetap baharu' : 'Tugasan sesi baharu'}</b><div style="font-size:13px">${esc(sessLabel(a))}</div>
      <div class="muted" style="font-size:12px">${a.status === 'expired' ? '⏰ Tempoh 1 jam tamat — admin dimaklumkan. Anda masih boleh menjawab.' : `Sila jawab dalam <b>${Math.max(0, left)} minit</b>`}</div></div>
      <div class="actions"><button class="btn sm primary" data-action="c-asg-ok" data-id="${a.id}">Terima</button><button class="btn sm" data-action="c-asg-no" data-id="${a.id}">Tolak</button></div></div>`; }).join('')}</div>`;
}
async function respond(id, accept, reason) {
  if (S.mode === 'supabase') await rpc('coach_respond_assignment', { p_id: id, p_accept: accept, p_reason: reason || null });
  Object.assign(byId('session_assignments', id), { status: accept ? 'accepted' : 'rejected', responded_at: new Date().toISOString(), reason: reason || null });
  toast(accept ? 'Tugasan diterima ✓' : 'Tugasan ditolak — admin dimaklumkan'); app.render();
}
ACTIONS['c-asg-ok'] = id => respond(id, true);
ACTIONS['c-asg-no'] = id => openModal({ title: 'Tolak tugasan', submit: 'Hantar', body: `<p style="font-size:13px;margin-bottom:8px">${esc(sessLabel(byId('session_assignments', id)))}</p><label class="f full">Sebab (wajib)<textarea name="r" required placeholder="cth. Ada kelas lain pada masa sama"></textarea></label>`,
  onSubmit: d => { if (!(d.r || '').trim()) throw new Error('Nyatakan sebab.'); return respond(id, false, d.r); } });

/* ---------- CHECK IN / CHECK OUT ---------- */
const fmtT = iso => new Date(iso).toLocaleTimeString('ms-MY', { hour: 'numeric', minute: '2-digit' });
const myChecks = sid => T('coach_checkins').filter(k => k.session_id === sid && k.staff_id === me()?.id);
/** Jalur check-in di bawah kad sesi (hari ini sahaja). */
export function checkStrip({ s, c, date }) {
  if (date < todayISO() || s?.status === 'cancelled') return '';
  const cov = s && T('cover_requests').find(r => r.session_id === s.id && r.staff_id === me()?.id && ['open', 'covered'].includes(r.status));
  if (cov) return `<div class="ck-strip"><span>${cov.status === 'open' ? '⏳ Permohonan ganti dihantar — admin sedang mencari pengganti' : '✓ Pengganti telah ditetapkan oleh admin'}</span>${cov.status === 'open' ? `<button class="btn sm" data-action="c-cover-x" data-id="${cov.id}">Tarik balik</button>` : ''}</div>`;
  const id0 = s ? s.id : `${c.id}|${date}`, coverBtn = `<button class="btn sm ghost" data-action="c-cover" data-id="${id0}">Tidak dapat hadir</button>`;
  if (date !== todayISO()) return `<div class="ck-strip quiet"><span></span>${coverBtn}</div>`;
  const ins = s ? myChecks(s.id).find(k => k.kind === 'in') : null, out = s ? myChecks(s.id).find(k => k.kind === 'out') : null, id = s ? s.id : `${c.id}|${date}`;
  const ckBy = (() => { const t0 = String(s?.start_time || c.start_time || '00:00').slice(0, 5).split(':').map(Number), m0 = t0[0] * 60 + t0[1] - 10; return `${String(Math.floor(m0 / 60)).padStart(2, '0')}:${String(m0 % 60).padStart(2, '0')}`; })();
  if (!ins) return `<div class="ck-strip"><span>📍 Check in sebelum <b>${ckBy}</b> (10 min awal)</span><span class="ck-btns">${coverBtn}<button class="btn sm primary" data-action="c-checkin" data-id="${id}|in">Check in</button></span></div>`;
  const early = -ins.late_min, lbl = ins.late_min > 0 ? `<b style="color:var(--bad)">lewat ${ins.late_min} min</b>` : `awal ${early} min`;
  return `<div class="ck-strip ok"><span>✓ Masuk ${fmtT(ins.at)} (${lbl})${out ? ` · ✓ Keluar ${fmtT(out.at)}` : ''}</span>${out ? '' : `<button class="btn sm" data-action="c-checkin" data-id="${id}|out">Check out</button>`}</div>`;
}
let GEO = null;
function getGeo() {
  GEO = { state: 'wait' }; const el = () => document.getElementById('ck-geo');
  if (!navigator.geolocation) { GEO = { state: 'na' }; return; }
  navigator.geolocation.getCurrentPosition(p => { GEO = { state: 'ok', lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; if (el()) el().innerHTML = `📍 Lokasi diperoleh (±${Math.round(p.coords.accuracy)} m)`; },
    () => { GEO = { state: 'no' }; if (el()) el().innerHTML = '⚠️ Lokasi tidak dibenarkan — check in tetap direkod tanpa lokasi.'; }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
ACTIONS['c-checkin'] = async raw => {
  const parts = raw.split('|'), kind = parts.pop(); let sid = parts.length === 2 ? null : parts[0];
  const c = sid ? byId('classes', byId('class_sessions', sid)?.class_id) : byId('classes', parts[0]);
  getGeo();
  openModal({ title: kind === 'in' ? 'Check in sesi' : 'Check out sesi', submit: kind === 'in' ? 'Check in' : 'Check out', body: `
    <p style="font-size:13.5px;margin-bottom:10px"><b>${esc(byId('programmes', c?.programme_id)?.name || '')}</b> · ${esc(byId('venues', c?.venue_id)?.name || '')} · ${hm(c?.start_time)}–${hm(c?.end_time)}</p>
    <label class="f full">${kind === 'in' ? '📸 Swafoto di court (wajib)' : '📸 Gambar court selepas dikemas (pilihan)'}<input type="file" name="photo" accept="image/*" capture="${kind === 'in' ? 'user' : 'environment'}" ${kind === 'in' ? 'required' : ''}></label>
    <div id="ck-geo" class="muted" style="font-size:12.5px;margin:8px 0">📍 Mendapatkan lokasi…</div>
    ${kind === 'in' ? `<div class="hint" style="margin-top:6px">📵 <b>Selepas check in, simpan telefon.</b> Ibu bapa memberi maklum balas selepas setiap sesi. Fokus kepada pelajar — kurang menunggu, lebih latihan.</div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:10px"><input type="checkbox" name="ok" value="1" style="width:auto;height:auto;margin-top:2px"> Saya sudah sediakan shuttle & peralatan, dan akan ikut SOP sesi.</label>`
    : `<div class="hint">✅ Pastikan kehadiran semua pelajar sudah ditanda dan nota latihan ditulis.</div>`}
    <label class="f full" style="margin-top:8px">Catatan (pilihan)<input name="note" placeholder="cth. court 3 bocor, guna court 5"></label>`,
    onSubmit: async d => {
      if (kind === 'in' && d.ok !== '1') throw new Error('Tandakan pengesahan persediaan & SOP.');
      if (kind === 'in' && !(d.photo && d.photo.size)) throw new Error('Swafoto diperlukan untuk check in.');
      const m = me(); if (!m) throw new Error('Akaun belum dipautkan kepada rekod coach.');
      // had masa: check in 2 jam sebelum hingga tamat; check out selepas mula
      { const sx = sid && byId('class_sessions', sid), dd = sx?.session_date || parts[1] || todayISO(), st0 = new Date(`${dd}T${String(sx?.start_time || c.start_time).slice(0, 5)}:00`), en0 = new Date(`${dd}T${String(sx?.end_time || c.end_time).slice(0, 5)}:00`), now = Date.now();
        if (S.mode === 'supabase' && kind === 'in' && (now < st0 - 7200000 || now > en0)) throw new Error('Check in hanya dibuka 2 jam sebelum sesi hingga sesi tamat.');
        if (S.mode === 'supabase' && kind === 'out' && now < st0) throw new Error('Check out hanya selepas sesi bermula.'); }
      // lokasi: jika jauh dari dewan, wajib nyatakan sebab
      const ven = byId('venues', c.venue_id), gg = GEO?.state === 'ok' ? GEO : null;
      const dist = gg && ven?.lat != null ? Math.round(distM(gg.lat, gg.lng, ven.lat, ven.lng)) : null;
      if (dist != null && dist > (ven.radius_m || 300) && !(d.note || '').trim()) throw new Error(`Anda kira-kira ${dist} m dari ${ven.name}. Nyatakan sebab di ruang Catatan (cth. dewan berlainan).`);
      if (kind === 'in' && GEO?.state === 'no' && !(d.note || '').trim()) throw new Error('Lokasi tidak dibenarkan. Hidupkan lokasi (GPS) atau nyatakan sebab di Catatan.');
      if (d.photo && d.photo.size) d.photo = await stampPhoto(d.photo, [`${m.full_name} · ${kind === 'in' ? 'CHECK IN' : 'CHECK OUT'}`, `${new Date().toLocaleString('ms-MY', { dateStyle: 'medium', timeStyle: 'short' })} · ${ven?.name || ''}`, gg ? `GPS ${gg.lat.toFixed(5)}, ${gg.lng.toFixed(5)} (±${Math.round(gg.acc)} m)${dist != null ? ` · ${dist} m dari dewan` : ''}` : 'GPS tidak tersedia']);
      if (!sid) { const date = parts[1]; sid = S.mode === 'supabase' ? await rpc('ensure_session', { p_class: parts[0], p_date: date }) : (T('class_sessions').find(x => x.class_id === parts[0] && x.session_date === date)?.id); }
      const photo = d.photo && d.photo.size ? await uploadMedia('checkins', m.id, d.photo, { maxMB: 5 }) : null;
      const g = GEO?.state === 'ok' ? GEO : {};
      let row;
      if (S.mode === 'supabase') row = await rpc('coach_check_in', { p_session: sid, p_kind: kind, p_photo: photo, p_lat: g.lat ?? null, p_lng: g.lng ?? null, p_acc: g.acc ?? null, p_note: d.note || null });
      else { const s = byId('class_sessions', sid), st = new Date(`${s?.session_date || todayISO()}T${(s?.start_time || c.start_time).slice(0, 5)}:00`);
        row = { id: crypto.randomUUID(), staff_id: m.id, session_id: sid, class_id: c.id, session_date: s?.session_date || todayISO(), kind, at: new Date().toISOString(), photo_path: photo, late_min: Math.round((Date.now() - (st - 600000)) / 60000), note: d.note || null }; }
      (S.t.coach_checkins ||= []).push(row);
      toast(kind === 'in' ? (row.late_min > 0 ? `Check in direkod — lewat ${row.late_min} minit` : 'Check in direkod ✓ Simpan telefon & selamat coaching!') : 'Check out direkod ✓', kind === 'in' && row.late_min > 0);
      app.render();
    } });
};

/* ---------- Bantuan: jarak GPS & cop masa pada gambar ---------- */
function distM(a1, o1, a2, o2) { const R = 6371000, r = x => x * Math.PI / 180, dA = r(a2 - a1), dO = r(o2 - o1);
  const h = Math.sin(dA / 2) ** 2 + Math.cos(r(a1)) * Math.cos(r(a2)) * Math.sin(dO / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
/** Kecilkan gambar (maks 1280px) dan cop nama, masa, lokasi di bahagian bawah — sukar digunakan semula. */
async function stampPhoto(file, lines) {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, w, h);
    const fs = Math.max(14, Math.round(w / 34)), pad = Math.round(fs * .6), bh = lines.length * fs * 1.35 + pad * 2;
    g.fillStyle = 'rgba(7,22,55,.72)'; g.fillRect(0, h - bh, w, bh); g.fillStyle = '#fff'; g.font = `600 ${fs}px system-ui, sans-serif`; g.textBaseline = 'top';
    lines.forEach((t, i) => g.fillText(t, pad, h - bh + pad + i * fs * 1.35, w - pad * 2));
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .82));
    return blob ? new File([blob], 'checkin.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

/* ---------- Tidak dapat hadir → minta pengganti ---------- */
ACTIONS['c-cover'] = raw => {
  const parts = raw.split('|'); let sid = parts.length === 2 ? null : parts[0];
  const c = sid ? byId('classes', byId('class_sessions', sid)?.class_id) : byId('classes', parts[0]), date = sid ? byId('class_sessions', sid)?.session_date : parts[1];
  openModal({ title: 'Tidak dapat hadir', submit: 'Hantar kepada admin', body: `<p style="font-size:13.5px;margin-bottom:10px"><b>${esc(byId('programmes', c?.programme_id)?.name || '')}</b> · ${esc(byId('venues', c?.venue_id)?.name || '')} · ${esc(date || '')} ${hm(c?.start_time)}</p>
    <label class="f full">Sebab (wajib)<textarea name="r" required placeholder="cth. demam / MC, kecemasan keluarga, pertembungan kejohanan"></textarea></label>
    <p class="muted" style="font-size:12.5px;margin-top:8px">Admin akan dimaklumkan segera untuk mencari coach pengganti atau membatalkan sesi. Maklumkan seawal mungkin — sekurang-kurangnya 24 jam sebelum sesi jika boleh.</p>`,
    onSubmit: async d => { if (!(d.r || '').trim()) throw new Error('Nyatakan sebab.');
      const m = me(); if (!m) throw new Error('Akaun belum dipautkan kepada rekod coach.');
      if (!sid) sid = S.mode === 'supabase' ? await rpc('ensure_session', { p_class: parts[0], p_date: parts[1] }) : T('class_sessions').find(x => x.class_id === parts[0] && x.session_date === parts[1])?.id;
      const id = S.mode === 'supabase' ? await rpc('coach_request_cover', { p_session: sid, p_reason: d.r.trim() }) : crypto.randomUUID();
      (S.t.cover_requests ||= []).push({ id, session_id: sid, staff_id: m.id, reason: d.r.trim(), status: 'open', created_at: new Date().toISOString() });
      toast('Admin dimaklumkan — anda akan diberitahu bila pengganti ditetapkan'); app.render(); } });
};
ACTIONS['c-cover-x'] = async id => { if (S.mode === 'supabase') await rpc('coach_withdraw_cover', { p_id: id }); const r = byId('cover_requests', id); if (r) r.status = 'withdrawn'; toast('Permohonan ditarik balik'); app.render(); };

/* ---------- Rekod disiplin coach (penalti) + rayuan ---------- */
const PK = { late: 'Lewat', no_show: 'Tidak hadir', late_cancel: 'Batal lewat', other: 'Lain-lain' };
const PS = { pending: ['Menunggu semakan admin', 'b-warn'], approved: ['Disahkan', 'b-bad'], waived: ['Dikecualikan', 'b-muted'], appealed: ['Rayuan dihantar', 'b-info'] };
export function penaltyCard() {
  const m = me(); if (!m) return '';
  const M = todayISO().slice(0, 7), L = T('coach_penalties').filter(x => x.staff_id === m.id).sort((a, b) => (b.session_date || '').localeCompare(a.session_date || '')).slice(0, 12);
  const tot = L.filter(x => x.status === 'approved' && (x.session_date || '').startsWith(M)).reduce((n, x) => n + Number(x.amount), 0);
  const ok = T('coach_checkins').filter(k => k.staff_id === m.id && k.kind === 'in' && (k.session_date || '').startsWith(M));
  const onTime = ok.filter(k => (k.late_min ?? 0) <= 0).length;
  return `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>⏱️ Ketepatan masa bulan ini</b><span class="muted" style="font-size:13px">${ok.length ? `${onTime}/${ok.length} check in tepat masa` : 'Belum ada check in'}${tot ? ` · <b style="color:var(--bad)">penalti ${'RM' + tot}</b>` : ''}</span></div>
    ${L.length ? `<ul class="list" style="margin:10px -4px 0">${L.map(x => { const [l, b] = PS[x.status] || [x.status, 'b-muted'];
      return `<li class="list-item" style="padding:8px 4px"><div class="li-main"><div class="li-title">${PK[x.kind] || x.kind} · ${esc(x.session_date)} · ${Number(x.amount) ? 'RM' + Number(x.amount) : 'amaran'}</div><div class="li-sub">${esc(x.note || '')}${x.appeal ? `<br>Rayuan: ${esc(x.appeal)}` : ''}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end"><span class="badge ${b}">${l}</span>${['pending', 'approved'].includes(x.status) && Number(x.amount) ? `<button class="btn sm" data-action="c-appeal" data-id="${x.id}">Rayu</button>` : ''}</div></li>`; }).join('')}</ul>`
      : '<p class="muted" style="font-size:13px;margin-top:6px">Tiada rekod lewat atau tidak hadir. Teruskan! 💪</p>'}</div>`;
}
ACTIONS['c-appeal'] = id => openModal({ title: 'Rayu penalti', submit: 'Hantar rayuan', body: `<p class="muted" style="font-size:13px;margin-bottom:8px">Terangkan apa yang berlaku. Sertakan bukti kepada admin jika ada (cth. gambar MC, laporan kemalangan).</p><label class="f full">Sebab<textarea name="r" required></textarea></label>`,
  onSubmit: async d => { if (!(d.r || '').trim()) throw new Error('Tulis sebab rayuan.');
    if (S.mode === 'supabase') await rpc('coach_appeal_penalty', { p_id: id, p_text: d.r.trim() });
    Object.assign(byId('coach_penalties', id), { status: 'appealed', appeal: d.r.trim() }); toast('Rayuan dihantar kepada admin'); app.render(); } });
