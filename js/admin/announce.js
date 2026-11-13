// Pengumuman / berita / acara: gambar + kapsyen, sasaran (semua, ibu bapa, coach, lokasi, program, kelas, kategori umur).
import { VIEWS, ACTIONS } from '../registry.js';
import { S, insert, update, remove, rpc } from '../data.js';
import { ic, esc, F, val, app, toast, openModal, confirmModal, pageHead, fmtDate, fmtShort, todayISO, DAYS, hm } from '../ui.js';
import { T, byId, venueName, progName } from './helpers.js';
import { ageGroups } from './sessions.js';
import { uploadMedia, publicUrl } from '../media.js';

export const AUD = { all: 'Semua (ibu bapa & coach)', parents: 'Semua ibu bapa', coaches: 'Semua coach', venue: 'Ibu bapa & coach di lokasi tertentu', programme: 'Program / group tertentu', class: 'Kelas tertentu', category: 'Kategori umur tertentu' };
export const KIND = { news: ['Berita', 'b-info'], event: ['Acara', 'b-purple'], reminder: ['Peringatan', 'b-warn'], urgent: ['Penting', 'b-bad'] };
const audLabel = a => {
  const names = a.audience === 'venue' ? a.target_ids.map(venueName) : a.audience === 'programme' ? a.target_ids.map(progName)
    : a.audience === 'class' ? a.target_ids.map(id => { const c = byId('classes', id); return c ? `${DAYS[c.weekday]} ${hm(c.start_time)} ${progName(c.programme_id)}` : '—'; }) : a.audience === 'category' ? a.target_cats : [];
  return AUD[a.audience] + (names.length ? ': ' + names.join(', ') : '');
};

/** Kad suapan berita — dikongsi admin, ibu bapa & coach. tr = fungsi terjemahan label. */
export function annCard(a, tr = x => x) {
  const [k, tone] = KIND[a.kind] || KIND.news;
  return `<article class="card mb ann">${a.image_path ? `<img class="ann-img" loading="lazy" src="${publicUrl(a.image_path)}" alt="">` : ''}
    <div class="card-pad"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><span class="badge ${tone}">${esc(tr(k))}</span>${a.pinned ? `<span class="badge b-muted">📌</span>` : ''}<span class="muted" style="font-size:12px">${fmtShort((a.publish_at || a.created_at || '').slice(0, 10))}</span></div>
    <h3 style="font-size:16px;margin-bottom:4px">${esc(a.title)}</h3>${a.body ? `<p class="ann-body">${esc(a.body)}</p>` : ''}
    ${a.link ? `<a class="btn sm ${a.cta_label ? 'primary' : ''}" style="margin-top:10px" href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.cta_label ? tr(a.cta_label) : tr('Buka pautan'))}</a>` : ''}</div></article>`;
}
/* Pop-up promosi (iklan) — satu sahaja setiap kali app dibuka; "Jangan tunjuk lagi" disimpan dalam peranti. */
const POPKEY = id => 'mx_pop_' + id;
export function showAnnPopup(tr = x => x, { only } = {}) {
  let seen = []; try { seen = JSON.parse(sessionStorage.getItem('mx_pop_seen') || '[]'); } catch { /* abaikan */ }
  const a = visibleAnns().filter(x => x.popup && (!only || x.id === only)).find(x => { try { return localStorage.getItem(POPKEY(x.id)) !== '1' && !seen.includes(x.id); } catch { return !seen.includes(x.id); } });
  if (!a || document.querySelector('#modal.open')) return;
  try { sessionStorage.setItem('mx_pop_seen', JSON.stringify([...seen, a.id])); } catch { /* abaikan */ }
  const el = document.getElementById('modal');
  el.innerHTML = `<div class="modal promo" role="dialog" aria-modal="true"><button class="promo-x" data-action="close-modal" aria-label="Tutup">✕</button>
    ${a.image_path ? `<img class="promo-img" src="${publicUrl(a.image_path)}" alt="">` : ''}
    <div class="promo-in"><h3>${esc(a.title)}</h3>${a.body ? `<p>${esc(a.body)}</p>` : ''}
      <div class="promo-btns">${a.link ? `<a class="btn primary" href="${esc(a.link)}" target="_blank" rel="noopener" data-action="close-modal">${esc(tr(a.cta_label || 'Lihat butiran'))}</a>` : ''}
      <button type="button" class="btn ghost" data-action="pop-never" data-id="${a.id}">${esc(tr('Jangan tunjuk lagi'))}</button></div></div></div>`;
  el.classList.add('open');
}
ACTIONS['pop-never'] = id => { try { localStorage.setItem(POPKEY(id), '1'); } catch { /* abaikan */ } const el = document.getElementById('modal'); el.classList.remove('open'); el.innerHTML = ''; };
export const visibleAnns = () => T('announcements').filter(a => (!a.expires_on || a.expires_on >= todayISO()) && (a.publish_at || '') <= new Date().toISOString())
  .sort((a, b) => (b.pinned - a.pinned) || (b.publish_at || '').localeCompare(a.publish_at || ''));

