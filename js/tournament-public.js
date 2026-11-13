// Halaman awam kejohanan: tournament.html?t=SLUG
// Maklumat, kategori ikut tahun lahir, format, hadiah, tarikh penting, saiz jersi, peraturan,
// borang daftar 4 langkah, semak status + muat naik bukti bayaran, keputusan langsung.
// v22: reka bentuk landing page penuh (notis tarikh, kiraan detik, kad kategori, format, hadiah, jersi, garis masa, peraturan).
import { CONFIG } from './config.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import { standings, GROUP_NAMES } from './tn-core.js';
import './theme.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const demo = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const slug = new URLSearchParams(location.search).get('t') || 'brbc2026';
const toast = (m, bad) => { const e = $('#toast'); e.textContent = m; e.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(e._t); e._t = setTimeout(() => (e.className = 'toast'), 4500); };
try { const q = new URLSearchParams(location.search).get('lang'); if (q) setLang(q); } catch { /* abaikan */ }
const MONTHS = () => getLang() === 'zh' ? [...Array(12)].map((_, i) => (i + 1) + '月') : getLang() === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const fd = d => { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return `${x.getDate()} ${MONTHS()[x.getMonth()]} ${x.getFullYear()}`; };
const hm = v => (v ? String(v).slice(0, 5) : '');
const RM = n => 'RM' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pubUrl = p => !p ? '' : /^https?:/.test(p) ? p : `${CONFIG.SUPABASE_URL}/storage/v1/object/public/public-media/${p}`;
const wa = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '').replace(/^0/, '60')}?text=${encodeURIComponent(text)}`;
let client = null, INFO = null, RES = null, F = { step: 1 }, LOOK = null;

const rpc = async (fn, args) => { if (demo) return demoRpc(fn, args); const { data, error } = await client.rpc(fn, args); if (error) throw error; return data; };
const track = k => { try { if (!demo && sessionStorage.getItem('tn_' + k + slug) !== '1') { sessionStorage.setItem('tn_' + k + slug, '1'); rpc('public_tn_track', { p_slug: slug, p_kind: k }); } } catch { /* abaikan */ } };


const G = { boys: () => t('Lelaki'), girls: () => t('Perempuan'), mixed: () => t('Lelaki & perempuan'), open: () => t('Terbuka') };
const parseRules = txt => String(txt || '').split('\n').reduce((acc, l) => { if (/^#\s*/.test(l)) acc.push({ h: l.replace(/^#\s*/, ''), items: [] }); else if (l.trim()) { if (!acc.length) acc.push({ h: t('Peraturan'), items: [] }); acc[acc.length - 1].items.push(l.replace(/^[-•*]\s*/, '')); } return acc; }, []);
const isOpen = T => T.status === 'open' && (!T.registration_deadline || T.registration_deadline >= new Date().toISOString().slice(0, 10));
const eligTxt = c => { const b = c.birth_from, g = c.girls_from;
  if (!b && !c.birth_to) return t('Semua umur');
  const yr = (y, to) => to ? `${y}–${to}` : t('{y} dan ke atas', { y });
  if (c.gender === 'mixed' || c.gender === 'open') return g && g !== b ? `${t('Lelaki')}: ${t('lahir')} ${yr(b, c.birth_to)} · ${t('Perempuan')}: ${t('lahir')} ${yr(g, c.birth_to)}` : `${t('Lahir')} ${yr(b, c.birth_to)}`;
  return `${t('Lahir')} ${yr(c.gender === 'girls' && g ? g : b, c.birth_to)}`; };
const eligible = (c, by, g) => { const lo = g === 'girl' && c.girls_from ? c.girls_from : c.birth_from;
  return (!by || ((!lo || by >= lo) && (!c.birth_to || by <= c.birth_to))) && (!g || c.gender === 'open' || c.gender === 'mixed' || (c.gender === 'boys' ? g === 'boy' : g === 'girl')); };
const mapUrl = T => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([T.venue, T.venue_area].filter(Boolean).join(', '))}`;
function countdown(T) {
  if (!isOpen(T) || !T.registration_deadline) return '';
  const ms = new Date(T.registration_deadline + 'T23:59:59+08:00') - Date.now(); if (ms <= 0) return '';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return `<div style="margin-top:16px;font-size:12px;color:#c9d3ef;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${t('Pendaftaran ditutup dalam')}</div><div class="cd" id="cd"><div><b>${d}</b><small>${t('hari')}</small></div><div><b>${h}</b><small>${t('jam')}</small></div><div><b>${m}</b><small>${t('minit')}</small></div></div>`;
}

