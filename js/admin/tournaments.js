// Penganjuran Kejohanan: kejohanan → kategori → peserta → cabutan → keputusan.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove } from '../data.js';
import { ic, esc, F, RM, sum, num, val, badge, avatar, UI, app, toast, openModal, closeModal, confirmModal, pageHead, fmtDate, fmtShort, hm, todayISO, addDays, LABEL, $ } from '../ui.js';
import { T, byId, venueName, studentName, entryLabel, ageOf, invStatus } from './helpers.js';
import { buildDraw, nextSlot } from './bracket.js';
import { makeGroups, roundRobin, standings, GROUP_NAMES } from '../tn-core.js';
import { uploadMedia, publicUrl } from '../media.js';
import { rpc } from '../data.js';

const STATUS_ORDER = ['draft', 'open', 'closed', 'ongoing', 'completed'];
const catsOf = tid => T('tournament_categories').filter(c => c.tournament_id === tid);
const entriesOf = cid => T('tournament_entries').filter(e => e.category_id === cid);
const matchesOf = cid => T('tournament_matches').filter(m => m.category_id === cid);

VIEWS.kejohanan = param => (param ? detail(param) : list());

/* ---------------------------------------------------------------------
   SENARAI KEJOHANAN
   --------------------------------------------------------------------- */
function list() {
  const ts = T('tournaments').slice().sort((a, b) => (b.start_date || '9999').localeCompare(a.start_date || '9999'));
  return `
  ${pageHead('Kejohanan', 'Anjur kejohanan akademi: kategori, pendaftaran peserta, cabutan dan keputusan.', `<button class="btn primary" data-action="tn-add">${ic('plus', 'sm')} Kejohanan Baharu</button>`)}
  <div class="grid g-3">${ts.map(t => {
    const cats = catsOf(t.id), n = sum(cats, c => entriesOf(c.id).filter(e => e.status !== 'withdrawn').length);
    return `<a href="#kejohanan/${t.id}" class="card coach-card tn-card">
      <div class="coach-top"><div class="kpi-ico t-purple" style="display:grid;width:44px;height:44px">${ic('trophy')}</div><div style="flex:1;min-width:0"><h4>${esc(t.name)}</h4><div class="muted" style="font-size:12.5px">${t.start_date ? fmtDate(t.start_date) + (t.end_date && t.end_date !== t.start_date ? ' – ' + fmtDate(t.end_date) : '') : 'Tarikh belum ditetapkan'}</div></div></div>
      <div style="display:flex;gap:8px;align-items:center;font-size:13px">${ic('pin', 'sm')} ${esc(t.venue_id ? venueName(t.venue_id) : t.venue_note || 'Lokasi belum ditetapkan')}</div>
      <div class="stats3"><div><b>${cats.length}</b><small>Kategori</small></div><div><b>${n}</b><small>Peserta</small></div><div><b>${t.entry_fee ? RM(t.entry_fee) : 'Percuma'}</b><small>Yuran</small></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center">${badge(t.status)}${t.registration_deadline && t.status === 'open' ? `<span class="muted" style="font-size:12px">tutup ${fmtShort(t.registration_deadline)}</span>` : ''}</div>
    </a>`; }).join('') || `<div class="card empty" style="grid-column:1/-1">Belum ada kejohanan. Klik <b>Kejohanan Baharu</b> untuk bermula.</div>`}</div>`;
}

const tnForm = t => `<div class="form-grid">
  ${F('Nama kejohanan', 'name', { value: t?.name, req: true, full: true, ph: 'cth. Bukit Raja Badminton Challenge 2026' })}
  ${F('Lokasi', 'venue_id', { value: t?.venue_id || '', opts: [['', '— Lain / belum pasti —'], ...T('venues').map(v => [v.id, v.name])] })}
  ${F('Nota lokasi', 'venue_note', { value: t?.venue_note, ph: 'jika bukan lokasi akademi' })}
  ${F('Tarikh mula', 'start_date', { type: 'date', value: t?.start_date })}
  ${F('Tarikh tamat', 'end_date', { type: 'date', value: t?.end_date })}
  ${F('Masa mula', 'start_time', { type: 'time', value: hm(t?.start_time) })}
  ${F('Masa tamat', 'end_time', { type: 'time', value: hm(t?.end_time) })}
  ${F('Yuran penyertaan (RM / pemain)', 'entry_fee', { type: 'number', step: '0.01', min: 0, value: t?.entry_fee ?? 0 })}
  ${F('Status', 'status', { value: t?.status || 'draft', opts: STATUS_ORDER.map(s => [s, LABEL[s]]) })}
  ${F('Format', 'format', { value: t?.format || 'knockout', opts: [['rr_groups', 'Round robin berkumpulan + akhir round robin'], ['knockout', 'Kalah mati (knockout)']] })}
  ${F('Pemain setiap kumpulan', 'group_size', { type: 'number', min: 3, max: 8, value: t?.group_size ?? 4 })}
  ${F('Mata satu game', 'points_to', { type: 'number', min: 11, max: 31, value: t?.points_to ?? 21 })}
  <div class="full"><b style="font-size:13px">Tarikh penting</b></div>
  ${F('Akhir daftar awal (jersi percuma)', 'early_deadline', { type: 'date', value: t?.early_deadline })}
  ${F('Tutup pendaftaran', 'registration_deadline', { type: 'date', value: t?.registration_deadline })}
  ${F('Senarai peserta dikongsi', 'list_date', { type: 'date', value: t?.list_date })}
  ${F('Tempoh bantahan tamat', 'protest_end', { type: 'date', value: t?.protest_end })}
  <div class="full"><b style="font-size:13px">Halaman awam & pendaftaran online</b></div>
  <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="public_page" value="1" ${t?.public_page ? 'checked' : ''} style="width:auto;height:auto"> Terbitkan halaman awam (borang daftar, peraturan, keputusan langsung)</label>
  ${F('Pautan pendek (slug)', 'slug', { value: t?.slug, ph: 'cth. brbc2026 — huruf kecil/nombor sahaja' })}
  <label class="f">Poster (gambar)<input type="file" name="poster" accept="image/*"></label>
  ${F('Notis (banner kuning di atas halaman, cth. tukar tarikh)', 'notice', { type: 'textarea', value: t?.notice, full: true })}
  ${F('Nota kelayakan (cth. pemain negeri tidak layak)', 'eligibility_note', { type: 'textarea', value: t?.eligibility_note, full: true })}
  ${F('Nota pemarkahan', 'scoring_note', { value: t?.scoring_note, full: true, ph: 'cth. Satu game hingga 20 mata, tanpa deuce — pada 19–19, mata seterusnya menang.' })}
  ${F('Pautan kumpulan WhatsApp peserta', 'group_link', { value: t?.group_link, full: true, ph: 'https://chat.whatsapp.com/...' })}
  <label class="f">QR bayaran (DuitNow)${t?.pay_qr_path ? ' — ada' : ''}<input type="file" name="pay_qr" accept="image/*"></label>
  <label class="f">Carta saiz jersi${t?.size_chart_path ? ' — ada' : ''}<input type="file" name="size_chart" accept="image/*"></label>
  <label class="f full">Gambar jersi (depan / belakang — pilih semula untuk ganti)${(t?.jersey_images || []).length ? ` — ${t.jersey_images.length} gambar` : ''}<input type="file" name="jersey_imgs" accept="image/*" multiple></label>
  <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="shirt_free" value="1" ${t?.shirt_free ? 'checked' : ''} style="width:auto;height:auto"> Jersi percuma (jika daftar & bayar sebelum akhir daftar awal)</label>
  ${F('Saiz jersi (pisah koma)', 'shirt_sizes', { value: (t?.shirt_sizes || []).join(', '), full: true, ph: '4XS, 3XS, 2XS, XS, S, M, L, XL, 2XL, 3XL' })}
  ${F('Hadiah', 'prizes', { type: 'textarea', value: t?.prizes, full: true, ph: 'Johan: raket + pingat + sijil\nNaib johan: beg + pingat + sijil' })}
  ${F('Peraturan (satu perkara setiap baris; baris bermula "# " = tajuk bahagian)', 'rules', { type: 'textarea', value: t?.rules, full: true })}
  ${F('Arahan bayaran (bank / DuitNow)', 'pay_note', { type: 'textarea', value: t?.pay_note, full: true, ph: 'cth. Maybank 5xxxx (Maxxima Badminton Academy). Rujukan: no. pendaftaran.' })}
  ${F('WhatsApp penganjur', 'contact_phone', { value: t?.contact_phone })}
  ${F('E-mel penganjur', 'contact_email', { type: 'email', value: t?.contact_email })}
  ${F('Keterangan ringkas', 'description', { type: 'textarea', value: t?.description, full: true })}
</div>`;
const tnPatch = d => ({ name: d.name.trim(), venue_id: val(d.venue_id), venue_note: val(d.venue_note), start_date: val(d.start_date), end_date: val(d.end_date), start_time: val(d.start_time), end_time: val(d.end_time),
  registration_deadline: val(d.registration_deadline), entry_fee: num(d.entry_fee) || 0, status: d.status, description: val(d.description), format: d.format || 'knockout', group_size: num(d.group_size) || 4, points_to: num(d.points_to) || 21,
  early_deadline: val(d.early_deadline), list_date: val(d.list_date), protest_end: val(d.protest_end), public_page: d.public_page === '1', slug: val(String(d.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '')),
  shirt_free: d.shirt_free === '1', shirt_sizes: String(d.shirt_sizes || '').split(',').map(x => x.trim()).filter(Boolean), prizes: val(d.prizes), rules: val(d.rules), pay_note: val(d.pay_note), contact_phone: val(d.contact_phone), contact_email: val(d.contact_email),
  notice: val(d.notice), eligibility_note: val(d.eligibility_note), scoring_note: val(d.scoring_note), group_link: val(d.group_link) });