VIEWS.berita = () => {
  const list = T('announcements').slice().sort((a, b) => (b.pinned - a.pinned) || (b.publish_at || '').localeCompare(a.publish_at || ''));
  return `${pageHead('Pengumuman & Berita', 'Hantar berita, acara atau peringatan bergambar kepada ibu bapa dan coach — semua, ikut lokasi, program, kelas atau kategori umur. Penerima juga dapat notifikasi loceng.',
    `<button class="btn primary" data-action="ann-add">${ic('plus', 'sm')} Pengumuman Baharu</button>`)}
  <div class="grid g-2">${list.map(a => `<div>${annCard(a)}<div class="muted" style="font-size:12px;margin:-8px 0 8px">${esc(audLabel(a))}${a.expires_on ? ' · tamat ' + fmtShort(a.expires_on) : ''}${a.publish_at > new Date().toISOString() ? ' · dijadual ' + fmtShort(a.publish_at.slice(0, 10)) : ''}</div>
    <div class="actions" style="margin-bottom:18px"><button class="btn sm" data-action="ann-edit" data-id="${a.id}">${ic('edit', 'sm')} Edit</button><button class="btn sm" data-action="ann-notify" data-id="${a.id}">${ic('bell', 'sm')} Hantar notifikasi</button><button class="btn sm danger-o" data-action="ann-del" data-id="${a.id}">${ic('trash', 'sm')}</button></div></div>`).join('')
    || '<div class="card empty" style="grid-column:1/-1">Belum ada pengumuman.</div>'}</div>`;
};