function page() {
  if (!INFO?.ok) return `<div class="wrap done"><div class="big">🏸</div><h1>${t('Kejohanan tidak dijumpai')}</h1><p class="muted">${t('Pautan mungkin salah atau halaman belum diterbitkan.')}</p></div>`;
  const T = INFO.t, cats = INFO.cats || [], open = isOpen(T), rules = parseRules(T.rules);
  const max = cats.reduce((n, c) => Math.max(n, c.max || 0), 0);
  const dates = [[T.early_deadline, t('Akhir jersi percuma & bayaran penuh')], [T.registration_deadline, t('Tutup pendaftaran (atau lebih awal jika penuh)')], [T.list_date, t('Senarai peserta dikongsi')], [T.protest_end, t('Tempoh bantahan kelayakan tamat')], [T.start_date, t('Hari pertandingan'), 'game']].filter(x => x[0]).sort((a, b) => a[0].localeCompare(b[0]));
  const showRes = RES && ['ongoing', 'completed', 'closed'].includes(T.status) && (RES.matches || []).length;
  const prizes = String(T.prizes || '').split('\n').filter(l => l.trim()).map(l => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ['', l.trim()]; });
  const nameParts = String(T.name).match(/^(.*?)(\s+(?:\d{4}))?$/) || [T.name, T.name, ''];
  const contact = T.contact_phone ? wa(T.contact_phone, t('Hi, saya ingin bertanya tentang {n}', { n: T.name })) : '';
  return `
  <header class="topbar"><div class="wrap"><a class="brand" href="#top"><img src="assets/logo.png" alt=""><span>${esc(T.academy || 'Maxxima')}</span></a>
    <nav><a href="#kategori">${t('Kategori')}</a>${(T.shirt_sizes || []).length ? `<a href="#jersi">${t('Jersi')}</a>` : ''}<a href="#format">${t('Format')}</a>${rules.length ? `<a href="#peraturan">${t('Peraturan')}</a>` : ''}${showRes ? `<a href="#keputusan">${t('Keputusan')}</a>` : ''}<a href="#semak">${t('Semak status')}</a>${open ? `<a class="cta" href="#daftar" data-reg>${t('Daftar')}</a>` : ''}</nav>
    <div class="langsw2">${LANGS.map(([c, l]) => `<button type="button" class="${c === getLang() ? 'on' : ''}" data-lang="${c}">${l}</button>`).join('')}</div></div></header>
  ${T.notice ? `<div class="notice"><div class="wrap"><span class="tag">${t('NOTIS')}</span><span>${esc(T.notice)}</span>${contact ? `<a href="${contact}" target="_blank" rel="noopener">${t('Hubungi admin')}</a>` : ''}</div></div>` : ''}
  <section class="hero" id="top"><div class="wrap"><div>
    <div class="chips">${cats.length ? `<span class="chip2">${t('Junior')} ${esc(cats.map(c => (String(c.name).match(/(\d+)/) || [])[1]).filter(Boolean).sort((a, b) => a - b).filter((v, i, a) => i === 0 || i === a.length - 1).map(x => 'U' + x).join('–'))}</span>` : ''}<span class="chip2">${T.format === 'rr_groups' ? t('Round robin perseorangan') : t('Kalah mati')}</span></div>
    <h1>${esc(nameParts[1])}${nameParts[2] ? ` <em>${esc(nameParts[2].trim())}</em>` : ''}</h1>
    ${T.description ? `<p class="lead">${esc(T.description)}</p>` : ''}
    <div class="when"><span>📅 ${fd(T.start_date)}</span>${T.start_time ? `<span>⏰ ${hm(T.start_time)}${T.end_time ? '–' + hm(T.end_time) : ''}</span>` : ''}<span>📍 ${esc(T.venue || '')}${T.venue_area ? ', ' + esc(T.venue_area) : ''}</span></div>
    <div class="btns">${open ? `<a class="b lime" href="#daftar" data-reg>${t('Daftar pemain')} · ${RM(T.entry_fee)}</a>` : `<span class="b ghost">${t('Pendaftaran ditutup')}</span>`}${rules.length ? `<a class="b ghost" href="#peraturan">${t('Lihat peraturan')}</a>` : ''}</div>
    ${countdown(T)}</div>
    ${T.poster_path ? `<div class="poster"><img src="${pubUrl(T.poster_path)}" alt="${esc(T.name)}"></div>` : '<div></div>'}</div></section>

  <div class="wrap facts"><div class="grid">
    <div class="fact"><b>${cats.length}</b><span>${t('kategori junior')}</span></div>
    ${max ? `<div class="fact"><b>${max}</b><span>${t('pemain setiap kategori')}</span></div>` : ''}
    <div class="fact"><b>${RM(T.entry_fee)}</b><span>${t('setiap pemain · satu kategori')}</span></div>
    ${T.registration_deadline ? `<div class="fact"><b>${fd(T.registration_deadline).replace(/ \d{4}$/, '')}</b><span>${t('tutup pendaftaran')}</span></div>` : ''}
  </div>
  <div class="box" style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>📍 ${esc(T.venue || '')}</b><div class="muted" style="font-size:13px">${esc(T.venue_area || '')}</div></div><a class="b out" href="${mapUrl(T)}" target="_blank" rel="noopener">${t('Cari lokasi')}</a>${T.shirt_free && T.early_deadline ? `<div style="flex-basis:100%;font-size:13px;color:#7a5b00;background:#fff7e0;border-radius:10px;padding:8px 10px">👕 ${t('Daftar & bayar penuh sebelum {d} untuk jersi acara PERCUMA.', { d: fd(T.early_deadline) })}</div>` : ''}</div></div>

  ${showRes ? `<section class="sec wrap" id="keputusan"><h2>${t('Keputusan & kedudukan langsung')}</h2>${results()}</section>` : ''}

  <section class="sec wrap" id="kategori"><h2>${t('Kategori')}</h2><p class="sub">${t('{n} kategori perseorangan · kelayakan ikut tahun lahir, bukan tarikh hari jadi.', { n: cats.length })}</p>
    <div class="cards">${cats.map(c => { const left = c.max ? c.max - c.taken : null, pct = c.max ? Math.min(100, Math.round(c.taken / c.max * 100)) : 0; return `<div class="cat ${left === 0 ? 'full' : ''}"><div class="n">${esc(c.name)}</div><div class="el">${G[c.gender]?.() || ''} · ${eligTxt(c)}</div>
      ${c.max ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="row"><span>${t('{a}/{b} berdaftar', { a: c.taken, b: c.max })}</span><b>${left > 0 ? t('{n} tempat lagi', { n: left }) : t('Penuh')}</b></div>` : ''}
      <div class="row"><span>${t('Yuran')}</span><b>${RM(c.fee)}</b></div>${open && left !== 0 ? `<button class="b dark" style="justify-content:center" data-pick="${c.id}">${t('Pilih kategori')}</button>` : ''}</div>`; }).join('')}</div>
    ${T.eligibility_note ? `<div class="warn">⚠️ ${esc(T.eligibility_note)}</div>` : ''}</section>

  <section class="sec wrap" id="format"><h2>${t('Format')}</h2><p class="sub">${T.format === 'rr_groups' ? t('Setiap pemain dijamin {m} perlawanan kumpulan.', { m: (T.group_size || 4) - 1 }) : t('Kalah mati (knockout).')}</p>
    ${T.format === 'rr_groups' ? `<div class="two"><div class="box"><span class="step-n">1</span><h3>${t('Peringkat kumpulan')}</h3><p>${t('{p} pemain dibahagi kepada kumpulan A–D, {g} pemain setiap kumpulan. Setiap pemain bermain {m} perlawanan. Hanya juara kumpulan mara.', { p: max || 16, g: T.group_size || 4, m: (T.group_size || 4) - 1 })}</p></div>
      <div class="box"><span class="step-n">2</span><h3>${t('Pusingan akhir round robin')}</h3><p>${t('4 juara kumpulan bermain {m} lagi perlawanan setiap seorang. Kedudukan akhir menentukan tempat 1 hingga 4.', { m: 3 })}</p></div></div>` : ''}
    <div class="box" style="margin-top:12px"><h3>🏸 ${t('Pemarkahan')}</h3><p>${esc(T.scoring_note || t('Satu game hingga {p} mata.', { p: T.points_to }))}</p></div></section>

  ${prizes.length ? `<section class="sec wrap" id="hadiah"><h2>${t('Hadiah setiap kategori')}</h2><div class="prizes">${prizes.map(([a, b], i) => `<div class="prize ${i === 0 ? 'p1' : i === 1 ? 'p2' : ''}">${a ? `<b>${esc(a)}</b>` : ''}<span>${esc(b)}</span></div>`).join('')}</div></section>` : ''}

  ${(T.shirt_sizes || []).length ? `<section class="sec wrap" id="jersi"><h2>${t('Jersi acara')}</h2><div class="jer"><div>
      <div class="box"><p>${T.shirt_free && T.early_deadline ? t('Satu jersi untuk setiap penyertaan yang didaftar DAN dibayar penuh sebelum {d}, 11:59 malam. Pendaftaran selepas tarikh ini tidak mendapat jersi.', { d: fd(T.early_deadline) }) : t('Jersi acara tersedia.')}</p>
      <p style="margin-top:8px"><b>${t('Saiz yang dipilih adalah muktamad dan tidak boleh ditukar.')}</b></p>
      <div class="szs">${T.shirt_sizes.map(z => `<span>${esc(z)}</span>`).join('')}</div>
      ${T.size_chart_path ? `<a class="b out" href="${pubUrl(T.size_chart_path)}" target="_blank" rel="noopener">📏 ${t('Lihat carta saiz')}</a>` : ''}</div></div>
      ${(T.jersey_images || []).length ? `<div class="jer-imgs">${T.jersey_images.map(p => `<img src="${pubUrl(p)}" alt="${t('Jersi')}" loading="lazy">`).join('')}</div>` : ''}</div></section>` : ''}

  ${dates.length ? `<section class="sec wrap" id="tarikh"><h2>${t('Tarikh penting')}</h2><div class="box"><div class="tl">${dates.map(([d, l, k]) => `<div class="${k || ''}"><b>${fd(d)}</b><span>${esc(l)}</span></div>`).join('')}</div></div></section>` : ''}

  ${rules.length ? `<section class="sec wrap rules" id="peraturan"><h2>${t('Peraturan')}</h2><div class="jump">${rules.map((r, i) => `<a href="#r${i}">${esc(r.h)}</a>`).join('')}</div>${rules.map((r, i) => `<details id="r${i}" ${i === 0 ? 'open' : ''}><summary>${esc(r.h)}</summary><ul>${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</section>` : ''}

  <section class="sec wrap" id="daftar"><h2>${t('Cara mendaftar')}</h2>
    <div class="cards steps3" style="margin-bottom:16px"><div class="box"><span class="step-n">1</span><div><h3>${t('Isi borang')}</h3><p>${t('Butiran pemain, No. IC / MyKid, kategori, WhatsApp & e-mel penjaga.')}</p></div></div>
      <div class="box"><span class="step-n">2</span><div><h3>${t('Sertai kumpulan')}</h3><p>${t('Kumpulan WhatsApp kejohanan untuk cabutan, jadual & pengumuman.')}</p></div></div>
      <div class="box"><span class="step-n">3</span><div><h3>${t('Bayar & sahkan')}</h3><p>${t('Tempat disahkan selepas penganjur menyemak borang dan bayaran.')}</p></div></div></div>
    ${open ? `<div class="regbox">${form()}</div>` : `<div class="box"><p>${t('Pendaftaran ditutup.')}</p></div>`}</section>

  <section class="sec wrap" id="semak"><h2>${t('Semak status & bayaran')}</h2><div class="regbox">${lookup()}</div></section>
  <footer><div class="wrap" style="display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between"><div><b style="color:#fff">${esc(T.name)}</b><br>${fd(T.start_date)} · ${esc(T.venue || '')}</div>
    <div>${T.contact_phone ? `WhatsApp: <a href="${contact}" target="_blank" rel="noopener">${esc(T.contact_phone)}</a><br>` : ''}${T.contact_email ? `${t('E-mel')}: <a href="mailto:${esc(T.contact_email)}">${esc(T.contact_email)}</a>` : ''}</div>
    <div style="flex-basis:100%;font-size:11.5px;opacity:.7">${t('Halaman ini hanya mengira lawatan tanpa maklumat peribadi.')} ${t('No. IC penuh tidak disimpan — hanya 4 digit terakhir untuk semakan.')}</div></div></footer>`;
}

const STEPS = () => [t('Pemain'), t('Penjaga'), t('Jersi'), t('Semak')];
function payBox(ref, fee) {
  const T = INFO.t, pay = T.pay || {}, qr = T.pay_qr_path ? pubUrl(T.pay_qr_path) : pay.qr_url || '';
  return `${T.pay_note ? `<div class="hint" style="text-align:left;margin-top:10px;white-space:pre-line">${esc(T.pay_note)}</div>` : ''}${qr ? `<img class="payqr" src="${esc(qr)}" alt="QR">` : ''}
    <p class="muted" style="font-size:13px;margin-top:8px">${t('Jumlah')}: <b>${RM(fee)}</b> · ${t('Rujukan bayaran')}: <b>${esc(ref)}</b></p>`;
}
function form() {
  const T = INFO.t, cats = INFO.cats || [], s = F.step, v = F;
  const elig = cats.filter(c => eligible(c, Number(v.birth_year) || 0, v.gender) && (!c.max || c.taken < c.max));
  const bar = `<div class="steps">${[1, 2, 3, 4].map(i => `<span class="${i <= s ? 'on' : ''}"></span>`).join('')}</div><div class="stepl">${STEPS().map((x, i) => i + 1 === s ? `<b>${x}</b>` : `<span>${x}</span>`).join('')}</div>`;
  if (F.done) return `<div style="text-align:center"><div style="font-size:44px">🎉</div><h3>${t('Pendaftaran diterima!')}</h3><p>${t('No. rujukan anda')}: <b style="font-size:22px">${esc(F.done.ref)}</b></p>
    <p class="muted" style="font-size:13px">${t('Simpan nombor ini untuk semak status dan muat naik bukti bayaran.')}</p>
    ${payBox(F.done.ref, F.done.fee)}
    <div class="btns" style="justify-content:center;margin-top:14px">${F.done.group_link || T.group_link ? `<a class="b lime" href="${esc(F.done.group_link || T.group_link)}" target="_blank" rel="noopener">${t('Sertai kumpulan WhatsApp')}</a>` : ''}<a class="b dark" href="#semak" data-goref="${esc(F.done.ref)}">${t('Muat naik bukti bayaran')}</a><button class="b out" data-new>${t('Daftar pemain lain')}</button></div></div>`;
  const years = []; for (let y = new Date().getFullYear(); y >= 2000; y--) years.push(y);
  let body = '';
  if (s === 1) body = `<div class="form-grid">
    <label class="f full">${t('Nama penuh pemain (seperti dalam MyKid / IC)')}<input name="player_name" value="${esc(v.player_name || '')}" maxlength="120"></label>
    <label class="f full">${t('No. IC / MyKid (12 digit)')}<input name="ic" inputmode="numeric" maxlength="14" value="${esc(v.ic || '')}" placeholder="cth. 140523101234"><small class="muted" style="font-size:11.5px">${t('Untuk semakan umur sahaja. Hanya 4 digit terakhir disimpan.')}</small></label>
    <label class="f">${t('Jantina')}<select name="gender"><option value="">—</option><option value="boy" ${v.gender === 'boy' ? 'selected' : ''}>${t('Lelaki')}</option><option value="girl" ${v.gender === 'girl' ? 'selected' : ''}>${t('Perempuan')}</option></select></label>
    <label class="f">${t('Tahun lahir')}<select name="birth_year"><option value="">—</option>${years.map(y => `<option ${Number(v.birth_year) === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <label class="f full">${t('Kategori')}<select name="category_id"><option value="">${v.birth_year && v.gender ? (elig.length ? t('Pilih kategori yang layak') : t('Tiada kategori yang layak / kosong')) : t('Pilih tahun lahir & jantina dahulu')}</option>${elig.map(c => `<option value="${c.id}" ${v.category_id === c.id ? 'selected' : ''}>${esc(c.name)} · ${RM(c.fee)}</option>`).join('')}</select></label>
    <label class="f full">${t('Akademi / kelab / sekolah (pilihan)')}<input name="club" value="${esc(v.club || '')}" maxlength="120"></label></div>`;
  if (s === 2) body = `<div class="form-grid">
    <label class="f full">${t('Nama penjaga')}<input name="guardian_name" value="${esc(v.guardian_name || '')}" maxlength="120"></label>
    <label class="f">${t('No. WhatsApp penjaga')}<input name="guardian_phone" inputmode="tel" value="${esc(v.guardian_phone || '')}" placeholder="012-3456789"></label>
    <label class="f">${t('E-mel (untuk sijil digital)')}<input name="guardian_email" type="email" value="${esc(v.guardian_email || '')}"></label></div>`;
  if (s === 3) body = (T.shirt_sizes || []).length ? `<p class="muted" style="font-size:13px;margin-bottom:10px">${T.shirt_free && T.early_deadline ? t('Jersi percuma untuk pendaftaran yang lengkap dan dibayar penuh sebelum {d}.', { d: fd(T.early_deadline) }) + ' ' : ''}${t('Saiz muktamad selepas dihantar.')}${T.size_chart_path ? ` <a href="${pubUrl(T.size_chart_path)}" target="_blank" rel="noopener">${t('Lihat carta saiz')}</a>` : ''}</p><div class="sizes">${T.shirt_sizes.map(z => `<label><input type="radio" name="shirt_size" value="${esc(z)}" ${v.shirt_size === z ? 'checked' : ''}><span>${esc(z)}</span></label>`).join('')}</div>` : `<p class="muted">${t('Tiada jersi untuk kejohanan ini.')}</p>`;
  if (s === 4) { const c = cats.find(x => x.id === v.category_id); body = `<div class="dates">
    <div><b>${t('Pemain')}</b><span>${esc(v.player_name)} · ${v.birth_year} · ${v.gender === 'boy' ? t('Lelaki') : t('Perempuan')}${v.ic ? ' · IC ******-**-' + esc(String(v.ic).replace(/\D/g, '').slice(-4)) : ''}</span></div><div><b>${t('Kategori')}</b><span>${esc(c?.name || '')} · ${RM(c?.fee)}</span></div>
    <div><b>${t('Penjaga')}</b><span>${esc(v.guardian_name || '')} · ${esc(v.guardian_phone)}${v.guardian_email ? ' · ' + esc(v.guardian_email) : ''}</span></div>${v.shirt_size ? `<div><b>${t('Jersi')}</b><span>${esc(v.shirt_size)}</span></div>` : ''}</div>
    <label class="consent" style="display:flex;gap:8px;margin-top:14px;font-size:13px"><input type="checkbox" name="agree" style="width:auto;height:auto" ${v.agree ? 'checked' : ''}> <span>${t('Saya mengesahkan maklumat adalah benar, pemain layak mengikut peraturan, dan bersetuju dengan peraturan kejohanan. Yuran tidak dikembalikan selepas pendaftaran lengkap.')}</span></label>`; }
  return `<form id="tnf" novalidate>${bar}${body}<div style="display:flex;gap:8px;margin-top:16px">${s > 1 ? `<button type="button" class="b out" data-back>${t('Kembali')}</button>` : ''}<button type="submit" class="b dark" style="flex:1;justify-content:center">${s < 4 ? t('Teruskan') : t('Hantar pendaftaran')}</button></div></form>`;
}

function lookup() {
  const r = LOOK;
  return `<form id="lk"><div style="display:flex;gap:8px"><input name="ref" placeholder="${t('No. rujukan, cth. BRBC-7K2Q9M')}" style="flex:1;text-transform:uppercase" value="${esc(r?.ref || '')}"><button class="b dark">${t('Semak')}</button></div>
  ${r ? r.ok ? `<div class="dates" style="margin-top:12px"><div><b>${t('Pemain')}</b><span>${esc(r.player)}</span></div><div><b>${t('Kategori')}</b><span>${esc(r.category)}</span></div>
    <div><b>${t('Bayaran')}</b><span>${{ unpaid: t('Belum bayar'), pending: t('Bukti diterima — menunggu pengesahan'), paid: t('Dibayar ✓'), waived: t('Percuma'), refunded: t('Dipulangkan') }[r.pay_status]} · ${RM(r.amount)}</span></div>
    <div><b>${t('Status')}</b><span>${r.status === 'confirmed' ? t('Disahkan ✓') : r.status === 'withdrawn' ? t('Tarik diri') : t('Berdaftar')}${r.group ? ' · ' + t('Kumpulan') + ' ' + GROUP_NAMES[r.group - 1] : ''}</span></div></div>
    ${['unpaid', 'pending'].includes(r.pay_status) ? `<div style="margin-top:12px">${payBox(r.ref, r.amount)}<label class="f" style="margin-top:10px">${t('Muat naik bukti bayaran (gambar / PDF)')}<input type="file" id="proof" accept="image/*,application/pdf"></label><button type="button" class="b dark" style="margin-top:8px" data-proof>${t('Hantar bukti')}</button></div>` : ''}`
    : `<p class="muted" style="margin-top:10px">${t('No. rujukan tidak dijumpai.')}</p>` : ''}</form>`;
}

function results() {
  const E = new Map((RES.entries || []).map(e => [e.id, e])), nm = id => esc(E.get(id)?.name || '—');
  return (INFO.cats || []).map(c => {
    const ms = (RES.matches || []).filter(m => m.category_id === c.id); if (!ms.length) return '';
    const grp = [...new Set(ms.filter(m => m.stage === 'group').map(m => m.group_no))].sort((a, b) => a - b), fin = ms.filter(m => m.stage === 'final');
    const tbl = (title, list) => { const ids = [...new Set(list.flatMap(m => [m.entry_a, m.entry_b]).filter(Boolean))], st = standings(ids, list);
      return `<div class="card card-pad mb"><b>${title}</b><table class="st" style="margin-top:6px"><tr><th>${t('Pemain')}</th><th>${t('M')}</th><th>${t('K')}</th><th>+/-</th></tr>${st.map((r, i) => `<tr><td>${i + 1}. ${nm(r.id)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf - r.pa}</td></tr>`).join('')}</table>
      <table class="st" style="margin-top:8px">${list.sort((a, b) => a.round_no - b.round_no || a.match_no - b.match_no).map(m => `<tr><td>${nm(m.entry_a)}</td><td><b>${m.status === 'pending' ? (m.play_time ? hm(m.play_time) : 'vs') : m.status === 'walkover' ? 'WO' : `${m.score_a}–${m.score_b}`}</b></td><td style="text-align:right">${nm(m.entry_b)}</td></tr>`).join('')}</table></div>`; };
    const ko = ms.filter(m => m.stage === 'ko');
    return `<h3 style="margin:14px 0 8px">${esc(c.name)}</h3>${fin.length ? tbl(t('Pusingan akhir'), fin) : ''}${grp.map(g => tbl(t('Kumpulan') + ' ' + GROUP_NAMES[g - 1], ms.filter(m => m.stage === 'group' && m.group_no === g))).join('')}
      ${ko.length ? `<div class="card card-pad mb">${ko.sort((a, b) => a.round_no - b.round_no || a.match_no - b.match_no).map(m => `<div style="font-size:13px;margin:3px 0">${esc(m.round_label || '')} #${m.match_no}: ${nm(m.entry_a)} vs ${nm(m.entry_b)} ${m.score_text ? '· <b>' + esc(m.score_text) + '</b>' : ''}</div>`).join('')}</div>` : ''}`;
  }).join('');
}

function readForm() { const f = $('#tnf'); if (!f) return; const d = new FormData(f); for (const [k, v] of d.entries()) F[k] = k === 'birth_year' ? (v ? Number(v) : '') : v; if (f.agree) F.agree = f.agree.checked; }
function render() {
  $('#reg').innerHTML = page();
  clearInterval(render._cd); if ($('#cd')) render._cd = setInterval(() => { const el = $('#cd'); if (!el) return; const T = INFO.t, ms = new Date(T.registration_deadline + 'T23:59:59+08:00') - Date.now(); if (ms <= 0) return; const v = [Math.floor(ms / 864e5), Math.floor(ms % 864e5 / 36e5), Math.floor(ms % 36e5 / 6e4)]; el.querySelectorAll('b').forEach((b, i) => { b.textContent = v[i]; }); }, 30000);
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { readForm(); setLang(b.dataset.lang); render(); }));
  document.querySelectorAll('[data-reg]').forEach(b => b.addEventListener('click', () => track('register_click')));
  document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { F.category_id = b.dataset.pick; const c = INFO.cats.find(x => x.id === b.dataset.pick); if (c?.gender === 'boys') F.gender = 'boy'; if (c?.gender === 'girls') F.gender = 'girl'; F.step = 1; F.done = null; track('register_click'); render(); $('#daftar').scrollIntoView({ behavior: 'smooth' }); }));
  const f = $('#tnf');
  if (f) {
    f.querySelectorAll('select[name=birth_year],select[name=gender]').forEach(x => x.addEventListener('change', () => { readForm(); render(); $('#tnf').scrollIntoView({ block: 'center' }); }));
    f.querySelector('input[name=ic]')?.addEventListener('change', e => { const d = e.target.value.replace(/\D/g, ''); if (d.length === 12) { const yy = Number(d.slice(0, 2)), y = (yy > (new Date().getFullYear() % 100) ? 1900 : 2000) + yy; readForm(); F.ic = d; F.birth_year = y; if (!F.gender) F.gender = Number(d.slice(-1)) % 2 ? 'boy' : 'girl'; render(); } });
    f.querySelector('[data-back]')?.addEventListener('click', () => { readForm(); F.step--; render(); $('#daftar').scrollIntoView(); });
    f.addEventListener('submit', async e => {
      e.preventDefault(); readForm();
      if (F.step === 1 && (!String(F.player_name || '').trim() || !F.birth_year || !F.gender || !F.category_id)) return toast(t('Lengkapkan nama, tahun lahir, jantina dan kategori.'), true);
      if (F.step === 1 && F.ic) { const d = String(F.ic).replace(/\D/g, ''); if (d.length !== 12) return toast(t('No. IC / MyKid mesti 12 digit.'), true); if (Number(d.slice(0, 2)) !== Number(F.birth_year) % 100) return toast(t('Tahun lahir tidak sepadan dengan No. IC / MyKid.'), true); }
      if (F.step === 2 && String(F.guardian_phone || '').replace(/\D/g, '').length < 9) return toast(t('Isi no. WhatsApp penjaga yang sah.'), true);
      if (F.step === 3 && (INFO.t.shirt_sizes || []).length && !F.shirt_size) return toast(t('Pilih saiz jersi.'), true);
      if (F.step < 4) { F.step++; render(); $('#daftar').scrollIntoView(); return; }
      if (!F.agree) return toast(t('Sila tanda pengesahan.'), true);
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const r = await rpc('public_tn_register', { p_slug: slug, p: { player_name: F.player_name, ic: F.ic, birth_year: F.birth_year, gender: F.gender, category_id: F.category_id, club: F.club, guardian_name: F.guardian_name, guardian_phone: F.guardian_phone, guardian_email: F.guardian_email, shirt_size: F.shirt_size } });
        F = { step: 1, done: { ...r, group_link: r.group_link || INFO.t.group_link } }; LOOK = null; INFO = await rpc('public_tn_info', { p_slug: slug }); render(); $('#daftar').scrollIntoView();
      } catch (err) { toast(err.message || String(err), true); btn.disabled = false; }
    });
    f.closest('section')?.querySelector('[data-new]');
  }
  document.querySelector('[data-new]')?.addEventListener('click', () => { F = { step: 1 }; render(); $('#daftar').scrollIntoView(); });
  document.querySelector('[data-goref]')?.addEventListener('click', async e => { e.preventDefault(); try { LOOK = await rpc('public_tn_status', { p_ref: e.target.dataset.goref }); render(); $('#semak').scrollIntoView(); } catch (err) { toast(err.message, true); } });
  const lk = $('#lk');
  lk?.addEventListener('submit', async e => { e.preventDefault(); const ref = new FormData(lk).get('ref'); if (!ref) return; try { LOOK = await rpc('public_tn_status', { p_ref: ref }); if (LOOK) LOOK.ref ||= String(ref).toUpperCase(); track('status_check'); render(); $('#semak').scrollIntoView(); } catch (err) { toast(err.message, true); } });
  lk?.querySelector('[data-proof]')?.addEventListener('click', async ev => {
    const file = $('#proof')?.files?.[0]; if (!file) return toast(t('Pilih fail bukti dahulu.'), true);
    if (file.size > 5 * 1024 * 1024) return toast(t('Fail terlalu besar (maksimum 5MB).'), true);
    ev.target.disabled = true;
    try {
      const path = `tournament/${LOOK.ref}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      if (!demo) { const { error } = await client.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false }); if (error) throw error; }
      await rpc('public_tn_proof', { p_ref: LOOK.ref, p_path: path });
      LOOK = await rpc('public_tn_status', { p_ref: LOOK.ref }); toast(t('Bukti dihantar. Penganjur akan sahkan.')); render(); $('#semak').scrollIntoView();
    } catch (err) { toast(err.message || String(err), true); ev.target.disabled = false; }
  });
}

/* ---- Data demo (tanpa pelayan) ---- */
const DEMO_DB = { entries: [] };
function demoRpc(fn, a) {
  const y = new Date().getFullYear();
  const info = { ok: true, t: { name: 'Bukit Raja Badminton Challenge 2026', start_date: `${y}-12-12`, start_time: '13:00', end_time: '21:00', venue: 'GoTeam Sports Complex', venue_area: 'Bukit Raja', entry_fee: 150, status: 'open', registration_deadline: `${y}-12-04`, early_deadline: `${y}-11-30`, list_date: `${y}-12-05`, protest_end: `${y}-12-10`, format: 'rr_groups', group_size: 4, points_to: 20, shirt_free: true, shirt_sizes: ['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL'], prizes: 'Johan: raket + pingat + sijil\nNaib johan: beg + pingat + sijil\nTempat 3 & 4: pingat + sijil', rules: '# Kelayakan\nKelayakan ikut tahun lahir\nPemain negeri/kebangsaan tidak layak\n# Pemarkahan\nSatu game hingga 20 mata, tiada deuce', pay_note: 'DuitNow / Maybank 5xxxxxxxxx (Maxxima Badminton Academy)\nRujukan: no. pendaftaran anda', contact_phone: '0123351291', notice: 'TARIKH BAHARU: Sabtu, 12 Disember 2026 (asal 7 November 2026). Masa dan tempat tidak berubah.', description: 'Kejohanan round robin perseorangan junior untuk pemain bukan negeri.', scoring_note: 'Satu game hingga 20 mata, tanpa deuce — pada 19–19, mata seterusnya menang.', eligibility_note: 'Pemain negeri / kebangsaan tidak layak.', group_link: 'https://chat.whatsapp.com/demo', academy: 'Maxxima Badminton Academy' },
    cats: [{ id: 'c1', name: 'Singles Under 8 (Boys & Girls)', gender: 'mixed', birth_from: 2018, girls_from: 2017, birth_to: null, max: 16, fee: 150, taken: 5 }, { id: 'c2', name: "Boys' Singles Under 12", gender: 'boys', birth_from: 2014, birth_to: null, max: 16, fee: 150, taken: 16 }, { id: 'c3', name: "Girls' Singles Under 12", gender: 'girls', birth_from: 2014, birth_to: null, max: 16, fee: 150, taken: 3 }] };
  if (fn === 'public_tn_info') return info;
  if (fn === 'public_tn_results') return { entries: [], matches: [] };
  if (fn === 'public_tn_track') return null;
  if (fn === 'public_tn_register') { const ref = 'BRBC-' + Math.random().toString(36).slice(2, 8).toUpperCase(); DEMO_DB.entries.push({ ref, ...a.p, pay_status: 'unpaid' }); return { ref, fee: 150, category: 'demo' }; }
  if (fn === 'public_tn_status') { const e = DEMO_DB.entries.find(x => x.ref === String(a.p_ref).toUpperCase()); return e ? { ok: true, ref: e.ref, player: e.player_name, category: 'Demo', pay_status: e.pay_status, status: 'registered', amount: 150 } : { ok: false }; }
  if (fn === 'public_tn_proof') { const e = DEMO_DB.entries.find(x => x.ref === a.p_ref); if (e) e.pay_status = 'pending'; return null; }
}

(async () => {
  try {
    if (!demo) { const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: false } }); }
    INFO = await rpc('public_tn_info', { p_slug: slug });
    if (INFO?.ok) { document.title = INFO.t.name; track('view'); try { RES = await rpc('public_tn_results', { p_slug: slug }); } catch { RES = null; } }
    render();
  } catch (e) { console.error(e); $('#reg').innerHTML = `<div class="done"><h1>${t('Ralat')}</h1><p class="muted">${esc(e.message || e)}</p></div>`; }
})();