const withPoster = async (d, row) => {
  if (d.poster && d.poster.size) row.poster_path = await uploadMedia('public-media', 'tournament', d.poster, { maxMB: 10 });
  if (d.pay_qr && d.pay_qr.size) row.pay_qr_path = await uploadMedia('public-media', 'tournament', d.pay_qr, { maxMB: 5 });
  if (d.size_chart && d.size_chart.size) row.size_chart_path = await uploadMedia('public-media', 'tournament', d.size_chart, { maxMB: 10 });
  const js = [].concat(d.jersey_imgs || []).filter(f => f && f.size);
  if (js.length) { row.jersey_images = []; for (const f of js) row.jersey_images.push(await uploadMedia('public-media', 'tournament', f, { maxMB: 10 })); }
  return row; };
const publicLink = t => t?.slug ? location.origin + location.pathname.replace(/[^/]*$/, '') + 'tournament.html?t=' + t.slug : '';

/* ---------------------------------------------------------------------
   BUTIRAN KEJOHANAN
   --------------------------------------------------------------------- */
function detail(id) {
  const t = byId('tournaments', id);
  if (!t) return `<div class="card empty">Kejohanan tidak dijumpai. <a href="#kejohanan" style="color:var(--info)">Kembali ke senarai</a></div>`;
  const cats = catsOf(id), tab = UI.tnTab || 'ringkasan';
  if (!cats.find(c => c.id === UI.tnCat)) UI.tnCat = cats[0]?.id;
  const cat = byId('tournament_categories', UI.tnCat);
  const tabs = [['ringkasan', 'Ringkasan & Analitik'], ['kategori', 'Kategori'], ['peserta', 'Peserta & Bayaran'], ['cabutan', t.format === 'rr_groups' ? 'Kumpulan, Jadual & Keputusan' : 'Cabutan & Keputusan']];
  const catPicker = cats.length ? `<label class="field" style="max-width:340px">${ic('list', 'sm') || ''}<select data-on-change="tn-cat">${cats.map(c => `<option value="${c.id}" ${c.id === UI.tnCat ? 'selected' : ''}>${esc(c.name)} (${entriesOf(c.id).filter(e => e.status !== 'withdrawn').length})</option>`).join('')}</select></label>` : '';

  return `
  <a href="#kejohanan" class="btn sm ghost" style="margin-bottom:10px">${ic('back', 'sm')} Semua kejohanan</a>
  <div class="card card-pad mb">
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      ${t.poster_path ? `<img src="${publicUrl(t.poster_path)}" alt="" style="width:84px;border-radius:10px">` : `<div class="kpi-ico t-purple" style="display:grid;width:52px;height:52px">${ic('trophy')}</div>`}
      <div style="flex:1;min-width:220px"><h1 style="font-size:21px;font-weight:800;letter-spacing:-.02em">${esc(t.name)}</h1>
        <div class="muted" style="margin-top:2px">${t.start_date ? fmtDate(t.start_date) + (t.end_date && t.end_date !== t.start_date ? ' – ' + fmtDate(t.end_date) : '') : 'Tarikh belum ditetapkan'} · ${esc(t.venue_id ? venueName(t.venue_id) : t.venue_note || 'lokasi belum ditetapkan')}</div>
        <div class="muted" style="font-size:12.5px;margin-top:2px">Yuran penyertaan: <b style="color:var(--ink)">${t.entry_fee ? RM(t.entry_fee) : 'Percuma'}</b>${t.registration_deadline ? ' · tutup pendaftaran ' + fmtDate(t.registration_deadline) : ''}</div>
        ${t.description ? `<p style="margin-top:8px;font-size:13px">${esc(t.description)}</p>` : ''}</div>
      <div class="actions"><label class="field"><select data-on-change="tn-status">${STATUS_ORDER.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${LABEL[s]}</option>`).join('')}</select></label>
        <button class="btn" data-action="tn-edit" data-id="${id}">${ic('edit', 'sm')} Edit</button></div>
    </div>
  </div>
  <div class="chips">${tabs.map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-action="tn-tab" data-id="${k}">${l}</button>`).join('')}</div>
  ${tab === 'ringkasan' ? tabSummary(t, cats) : tab === 'kategori' ? tabCategories(t, cats) : !cats.length ? `<div class="card empty">Tambah kategori dahulu di tab <b>Kategori</b>.</div>` : `<div style="margin-bottom:12px">${catPicker}</div>` + (tab === 'peserta' ? tabEntries(t, cat) : t.format === 'rr_groups' ? tabRR(t, cat) : tabDraw(t, cat))}`;
}

