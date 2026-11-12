// Penganjuran Kejohanan: kejohanan → kategori → peserta → cabutan → keputusan.
import { VIEWS, ACTIONS, INPUTS } from '../registry.js';
import { S, insert, update, remove } from '../data.js';
import { ic, esc, F, RM, sum, num, val, badge, avatar, UI, app, toast, openModal, closeModal, confirmModal, pageHead, fmtDate, fmtShort, hm, todayISO, addDays, LABEL, $ } from '../ui.js';
import { T, byId, venueName, studentName, entryLabel, ageOf, invStatus } from './helpers.js';
import { buildDraw, nextSlot } from './bracket.js';

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
  ${F('Nama kejohanan', 'name', { value: t?.name, req: true, full: true, ph: 'cth. Maxxima Open 2026' })}
  ${F('Lokasi', 'venue_id', { value: t?.venue_id || '', opts: [['', '— Lain / belum pasti —'], ...T('venues').map(v => [v.id, v.name])] })}
  ${F('Nota lokasi', 'venue_note', { value: t?.venue_note, ph: 'jika bukan lokasi akademi' })}
  ${F('Tarikh mula', 'start_date', { type: 'date', value: t?.start_date })}
  ${F('Tarikh tamat', 'end_date', { type: 'date', value: t?.end_date })}
  ${F('Tutup pendaftaran', 'registration_deadline', { type: 'date', value: t?.registration_deadline })}
  ${F('Yuran penyertaan (RM)', 'entry_fee', { type: 'number', step: '0.01', min: 0, value: t?.entry_fee ?? 0 })}
  ${F('Status', 'status', { value: t?.status || 'draft', opts: STATUS_ORDER.map(s => [s, LABEL[s]]), full: true })}
  ${F('Keterangan / peraturan', 'description', { type: 'textarea', value: t?.description, full: true })}
