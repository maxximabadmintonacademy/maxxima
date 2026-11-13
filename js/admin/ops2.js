// Jersi, Perancang Kandungan, Perancang Acara, Tawaran Kelas, Kursus Online, Pelarasan Bil, Pelan Latihan (admin).
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove, rpc } from '../data.js';
import { ic, esc, F, val, num, RM, UI, app, toast, openModal, confirmModal, pageHead, hm, todayISO, addDays, fmtShort, fmtDate, DAYS, avatar, monthLabel } from '../ui.js';
import { T, byId, venueName, progName, staffName, studentName } from './helpers.js';
import { uploadMedia, publicUrl } from '../media.js';
import { planCard, planView, openPlanEditor, copyPlan } from '../planner.js';

const sel = (list, v) => list.map(([k, l]) => `<option value="${esc(k)}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
const chips = (list, cur, action) => `<div class="chips">${list.map(([k, l, n]) => `<button class="chip ${cur === k ? 'on' : ''}" style="cursor:pointer" data-action="${action}" data-id="${k}">${esc(l)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
const studentOpts = (v, blank = '— Tiada / orang luar —') => [['', blank], ...T('students').filter(s => s.status !== 'left').sort((a, b) => a.full_name.localeCompare(b.full_name)).map(s => [s.id, s.full_name])];
const famMembers = s => { if (!s) return []; const ph = String(s.guardian_phone || '').replace(/\D/g, '').slice(-9); return T('students').filter(x => x.id !== s.id && x.status !== 'left' && ((s.family_ref && x.family_ref === s.family_ref) || (ph && String(x.guardian_phone || '').replace(/\D/g, '').slice(-9) === ph))); };

/* =====================================================================
   PESANAN JERSI
   ===================================================================== */
const JSRC = { free_tournament: 'Percuma (kejohanan)', free_package: 'Percuma (pakej)', purchase: 'Beli (pelajar)', outsider: 'Orang luar', staff: 'Staf / coach' };
const JST = { new: ['Baharu', 'b-info'], ordered: ['Dipesan', 'b-purple'], received: ['Diterima', 'b-warn'], printed: ['Siap cetak', 'b-ok'], delivered: ['Diserahkan', 'b-muted'], cancelled: ['Batal', 'b-muted'] };
const BST = { draft: 'Draf', ordered: 'Dipesan dari supplier', received: 'Diterima', printing: 'Heat press', ready: 'Sedia diserah', done: 'Selesai' };
const PRINT = { self: 'Heat press sendiri', supplier: 'Supplier heat press', none: 'Tiada cetakan' };
VIEWS.jersi = () => {
  const tab = UI.jTab || 'orders', st = UI.jSt || '', all = T('jersey_orders'), list = all.filter(o => !st || o.status === st).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const sizes = {}; all.filter(o => ['new', 'ordered'].includes(o.status)).forEach(o => { sizes[o.size] = (sizes[o.size] || 0) + Number(o.qty); });
  return `${pageHead('Pesanan Jersi', 'Rekod jersi percuma (kejohanan/pakej), jualan kepada pelajar & orang luar, dan kumpulan pesanan ke supplier (heat press sendiri atau oleh supplier).',
    `<button class="btn" data-action="jo-import">${ic('trophy', 'sm')} Import dari kejohanan</button><button class="btn" data-action="jb-add">${ic('plus', 'sm')} Kumpulan pesanan supplier</button><button class="btn primary" data-action="jo-add">${ic('plus', 'sm')} Pesanan</button>`)}
  ${chips([['orders', 'Pesanan', all.length], ['batches', 'Kumpulan supplier', T('jersey_batches').length]], tab, 'j-tab')}
  ${tab === 'orders' ? `<div class="card card-pad mb"><div class="filters">${chips([['', 'Semua'], ...Object.entries(JST).map(([k, [l]]) => [k, l, all.filter(o => o.status === k).length])], st, 'j-st')}</div>
    ${Object.keys(sizes).length ? `<p style="font-size:13px;margin-top:8px"><b>Perlu dipesan / dalam pesanan:</b> ${Object.entries(sizes).map(([k, v]) => `${esc(k)} × ${v}`).join(' · ')}</p>` : ''}</div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Pelanggan</th><th>Jenis</th><th>Saiz</th><th>Cetakan</th><th>Harga</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(o => `<tr><td><b>${esc(o.customer_name)}</b><br><span class="muted" style="font-size:12px">${esc(o.phone || '')}${o.design ? ' · ' + esc(o.design) : ''}${o.batch_id ? ' · ' + esc(byId('jersey_batches', o.batch_id)?.name || '') : ''}</span></td>
    <td style="font-size:12.5px">${esc(JSRC[o.source] || o.source)}</td><td><b>${esc(o.size)}</b>${o.qty > 1 ? ' × ' + o.qty : ''}</td><td style="font-size:12.5px">${esc([o.print_name, o.print_number].filter(Boolean).join(' #') || '—')}</td>
    <td>${o.pay_status === 'free' ? '<span class="badge b-muted">Percuma</span>' : `${RM(o.price * o.qty)} <span class="badge ${o.pay_status === 'paid' ? 'b-ok' : 'b-bad'}">${o.pay_status === 'paid' ? 'Dibayar' : 'Belum'}</span>`}</td>
    <td><select class="att-select" data-on-change="jo-st" data-key="${o.id}">${sel(Object.entries(JST).map(([k, [l]]) => [k, l]), o.status)}</select></td>
    <td><button class="btn sm" data-action="jo-edit" data-id="${o.id}">${ic('edit', 'sm')}</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Tiada pesanan.</td></tr>'}</tbody></table></div></div>`
  : `<div class="grid g-2">${T('jersey_batches').slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(b => { const os = T('jersey_orders').filter(o => o.batch_id === b.id), sz = {}; os.forEach(o => { sz[o.size] = (sz[o.size] || 0) + Number(o.qty); });
    return `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>${esc(b.name)}</b><div class="muted" style="font-size:12.5px">${esc(b.supplier || 'Supplier belum ditetapkan')} · ${PRINT[b.print_mode]}</div></div><button class="btn sm" data-action="jb-edit" data-id="${b.id}">${ic('edit', 'sm')}</button></div>
      <div style="margin-top:8px"><select class="att-select" data-on-change="jb-st" data-key="${b.id}">${sel(Object.entries(BST), b.status)}</select></div>
      <p style="font-size:13px;margin-top:8px">${os.length} pesanan · ${Object.entries(sz).map(([k, v]) => `${esc(k)}×${v}`).join(', ') || '—'}${b.cost ? ' · kos ' + RM(b.cost) : ''}</p>
      <p class="muted" style="font-size:12px">${[b.ordered_on && 'Dipesan ' + fmtShort(b.ordered_on), b.received_on && 'Diterima ' + fmtShort(b.received_on), b.ready_on && 'Siap ' + fmtShort(b.ready_on)].filter(Boolean).join(' · ')}</p>
      <div class="actions" style="margin-top:8px"><button class="btn sm" data-action="jb-assign" data-id="${b.id}">Masukkan pesanan baharu</button><button class="btn sm" data-action="jb-copy" data-id="${b.id}">Salin senarai untuk supplier</button></div></div>`; }).join('') || '<div class="card empty">Belum ada kumpulan pesanan.</div>'}</div>`}`;
};
const joForm = o => `<div class="form-grid">
  ${F('Jenis', 'source', { value: o?.source || 'purchase', opts: Object.entries(JSRC) })}
  ${F('Pelajar (jika ada)', 'student_id', { value: o?.student_id || '', opts: studentOpts() })}
  ${F('Nama pelanggan', 'customer_name', { value: o?.customer_name, ph: 'auto dari pelajar jika kosong' })}${F('Telefon', 'phone', { value: o?.phone })}
  ${F('Reka bentuk / jenis jersi', 'design', { value: o?.design, ph: 'cth. Jersi Maxxima 2026 / BRBC 2026' })}
  ${F('Saiz', 'size', { value: o?.size, req: true, ph: 'cth. M / 2XS' })}${F('Kuantiti', 'qty', { type: 'number', min: 1, value: o?.qty ?? 1 })}
  ${F('Nama dicetak', 'print_name', { value: o?.print_name })}${F('Nombor dicetak', 'print_number', { value: o?.print_number })}
  ${F('Harga seunit (RM)', 'price', { type: 'number', step: '0.01', min: 0, value: o?.price ?? 0 })}
  ${F('Bayaran', 'pay_status', { value: o?.pay_status || 'unpaid', opts: [['unpaid', 'Belum bayar'], ['paid', 'Dibayar'], ['free', 'Percuma']] })}
  ${F('Kumpulan supplier', 'batch_id', { value: o?.batch_id || '', opts: [['', '— Belum —'], ...T('jersey_batches').map(b => [b.id, b.name])] })}
  ${F('Nota', 'notes', { value: o?.notes, full: true })}</div>`;
const joPatch = d => { const s = byId('students', d.student_id); return { source: d.source, student_id: val(d.student_id), customer_name: (d.customer_name || '').trim() || s?.full_name || 'Pelanggan', phone: val(d.phone) || s?.guardian_phone || null, design: val(d.design), size: d.size.trim().toUpperCase(), qty: Number(d.qty) || 1, print_name: val(d.print_name), print_number: val(d.print_number), price: Number(d.price) || 0, pay_status: d.source.startsWith('free') ? 'free' : d.pay_status, batch_id: val(d.batch_id), notes: val(d.notes) }; };
const jbForm = b => `<div class="form-grid">${F('Nama kumpulan', 'name', { value: b?.name, req: true, full: true, ph: 'cth. Jersi BRBC 2026 — batch 1' })}${F('Supplier', 'supplier', { value: b?.supplier })}
  ${F('Cetakan', 'print_mode', { value: b?.print_mode || 'self', opts: Object.entries(PRINT) })}${F('Status', 'status', { value: b?.status || 'draft', opts: Object.entries(BST) })}
  ${F('Tarikh pesan', 'ordered_on', { type: 'date', value: b?.ordered_on })}${F('Tarikh terima', 'received_on', { type: 'date', value: b?.received_on })}${F('Tarikh siap', 'ready_on', { type: 'date', value: b?.ready_on })}
  ${F('Kos (RM)', 'cost', { type: 'number', step: '0.01', value: b?.cost ?? '' })}${F('Nota', 'notes', { type: 'textarea', value: b?.notes, full: true })}</div>`;
const jbPatch = d => ({ name: d.name.trim(), supplier: val(d.supplier), print_mode: d.print_mode, status: d.status, ordered_on: val(d.ordered_on), received_on: val(d.received_on), ready_on: val(d.ready_on), cost: num(d.cost), notes: val(d.notes) });
const ORDER_FOR = { ordered: 'ordered', received: 'received', printing: 'received', ready: 'printed', done: 'delivered' };
INPUTS['jo-st'] = async (v, el) => { await update('jersey_orders', el.dataset.key, { status: v, delivered_on: v === 'delivered' ? todayISO() : null }); app.render(); };
INPUTS['jb-st'] = async (v, el) => {
  const id = el.dataset.key, patch = { status: v }; if (v === 'ordered') patch.ordered_on = todayISO(); if (v === 'received') patch.received_on = todayISO(); if (v === 'ready') patch.ready_on = todayISO();
  await update('jersey_batches', id, patch);
  const os = ORDER_FOR[v]; if (os) for (const o of T('jersey_orders').filter(o => o.batch_id === id && o.status !== 'cancelled' && o.status !== 'delivered')) await update('jersey_orders', o.id, { status: os, delivered_on: os === 'delivered' ? todayISO() : null });
  toast('Status kumpulan & pesanan dikemas kini'); app.render();
};
Object.assign(ACTIONS, {
  'j-tab': k => { UI.jTab = k; app.render(); }, 'j-st': k => { UI.jSt = k; app.render(); },
  'jo-add': () => openModal({ title: 'Pesanan Jersi', submit: 'Simpan', wide: true, body: joForm(), onSubmit: async d => { await insert('jersey_orders', joPatch(d)); toast('Pesanan disimpan'); app.render(); } }),
  'jo-edit': id => openModal({ title: 'Edit Pesanan Jersi', wide: true, body: joForm(byId('jersey_orders', id)) + `<button type="button" class="btn sm danger-o" style="margin-top:12px" data-action="jo-del" data-id="${id}">${ic('trash', 'sm')} Padam</button>`, onSubmit: async d => { await update('jersey_orders', id, joPatch(d)); toast('Dikemas kini'); app.render(); } }),
  'jo-del': id => confirmModal({ title: 'Padam pesanan?', message: '', ok: 'Padam', danger: true, onOk: async () => { await remove('jersey_orders', id); app.render(); } }),
  'jo-import': () => {
    const have = new Set(T('jersey_orders').map(o => o.tournament_entry_id).filter(Boolean));
    const es = T('tournament_entries').filter(e => e.shirt_size && e.status !== 'withdrawn' && !have.has(e.id));
    const eligible = e => { if (e.jersey_eligible != null) return e.jersey_eligible; const t = byId('tournaments', byId('tournament_categories', e.category_id)?.tournament_id); const paidOk = e.pay_status === 'paid' || e.pay_status === 'waived'; return paidOk && (!t?.early_deadline || !e.paid_at || e.paid_at.slice(0, 10) <= t.early_deadline); };
    if (!es.length) return toast('Tiada peserta kejohanan dengan saiz jersi yang belum diimport');
    confirmModal({ title: 'Import jersi kejohanan?', message: `${es.length} peserta mempunyai saiz jersi. ${es.filter(eligible).length} layak jersi percuma (dibayar sebelum akhir daftar awal); selebihnya direkod sebagai pesanan berbayar (belum bayar).`, ok: 'Import', onOk: async () => {
      for (const e of es) { const t = byId('tournaments', byId('tournament_categories', e.category_id)?.tournament_id); const fr = t?.shirt_free && eligible(e);
        await insert('jersey_orders', { source: fr ? 'free_tournament' : 'outsider', student_id: e.student_id || null, tournament_entry_id: e.id, customer_name: e.player_name || studentName(e.student_id), phone: e.guardian_phone, design: t?.name, size: e.shirt_size, qty: 1, price: 0, pay_status: fr ? 'free' : 'unpaid' }); }
      toast(`${es.length} pesanan diimport`); app.render(); } });
  },
  'jb-add': () => openModal({ title: 'Kumpulan Pesanan Supplier', submit: 'Simpan', wide: true, body: jbForm(), onSubmit: async d => { await insert('jersey_batches', jbPatch(d)); UI.jTab = 'batches'; app.render(); } }),
  'jb-edit': id => openModal({ title: 'Edit Kumpulan', wide: true, body: jbForm(byId('jersey_batches', id)), onSubmit: async d => { await update('jersey_batches', id, jbPatch(d)); app.render(); } }),
  'jb-assign': async id => { const os = T('jersey_orders').filter(o => !o.batch_id && o.status === 'new'); for (const o of os) await update('jersey_orders', o.id, { batch_id: id }); toast(`${os.length} pesanan dimasukkan`); app.render(); },
  'jb-copy': async id => { const b = byId('jersey_batches', id), os = T('jersey_orders').filter(o => o.batch_id === id && o.status !== 'cancelled'), sz = {}; os.forEach(o => { sz[o.size] = (sz[o.size] || 0) + Number(o.qty); });
    const txt = `${b.name}\n${Object.entries(sz).map(([k, v]) => `${k}: ${v}`).join('\n')}\nJumlah: ${os.reduce((n, o) => n + Number(o.qty), 0)}${b.print_mode !== 'none' ? '\n\nCetakan:\n' + os.filter(o => o.print_name || o.print_number).map(o => `${o.size} — ${o.print_name || ''} ${o.print_number || ''}`).join('\n') : ''}`;
    try { await navigator.clipboard.writeText(txt); toast('Senarai disalin — tampal di WhatsApp supplier'); } catch { openModal({ title: 'Senarai untuk supplier', cancel: 'Tutup', body: `<textarea style="width:100%;min-height:200px" data-noi18n>${esc(txt)}</textarea>` }); } },
});

/* =====================================================================
   PERANCANG KANDUNGAN (PEMASARAN)
   ===================================================================== */
const CTYPE = { promo: 'Promosi', program: 'Program / kelas', event: 'Acara', testimonial: 'Testimoni', result: 'Pencapaian pelajar', tips: 'Tips / ilmu', behind: 'Di sebalik tabir', other: 'Lain-lain' };
const PLAT = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp', youtube: 'YouTube', xhs: 'Xiaohongshu' };
const CST = { idea: ['Idea', 'b-muted'], draft: ['Draf', 'b-info'], ready: ['Sedia', 'b-purple'], scheduled: ['Dijadual', 'b-warn'], posted: ['Diterbit', 'b-ok'], archived: ['Arkib', 'b-muted'] };
VIEWS.kandungan = () => {
  const st = UI.cSt || '', items = T('content_items').filter(c => (!st || c.status === st)).sort((a, b) => (a.plan_date || '9999').localeCompare(b.plan_date || '9999'));
  return `${pageHead('Perancang Kandungan', 'Simpan idea, caption, gambar/video & jadual posting untuk promosi program, acara, testimoni dan lain-lain.', `<button class="btn primary" data-action="ct-add">${ic('plus', 'sm')} Kandungan</button>`)}
  ${chips([['', 'Semua', T('content_items').length], ...Object.entries(CST).map(([k, [l]]) => [k, l, T('content_items').filter(c => c.status === k).length])], st, 'c-st')}
  <div class="grid g-3">${items.map(c => `<div class="card mb ann">${c.media?.[0] && !/video/.test(c.media[0].type || '') ? `<img class="ann-img" style="max-height:220px" src="${publicUrl(c.media[0].path)}" alt="">` : ''}<div class="card-pad">
    <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge ${CST[c.status][1]}">${CST[c.status][0]}</span><span class="badge b-muted">${esc(CTYPE[c.ctype] || c.ctype)}</span>${c.plan_date ? `<span class="muted" style="font-size:12px">${fmtShort(c.plan_date)}</span>` : ''}</div>
    <b style="display:block;margin-top:6px">${esc(c.title)}</b><div class="muted" style="font-size:12px">${(c.platforms || []).map(p => PLAT[p] || p).join(' · ')}${(c.media || []).length ? ` · ${c.media.length} fail` : ''}</div>
    ${c.caption ? `<p class="ann-body" style="margin-top:6px;max-height:110px;overflow:hidden">${esc(c.caption)}</p>` : ''}
    <div class="actions" style="margin-top:8px"><button class="btn sm" data-action="ct-edit" data-id="${c.id}">${ic('edit', 'sm')} Edit</button>${c.caption ? `<button class="btn sm" data-action="ct-copy" data-id="${c.id}">Salin caption</button>` : ''}${c.posted_url ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(c.posted_url)}">Lihat post</a>` : ''}</div></div></div>`).join('') || '<div class="card empty" style="grid-column:1/-1">Belum ada kandungan.</div>'}</div>`;
};
const ctForm = c => `<div class="form-grid">${F('Tajuk / idea', 'title', { value: c?.title, req: true, full: true })}
  ${F('Jenis', 'ctype', { value: c?.ctype || 'promo', opts: Object.entries(CTYPE) })}${F('Status', 'status', { value: c?.status || 'idea', opts: Object.entries(CST).map(([k, [l]]) => [k, l]) })}
  <div class="f full">Platform<div class="langchk">${Object.entries(PLAT).map(([k, l]) => `<label><input type="checkbox" name="platforms" value="${k}" ${(c?.platforms || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
  ${F('Tarikh posting', 'plan_date', { type: 'date', value: c?.plan_date })}${F('Pemilik tugas', 'owner', { value: c?.owner })}
  ${F('Caption', 'caption', { type: 'textarea', value: c?.caption, full: true })}${F('Hashtag', 'hashtags', { value: c?.hashtags, full: true, ph: '#MaxximaBadminton #BadmintonKL' })}
  <label class="f full">Gambar / video (boleh pilih beberapa; gambar maks 10MB, video maks 50MB)<input type="file" name="files" multiple accept="image/*,video/*">${(c?.media || []).length ? `<span class="hint">${c.media.length} fail sedia ada dikekalkan.</span>` : ''}</label>
  ${F('Pautan berkaitan', 'link', { value: c?.link, full: true })}${F('Pautan post (selepas diterbit)', 'posted_url', { value: c?.posted_url, full: true })}${F('Nota', 'notes', { type: 'textarea', value: c?.notes, full: true })}</div>`;
async function ctSave(d, c) {
  const media = [...(c?.media || [])];
  for (const f of [].concat(d.files || []).filter(x => x && x.size)) media.push({ path: await uploadMedia('public-media', 'content', f, { maxMB: f.type.startsWith('video/') ? 50 : 10 }), type: f.type });
  const row = { title: d.title.trim(), ctype: d.ctype, status: d.status, platforms: [].concat(d.platforms || []).filter(Boolean), plan_date: val(d.plan_date), owner: val(d.owner), caption: val(d.caption), hashtags: val(d.hashtags), link: val(d.link), posted_url: val(d.posted_url), notes: val(d.notes), media };
  if (c) await update('content_items', c.id, row); else await insert('content_items', row); toast('Kandungan disimpan'); app.render();
}
Object.assign(ACTIONS, {
  'c-st': k => { UI.cSt = k; app.render(); },
  'ct-add': () => openModal({ title: 'Kandungan Baharu', submit: 'Simpan', wide: true, body: ctForm(), onSubmit: d => ctSave(d) }),
  'ct-edit': id => { const c = byId('content_items', id); openModal({ title: 'Edit Kandungan', wide: true, body: ctForm(c) + `<button type="button" class="btn sm danger-o" style="margin-top:12px" data-action="ct-del" data-id="${id}">${ic('trash', 'sm')} Padam</button>`, onSubmit: d => ctSave(d, c) }); },
  'ct-del': id => confirmModal({ title: 'Padam kandungan?', message: '', ok: 'Padam', danger: true, onOk: async () => { await remove('content_items', id); app.render(); } }),
  'ct-copy': async id => { const c = byId('content_items', id); try { await navigator.clipboard.writeText([c.caption, c.hashtags].filter(Boolean).join('\n\n')); toast('Caption disalin'); } catch { toast('Tidak dapat menyalin', true); } },
});

/* =====================================================================
   PERANCANG ACARA
   ===================================================================== */
const ETYPE = { friendly: 'Friendly match', tournament: 'Kejohanan', school_clinic: 'Klinik sekolah', open_day: 'Hari terbuka / trial', camp: 'Kem latihan', workshop: 'Bengkel / kursus', outing: 'Lawatan / aktiviti', other: 'Lain-lain' };
const EST = { idea: ['Idea', 'b-muted'], planning: ['Perancangan', 'b-info'], confirmed: ['Disahkan', 'b-purple'], ongoing: ['Berlangsung', 'b-warn'], done: ['Selesai', 'b-ok'], cancelled: ['Batal', 'b-muted'] };
const CHECK = { friendly: ['Hubungi kelab lawan & sahkan tarikh', 'Tempah court', 'Senarai pemain & pasangan', 'Maklum ibu bapa (pengumuman)', 'Shuttlecock & air', 'Jadual perlawanan', 'Gambar / video untuk media sosial', 'Laporan & keputusan'],
  school_clinic: ['Surat / proposal kepada sekolah', 'Sahkan tarikh, masa & dewan', 'Senarai coach bertugas', 'Peralatan (raket pinjam, shuttle, kon)', 'Borang kebenaran / senarai murid', 'Pelan aktiviti klinik', 'Brosur & kod QR borang trial', 'Gambar & testimoni', 'Susulan leads (borang trial)', 'Laporan kepada sekolah'],
  tournament: ['Poster & halaman awam', 'Tempah dewan & court', 'Kategori & yuran', 'Pengadil / penjaga skor', 'Hadiah, pingat & sijil', 'Jersi (pesanan supplier)', 'Cabutan & jadual', 'Peralatan & first aid', 'Siaran keputusan', 'Laporan kewangan'],
  default: ['Tetapkan objektif & sasaran', 'Bajet', 'Tempat & tarikh', 'Staf bertugas', 'Promosi', 'Logistik & peralatan', 'Pelaksanaan', 'Laporan & susulan'] };
VIEWS.acara = () => {
  const st = UI.eSt || '', list = T('events').filter(e => !st || e.status === st).sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'));
  return `${pageHead('Perancang Acara', 'Friendly match, kejohanan, klinik sekolah, hari terbuka dan lain-lain — dengan senarai semak, bajet, staf, peserta dan laporan.', `<button class="btn primary" data-action="ev-add">${ic('plus', 'sm')} Acara</button>`)}
  ${chips([['', 'Semua', T('events').length], ...Object.entries(EST).map(([k, [l]]) => [k, l, T('events').filter(e => e.status === k).length])], st, 'e-st')}
  ${list.map(e => { const ck = e.checklist || [], done = ck.filter(x => x.done).length; return `<div class="card card-pad mb"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <div style="flex:1;min-width:240px"><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge ${EST[e.status][1]}">${EST[e.status][0]}</span><span class="badge b-muted">${esc(ETYPE[e.etype] || e.etype)}</span></div>
      <h3 style="font-size:16px;margin-top:6px">${esc(e.name)}</h3><div class="muted" style="font-size:12.5px">${e.start_date ? fmtDate(e.start_date) + (e.end_date && e.end_date !== e.start_date ? ' – ' + fmtDate(e.end_date) : '') : 'Tarikh belum ditetapkan'}${e.start_time ? ' · ' + hm(e.start_time) : ''} · ${esc(e.venue_id ? venueName(e.venue_id) : e.venue_note || '')}${e.partner ? ' · ' + esc(e.partner) : ''}</div>
      <div style="font-size:12.5px;margin-top:4px">PIC: ${esc(e.pic_staff ? staffName(e.pic_staff) : '—')} · Peserta ${e.actual_pax ?? '—'}/${e.target_pax ?? '—'} · Bajet ${e.budget != null ? RM(e.budget) : '—'} · Untung/Rugi ${e.income != null || e.expense != null ? RM((e.income || 0) - (e.expense || 0)) : '—'}</div></div>
    <div style="min-width:180px"><div style="font-size:12px" class="muted">Senarai semak ${done}/${ck.length}</div><div class="bar"><span style="width:${ck.length ? done / ck.length * 100 : 0}%;background:var(--ok)"></span></div>
      <div class="actions" style="margin-top:8px"><button class="btn sm" data-action="ev-check" data-id="${e.id}">Senarai semak</button><button class="btn sm" data-action="ev-edit" data-id="${e.id}">${ic('edit', 'sm')}</button></div></div></div></div>`; }).join('') || '<div class="card empty">Belum ada acara.</div>'}`;
};
const evForm = e => `<div class="form-grid">${F('Nama acara', 'name', { value: e?.name, req: true, full: true })}
  ${F('Jenis', 'etype', { value: e?.etype || 'friendly', opts: Object.entries(ETYPE) })}${F('Status', 'status', { value: e?.status || 'idea', opts: Object.entries(EST).map(([k, [l]]) => [k, l]) })}
  ${F('Tarikh mula', 'start_date', { type: 'date', value: e?.start_date })}${F('Tarikh tamat', 'end_date', { type: 'date', value: e?.end_date })}${F('Masa mula', 'start_time', { type: 'time', value: hm(e?.start_time) })}${F('Masa tamat', 'end_time', { type: 'time', value: hm(e?.end_time) })}
  ${F('Lokasi akademi', 'venue_id', { value: e?.venue_id || '', opts: [['', '— Lain —'], ...T('venues').map(v => [v.id, v.name])] })}${F('Lokasi lain / alamat', 'venue_note', { value: e?.venue_note })}
  ${F('Rakan / sekolah / kelab / penaja', 'partner', { value: e?.partner })}${F('Nama hubungan', 'contact_name', { value: e?.contact_name })}${F('Telefon hubungan', 'contact_phone', { value: e?.contact_phone })}
  ${F('PIC (staf)', 'pic_staff', { value: e?.pic_staff || '', opts: [['', '—'], ...T('staff').filter(s => s.active !== false).map(s => [s.id, s.full_name])] })}
  <div class="f full">Staf bertugas<div class="langchk">${T('staff').filter(s => s.active !== false).map(s => `<label><input type="checkbox" name="staff_ids" value="${s.id}" ${(e?.staff_ids || []).includes(s.id) ? 'checked' : ''}> ${esc(s.full_name)}</label>`).join('')}</div></div>
  ${F('Sasaran peserta', 'target_pax', { type: 'number', value: e?.target_pax ?? '' })}${F('Peserta sebenar', 'actual_pax', { type: 'number', value: e?.actual_pax ?? '' })}${F('Yuran peserta (RM)', 'fee', { type: 'number', step: '0.01', value: e?.fee ?? '' })}
  ${F('Bajet (RM)', 'budget', { type: 'number', step: '0.01', value: e?.budget ?? '' })}${F('Pendapatan (RM)', 'income', { type: 'number', step: '0.01', value: e?.income ?? '' })}${F('Perbelanjaan (RM)', 'expense', { type: 'number', step: '0.01', value: e?.expense ?? '' })}
  ${F('Kejohanan berkaitan', 'tournament_id', { value: e?.tournament_id || '', opts: [['', '—'], ...T('tournaments').map(t => [t.id, t.name])] })}${F('Leads diperoleh', 'leads_count', { type: 'number', value: e?.leads_count ?? '' })}
  ${F('Objektif', 'objective', { type: 'textarea', value: e?.objective, full: true })}${F('Aturcara / run sheet', 'run_sheet', { type: 'textarea', value: e?.run_sheet, full: true, ph: '8:00 Pendaftaran\n8:30 Warm up\n9:00 Perlawanan…' })}
  ${F('Hasil & laporan (selepas acara)', 'outcome', { type: 'textarea', value: e?.outcome, full: true })}${F('Nota', 'notes', { type: 'textarea', value: e?.notes, full: true })}</div>`;
const evPatch = d => ({ name: d.name.trim(), etype: d.etype, status: d.status, start_date: val(d.start_date), end_date: val(d.end_date), start_time: val(d.start_time), end_time: val(d.end_time), venue_id: val(d.venue_id), venue_note: val(d.venue_note), partner: val(d.partner), contact_name: val(d.contact_name), contact_phone: val(d.contact_phone), pic_staff: val(d.pic_staff), staff_ids: [].concat(d.staff_ids || []).filter(Boolean),
  target_pax: num(d.target_pax), actual_pax: num(d.actual_pax), fee: num(d.fee), budget: num(d.budget), income: num(d.income), expense: num(d.expense), tournament_id: val(d.tournament_id), leads_count: num(d.leads_count), objective: val(d.objective), run_sheet: val(d.run_sheet), outcome: val(d.outcome), notes: val(d.notes) });
Object.assign(ACTIONS, {
  'e-st': k => { UI.eSt = k; app.render(); },
  'ev-add': () => openModal({ title: 'Acara Baharu', submit: 'Simpan', wide: true, body: evForm(), onSubmit: async d => { const p = evPatch(d); await insert('events', { ...p, checklist: (CHECK[p.etype] || CHECK.default).map(t => ({ t, done: false })) }); toast('Acara dicipta dengan senarai semak'); app.render(); } }),
  'ev-edit': id => openModal({ title: 'Edit Acara', wide: true, body: evForm(byId('events', id)) + `<button type="button" class="btn sm danger-o" style="margin-top:12px" data-action="ev-del" data-id="${id}">${ic('trash', 'sm')} Padam</button>`, onSubmit: async d => { await update('events', id, evPatch(d)); app.render(); } }),
  'ev-del': id => confirmModal({ title: 'Padam acara?', message: '', ok: 'Padam', danger: true, onOk: async () => { await remove('events', id); app.render(); } }),
  'ev-check': id => { const e = byId('events', id), ck = e.checklist || [];
    openModal({ title: 'Senarai semak — ' + esc(e.name), submit: 'Simpan', wide: true, body: `<div id="ckList">${ck.map((x, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><input type="checkbox" name="ck_done" value="${i}" ${x.done ? 'checked' : ''} style="width:auto;height:auto"><input name="ck_t" value="${esc(x.t)}" style="flex:1"><input type="date" name="ck_due" value="${esc(x.due || '')}" style="width:150px"></div>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:8px"><input id="ckNew" placeholder="Tambah tugasan…" style="flex:1"></div>`,
      onSubmit: async d => { const ts = [].concat(d.ck_t || []), dues = [].concat(d.ck_due || []), dn = new Set([].concat(d.ck_done || []).map(Number));
        const list = ts.map((t, i) => ({ t, done: dn.has(i), due: dues[i] || null })).filter(x => x.t.trim()); const nw = document.getElementById('ckNew')?.value?.trim(); if (nw) list.push({ t: nw, done: false });
        await update('events', id, { checklist: list }); toast('Senarai semak disimpan'); app.render(); } }); },
});

/* =====================================================================
   TAWARAN KELAS / SLOT TERBUKA
   ===================================================================== */
const OTYPE = { group: 'Kelas kumpulan baharu', small_group: 'Small group (cari ahli)', share_personal: 'Kongsi personal (2 lawan 1)', camp: 'Kem / program khas', other: 'Lain-lain' };
VIEWS.tawaran = () => `${pageHead('Kelas & Slot Terbuka', 'Promosi kelas baharu atau slot kosong (cth. 2 lawan 1 cari ahli). Ibu bapa nampak di portal dan boleh tekan "Saya berminat" — masuk ke Tempahan.', `<button class="btn primary" data-action="of-add">${ic('plus', 'sm')} Tawaran</button>`)}
  <div class="grid g-2">${T('class_offers').slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(o => { const n = T('booking_requests').filter(b => b.offer_id === o.id && b.status !== 'cancelled').length; return `<div>${offerCard(o)}<div class="actions" style="margin:-6px 0 16px"><span class="muted" style="font-size:12.5px">${n} berminat</span><button class="btn sm" data-action="of-edit" data-id="${o.id}">${ic('edit', 'sm')} Edit</button><button class="btn sm" data-action="of-notify" data-id="${o.id}">${ic('bell', 'sm')} Hebah kepada ibu bapa</button></div></div>`; }).join('') || '<div class="card empty" style="grid-column:1/-1">Belum ada tawaran.</div>'}</div>`;
export function offerCard(o, tr = x => x) {
  const when = o.weekday != null ? `${DAYS[o.weekday]} ${hm(o.start_time)}${o.end_time ? '–' + hm(o.end_time) : ''}` : '';
  return `<article class="card mb ann">${o.image_path ? `<img class="ann-img" style="max-height:260px" src="${publicUrl(o.image_path)}" alt="">` : ''}<div class="card-pad">
    <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge b-purple">${esc(tr(OTYPE[o.otype] || o.otype))}</span>${o.status === 'full' ? `<span class="badge b-bad">${esc(tr('Penuh'))}</span>` : ''}${o.slots ? `<span class="badge b-info">${o.slots} ${esc(tr('tempat'))}</span>` : ''}</div>
    <h3 style="font-size:16px;margin:6px 0 4px">${esc(o.title)}</h3>
    <div style="font-size:13px;line-height:1.7">${[when, o.venue_id ? venueName(o.venue_id) : '', o.coach_name || (o.coach_id ? staffName(o.coach_id) : ''), o.level, o.age_note].filter(x => x && x !== '—').map(esc).join(' · ')}</div>
    ${o.fee != null ? `<div style="font-size:15px;margin-top:4px"><b>${RM(o.fee)}</b> <span class="muted" style="font-size:12.5px">${esc(o.fee_note || '')}</span></div>` : ''}
    ${o.start_date ? `<div class="muted" style="font-size:12.5px">${esc(tr('Mula'))} ${fmtShort(o.start_date)}</div>` : ''}${o.description ? `<p class="ann-body" style="margin-top:6px">${esc(o.description)}</p>` : ''}</div></article>`;
}
const ofForm = o => `<div class="form-grid">${F('Tajuk', 'title', { value: o?.title, req: true, full: true, ph: 'cth. Kelas Performance bersama Coach Zamry — setiap Jumaat 8–10 malam' })}
  ${F('Jenis', 'otype', { value: o?.otype || 'group', opts: Object.entries(OTYPE) })}${F('Status', 'status', { value: o?.status || 'open', opts: [['open', 'Dibuka'], ['full', 'Penuh'], ['closed', 'Ditutup']] })}
  ${F('Kelas sedia ada (pilihan)', 'class_id', { value: o?.class_id || '', opts: [['', '—'], ...T('classes').filter(c => c.active).map(c => [c.id, `${DAYS[c.weekday]} ${hm(c.start_time)} · ${progName(c.programme_id)} · ${venueName(c.venue_id)}`])] })}
  ${F('Program', 'programme_id', { value: o?.programme_id || '', opts: [['', '—'], ...T('programmes').filter(p => p.active).map(p => [p.id, p.name])] })}
  ${F('Coach', 'coach_id', { value: o?.coach_id || '', opts: [['', '—'], ...T('staff').filter(s => s.active !== false).map(s => [s.id, s.full_name])] })}${F('Lokasi', 'venue_id', { value: o?.venue_id || '', opts: [['', '—'], ...T('venues').filter(v => v.active).map(v => [v.id, v.name])] })}
  ${F('Hari', 'weekday', { value: o?.weekday ?? '', opts: [['', '—'], ...DAYS.map((d, i) => [String(i), d])] })}${F('Mula', 'start_time', { type: 'time', value: hm(o?.start_time) })}${F('Tamat', 'end_time', { type: 'time', value: hm(o?.end_time) })}
  ${F('Tahap', 'level', { value: o?.level, ph: 'cth. Pertengahan / boleh rally' })}${F('Umur', 'age_note', { value: o?.age_note, ph: 'cth. 10–15 tahun' })}
  ${F('Yuran (RM)', 'fee', { type: 'number', step: '0.01', value: o?.fee ?? '' })}${F('Nota yuran', 'fee_note', { value: o?.fee_note, ph: 'cth. sebulan (4 sesi) / seorang sesi' })}
  ${F('Tempat kosong', 'slots', { type: 'number', value: o?.slots ?? '' })}${F('Tarikh mula', 'start_date', { type: 'date', value: o?.start_date })}
  ${F('Keterangan', 'description', { type: 'textarea', value: o?.description, full: true })}<label class="f full">Gambar / poster (pilihan)<input type="file" name="image" accept="image/*"></label></div>`;
async function ofSave(d, o) {
  const c = byId('classes', d.class_id);
  const row = { title: d.title.trim(), otype: d.otype, status: d.status, class_id: val(d.class_id), programme_id: val(d.programme_id) || c?.programme_id || null, coach_id: val(d.coach_id) || c?.coach_id || null, venue_id: val(d.venue_id) || c?.venue_id || null,
    weekday: d.weekday !== '' ? Number(d.weekday) : c ? c.weekday : null, start_time: val(d.start_time) || c?.start_time || null, end_time: val(d.end_time) || c?.end_time || null, level: val(d.level), age_note: val(d.age_note), fee: num(d.fee), fee_note: val(d.fee_note), slots: num(d.slots), start_date: val(d.start_date), description: val(d.description), image_path: o?.image_path || null };
  if (d.image && d.image.size) row.image_path = await uploadMedia('public-media', 'offers', d.image, { maxMB: 10 });
  const r = o ? await update('class_offers', o.id, row) : await insert('class_offers', row);
  toast(o ? 'Tawaran dikemas kini' : 'Tawaran dicipta — tekan "Hebah kepada ibu bapa" untuk hantar notifikasi'); app.render(); return r;
}
Object.assign(ACTIONS, {
  'of-add': () => openModal({ title: 'Tawaran Kelas / Slot', submit: 'Simpan', wide: true, body: ofForm(), onSubmit: d => ofSave(d) }),
  'of-edit': id => openModal({ title: 'Edit Tawaran', wide: true, body: ofForm(byId('class_offers', id)), onSubmit: d => ofSave(d, byId('class_offers', id)) }),
  'of-notify': async id => { const o = byId('class_offers', id);
    const a = await insert('announcements', { title: o.title, body: [o.weekday != null ? `${DAYS[o.weekday]} ${hm(o.start_time)}${o.end_time ? '–' + hm(o.end_time) : ''}` : '', o.venue_id ? venueName(o.venue_id) : '', o.coach_id ? 'Coach ' + staffName(o.coach_id) : '', o.fee != null ? RM(o.fee) + ' ' + (o.fee_note || '') : '', o.description || '', 'Berminat? Buka menu Tempah → Kelas dibuka.'].filter(Boolean).join('\n'), kind: 'event', audience: 'parents', image_path: o.image_path, created_by: S.mode === 'demo' ? null : S.profile.id });
    if (S.mode === 'supabase') { const n = await rpc('announce_notify', { p_id: a.id }); toast(`Dihebah kepada ${n} ibu bapa`); } else toast('Pengumuman dicipta'); app.render(); },
});

/* =====================================================================
   KURSUS ONLINE
   ===================================================================== */
const CCAT = { rules: 'Peraturan pertandingan', equipment: 'Raket & peralatan', exercise: 'Latihan & senaman', tactics: 'Taktik', nutrition: 'Pemakanan & rehat', coaching: 'Untuk coach', other: 'Lain-lain' };
VIEWS.kursus = () => `${pageHead('Kursus Online', 'Bahan pembelajaran untuk ibu bapa, pelajar & coach: peraturan pertandingan, pengetahuan raket, senaman dan lain-lain. Pelajaran boleh ada teks, gambar & video (YouTube).', `<button class="btn primary" data-action="cr-add">${ic('plus', 'sm')} Kursus</button>`)}
  <div class="grid g-3">${T('courses').slice().sort((a, b) => a.sort - b.sort).map(c => `<div class="card mb ann">${c.cover_path ? `<img class="ann-img" style="max-height:180px" src="${publicUrl(c.cover_path)}" alt="">` : ''}<div class="card-pad">
    <div style="display:flex;gap:6px"><span class="badge ${c.status === 'published' ? 'b-ok' : 'b-muted'}">${c.status === 'published' ? 'Diterbit' : 'Draf'}</span><span class="badge b-info">${esc(CCAT[c.category] || c.category || '')}</span></div>
    <b style="display:block;margin-top:6px">${esc(c.title)}</b><div class="muted" style="font-size:12.5px">${T('course_lessons').filter(l => l.course_id === c.id).length} pelajaran · ${c.audience === 'all' ? 'Semua' : c.audience === 'parents' ? 'Ibu bapa' : 'Coach'}</div>
    <div class="actions" style="margin-top:8px"><button class="btn sm" data-action="cr-edit" data-id="${c.id}">${ic('edit', 'sm')} Edit</button><button class="btn sm primary" data-action="cl-add" data-id="${c.id}">+ Pelajaran</button></div>
    <ol style="margin:8px 0 0 18px;font-size:13px">${T('course_lessons').filter(l => l.course_id === c.id).sort((a, b) => a.sort - b.sort).map(l => `<li><a href="javascript:void 0" data-action="cl-edit" data-id="${l.id}">${esc(l.title)}</a></li>`).join('')}</ol></div></div>`).join('') || '<div class="card empty" style="grid-column:1/-1">Belum ada kursus. Contoh idea: "Peraturan asas badminton BWF", "Cara pilih raket & tali", "Senaman kekuatan kaki di rumah".</div>'}</div>`;
const crForm = c => `<div class="form-grid">${F('Tajuk kursus', 'title', { value: c?.title, req: true, full: true })}${F('Kategori', 'category', { value: c?.category || 'rules', opts: Object.entries(CCAT) })}
  ${F('Untuk', 'audience', { value: c?.audience || 'all', opts: [['all', 'Semua'], ['parents', 'Ibu bapa / pelajar'], ['coaches', 'Coach']] })}${F('Status', 'status', { value: c?.status || 'draft', opts: [['draft', 'Draf'], ['published', 'Diterbit']] })}${F('Susunan', 'sort', { type: 'number', value: c?.sort ?? 0 })}
  ${F('Ringkasan', 'summary', { type: 'textarea', value: c?.summary, full: true })}<label class="f full">Gambar kulit (pilihan)<input type="file" name="cover" accept="image/*"></label></div>`;
const clForm = l => `<div class="form-grid">${F('Tajuk pelajaran', 'title', { value: l?.title, req: true, full: true })}${F('Susunan', 'sort', { type: 'number', value: l?.sort ?? 0 })}${F('Minit', 'minutes', { type: 'number', value: l?.minutes ?? '' })}
  ${F('Pautan video (YouTube / lain)', 'video_url', { value: l?.video_url, full: true })}${F('Kandungan', 'body', { type: 'textarea', value: l?.body, full: true })}<label class="f full">Gambar (pilihan)<input type="file" name="image" accept="image/*"></label></div>`;
Object.assign(ACTIONS, {
  'cr-add': () => openModal({ title: 'Kursus Baharu', submit: 'Simpan', wide: true, body: crForm(), onSubmit: async d => { const row = { title: d.title.trim(), category: d.category, audience: d.audience, status: d.status, sort: Number(d.sort) || 0, summary: val(d.summary) }; if (d.cover && d.cover.size) row.cover_path = await uploadMedia('public-media', 'courses', d.cover); await insert('courses', row); app.render(); } }),
  'cr-edit': id => { const c = byId('courses', id); openModal({ title: 'Edit Kursus', wide: true, body: crForm(c) + `<button type="button" class="btn sm danger-o" style="margin-top:12px" data-action="cr-del" data-id="${id}">${ic('trash', 'sm')} Padam kursus</button>`, onSubmit: async d => { const row = { title: d.title.trim(), category: d.category, audience: d.audience, status: d.status, sort: Number(d.sort) || 0, summary: val(d.summary) }; if (d.cover && d.cover.size) row.cover_path = await uploadMedia('public-media', 'courses', d.cover); await update('courses', id, row); app.render(); } }); },
  'cr-del': id => confirmModal({ title: 'Padam kursus?', message: 'Semua pelajaran turut dipadam.', ok: 'Padam', danger: true, onOk: async () => { await remove('courses', id); app.render(); } }),
  'cl-add': cid => openModal({ title: 'Pelajaran Baharu', submit: 'Simpan', wide: true, body: clForm({ sort: T('course_lessons').filter(l => l.course_id === cid).length + 1 }), onSubmit: async d => { const row = { course_id: cid, title: d.title.trim(), sort: Number(d.sort) || 0, minutes: num(d.minutes), video_url: val(d.video_url), body: val(d.body) }; if (d.image && d.image.size) row.image_path = await uploadMedia('public-media', 'courses', d.image); await insert('course_lessons', row); app.render(); } }),
  'cl-edit': id => { const l = byId('course_lessons', id); openModal({ title: 'Edit Pelajaran', wide: true, body: clForm(l) + `<button type="button" class="btn sm danger-o" style="margin-top:12px" data-action="cl-del" data-id="${id}">${ic('trash', 'sm')} Padam</button>`, onSubmit: async d => { const row = { title: d.title.trim(), sort: Number(d.sort) || 0, minutes: num(d.minutes), video_url: val(d.video_url), body: val(d.body) }; if (d.image && d.image.size) row.image_path = await uploadMedia('public-media', 'courses', d.image); await update('course_lessons', id, row); app.render(); } }); },
  'cl-del': id => confirmModal({ title: 'Padam pelajaran?', message: '', ok: 'Padam', danger: true, onOk: async () => { await remove('course_lessons', id); app.render(); } }),
});

/* =====================================================================
   PELARASAN BIL (kredit / caj tertunda) — supaya tidak lupa
   ===================================================================== */
export const pendingAdj = sid => T('billing_adjustments').filter(a => a.status === 'pending' && (!sid || a.student_id === sid || famMembers(byId('students', sid)).some(x => x.id === a.student_id)));
VIEWS.pelarasan = () => {
  const st = UI.adjSt || 'pending', list = T('billing_adjustments').filter(a => st === 'all' || a.status === st).sort((a, b) => (a.apply_month || '').localeCompare(b.apply_month || ''));
  return `${pageHead('Pelarasan Bil', 'Rekod kredit atau caj yang perlu dibawa ke invois akan datang (cth. kawan sertai pertengahan bulan → kredit bulan depan). Peringatan muncul semasa membuat invois untuk pelajar/keluarga itu.', `<button class="btn primary" data-action="adj-add">${ic('plus', 'sm')} Pelarasan</button>`)}
  ${chips([['pending', 'Belum digunakan', T('billing_adjustments').filter(a => a.status === 'pending').length], ['applied', 'Sudah digunakan'], ['cancelled', 'Batal'], ['all', 'Semua']], st, 'adj-st')}
  <div class="card"><ul class="list">${list.map(a => `<li class="list-item">${avatar(studentName(a.student_id))}<div class="li-main"><div class="li-title">${esc(studentName(a.student_id))} · <span class="${a.kind === 'credit' ? '' : 'neg'}">${a.kind === 'credit' ? 'Kredit −' : 'Caj +'}${RM(a.amount)}</span></div>
    <div class="li-sub">${esc(a.reason)}${a.apply_month ? ' · untuk invois ' + esc(monthLabel(a.apply_month + '-01')) : ''}${a.invoice_id ? ' · ' + esc(byId('invoices', a.invoice_id)?.number || '') : ''}</div></div>
    <div class="actions">${a.status === 'pending' ? `<button class="btn sm" data-action="adj-done" data-id="${a.id}">Tanda digunakan</button><button class="btn sm danger-o" data-action="adj-cancel" data-id="${a.id}">Batal</button>` : `<span class="badge b-muted">${a.status === 'applied' ? 'Digunakan' : 'Batal'}</span>`}</div></li>`).join('') || '<li class="empty">Tiada rekod.</li>'}</ul></div>`;
};
Object.assign(ACTIONS, {
  'adj-st': k => { UI.adjSt = k; app.render(); },
  'adj-add': sid => openModal({ title: 'Pelarasan Bil', submit: 'Simpan', body: `<div class="form-grid">${F('Pelajar', 'student_id', { value: typeof sid === 'string' ? sid : '', req: true, opts: studentOpts(undefined, '— Pilih —') })}
    ${F('Jenis', 'kind', { value: 'credit', opts: [['credit', 'Kredit (tolak dari invois akan datang)'], ['charge', 'Caj tambahan (tambah ke invois akan datang)']] })}${F('Amaun (RM)', 'amount', { type: 'number', step: '0.01', min: 0.01, req: true })}
    ${F('Untuk invois bulan', 'apply_month', { type: 'month', value: addDays(todayISO(), 25).slice(0, 7) })}${F('Sebab', 'reason', { type: 'textarea', req: true, full: true, ph: 'cth. Bayaran penuh Nov; rakan sertai 12/11 — kredit 2 sesi untuk Disember' })}</div>`,
    onSubmit: async d => { await insert('billing_adjustments', { student_id: d.student_id, kind: d.kind, amount: Number(d.amount), apply_month: val(d.apply_month), reason: d.reason.trim(), created_by: S.mode === 'demo' ? null : S.profile.id }); toast('Pelarasan direkod — peringatan akan muncul semasa membuat invois'); app.render(); } }),
  'adj-done': id => update('billing_adjustments', id, { status: 'applied', applied_at: new Date().toISOString() }).then(() => app.render()),
  'adj-cancel': id => update('billing_adjustments', id, { status: 'cancelled' }).then(() => app.render()),
});

/* =====================================================================
   PELAN LATIHAN (semua coach, untuk admin)
   ===================================================================== */
VIEWS.pelanlatihan = () => { const cf = UI.lpCoach || '', list = T('lesson_plans').filter(p => !cf || p.coach_id === cf).sort((a, b) => (b.plan_date || '').localeCompare(a.plan_date || ''));
  return `${pageHead('Pelan Latihan Coach', 'Pelan sesi daripada semua coach: warm up, footwork, feeding, fizikal, sparring, pemerhatian & rancangan seterusnya. Templat boleh dikongsi kepada semua coach.', `<button class="btn primary" data-action="lp-new">${ic('plus', 'sm')} Pelan / templat</button>`)}
  <div class="card card-pad mb"><label class="field"><select data-on-change="lp-coach"><option value="">Semua coach</option>${T('staff').map(s => `<option value="${s.id}" ${cf === s.id ? 'selected' : ''}>${esc(s.full_name)}</option>`).join('')}</select></label></div>
  ${list.map(p => planCard(p)).join('') || '<div class="card empty">Belum ada pelan latihan.</div>'}`; };
INPUTS['lp-coach'] = v => { UI.lpCoach = v; app.render(); };
Object.assign(ACTIONS, {
  'lp-new': () => openPlanEditor(null, { coachId: null, onSaved: () => app.render() }),
  'lp-edit': id => openPlanEditor(byId('lesson_plans', id), { onSaved: () => app.render() }),
  'lp-view': id => { const p = byId('lesson_plans', id); openModal({ title: esc(p.title), wide: true, cancel: 'Tutup', body: planView(p) }); },
  'lp-copy': async id => { const meStaff = T('staff').find(s => s.profile_id === S.profile?.id); await copyPlan(byId('lesson_plans', id), S.profile?.role === 'coach' ? meStaff?.id : undefined); toast('Pelan disalin'); app.render(); },
});

/* Peringatan pelarasan tertunda — dipanggil oleh borang invois/jual pakej & dashboard */
export const adjHint = sid => { const L = pendingAdj(sid); return L.length ? `<div class="hint warn" style="margin:8px 0">${ic('alert', 'sm')} Pelarasan tertunda untuk keluarga ini: ${L.map(a => `${esc(studentName(a.student_id))} ${a.kind === 'credit' ? 'kredit −' : 'caj +'}${RM(a.amount)} (${esc(a.reason)})`).join('; ')}. Masukkan dalam invois ini, kemudian tanda "digunakan" di Pelarasan Bil.</div>` : ''; };
import { EXTRA_TASKS } from './helpers.js';
EXTRA_TASKS.push(add => {
  const m = todayISO().slice(0, 7);
  add(T('billing_adjustments').filter(a => a.status === 'pending' && (!a.apply_month || a.apply_month <= m)).length, 'wallet', 't-warn', '{n} pelarasan bil (kredit/caj) perlu dimasukkan dalam invois bulan ini', 'pelarasan');
  add(T('jersey_orders').filter(o => o.status === 'new').length, 'tag', 't-info', '{n} pesanan jersi belum dipesan dari supplier', 'jersi');
});