function tabCategories(t, cats) {
  return `<div class="card"><div class="card-head"><h3>Kategori Pertandingan</h3><button class="btn sm primary" data-action="cat-add" data-id="${t.id}">${ic('plus', 'sm')} Tambah Kategori</button></div>
  <div class="table-wrap"><table><thead><tr><th>Kategori</th><th>Jenis</th><th>Jantina</th><th>Umur</th><th>Peserta</th><th></th></tr></thead>
  <tbody>${cats.map(c => { const n = entriesOf(c.id).filter(e => e.status !== 'withdrawn').length; return `<tr><td><b>${esc(c.name)}</b></td><td>${LABEL[c.kind]}</td><td>${LABEL[c.gender]}</td><td>${esc(c.age_group || '—')}${c.birth_from || c.birth_to ? `<br><span class="muted" style="font-size:11.5px">lahir ${c.birth_from || '…'}–${c.birth_to || '…'}</span>` : ''}</td><td class="num">${n}${c.max_entries ? ' / ' + c.max_entries : ''}</td><td style="white-space:nowrap"><button class="btn sm" data-action="cat-edit" data-id="${c.id}">${ic('edit', 'sm')}</button></td></tr>`; }).join('') || `<tr><td colspan="6" class="empty">Belum ada kategori. Contoh: <i>Perseorangan Lelaki B12</i>, <i>Beregu Perempuan B14</i>.</td></tr>`}</tbody></table></div></div>`;
}