function annForm(a) {
  const tgt = (aud, ids = [], cats = []) => aud === 'venue' ? T('venues').filter(v => v.active).map(v => [v.id, v.name])
    : aud === 'programme' ? T('programmes').filter(p => p.active).map(p => [p.id, p.name])
    : aud === 'class' ? T('classes').filter(c => c.active).map(c => [c.id, `${DAYS[c.weekday]} ${hm(c.start_time)} · ${progName(c.programme_id)} · ${venueName(c.venue_id)}`])
    : aud === 'category' ? ageGroups().map(g => [g.code, `${g.code} (${g.min}–${g.max})`]) : [];
  const box = (aud, sel) => { const o = tgt(aud); return o.length ? `<div class="f full">Pilih sasaran<div class="langchk" style="flex-direction:column;gap:6px;max-height:200px;overflow:auto">${o.map(([v, l]) => `<label><input type="checkbox" name="targets" value="${esc(v)}" ${sel.includes(v) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>` : ''; };
  return { box, html: `<div class="form-grid">
    ${F('Tajuk', 'title', { value: a?.title, req: true, full: true, ph: 'cth. Bukit Raja Badminton Challenge 2026 — pendaftaran dibuka!' })}
    ${F('Kapsyen / keterangan', 'body', { type: 'textarea', value: a?.body, full: true })}
    <label class="f full">Gambar / poster (pilihan, maks 10MB)<input type="file" name="image" accept="image/*">${a?.image_path ? `<span class="hint">Gambar sedia ada akan dikekalkan jika tiada fail baharu. <label style="display:inline-flex;gap:4px"><input type="checkbox" name="rm_img" value="1" style="width:auto;height:auto"> buang gambar</label></span>` : ''}</label>
    ${F('Jenis', 'kind', { value: a?.kind || 'news', opts: Object.entries(KIND).map(([k, [l]]) => [k, l]) })}
    ${F('Sasaran', 'audience', { value: a?.audience || 'all', opts: Object.entries(AUD) })}
    <div class="full" id="annTgt">${box(a?.audience || 'all', [...(a?.target_ids || []), ...(a?.target_cats || [])])}</div>
    ${F('Pautkan ke kejohanan (pilihan)', 'tn_link', { value: '', opts: [['', '— Tiada —'], ...T('tournaments').filter(x => x.public_page && x.slug).map(x => ['tournament.html?t=' + x.slug, x.name])] })}
    ${F('Teks butang', 'cta_label', { value: a?.cta_label || '', ph: 'cth. Daftar sekarang / Saya berminat' })}
    ${F('Pautan (pilihan)', 'link', { value: a?.link, ph: 'https://…  atau  tournament.html?t=…', full: true })}
    <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="popup" value="1" ${a?.popup ? 'checked' : ''} style="width:auto;height:auto"> Papar sebagai pop-up promosi bila ibu bapa / coach buka app (ada butang "Jangan tunjuk lagi") — sesuai untuk kejohanan, acara & promosi dengan poster</label>
    ${F('Terbit pada', 'publish_at', { type: 'date', value: (a?.publish_at || new Date().toISOString()).slice(0, 10) })}
    ${F('Tamat paparan (pilihan)', 'expires_on', { type: 'date', value: a?.expires_on })}
    <label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="pinned" value="1" ${a?.pinned ? 'checked' : ''} style="width:auto;height:auto"> Pin di atas</label>
    ${a ? '' : `<label class="f full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="notify" value="1" checked style="width:auto;height:auto"> Hantar notifikasi loceng kepada penerima</label>`}
  </div>` };
}
async function saveAnn(d, a) {
  const aud = d.audience, sel = [].concat(d.targets || []).filter(Boolean);
  if (['venue', 'programme', 'class', 'category'].includes(aud) && !sel.length) throw new Error('Pilih sekurang-kurangnya satu sasaran.');
  let image_path = a?.image_path || null;
  if (d.rm_img === '1') image_path = null;
  if (d.image && d.image.size) image_path = await uploadMedia('public-media', 'announce', d.image, { maxMB: 10 });
  const today = todayISO(), pub = d.publish_at && d.publish_at > today ? new Date(d.publish_at + 'T07:00:00+08:00').toISOString() : (a?.publish_at && d.publish_at === a.publish_at.slice(0, 10) ? a.publish_at : new Date().toISOString());
  const row = { title: d.title.trim(), body: val(d.body), kind: d.kind, audience: aud, target_ids: aud === 'category' ? [] : sel, target_cats: aud === 'category' ? sel : [], link: val(d.tn_link) || val(d.link), cta_label: val(d.cta_label) || (val(d.tn_link) ? 'Daftar sekarang' : null), popup: d.popup === '1', publish_at: pub, expires_on: val(d.expires_on), pinned: d.pinned === '1', image_path };
  const r = a ? await update('announcements', a.id, row) : await insert('announcements', { ...row, created_by: S.mode === 'demo' ? null : S.profile.id });
  if (!a && d.notify === '1' && S.mode === 'supabase') { try { const n = await rpc('announce_notify', { p_id: r.id }); toast(`Diterbitkan · notifikasi dihantar kepada ${n} pengguna`); } catch (e) { toast(e.message, true); } }
  else toast(a ? 'Pengumuman dikemas kini' : 'Pengumuman diterbitkan');
  app.render();
}
const bind = (f, form) => f.elements.audience.addEventListener('change', e => { f.querySelector('#annTgt').innerHTML = form.box(e.target.value, []); });
Object.assign(ACTIONS, {
  'ann-add': () => { const form = annForm(); const f = openModal({ title: 'Pengumuman Baharu', submit: 'Terbitkan', wide: true, body: form.html, onSubmit: d => saveAnn(d) }); bind(f, form); },
  'ann-edit': id => { const a = byId('announcements', id), form = annForm(a); const f = openModal({ title: 'Edit Pengumuman', wide: true, body: form.html, onSubmit: d => saveAnn(d, a) }); bind(f, form); },
  'ann-del': id => confirmModal({ title: 'Padam pengumuman?', message: esc(byId('announcements', id).title), ok: 'Padam', danger: true, onOk: async () => { await remove('announcements', id); toast('Dipadam'); app.render(); } }),
  'ann-notify': async id => { if (S.mode !== 'supabase') return toast('Demo: notifikasi tidak dihantar'); const n = await rpc('announce_notify', { p_id: id }); toast(`Notifikasi dihantar kepada ${n} pengguna`); },
});