</div>`;
const tnPatch = d => ({ name: d.name.trim(), venue_id: val(d.venue_id), venue_note: val(d.venue_note), start_date: val(d.start_date), end_date: val(d.end_date), registration_deadline: val(d.registration_deadline), entry_fee: num(d.entry_fee) || 0, status: d.status, description: val(d.description) });

/* ---------------------------------------------------------------------
   BUTIRAN KEJOHANAN
   --------------------------------------------------------------------- */
function detail(id) {
  const t = byId('tournaments', id);
  if (!t) return `<div class="card empty">Kejohanan tidak dijumpai. <a href="#kejohanan" style="color:var(--info)">Kembali ke senarai</a></div>`;
  const cats = catsOf(id), tab = UI.tnTab || 'kategori';
  if (!cats.find(c => c.id === UI.tnCat)) UI.tnCat = cats[0]?.id;
  const cat = byId('tournament_categories', UI.tnCat);
  const tabs = [['kategori', 'Kategori'], ['peserta', 'Peserta'], ['cabutan', 'Cabutan & Keputusan']];
  const catPicker = cats.length ? `<label class="field" style="max-width:340px">${ic('list', 'sm') || ''}<select data-on-change="tn-cat">${cats.map(c => `<option value="${c.id}" ${c.id === UI.tnCat ? 'selected' : ''}>${esc(c.name)} (${entriesOf(c.id).filter(e => e.status !== 'withdrawn').length})</option>`).join('')}</select></label>` : '';

  return `
  <a href="#kejohanan" class="btn sm ghost" style="margin-bottom:10px">${ic('back', 'sm')} Semua kejohanan</a>
  <div class="card card-pad mb">
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      <div class="kpi-ico t-purple" style="display:grid;width:52px;height:52px">${ic('trophy')}</div>
      <div style="flex:1;min-width:220px"><h1 style="font-size:21px;font-weight:800;letter-spacing:-.02em">${esc(t.name)}</h1>
        <div class="muted" style="margin-top:2px">${t.start_date ? fmtDate(t.start_date) + (t.end_date && t.end_date !== t.start_date ? ' – ' + fmtDate(t.end_date) : '') : 'Tarikh belum ditetapkan'} · ${esc(t.venue_id ? venueName(t.venue_id) : t.venue_note || 'lokasi belum ditetapkan')}</div>
        <div class="muted" style="font-size:12.5px;margin-top:2px">Yuran penyertaan: <b style="color:var(--ink)">${t.entry_fee ? RM(t.entry_fee) : 'Percuma'}</b>${t.registration_deadline ? ' · tutup pendaftaran ' + fmtDate(t.registration_deadline) : ''}</div>
        ${t.description ? `<p style="margin-top:8px;font-size:13px">${esc(t.description)}</p>` : ''}</div>
      <div class="actions"><label class="field"><select data-on-change="tn-status">${STATUS_ORDER.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${LABEL[s]}</option>`).join('')}</select></label>
        <button class="btn" data-action="tn-edit" data-id="${id}">${ic('edit', 'sm')} Edit</button></div>
    </div>
  </div>
  <div class="chips">${tabs.map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-action="tn-tab" data-id="${k}">${l}</button>`).join('')}</div>
  ${tab === 'kategori' ? tabCategories(t, cats) : !cats.length ? `<div class="card empty">Tambah kategori dahulu di tab <b>Kategori</b>.</div>` : `<div style="margin-bottom:12px">${catPicker}</div>` + (tab === 'peserta' ? tabEntries(t, cat) : tabDraw(t, cat))}`;
}

function tabCategories(t, cats) {
  return `<div class="card"><div class="card-head"><h3>Kategori Pertandingan</h3><button class="btn sm primary" data-action="cat-add" data-id="${t.id}">${ic('plus', 'sm')} Tambah Kategori</button></div>
  <div class="table-wrap"><table><thead><tr><th>Kategori</th><th>Jenis</th><th>Jantina</th><th>Umur</th><th>Peserta</th><th></th></tr></thead>
  <tbody>${cats.map(c => { const n = entriesOf(c.id).filter(e => e.status !== 'withdrawn').length; return `<tr><td><b>${esc(c.name)}</b></td><td>${LABEL[c.kind]}</td><td>${LABEL[c.gender]}</td><td>${esc(c.age_group || '—')}</td><td class="num">${n}${c.max_entries ? ' / ' + c.max_entries : ''}</td><td style="white-space:nowrap"><button class="btn sm" data-action="cat-edit" data-id="${c.id}">${ic('edit', 'sm')}</button></td></tr>`; }).join('') || `<tr><td colspan="6" class="empty">Belum ada kategori. Contoh: <i>Perseorangan Lelaki B12</i>, <i>Beregu Perempuan B14</i>.</td></tr>`}</tbody></table></div></div>`;
}

function tabEntries(t, cat) {
  const es = entriesOf(cat.id).sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || entryLabel(a).localeCompare(entryLabel(b)));
  const locked = matchesOf(cat.id).length > 0;
  return `<div class="card"><div class="card-head"><div><h3>Peserta — ${esc(cat.name)}</h3><div class="sub">${locked ? 'Cabutan telah dijana. Reset cabutan untuk menukar peserta.' : 'Sahkan peserta selepas bayaran diterima.'}</div></div><button class="btn sm primary" data-action="ent-add" data-id="${cat.id}" ${locked ? 'disabled' : ''}>${ic('plus', 'sm')} Tambah Peserta</button></div>
  <div class="table-wrap"><table><thead><tr><th>Peserta</th><th>Seed</th><th>Status</th><th>Yuran</th><th></th></tr></thead>
  <tbody>${es.map(e => { const inv = byId('invoices', e.invoice_id); const s = byId('students', e.student_id); return `<tr>
    <td><div class="cell-person">${avatar(studentName(e.student_id))}<div><b>${esc(entryLabel(e))}</b><span>${s?.birth_date ? ageOf(s.birth_date) + ' thn' : ''}</span></div></div></td>
    <td><input class="seed-in" type="number" min="1" value="${e.seed ?? ''}" placeholder="—" data-on-change="ent-seed" data-key="${e.id}" ${locked ? 'disabled' : ''}></td>
    <td><select class="att-select" data-on-change="ent-status" data-key="${e.id}">${['registered', 'confirmed', 'withdrawn'].map(s => `<option value="${s}" ${e.status === s ? 'selected' : ''}>${LABEL[s]}</option>`).join('')}</select></td>
    <td>${inv ? badge(invStatus(inv)) : (t.entry_fee > 0 ? `<button class="btn sm" data-action="ent-invoice" data-id="${e.id}">Keluarkan invois</button>` : '<span class="muted">Percuma</span>')}</td>
    <td><button class="btn sm" data-action="ent-del" data-id="${e.id}" ${locked ? 'disabled' : ''} title="Buang">${ic('trash', 'sm')}</button></td></tr>`; }).join('') || `<tr><td colspan="5" class="empty">Belum ada peserta dalam kategori ini.</td></tr>`}</tbody></table></div></div>`;
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
});

Object.assign(ACTIONS, {
  'tn-tab': id => { UI.tnTab = id; app.render(); },
  'tn-add': () => openModal({ title: 'Kejohanan Baharu', submit: 'Cipta Kejohanan', body: tnForm(), onSubmit: async d => { const r = await insert('tournaments', tnPatch(d)); toast('Kejohanan dicipta'); UI.tnTab = 'kategori'; location.hash = 'kejohanan/' + r.id; app.render(); } }),
  'tn-edit': id => openModal({
    title: 'Edit Kejohanan', body: tnForm(byId('tournaments', id)) + `<div style="margin-top:14px"><button type="button" class="btn sm danger-o" data-action="tn-del" data-id="${id}">${ic('trash', 'sm')} Padam kejohanan</button></div>`,
    onSubmit: async d => { await update('tournaments', id, tnPatch(d)); toast('Kejohanan dikemas kini'); app.render(); },
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
  'draw-reset': cid => confirmModal({ title: 'Reset cabutan?', message: 'Semua perlawanan dan keputusan dalam kategori ini akan dipadam supaya cabutan boleh dijana semula.', ok: 'Reset Cabutan', danger: true, onOk: async () => { for (const m of matchesOf(cid)) await remove('tournament_matches', m.id); toast('Cabutan direset'); app.render(); } }),

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
  const inv = await insert('invoices', { student_id: e.student_id, kind: 'tournament', description: `Penyertaan ${t.name} — ${cat.name}`, amount: t.entry_fee, issued_on: todayISO(), due_date: t.registration_deadline && t.registration_deadline >= todayISO() ? t.registration_deadline : addDays(todayISO(), 7), status: 'issued' });
  await update('tournament_entries', e.id, { invoice_id: inv.id });
}

const catForm = c => `<div class="form-grid">
  ${F('Nama kategori', 'name', { value: c?.name, req: true, full: true, ph: 'cth. Perseorangan Lelaki B12' })}
  ${F('Jenis', 'kind', { value: c?.kind || 'singles', opts: [['singles', 'Perseorangan'], ['doubles', 'Beregu']] })}
  ${F('Jantina', 'gender', { value: c?.gender || 'open', opts: [['boys', 'Lelaki'], ['girls', 'Perempuan'], ['mixed', 'Campuran'], ['open', 'Terbuka']] })}
  ${F('Kumpulan umur', 'age_group', { value: c?.age_group, ph: 'cth. B12 / B14 / Terbuka' })}
  ${F('Maks. peserta', 'max_entries', { type: 'number', min: 2, value: c?.max_entries ?? '', ph: 'tanpa had' })}
</div>`;
const catPatch = d => ({ name: d.name.trim(), kind: d.kind, gender: d.gender, age_group: val(d.age_group), max_entries: num(d.max_entries) });