const PAY = { unpaid: ['Belum bayar', 'b-bad'], pending: ['Bukti diterima', 'b-warn'], paid: ['Dibayar', 'b-ok'], waived: ['Percuma', 'b-muted'], refunded: ['Dipulangkan', 'b-muted'] };
function tabEntries(t, cat) {
  const q = (UI.tnQ || '').toLowerCase(), pf = UI.tnPay || '';
  const es = entriesOf(cat.id).filter(e => (!q || (entryLabel(e) + ' ' + (e.ref_code || '') + ' ' + (e.club || '') + ' ' + (e.guardian_phone || '')).toLowerCase().includes(q)) && (!pf || e.pay_status === pf))
    .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || entryLabel(a).localeCompare(entryLabel(b)));
  const locked = matchesOf(cat.id).length > 0, live = entriesOf(cat.id).filter(e => e.status !== 'withdrawn').length;
  return `<div class="card"><div class="card-head" style="flex-wrap:wrap;gap:8px"><div><h3>Peserta — ${esc(cat.name)} <span class="muted">(${live}${cat.max_entries ? '/' + cat.max_entries : ''})</span></h3><div class="sub">${locked ? 'Kumpulan/cabutan sudah dijana. Reset untuk menukar peserta.' : 'Sahkan bayaran — peserta disahkan automatik bila dibayar.'}</div></div>
    <div class="actions"><button class="btn sm" data-action="tn-export" data-id="${t.id}">${ic('file', 'sm')} Eksport CSV (semua)</button><button class="btn sm" data-action="tn-cert" data-id="${cat.id}">${ic('award', 'sm')} Sijil kategori ini</button><button class="btn sm primary" data-action="ent-add" data-id="${cat.id}">${ic('plus', 'sm')} Tambah pelajar akademi</button></div></div>
  <div class="filters" style="padding:0 16px 10px"><label class="field grow">${ic('search', 'sm')}<input placeholder="Cari nama / no. rujukan / kelab / telefon" value="${esc(UI.tnQ || '')}" data-on-change="tn-q"></label>
    <label class="field"><select data-on-change="tn-pay"><option value="">Semua bayaran</option>${Object.entries(PAY).map(([k, [l]]) => `<option value="${k}" ${pf === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <div class="table-wrap"><table><thead><tr><th>Pemain</th><th>Penjaga</th><th>Seed</th><th>Status</th><th>Bayaran</th><th></th></tr></thead>
  <tbody>${es.map(e => { const inv = byId('invoices', e.invoice_id), s = byId('students', e.student_id), [pl, pt] = PAY[e.pay_status] || PAY.unpaid; return `<tr>
    <td><div class="cell-person">${avatar(entryLabel(e))}<div><b>${esc(entryLabel(e))}</b><span>${e.birth_year ? 'Lahir ' + e.birth_year : s?.birth_date ? ageOf(s.birth_date) + ' thn' : ''}${e.club ? ' · ' + esc(e.club) : s ? ' · pelajar akademi' : ''}${e.shirt_size ? ' · jersi ' + esc(e.shirt_size) + (e.jersey_eligible ? ' 🎁' : '') : ''}${e.ic_masked ? ' · IC ' + esc(e.ic_masked.slice(-4)) : ''}</span>${e.notes ? `<span style="font-size:11px;color:var(--warn)">${esc(e.notes)}</span>` : ''}${e.ref_code ? `<span style="font-size:11px">${esc(e.ref_code)} · ${fmtShort((e.created_at || '').slice(0, 10))}</span>` : ''}</div></div></td>
    <td style="font-size:12.5px">${esc(e.guardian_name || s?.guardian_name || '')}${e.guardian_phone || s?.guardian_phone ? `<br><a target="_blank" rel="noopener" href="https://wa.me/${String(e.guardian_phone || s?.guardian_phone).replace(/\D/g, '').replace(/^0/, '60')}">${esc(e.guardian_phone || s?.guardian_phone)}</a>` : ''}${e.guardian_email ? '<br>' + esc(e.guardian_email) : ''}</td>
    <td><input class="seed-in" type="number" min="1" value="${e.seed ?? ''}" placeholder="—" data-on-change="ent-seed" data-key="${e.id}" ${locked ? 'disabled' : ''}></td>
    <td><select class="att-select" data-on-change="ent-status" data-key="${e.id}">${['registered', 'confirmed', 'withdrawn'].map(x => `<option value="${x}" ${e.status === x ? 'selected' : ''}>${LABEL[x]}</option>`).join('')}</select></td>
    <td>${e.student_id && inv ? badge(invStatus(inv)) : `<span class="badge ${pt}">${pl}</span>${e.amount ? ' <span class="muted" style="font-size:12px">' + RM(e.amount) + '</span>' : ''}`}
      ${e.proof_path ? `<br><button class="btn sm" data-action="ent-proof" data-id="${e.id}">Bukti</button>` : ''}${!e.student_id && !['paid', 'waived'].includes(e.pay_status) ? ` <button class="btn sm primary" data-action="ent-paid" data-id="${e.id}">Sahkan bayaran</button>` : ''}
      ${e.student_id && !inv && (cat.fee ?? t.entry_fee) > 0 ? `<button class="btn sm" data-action="ent-invoice" data-id="${e.id}">Keluarkan invois</button>` : ''}</td>
    <td><button class="btn sm" data-action="ent-del" data-id="${e.id}" ${locked ? 'disabled' : ''} title="Buang">${ic('trash', 'sm')}</button></td></tr>`; }).join('') || `<tr><td colspan="6" class="empty">Tiada peserta.</td></tr>`}</tbody></table></div></div>`;
}

/* ---- Ringkasan: kiraan, kutipan, isian kategori, analitik halaman awam ---- */
function tabSummary(t, cats) {
  const all = cats.flatMap(c => entriesOf(c.id)).filter(e => e.status !== 'withdrawn'), paid = all.filter(e => e.pay_status === 'paid' || (e.student_id && byId('invoices', e.invoice_id)?.status === 'paid'));
  const st = T('tournament_stats').filter(x => x.tournament_id === t.id), sumK = k => st.filter(x => x.kind === k).reduce((n, x) => n + Number(x.n), 0);
  const days = [...new Set(st.map(x => x.day))].sort().slice(-21), maxV = Math.max(1, ...days.map(d => st.filter(x => x.day === d && x.kind === 'view').reduce((n, x) => n + Number(x.n), 0)));
  const views = sumK('view'), clicks = sumK('register_click'), subs = sumK('submit'), link = publicLink(t);
  const sizes = {}; all.forEach(e => { if (e.shirt_size) sizes[e.shirt_size] = (sizes[e.shirt_size] || 0) + 1; });
  return `<div class="kv-mini mb"><div><b>${all.length}</b><small>Peserta aktif</small></div><div><b>${paid.length}</b><small>Sudah bayar</small></div><div><b>${all.filter(e => e.pay_status === 'pending').length}</b><small>Bukti menunggu semakan</small></div>
    <div><b>${RM(paid.reduce((n, e) => n + Number(e.amount || t.entry_fee || 0), 0))}</b><small>Kutipan disahkan</small></div><div><b>${RM(all.filter(e => e.pay_status === 'unpaid').reduce((n, e) => n + Number(e.amount || t.entry_fee || 0), 0))}</b><small>Belum bayar</small></div></div>
  <div class="card card-pad mb"><h3 style="font-size:14.5px;margin-bottom:8px">Halaman awam</h3>${t.public_page && link ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><code style="font-size:12.5px;word-break:break-all">${esc(link)}</code><button class="btn sm" data-action="copy-text" data-id="${esc(link)}">Salin</button><a class="btn sm" target="_blank" rel="noopener" href="${esc(link)}">Buka</a><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(t.name + ' — daftar di sini: ' + link)}">${ic('msg', 'sm')} Kongsi WhatsApp</a></div>
    <img alt="QR" style="width:120px;margin-top:10px;border-radius:8px;background:#fff;padding:6px" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}">` : '<p class="muted" style="font-size:13px">Belum diterbitkan. Edit kejohanan → tanda "Terbitkan halaman awam" dan isi pautan pendek (slug).</p>'}</div>
  <div class="grid g-2"><div class="card card-pad mb"><h3 style="font-size:14.5px">Analitik laman (tanpa data peribadi)</h3>
    <div class="kv-mini" style="margin-top:10px"><div><b>${views}</b><small>Lawatan</small></div><div><b>${clicks}</b><small>Klik "Daftar"</small></div><div><b>${subs}</b><small>Pendaftaran online</small></div><div><b>${views ? Math.round(subs / views * 1000) / 10 : 0}%</b><small>Kadar penukaran</small></div></div>
    ${days.length ? `<div class="bars" style="margin-top:14px">${days.map(d => { const v = st.filter(x => x.day === d && x.kind === 'view').reduce((n, x) => n + Number(x.n), 0); return `<div style="height:${Math.round(v / maxV * 100)}%" title="${d}: ${v} lawatan"><span>${d.slice(8)}</span></div>`; }).join('')}</div><p class="muted" style="font-size:11.5px;margin-top:18px">Lawatan harian (21 hari terakhir)</p>` : '<p class="muted" style="font-size:12.5px;margin-top:10px">Belum ada data lawatan.</p>'}</div>
    <div class="card card-pad mb"><h3 style="font-size:14.5px">Isian kategori</h3>${cats.map(c => { const n = entriesOf(c.id).filter(e => e.status !== 'withdrawn').length, mx = c.max_entries || Math.max(n, 1); return `<div style="margin-top:10px;font-size:13px"><div style="display:flex;justify-content:space-between"><span>${esc(c.name)}</span><b>${n}${c.max_entries ? '/' + c.max_entries : ''}</b></div><div class="bar"><span style="width:${Math.min(100, n / mx * 100)}%;background:${n >= mx ? 'var(--bad)' : 'var(--ok)'}"></span></div></div>`; }).join('') || '<p class="muted">Belum ada kategori.</p>'}
    ${Object.keys(sizes).length ? `<h3 style="font-size:14px;margin-top:16px">Saiz jersi</h3><p style="font-size:13px">${Object.entries(sizes).map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join(' · ')}</p>` : ''}</div></div>`;
}

/* ---- Round robin berkumpulan ---- */
function tabRR(t, cat) {
  const ms = matchesOf(cat.id), live = entriesOf(cat.id).filter(e => e.status !== 'withdrawn'), E = id => byId('tournament_entries', id);
  if (!ms.length) return `<div class="card empty"><div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">Kumpulan belum dicabut</div>${live.length} peserta aktif · ${Math.max(1, Math.ceil(live.length / (t.group_size || 4)))} kumpulan × ${t.group_size || 4} pemain. Cabutan rawak direkod (kod cabutan + masa) untuk audit. Peserta ber-seed diagih ke kumpulan berbeza.<div style="margin-top:14px"><button class="btn primary" data-action="rr-draw" data-id="${cat.id}" ${live.length < 2 ? 'disabled' : ''}>${ic('shuttle', 'sm')} Cabut kumpulan & jana jadual</button></div></div>`;
  const groups = [...new Set(ms.filter(m => m.stage === 'group').map(m => m.group_no))].sort((a, b) => a - b), fin = ms.filter(m => m.stage === 'final');
  const mrow = m => `<tr><td>${m.round_no}</td><td style="text-align:left">${esc(entryLabel(E(m.entry_a)))}${m.winner === m.entry_a ? ' 🏆' : ''}</td><td><b>${m.status !== 'pending' ? `${m.score_a ?? '-'} – ${m.score_b ?? '-'}${m.status === 'walkover' ? ' (WO)' : ''}` : '—'}</b></td><td style="text-align:left">${esc(entryLabel(E(m.entry_b)))}${m.winner === m.entry_b ? ' 🏆' : ''}</td><td style="font-size:12px">${m.court ? 'C' + esc(m.court) : ''}${m.play_time ? ' ' + hm(m.play_time) : ''}</td><td><button class="btn sm" data-action="rr-score" data-id="${m.id}">${m.status === 'pending' ? 'Skor' : ic('edit', 'sm')}</button></td></tr>`;
  const table = (title, ids, list) => { const stn = standings(ids, list); return `<div class="card mb"><div class="card-head"><h3>${title}</h3><span class="muted" style="font-size:12px">${list.filter(m => m.status !== 'pending').length}/${list.length} selesai</span></div>
    <div class="table-wrap"><table class="rr-table"><thead><tr><th>Pemain</th><th>Main</th><th>M</th><th>K</th><th>+/-</th></tr></thead><tbody>${stn.map((r, i) => `<tr><td>${i + 1}. ${esc(entryLabel(E(r.id)))}</td><td>${r.p}</td><td><b>${r.w}</b></td><td>${r.l}</td><td>${r.pf - r.pa > 0 ? '+' : ''}${r.pf - r.pa}</td></tr>`).join('')}</tbody></table></div>
    <div class="table-wrap"><table class="rr-table"><thead><tr><th>Pus.</th><th>Pemain A</th><th>Skor</th><th>Pemain B</th><th>Court</th><th></th></tr></thead><tbody>${list.sort((a, b) => a.round_no - b.round_no || a.match_no - b.match_no).map(mrow).join('')}</tbody></table></div></div>`; };
  const groupIds = g => [...new Set(ms.filter(m => m.stage === 'group' && m.group_no === g).flatMap(m => [m.entry_a, m.entry_b]))];
  const allGroupDone = ms.filter(m => m.stage === 'group').every(m => m.status !== 'pending');
  const finIds = [...new Set(fin.flatMap(m => [m.entry_a, m.entry_b]))];
  const champ = fin.length && fin.every(m => m.status !== 'pending') ? standings(finIds, fin) : null;
  return `${champ ? `<div class="champ">${ic('trophy')}<div><small>Keputusan akhir — ${esc(cat.name)}</small><b>${champ.slice(0, 4).map((r, i) => ['🥇', '🥈', '🥉', '4️⃣'][i] + ' ' + esc(entryLabel(E(r.id)))).join(' &nbsp; ')}</b></div></div>` : ''}
  <div class="actions" style="margin-bottom:12px;flex-wrap:wrap">${!fin.length && groups.length > 1 ? `<button class="btn sm primary" data-action="rr-final" data-id="${cat.id}" ${allGroupDone ? '' : 'disabled title="Selesaikan semua perlawanan kumpulan dahulu"'}>Jana pusingan akhir (pemenang kumpulan)</button>` : ''}
    <button class="btn sm" data-action="rr-log" data-id="${cat.id}">Log cabutan</button><button class="btn sm danger-o" data-action="draw-reset" data-id="${cat.id}">Reset kumpulan & jadual</button></div>
  ${fin.length ? table('Pusingan Akhir (round robin)', finIds, fin) : ''}
  <div class="grid g-2">${groups.map(g => `<div>${table('Kumpulan ' + GROUP_NAMES[g - 1], groupIds(g), ms.filter(m => m.stage === 'group' && m.group_no === g))}</div>`).join('')}</div>
  <p class="muted" style="font-size:12.5px">Kedudukan: bilangan menang → keputusan bersemuka (jika 2 pemain seri) → beza mata → mata dijaringkan. Satu game hingga ${t.points_to || 21} mata.</p>`;
}

function tabDraw(t, cat) {
  const ms = matchesOf(cat.id), live = entriesOf(cat.id).filter(e => e.status !== 'withdrawn');
  if (!ms.length) return `<div class="card empty"><div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">Cabutan belum dijana</div>${live.length} peserta aktif dalam kategori ini. Peserta ber-seed diletakkan mengikut kedudukan piawai; selebihnya dicabut secara rawak. Bye diberikan kepada seed teratas.<br><button class="btn primary" style="margin-top:14px" data-action="draw-make" data-id="${cat.id}" ${live.length < 2 ? 'disabled' : ''}>${ic('shuttle', 'sm')} Jana Cabutan (${live.length} peserta)</button>${live.length < 2 ? '<div class="hint warn" style="margin-top:10px">Perlu sekurang-kurangnya 2 peserta.</div>' : ''}</div>`;
  const final = ms.reduce((a, m) => (m.round_no > a.round_no ? m : a), ms[0]);
  const champ = final.status !== 'pending' && final.winner ? byId('tournament_entries', final.winner) : null;
  const rounds = [...new Set(ms.map(m => m.round_no))].sort((a, b) => a - b);
  const side = (m, slot) => {
    const e = byId('tournament_entries', m[slot]), won = m.winner && m.winner === m[slot];
    const label = e ? entryLabel(e) : (m.round_no === 1 ? 'Bye' : 'Menunggu pemenang');
    return `<div class="b-side ${won ? 'won' : ''} ${e ? '' : 'empty'}"><span>${esc(label)}</span>${e && e.seed ? `<em>#${e.seed}</em>` : ''}</div>`;
  };
  return `
  ${champ ? `<div class="champ">${ic('trophy')}<div><small>Johan — ${esc(cat.name)}</small><b>${esc(entryLabel(champ))}</b></div></div>` : ''}
  <div class="actions" style="margin-bottom:12px"><button class="btn sm" data-action="draw-reset" data-id="${cat.id}">Reset cabutan</button></div>
  <div class="bracket">${rounds.map(r => { const rm = ms.filter(m => m.round_no === r).sort((a, b) => a.match_no - b.match_no); return `<div class="b-round"><div class="b-title">${esc(rm[0].round_label)}</div>${rm.map(m => {
    const ready = m.entry_a && m.entry_b, auto = m.status === 'walkover' && (!m.entry_a || !m.entry_b);
    return `<${ready && !auto ? 'button' : 'div'} class="b-match ${m.status !== 'pending' ? 'done' : ''}" ${ready && !auto ? `data-action="match-edit" data-id="${m.id}"` : ''}>
      <div class="b-meta">#${m.match_no}${m.court ? ' · ' + esc(m.court) : ''}${m.play_date ? ' · ' + fmtShort(m.play_date) : ''}${m.play_time ? ' ' + hm(m.play_time) : ''}</div>
      ${side(m, 'entry_a')}${side(m, 'entry_b')}
      ${m.score_text ? `<div class="b-score">${esc(m.score_text)}</div>` : ''}${m.status === 'walkover' && ready ? '<div class="b-score">Walkover</div>' : ''}
    </${ready && !auto ? 'button' : 'div'}>`; }).join('')}</div>`; }).join('')}</div>
  <p class="muted" style="font-size:12.5px;margin-top:8px">Klik perlawanan untuk merekod keputusan atau menetapkan gelanggang & masa. Pemenang naik ke pusingan seterusnya secara automatik.</p>`;
}

/* ---------------------------------------------------------------------
   TINDAKAN
   --------------------------------------------------------------------- */
const nextOf = m => { const nx = nextSlot(m); return matchesOf(m.category_id).find(x => x.round_no === nx.round_no && x.match_no === nx.match_no); };

Object.assign(INPUTS, {
  'tn-cat': v => { UI.tnCat = v; app.render(); },
  'tn-status': async v => { const id = location.hash.split('/')[1]; await update('tournaments', id, { status: v }); toast(`Status: ${LABEL[v]}`); app.render(); },
  'ent-seed': async (v, el) => { await update('tournament_entries', el.dataset.key, { seed: v === '' ? null : Number(v) }); app.render(); },
  'ent-status': async (v, el) => { await update('tournament_entries', el.dataset.key, { status: v }); app.render(); },
  'tn-q': v => { UI.tnQ = v; app.render(); },
  'tn-pay': v => { UI.tnPay = v; app.render(); },
});

Object.assign(ACTIONS, {
  'tn-tab': id => { UI.tnTab = id; app.render(); },
  'tn-add': () => openModal({ title: 'Kejohanan Baharu', submit: 'Cipta Kejohanan', wide: true, body: tnForm(), onSubmit: async d => { const r = await insert('tournaments', await withPoster(d, tnPatch(d))); toast('Kejohanan dicipta'); UI.tnTab = 'kategori'; location.hash = 'kejohanan/' + r.id; app.render(); } }),
  'tn-edit': id => openModal({
    title: 'Edit Kejohanan', wide: true, body: tnForm(byId('tournaments', id)) + `<div style="margin-top:14px"><button type="button" class="btn sm danger-o" data-action="tn-del" data-id="${id}">${ic('trash', 'sm')} Padam kejohanan</button></div>`,
    onSubmit: async d => { await update('tournaments', id, await withPoster(d, tnPatch(d))); toast('Kejohanan dikemas kini'); app.render(); },
  }),
  'tn-del': id => confirmModal({ title: 'Padam kejohanan?', message: 'Semua kategori, peserta dan cabutan akan dipadam kekal.', ok: 'Padam Kekal', danger: true, onOk: async () => { await remove('tournaments', id); toast('Kejohanan dipadam'); location.hash = 'kejohanan'; app.render(); } }),

  /* Kategori */
  'cat-add': tid => openModal({ title: 'Tambah Kategori', submit: 'Tambah', body: catForm(), onSubmit: async d => { const r = await insert('tournament_categories', { tournament_id: tid, ...catPatch(d) }); UI.tnCat = r.id; toast('Kategori ditambah'); app.render(); } }),
  'cat-edit': id => openModal({
    title: 'Edit Kategori', body: catForm(byId('tournament_categories', id)) + `<div style="margin-top:14px"><button type="button" class="btn sm danger-o" data-action="cat-del" data-id="${id}">${ic('trash', 'sm')} Padam kategori</button></div>`,
    onSubmit: async d => { await update('tournament_categories', id, catPatch(d)); toast('Kategori dikemas kini'); app.render(); },
  }),
  'cat-del': id => confirmModal({ title: 'Padam kategori?', message: 'Peserta dan cabutan kategori ini akan dipadam.', ok: 'Padam', danger: true, onOk: async () => { await remove('tournament_categories', id); toast('Kategori dipadam'); app.render(); } }),

  /* Peserta */
  'ent-add': cid => {
    const cat = byId('tournament_categories', cid), t = byId('tournaments', cat.tournament_id), taken = new Set(entriesOf(cid).flatMap(e => [e.student_id, e.partner_id]));
    const studs = T('students').filter(s => s.status === 'active' && !taken.has(s.id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
    const opt = (blank) => [['', blank], ...studs.map(s => [s.id, `${s.full_name}${s.birth_date ? ' (' + ageOf(s.birth_date) + ' thn)' : ''}`])];
    openModal({
      title: `Tambah Peserta — ${esc(cat.name)}`, submit: 'Tambah Peserta',
      body: `<div class="form-grid">
        ${F(cat.kind === 'doubles' ? 'Pemain 1' : 'Pelajar', 'student_id', { req: true, opts: opt('— Pilih pelajar —'), full: cat.kind !== 'doubles' })}
        ${cat.kind === 'doubles' ? F('Pemain 2 (pasangan)', 'partner_id', { req: true, opts: opt('— Pilih pasangan —') }) : ''}
        ${F('Status', 'status', { value: 'registered', opts: [['registered', 'Berdaftar'], ['confirmed', 'Disahkan']], full: true })}
        ${t.entry_fee > 0 ? `<label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="invoice" value="1" checked style="width:auto;height:auto"> Keluarkan invois yuran penyertaan (${RM(t.entry_fee)})</label>` : ''}
      </div><p class="muted" style="font-size:12.5px;margin-top:10px">Kategori: ${LABEL[cat.gender]}${cat.age_group ? ' · ' + esc(cat.age_group) : ''}. Pastikan pelajar layak mengikut umur/jantina.</p>`,
      onSubmit: async d => {
        if (cat.kind === 'doubles' && d.student_id === d.partner_id) throw new Error('Pemain 1 dan pasangan mesti berbeza.');
        const e = await insert('tournament_entries', { category_id: cid, student_id: d.student_id, partner_id: val(d.partner_id), status: d.status });
        if (d.invoice === '1') await issueEntryInvoice(e, t, cat);
        toast('Peserta ditambah'); app.render();
      },
    });
  },
  'ent-invoice': async eid => { const e = byId('tournament_entries', eid), cat = byId('tournament_categories', e.category_id); await issueEntryInvoice(e, byId('tournaments', cat.tournament_id), cat); toast('Invois dikeluarkan'); app.render(); },
  'ent-del': id => confirmModal({ title: 'Buang peserta?', message: `Buang <b>${esc(entryLabel(byId('tournament_entries', id)))}</b> daripada kategori ini?`, ok: 'Buang', danger: true, onOk: async () => { await remove('tournament_entries', id); toast('Peserta dibuang'); app.render(); } }),

  /* Cabutan */
  'draw-make': async cid => {
    const live = entriesOf(cid).filter(e => e.status !== 'withdrawn');
    const rows = buildDraw(live.map(e => ({ id: e.id, seed: e.seed })));
    await insert('tournament_matches', rows.map(m => ({ ...m, category_id: cid })));
    const t = byId('tournaments', byId('tournament_categories', cid).tournament_id);
    if (['draft', 'open', 'closed'].includes(t.status)) await update('tournaments', t.id, { status: 'ongoing' });
    toast('Cabutan dijana'); app.render();
  },
  'draw-reset': cid => confirmModal({ title: 'Reset cabutan?', message: 'Semua perlawanan dan keputusan dalam kategori ini akan dipadam supaya cabutan boleh dijana semula.', ok: 'Reset Cabutan', danger: true, onOk: async () => { for (const m of matchesOf(cid)) await remove('tournament_matches', m.id); for (const e of entriesOf(cid).filter(e => e.group_no)) await update('tournament_entries', e.id, { group_no: null }); toast('Cabutan direset'); app.render(); } }),

  'ent-paid': id => { const e = byId('tournament_entries', id); confirmModal({ title: 'Sahkan bayaran?', message: `${esc(entryLabel(e))} · ${RM(e.amount || 0)}${e.ref_code ? ' · ' + esc(e.ref_code) : ''}`, ok: 'Sahkan dibayar', onOk: async () => { await update('tournament_entries', id, { pay_status: 'paid', paid_at: new Date().toISOString(), status: e.status === 'withdrawn' ? e.status : 'confirmed' }); toast('Bayaran disahkan'); app.render(); } }); },
  'ent-proof': async id => { const e = byId('tournament_entries', id); if (S.mode !== 'supabase') return toast('Demo: tiada fail'); const { data, error } = await S.client.storage.from('payment-proofs').createSignedUrl(e.proof_path, 300); if (error) return toast(error.message, true); window.open(data.signedUrl, '_blank', 'noopener'); },
  'tn-export': tid => {
    const t = byId('tournaments', tid), rows = [['Kategori', 'No. rujukan', 'Pemain', 'Tahun lahir', 'Jantina', 'Kelab/sekolah', 'Penjaga', 'Telefon', 'E-mel', 'Jersi', 'Layak jersi percuma', 'IC (4 digit akhir)', 'Status', 'Bayaran', 'Amaun', 'Tarikh bayar', 'Kumpulan', 'Tarikh daftar', 'Catatan']];
    catsOf(tid).forEach(c => entriesOf(c.id).forEach(e => { const s = byId('students', e.student_id); rows.push([c.name, e.ref_code || '', entryLabel(e), e.birth_year || (s?.birth_date || '').slice(0, 4), e.gender || s?.gender || '', e.club || (s ? 'Maxxima' : ''), e.guardian_name || s?.guardian_name || '', e.guardian_phone || s?.guardian_phone || '', e.guardian_email || '', e.shirt_size || '', e.jersey_eligible ? 'Ya' : 'Tidak', e.ic_masked || '', e.status, e.pay_status, e.amount ?? '', (e.paid_at || '').slice(0, 10), e.group_no ? GROUP_NAMES[e.group_no - 1] : '', (e.created_at || '').slice(0, 10), e.notes || '']); }));
    const csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `${(t.slug || t.name).replace(/\W+/g, '_')}_peserta.csv` }); a.click();
  },
  'rr-draw': async cid => {
    const cat = byId('tournament_categories', cid), t = byId('tournaments', cat.tournament_id), live = entriesOf(cid).filter(e => e.status !== 'withdrawn');
    const seedText = `${cat.id}|${new Date().toISOString()}|${Math.random().toString(36).slice(2, 10)}`, groups = makeGroups(live.map(e => ({ id: e.id, seed: e.seed })), t.group_size || 4, seedText);
    const rows = []; groups.forEach((ids, gi) => roundRobin(ids).forEach(m => rows.push({ ...m, category_id: cid, stage: 'group', group_no: gi + 1, round_label: 'Kumpulan ' + GROUP_NAMES[gi], status: 'pending' })));
    for (const [gi, ids] of groups.entries()) for (const id of ids) await update('tournament_entries', id, { group_no: gi + 1 });
    await insert('tournament_matches', rows);
    await insert('tournament_draw_log', { category_id: cid, seed_text: seedText, groups: groups.map((ids, i) => ({ group: GROUP_NAMES[i], players: ids.map(id => entryLabel(byId('tournament_entries', id))) })), created_by: S.mode === 'demo' ? null : S.profile.id });
    if (['draft', 'open', 'closed'].includes(t.status)) await update('tournaments', t.id, { status: 'ongoing' });
    toast(`${groups.length} kumpulan · ${rows.length} perlawanan dijana`); app.render();
  },
  'rr-log': cid => { const L = T('tournament_draw_log').filter(x => x.category_id === cid).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    openModal({ title: 'Log cabutan', cancel: 'Tutup', body: L.map(x => `<div class="card card-pad mb"><b>${fmtShort((x.created_at || '').slice(0, 10))} ${(x.created_at || '').slice(11, 16)}</b><div class="muted" style="font-size:11.5px;word-break:break-all">Kod cabutan: ${esc(x.seed_text)}</div>${(x.groups || []).map(g => `<div style="font-size:13px;margin-top:4px"><b>${g.group}:</b> ${g.players.map(esc).join(', ')}</div>`).join('')}</div>`).join('') || '<div class="empty">Tiada log.</div>' }); },
  'rr-final': async cid => {
    const ms = matchesOf(cid).filter(m => m.stage === 'group'), groups = [...new Set(ms.map(m => m.group_no))].sort((a, b) => a - b);
    const winners = groups.map(g => { const list = ms.filter(m => m.group_no === g); return standings([...new Set(list.flatMap(m => [m.entry_a, m.entry_b]))], list)[0]?.id; }).filter(Boolean);
    await insert('tournament_matches', roundRobin(winners).map(m => ({ ...m, category_id: cid, stage: 'final', group_no: 0, round_label: 'Akhir', status: 'pending' })));
    toast('Pusingan akhir dijana'); app.render();
  },
  'rr-score': id => {
    const m = byId('tournament_matches', id), a = byId('tournament_entries', m.entry_a), b = byId('tournament_entries', m.entry_b), t = byId('tournaments', byId('tournament_categories', m.category_id).tournament_id);
    openModal({ title: `${esc(m.round_label || '')} · Pusingan ${m.round_no}`, submit: 'Simpan', body: `<div class="vs"><div>${esc(entryLabel(a))}</div><span>lwn</span><div>${esc(entryLabel(b))}</div></div>
      <div class="form-grid" style="margin-top:14px">${F('Mata ' + esc(entryLabel(a)), 'sa', { type: 'number', min: 0, max: 40, value: m.score_a ?? '' })}${F('Mata ' + esc(entryLabel(b)), 'sb', { type: 'number', min: 0, max: 40, value: m.score_b ?? '' })}
        ${F('Walkover — pemenang', 'wo', { value: m.status === 'walkover' ? m.winner : '', opts: [['', 'Tiada (main biasa)'], [a.id, entryLabel(a)], [b.id, entryLabel(b)]], full: true })}
        ${F('Court', 'court', { value: m.court })}${F('Masa', 'play_time', { type: 'time', value: hm(m.play_time) })}
        <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="clear" value="1" style="width:auto;height:auto"> Kosongkan keputusan</label></div>
      <p class="muted" style="font-size:12px;margin-top:8px">Satu game hingga ${t.points_to || 21} mata.</p>`,
      onSubmit: async d => {
        let patch = { court: val(d.court), play_time: val(d.play_time) };
        if (d.clear === '1') patch = { ...patch, score_a: null, score_b: null, winner: null, status: 'pending' };
        else if (d.wo) patch = { ...patch, winner: d.wo, status: 'walkover', score_a: null, score_b: null };
        else if (d.sa !== '' && d.sb !== '') { const sa = Number(d.sa), sb = Number(d.sb); if (sa === sb) throw new Error('Skor tidak boleh seri.'); patch = { ...patch, score_a: sa, score_b: sb, winner: sa > sb ? a.id : b.id, status: 'done', score_text: `${sa}-${sb}` }; }
        await update('tournament_matches', id, patch); toast('Disimpan'); app.render();
      } });
  },
  'match-edit': id => {
    const m = byId('tournament_matches', id), a = byId('tournament_entries', m.entry_a), b = byId('tournament_entries', m.entry_b);
    openModal({
      title: `${esc(m.round_label)} · Perlawanan #${m.match_no}`, submit: 'Simpan',
      body: `<div class="vs"><div>${esc(entryLabel(a))}</div><span>lwn</span><div>${esc(entryLabel(b))}</div></div>
      <div class="form-grid" style="margin-top:14px">
        ${F('Pemenang', 'winner', { value: m.winner || '', opts: [['', '— Belum bermain —'], [a.id, entryLabel(a)], [b.id, entryLabel(b)]], full: true })}
        ${F('Skor', 'score_text', { value: m.score_text, ph: 'cth. 21-15, 18-21, 21-19', full: true })}
        <label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="wo" value="1" ${m.status === 'walkover' ? 'checked' : ''} style="width:auto;height:auto"> Walkover (menang tanpa bertanding)</label>
        ${F('Gelanggang', 'court', { value: m.court })}
        ${F('Tarikh', 'play_date', { type: 'date', value: m.play_date })}
        ${F('Masa', 'play_time', { type: 'time', value: hm(m.play_time) })}
      </div>`,
      onSubmit: async d => {
        const winner = val(d.winner), prev = m.winner || null, nxt = nextOf(m), slot = nextSlot(m).slot;   // simpan nilai lama sebelum cache dikemas kini
        if (winner !== prev && nxt && nxt.status !== 'pending') throw new Error('Perlawanan pusingan seterusnya sudah ada keputusan. Padam keputusan tersebut dahulu.');
        await update('tournament_matches', id, { winner, score_text: val(d.score_text), status: winner ? (d.wo === '1' ? 'walkover' : 'done') : 'pending', court: val(d.court), play_date: val(d.play_date), play_time: val(d.play_time) });
        if (winner !== prev && nxt) await update('tournament_matches', nxt.id, { [slot]: winner });
        toast(winner ? 'Keputusan disimpan' : 'Perlawanan dikemas kini'); app.render();
      },
    });
  },
});

async function issueEntryInvoice(e, t, cat) {
  const inv = await insert('invoices', { student_id: e.student_id, kind: 'tournament', description: `Penyertaan ${t.name} — ${cat.name}`, amount: cat.fee ?? t.entry_fee, issued_on: todayISO(), due_date: t.registration_deadline && t.registration_deadline >= todayISO() ? t.registration_deadline : addDays(todayISO(), 7), status: 'issued' });
  await update('tournament_entries', e.id, { invoice_id: inv.id });
}

const catForm = c => `<div class="form-grid">
  ${F('Nama kategori', 'name', { value: c?.name, req: true, full: true, ph: 'cth. Perseorangan Lelaki B12' })}
  ${F('Jenis', 'kind', { value: c?.kind || 'singles', opts: [['singles', 'Perseorangan'], ['doubles', 'Beregu']] })}
  ${F('Jantina', 'gender', { value: c?.gender || 'open', opts: [['boys', 'Lelaki'], ['girls', 'Perempuan'], ['mixed', 'Campuran'], ['open', 'Terbuka']] })}
  ${F('Kumpulan umur', 'age_group', { value: c?.age_group, ph: 'cth. B12 / B14 / Terbuka' })}
  ${F('Maks. peserta', 'max_entries', { type: 'number', min: 2, value: c?.max_entries ?? '', ph: 'tanpa had' })}
  ${F('Tahun lahir dari (paling tua)', 'birth_from', { type: 'number', value: c?.birth_from ?? '', ph: 'cth. 2015' })}
  ${F('Perempuan: tahun lahir dari (kelonggaran)', 'girls_from', { type: 'number', value: c?.girls_from ?? '', ph: 'cth. 2017 untuk U8' })}
  ${F('Tahun lahir hingga', 'birth_to', { type: 'number', value: c?.birth_to ?? '', ph: 'cth. 2016' })}
  ${F('Yuran khas kategori (RM, kosong = yuran kejohanan)', 'fee', { type: 'number', step: '0.01', value: c?.fee ?? '' })}
  ${F('Susunan', 'sort', { type: 'number', value: c?.sort ?? 0 })}
</div><p class="muted" style="font-size:12px;margin-top:8px">Kelayakan ikut tahun lahir (bukan hari jadi). Borang awam menyekat pemain di luar julat tahun dan jantina.</p>`;
const catPatch = d => ({ name: d.name.trim(), kind: d.kind, gender: d.gender, age_group: val(d.age_group), max_entries: num(d.max_entries), birth_from: num(d.birth_from), girls_from: num(d.girls_from), birth_to: num(d.birth_to), fee: num(d.fee), sort: num(d.sort) || 0 });

import { openCertificates } from '../docs2.js';
ACTIONS['tn-cert'] = catId => { const cat = byId('tournament_categories', catId), tn = byId('tournaments', cat.tournament_id);
  const L = T('tournament_entries').filter(e => e.category_id === catId && e.status !== 'withdrawn' && e.pay_status !== 'refunded');
  if (!L.length) return toast('Tiada peserta dalam kategori ini.', true);
  openCertificates(L, tn); };
