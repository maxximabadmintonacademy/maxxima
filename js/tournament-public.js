// Halaman awam kejohanan: tournament.html?t=SLUG
// Maklumat, kategori ikut tahun lahir, format, hadiah, tarikh penting, saiz jersi, peraturan,
// borang daftar 4 langkah, semak status + muat naik bukti bayaran, keputusan langsung.
// v22: reka bentuk landing page penuh (notis tarikh, kiraan detik, kad kategori, format, hadiah, jersi, garis masa, peraturan).
import { CONFIG } from './config.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import { standings, GROUP_NAMES } from './tn-core.js';
import { certDoc } from './cert.js';
import { openDoc } from './docview.js';
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
document.addEventListener('click', async e => { const b = e.target.closest('[data-copy]'); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch { const x = document.createElement('textarea'); x.value = b.dataset.copy; document.body.append(x); x.select(); document.execCommand('copy'); x.remove(); }
  b.textContent = t('Disalin ✓'); setTimeout(() => (b.textContent = t('Salin')), 1800); });
let client = null, INFO = null, RES = null, F = { step: 1 }, LOOK = null, FEED = [], ME = null;

const QD04 = { model: 'QD04', head: ['4XS', '3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'], rows: [['Bahu', '13', '13.5', '15', '16', '17', '18', '19', '20', '21', '22', '24', '26'], ['Dada', '31', '33', '34', '36', '38', '40', '42', '44', '46', '48', '52', '56'], ['Lengan', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11.5', '12'], ['Panjang', '19', '20.5', '24', '25', '26', '27', '28', '29', '30', '31', '33', '35']], note: 'Ukuran boleh berbeza ±5%.' };
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
  const showRes = RES && (T.draw_public || ['ongoing', 'completed', 'closed'].includes(T.status)) && (RES.matches || []).length;
  const prizes = String(T.prizes || '').split('\n').filter(l => l.trim()).map(l => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ['', l.trim()]; });
  const nameParts = String(T.name).match(/^(.*?)(\s+(?:\d{4}))?$/) || [T.name, T.name, ''];
  const contact = T.contact_phone ? wa(T.contact_phone, t('Hi, saya ingin bertanya tentang {n}', { n: T.name })) : '';
  return `
  <header class="topbar"><div class="wrap"><a class="brand" href="#top"><img src="assets/logo.png" alt=""><span>${esc(T.academy || 'Maxxima')}</span></a>
    <nav><a href="#kategori">${t('Kategori')}</a>${(T.shirt_sizes || []).length ? `<a href="#jersi">${t('Jersi')}</a>` : ''}${T.pay_note || T.pay_qr_path ? `<a href="#bayaran">${t('Bayaran')}</a>` : ''}<a href="#format">${t('Format')}</a>${rules.length ? `<a href="#peraturan">${t('Peraturan')}</a>` : ''}${showRes ? `<a href="#keputusan">${T.status === 'open' || T.status === 'closed' ? t('Cabutan') : t('Keputusan')}</a>` : ''}<a href="#peserta">${t('Portal peserta')}</a><a href="#semak">${t('Semak status')}</a>${open ? `<a class="cta" href="#daftar" data-reg>${t('Daftar')}</a>` : ''}</nav>
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

  ${showRes ? `<section class="sec wrap" id="keputusan"><h2>${['ongoing', 'completed'].includes(T.status) ? t('Keputusan & kedudukan langsung') : t('Cabutan kumpulan & jadual')}</h2>${results()}</section>` : ''}

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
      ${T.size_chart_path ? `<a class="b out" href="${pubUrl(T.size_chart_path)}" target="_blank" rel="noopener">📏 ${t('Lihat carta saiz')}</a>` : ''}</div>${sizeChart()}</div>
      ${(T.jersey_images || []).length ? `<div class="jer-imgs">${T.jersey_images.map(p => `<img src="${pubUrl(p)}" alt="${t('Jersi')}" loading="lazy">`).join('')}</div>` : ''}</div></section>` : ''}

  ${dates.length ? `<section class="sec wrap" id="tarikh"><h2>${t('Tarikh penting')}</h2><div class="box"><div class="tl">${dates.map(([d, l, k]) => `<div class="${k || ''}"><b>${fd(d)}</b><span>${esc(l)}</span></div>`).join('')}</div></div></section>` : ''}

  ${rules.length ? `<section class="sec wrap rules" id="peraturan"><h2>${t('Peraturan')}</h2><div class="jump">${rules.map((r, i) => `<a href="#r${i}">${esc(r.h)}</a>`).join('')}</div>${rules.map((r, i) => `<details id="r${i}" ${i === 0 ? 'open' : ''}><summary>${esc(r.h)}</summary><ul>${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</section>` : ''}

  ${T.pay_note || T.pay_qr_path ? `<section class="sec wrap" id="bayaran"><h2>${t('Yuran & bayaran')}</h2><div class="jer"><div class="box">
    <div class="fees">${[...new Set((INFO.cats || []).map(c => Number(c.fee || 0)))].length > 1 ? (INFO.cats || []).map(c => `<div><span>${esc(c.name)}</span><b>${RM(c.fee)}</b></div>`).join('') : `<div><span>${t('Yuran penyertaan setiap kategori')}</span><b>${RM((INFO.cats || [])[0]?.fee ?? T.entry_fee)}</b></div>`}</div>
    <ol class="paysteps"><li>${t('Daftar dan simpan no. rujukan anda.')}</li><li>${t('Bayar ke akaun di sebelah — guna no. rujukan sebagai rujukan bayaran.')}</li><li>${t('Muat naik bukti bayaran di "Semak status & bayaran".')}</li></ol>
    ${T.registration_deadline ? `<p class="muted" style="font-size:13px;margin-top:8px">${t('Pendaftaran & bayaran ditutup {d}.', { d: fd(T.registration_deadline) })}</p>` : ''}</div>
    <div>${payBox('', null)}</div></div></section>` : ''}

  <section class="sec wrap" id="daftar"><h2>${t('Cara mendaftar')}</h2>
    <div class="cards steps3" style="margin-bottom:16px"><div class="box"><span class="step-n">1</span><div><h3>${t('Isi borang')}</h3><p>${t('Butiran pemain, No. IC / MyKid, kategori, WhatsApp & e-mel penjaga.')}</p></div></div>
      <div class="box"><span class="step-n">2</span><div><h3>${t('Sertai kumpulan')}</h3><p>${t('Kumpulan WhatsApp kejohanan untuk cabutan, jadual & pengumuman.')}</p></div></div>
      <div class="box"><span class="step-n">3</span><div><h3>${t('Bayar & sahkan')}</h3><p>${t('Tempat disahkan selepas penganjur menyemak borang dan bayaran.')}</p></div></div></div>
    ${open ? `<div class="regbox">${form()}</div>` : `<div class="box"><p>${t('Pendaftaran ditutup.')}</p></div>`}</section>

  <section class="sec wrap" id="peserta"><h2>${t('Portal peserta')}</h2><p class="sub">${t('Log masuk dengan No. rujukan dan No. WhatsApp penjaga untuk lihat kumpulan, jadual & keputusan, dan muat turun sijil.')}</p><div class="regbox">${playerBox()}</div></section>
  <section class="sec wrap" id="semak"><h2>${t('Semak status & bayaran')}</h2><div class="regbox">${lookup()}</div></section>
  <footer><div class="wrap" style="display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between"><div><b style="color:#fff">${esc(T.name)}</b><br>${fd(T.start_date)} · ${esc(T.venue || '')}</div>
    <div>${T.contact_phone ? `WhatsApp: <a href="${contact}" target="_blank" rel="noopener">${esc(T.contact_phone)}</a><br>` : ''}${T.contact_email ? `${t('E-mel')}: <a href="mailto:${esc(T.contact_email)}">${esc(T.contact_email)}</a>` : ''}</div>
    <div style="flex-basis:100%;font-size:11.5px;opacity:.7">${t('Halaman ini hanya mengira lawatan tanpa maklumat peribadi.')} ${t('No. IC penuh tidak disimpan — hanya 4 digit terakhir untuk semakan.')}</div></div></footer>`;
}

const STEPS = () => [t('Pemain'), t('Penjaga'), t('Jersi'), t('Semak')];
/** Butiran bayaran: setiap baris arahan bayaran; no. akaun (8+ digit) dan no. rujukan boleh disalin dengan satu tekan. */
const copyBtn = v => `<button type="button" class="cp" data-copy="${esc(v)}">${t('Salin')}</button>`;
function payLines() {
  const T = INFO.t;
  return String(T.pay_note || '').split('\n').map(x => x.trim()).filter(Boolean).map(l => { const n = (l.match(/\d[\d\s-]{6,}\d/) || [])[0];
    return `<div class="pl${n && n.replace(/\D/g, '').length >= 8 ? ' acc' : ''}"><span>${esc(l)}</span>${n && n.replace(/\D/g, '').length >= 8 ? copyBtn(n.replace(/\D/g, '')) : ''}</div>`; }).join('');
}
function payBox(ref, fee) {
  const T = INFO.t, pay = T.pay || {}, qr = T.pay_qr_path ? pubUrl(T.pay_qr_path) : pay.qr_url || '';
  return `<div class="paybox">${T.pay_note ? `<div class="pls">${payLines()}</div>` : ''}${qr ? `<img class="payqr" src="${esc(qr)}" alt="QR DuitNow">` : ''}
    ${fee != null ? `<div class="pl"><span>${t('Jumlah')}: <b>${RM(fee)}</b></span></div>` : ''}${ref ? `<div class="pl ref"><span>${t('Rujukan bayaran')}: <b>${esc(ref)}</b></span>${copyBtn(ref)}</div>` : `<div class="pl ref"><span>${t('Rujukan bayaran')}: <b>${t('no. pendaftaran anda')}</b></span></div>`}
    ${T.shirt_free && T.early_deadline ? `<div class="pl note"><span>${t('Bayar penuh sebelum {d} untuk dapat jersi percuma.', { d: fd(T.early_deadline) })}</span></div>` : ''}</div>`;
}
const SZ_LABEL = { 'Bahu': () => t('Bahu'), 'Dada': () => t('Dada'), 'Lengan': () => t('Lengan'), 'Panjang': () => t('Panjang') };
/** Carta saiz (inci) — lajur saiz dipilih ditonjolkan. */
function sizeChart(sel) {
  const c = INFO.t.size_chart; if (!c || !(c.head || []).length) return '';
  const hi = c.head.indexOf(sel);
  return `<div class="szc"><div class="szc-h"><b>📏 ${t('Carta saiz')}${c.model ? ' · ' + esc(c.model) : ''}</b><span>${t('ukuran baju dalam inci')}</span></div>
    <div class="szc-w"><table><thead><tr><th>${t('Saiz')}</th>${c.head.map((h, i) => `<th class="${i === hi ? 'on' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${(c.rows || []).map(r => `<tr><th>${esc((SZ_LABEL[r[0]] || (() => r[0]))())}</th>${c.head.map((_, i) => `<td class="${i === hi ? 'on' : ''}">${esc(r[i + 1] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p>${t('Cara pilih: letak baju-T pemain yang muat di atas meja, ukur dari ketiak ke ketiak dan darab 2 untuk dada, kemudian bandingkan dengan carta. Jika antara dua saiz, pilih yang lebih besar.')}${c.note ? ' ' + esc(t(c.note)) : ''}</p></div>`;
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
  if (s === 3) body = (T.shirt_sizes || []).length ? `<p class="muted" style="font-size:13px;margin-bottom:10px">${T.shirt_free && T.early_deadline ? t('Jersi percuma untuk pendaftaran yang lengkap dan dibayar penuh sebelum {d}.', { d: fd(T.early_deadline) }) + ' ' : ''}${t('Saiz muktamad selepas dihantar.')}${T.size_chart_path ? ` <a href="${pubUrl(T.size_chart_path)}" target="_blank" rel="noopener">${t('Lihat carta saiz')}</a>` : ''}</p><div class="sizes">${T.shirt_sizes.map(z => `<label><input type="radio" name="shirt_size" value="${esc(z)}" ${v.shirt_size === z ? 'checked' : ''}><span>${esc(z)}</span></label>`).join('')}</div>${sizeChart(v.shirt_size)}` : `<p class="muted">${t('Tiada jersi untuk kejohanan ini.')}</p>`;
  if (s === 4) { const c = cats.find(x => x.id === v.category_id); body = `<div class="dates">
    <div><b>${t('Pemain')}</b><span>${esc(v.player_name)} · ${v.birth_year} · ${v.gender === 'boy' ? t('Lelaki') : t('Perempuan')}${v.ic ? ' · IC ******-**-' + esc(String(v.ic).replace(/\D/g, '').slice(-4)) : ''}</span></div><div><b>${t('Kategori')}</b><span>${esc(c?.name || '')} · ${RM(c?.fee)}</span></div>
    <div><b>${t('Penjaga')}</b><span>${esc(v.guardian_name || '')} · ${esc(v.guardian_phone)}${v.guardian_email ? ' · ' + esc(v.guardian_email) : ''}</span></div>${v.shirt_size ? `<div><b>${t('Jersi')}</b><span>${esc(v.shirt_size)}</span></div>` : ''}</div>
    ${T.pay_note || T.pay_qr_path ? `<h4 style="margin:16px 0 4px;font-size:14px">${t('Bayaran selepas hantar')}</h4>${payBox('', c?.fee)}` : ''}
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
      <table class="st" style="margin-top:8px">${list.sort((a, b) => a.round_no - b.round_no || a.match_no - b.match_no).map(m => `<tr><td>${nm(m.entry_a)}</td><td><b>${m.status === 'pending' ? (m.play_time ? hm(m.play_time) : 'vs') : m.status === 'walkover' ? 'WO' : `${m.score_a}–${m.score_b}`}</b>${m.status === 'pending' && m.court ? `<div style="font-size:11px;color:#64748b">C${esc(m.court)}</div>` : ''}</td><td style="text-align:right">${nm(m.entry_b)}</td></tr>`).join('')}</table></div>`; };
    const ko = ms.filter(m => m.stage === 'ko');
    return `<h3 style="margin:14px 0 8px">${esc(c.name)}</h3>${fin.length ? tbl(t('Pusingan akhir'), fin) : ''}${grp.map(g => tbl(t('Kumpulan') + ' ' + GROUP_NAMES[g - 1], ms.filter(m => m.stage === 'group' && m.group_no === g))).join('')}
      ${ko.length ? `<div class="card card-pad mb">${ko.sort((a, b) => a.round_no - b.round_no || a.match_no - b.match_no).map(m => `<div style="font-size:13px;margin:3px 0">${esc(m.round_label || '')} #${m.match_no}: ${nm(m.entry_a)} vs ${nm(m.entry_b)} ${m.score_text ? '· <b>' + esc(m.score_text) + '</b>' : ''}</div>`).join('')}</div>` : ''}`;
  }).join('');
}


/* ---- Suapan "baru mendaftar" (bertukar setiap 3 saat) ---- */
function startFeed() {
  if (!FEED.length || document.getElementById('feed')) return;
  try { if (sessionStorage.getItem('tn_feed_off') === '1') return; } catch { /* abaikan */ }
  const el = document.createElement('div'); el.id = 'feed'; el.className = 'feed'; document.body.appendChild(el);
  const ago = iso => { const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 6e4)); return m < 60 ? t('{n} minit lalu', { n: m }) : m < 1440 ? t('{n} jam lalu', { n: Math.round(m / 60) }) : t('{n} hari lalu', { n: Math.round(m / 1440) }); };
  let i = 0;
  const show = () => { const x = FEED[i % FEED.length]; i++;
    el.innerHTML = `<div class="feed-ic">🏸</div><div><b>${esc(x.name)}</b> ${t('baru mendaftar')}<br><span>${esc(x.cat)}${x.club ? ' · ' + esc(x.club) : ''} · ${ago(x.at)}</span></div><button aria-label="x" data-feedx>✕</button>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    el.querySelector('[data-feedx]').onclick = () => { clearInterval(startFeed._t); el.remove(); try { sessionStorage.setItem('tn_feed_off', '1'); } catch { /* abaikan */ } }; };
  setTimeout(() => { show(); startFeed._t = setInterval(show, 3000); }, 2500);
}

/* ---- Portal peserta ---- */
const PST = { unpaid: () => t('Belum bayar'), pending: () => t('Bukti diterima — menunggu pengesahan'), paid: () => t('Dibayar ✓'), waived: () => t('Percuma'), refunded: () => t('Dipulangkan') };
function playerBox() {
  if (!ME) return `<form id="pl" class="form-grid"><label class="f">${t('No. rujukan')}<input name="ref" style="text-transform:uppercase" placeholder="BR26-…" required></label><label class="f">${t('No. WhatsApp penjaga')}<input name="phone" inputmode="tel" placeholder="012-3456789" required></label>
    <div class="f full"><button class="b dark" style="justify-content:center">${t('Log masuk peserta')}</button></div></form>`;
  const e = ME.entry, T = ME.t, E = new Map((ME.entries || []).map(x => [x.id, x])), nm = id => esc(E.get(id)?.name || '—');
  const my = (ME.matches || []).filter(m => m.entry_a === e.id || m.entry_b === e.id).sort((a, b) => (a.stage === 'final') - (b.stage === 'final') || a.round_no - b.round_no);
  const grpMs = (ME.matches || []).filter(m => m.stage === 'group' && m.group_no === e.group), finMs = (ME.matches || []).filter(m => m.stage === 'final');
  const tbl = (title, list) => { if (!list.length) return ''; const ids = [...new Set(list.flatMap(m => [m.entry_a, m.entry_b]).filter(Boolean))], st = standings(ids, list);
    return `<div class="box pbx" style="margin-top:10px"><b>${title}</b><table class="st" style="margin-top:6px"><tr><th>${t('Pemain')}</th><th>${t('M')}</th><th>${t('K')}</th><th>+/-</th></tr>${st.map((r, i) => `<tr style="${r.id === e.id ? 'background:#eef4ff;font-weight:700' : ''}"><td>${i + 1}. ${nm(r.id)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf - r.pa}</td></tr>`).join('')}</table></div>`; };
  const place = placeOf(ME), withdrawn = e.status === 'withdrawn';
  return `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start"><div><div style="font-size:20px;font-weight:800">${esc(e.name)}</div><div class="muted">${esc(ME.cat.name)} · ${esc(e.ref)}${e.club ? ' · ' + esc(e.club) : ''}</div></div><button class="b out" data-plout>${t('Log keluar')}</button></div>
    <div class="dates" style="margin-top:12px"><div><b>${t('Status')}</b><span>${withdrawn ? t('Tarik diri') : e.status === 'confirmed' ? t('Disahkan ✓') : t('Berdaftar')}</span></div>
      <div><b>${t('Bayaran')}</b><span>${(PST[e.pay_status] || PST.unpaid)()}${e.refund_amount ? ` · ${t('dipulangkan')} ${RM(e.refund_amount)}${e.refunded_at ? ' (' + fd(e.refunded_at) + ')' : ''}` : ''}</span></div>
      ${e.shirt ? `<div><b>${t('Jersi')}</b><span>${esc(e.shirt)}${e.jersey ? ' · ' + t('percuma ✓') : ''}</span></div>` : ''}
      ${e.group ? `<div><b>${t('Kumpulan')}</b><span>${GROUP_NAMES[e.group - 1]}</span></div>` : ''}</div>
    ${T.group_link && !withdrawn ? `<a class="b lime" style="margin-top:12px" href="${esc(T.group_link)}" target="_blank" rel="noopener">${t('Sertai kumpulan WhatsApp')}</a>` : ''}
    ${withdrawn ? '' : !my.length ? `<p class="muted" style="margin-top:12px">${t('Cabutan & jadual belum diterbitkan. Semak semula selepas senarai peserta dikongsi.')}</p>` : `
      <h3 style="margin-top:16px">${t('Perlawanan saya')}</h3><div class="box pbx" style="margin-top:8px"><table class="st">${my.map(m => { const opp = m.entry_a === e.id ? m.entry_b : m.entry_a, mine = m.entry_a === e.id ? [m.score_a, m.score_b] : [m.score_b, m.score_a];
        return `<tr><td style="text-align:left"><b>vs ${nm(opp)}</b><div style="font-size:11.5px;color:#64748b">${m.stage === 'final' ? t('Akhir') : t('Kumpulan') + ' ' + GROUP_NAMES[(m.group_no || 1) - 1]} · R${m.round_no}</div></td><td style="text-align:right;white-space:nowrap">${m.status === 'pending' ? `${m.play_time ? hm(m.play_time) : '—'}${m.court ? ' · C' + esc(m.court) : ''}` : m.status === 'walkover' ? (m.winner === e.id ? t('Menang (WO)') : t('Kalah (WO)')) : `<b style="color:${m.winner === e.id ? '#16a34a' : '#dc2626'}">${mine[0]}–${mine[1]}</b>`}</td></tr>`; }).join('')}</table></div>
      ${tbl(t('Kumpulan') + ' ' + GROUP_NAMES[(e.group || 1) - 1], grpMs)}${finMs.some(m => m.entry_a === e.id || m.entry_b === e.id) ? tbl(t('Pusingan akhir'), finMs) : ''}`}
    ${!withdrawn && T.cert_ready ? `${place ? `<div class="box" style="margin-top:12px;background:#fff8e1;border-color:#f5d97a"><b>🏆 ${['', t('Juara'), t('Naib juara'), t('Tempat ketiga'), t('Tempat keempat')][place]}!</b><div class="muted" style="font-size:13px">${t('Tahniah! Sijil pemenang rasmi diserahkan oleh urus setia kejohanan.')}</div></div>` : ''}<div class="box" style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>🎖️ ${t('Sijil penyertaan')}</b><div class="muted" style="font-size:13px">${t('Muat turun & simpan sebagai PDF')}</div></div><button class="b dark" data-cert>${t('Muat turun sijil')}</button></div>` : ''}`;
}
/** Kedudukan akhir pemain (1–4) daripada pusingan akhir round robin. */
function placeOf(P) {
  const fin = (P.matches || []).filter(m => m.stage === 'final'); if (!fin.length || fin.some(m => m.status === 'pending')) return 0;
  const ids = [...new Set(fin.flatMap(m => [m.entry_a, m.entry_b]).filter(Boolean))], st = standings(ids, fin), i = st.findIndex(r => r.id === P.entry.id);
  return i >= 0 && i < 4 ? i + 1 : 0;
}
async function openCert(P) {
  const e = P.entry, T = P.t, place = placeOf(P);
  let cfg = {}; try { cfg = (await rpc('public_cert_info')) || {}; } catch { /* abaikan */ }
  const winPlain = place && (cfg.winner_mode || 'plain') === 'plain';
  openDoc(certDoc([{ name: e.name, cat: P.cat.name, place: winPlain ? 0 : place, ref: e.ref }], { event: T.name, dates: fd(T.start_date), venue: T.venue, academy: 'Maxxima Badminton Academy',
    logo: new URL('assets/logo.png', location.href).href, cfg, imgUrl: p => (/^https?:/.test(p) ? p : `${CONFIG.SUPABASE_URL}/storage/v1/object/public/public-media/${p.split('/').map(encodeURIComponent).join('/')}`) }), `sijil-${e.ref}.html`);
}
async function plLogin(ref, phone, silent) {
  try { const r = await rpc('public_tn_player', { p_ref: ref, p_phone: phone }); if (!r?.ok) { if (!silent) toast(r?.error || t('Tidak dijumpai'), true); ME = null; return; }
    ME = r; try { sessionStorage.setItem('tn_pl', JSON.stringify({ ref, phone })); } catch { /* abaikan */ } }
  catch (err) { if (!silent) toast(err.message || String(err), true); }
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
    f.querySelectorAll('input[name=shirt_size]').forEach(x => x.addEventListener('change', () => { readForm(); const c = f.querySelector('.szc'); if (c) c.outerHTML = sizeChart(F.shirt_size); }));
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
  const pl = $('#pl');
  pl?.addEventListener('submit', async e => { e.preventDefault(); const d = new FormData(pl); await plLogin(String(d.get('ref')).trim(), String(d.get('phone')).trim()); render(); $('#peserta').scrollIntoView(); });
  document.querySelector('[data-plout]')?.addEventListener('click', () => { ME = null; try { sessionStorage.removeItem('tn_pl'); } catch { /* abaikan */ } render(); $('#peserta').scrollIntoView(); });
  document.querySelector('[data-cert]')?.addEventListener('click', () => openCert(ME));
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
  const info = { ok: true, t: { name: 'Bukit Raja Badminton Challenge 2026', start_date: `${y}-12-12`, start_time: '13:00', end_time: '21:00', venue: 'GoTeam Sports Complex', venue_area: 'Bukit Raja', entry_fee: 150, status: 'open', registration_deadline: `${y}-12-04`, early_deadline: `${y}-11-30`, list_date: `${y}-12-05`, protest_end: `${y}-12-10`, format: 'rr_groups', group_size: 4, points_to: 20, shirt_free: true, shirt_sizes: ['4XS', '3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'], prizes: 'Johan: raket + pingat + sijil\nNaib johan: beg + pingat + sijil\nTempat 3 & 4: pingat + sijil', rules: '# Kelayakan\nKelayakan ikut tahun lahir\nPemain negeri/kebangsaan tidak layak\n# Pemarkahan\nSatu game hingga 20 mata, tiada deuce', pay_note: 'Maybank\n5142-0866-3231\nMuhaimin Badminton Academy', size_chart: QD04, contact_phone: '0123351291', notice: 'TARIKH BAHARU: Sabtu, 12 Disember 2026 (asal 7 November 2026). Masa dan tempat tidak berubah.', description: 'Kejohanan round robin perseorangan junior untuk pemain bukan negeri.', scoring_note: 'Satu game hingga 20 mata, tanpa deuce — pada 19–19, mata seterusnya menang.', eligibility_note: 'Pemain negeri / kebangsaan tidak layak.', group_link: 'https://chat.whatsapp.com/demo', academy: 'Maxxima Badminton Academy' },
    cats: [{ id: 'c1', name: 'Singles Under 8 (Boys & Girls)', gender: 'mixed', birth_from: 2018, girls_from: 2017, birth_to: null, max: 16, fee: 150, taken: 5 }, { id: 'c2', name: "Boys' Singles Under 12", gender: 'boys', birth_from: 2014, birth_to: null, max: 16, fee: 150, taken: 16 }, { id: 'c3', name: "Girls' Singles Under 12", gender: 'girls', birth_from: 2014, birth_to: null, max: 16, fee: 150, taken: 3 }] };
  if (fn === 'public_tn_info') return info;
  if (fn === 'public_tn_results') return { entries: [], matches: [] };
  if (fn === 'public_tn_track') return null;
  if (fn === 'public_tn_register') { const ref = 'BRBC-' + Math.random().toString(36).slice(2, 8).toUpperCase(); DEMO_DB.entries.push({ ref, ...a.p, pay_status: 'unpaid' }); return { ref, fee: 150, category: 'demo' }; }
  if (fn === 'public_tn_status') { const e = DEMO_DB.entries.find(x => x.ref === String(a.p_ref).toUpperCase()); return e ? { ok: true, ref: e.ref, player: e.player_name, category: 'Demo', pay_status: e.pay_status, status: 'registered', amount: 150 } : { ok: false }; }
  if (fn === 'public_cert_info') return { signers: [{ name: 'Coach Doryn', title: 'Ketua Jurulatih' }, { name: '', title: 'Pengarah Kejohanan' }], winner_mode: 'plain' };
  if (fn === 'public_tn_recent') return [{ name: 'Chan D** Y**', cat: "Boys' Singles Under 16", club: 'Ipoh City BA', at: new Date(Date.now() - 36e5).toISOString() }, { name: 'Leim X** J**', cat: 'Singles Under 10 (Boys & Girls)', club: '', at: new Date(Date.now() - 864e5).toISOString() }, { name: 'Yuki Y** Q**', cat: "Girls' Singles Under 16", club: 'Skba', at: new Date(Date.now() - 2 * 864e5).toISOString() }];
  if (fn === 'public_tn_player') { if (String(a.p_ref).toUpperCase() !== 'BR26-DEMO') return { ok: false, error: 'No. rujukan tidak dijumpai.' };
    const ids = ['e1', 'e2', 'e3', 'e4'], nm = ['Ali Demo', 'Chan Wei', 'Raju Kumar', 'Lim Boon'];
    const ms = [[0, 1, 1, 21, 15], [2, 3, 1, 18, 21], [0, 2, 2, 21, 19], [1, 3, 2, 20, 18], [0, 3, 3, null, null], [1, 2, 3, null, null]].map(([a1, b1, r, sa, sb], i) => ({ id: 'm' + i, stage: 'group', group_no: 1, round_no: r, match_no: i + 1, entry_a: ids[a1], entry_b: ids[b1], score_a: sa, score_b: sb, status: sa == null ? 'pending' : 'done', winner: sa == null ? null : sa > sb ? ids[a1] : ids[b1], court: '3', play_time: '15:20' }));
    return { ok: true, entry: { id: 'e1', ref: 'BR26-DEMO', name: 'Ali Demo', club: 'Maxxima', status: 'confirmed', pay_status: 'paid', amount: 150, shirt: 'S', jersey: true, group: 1 }, cat: { id: 'c2', name: "Boys' Singles Under 12" },
      t: { name: 'Bukit Raja Badminton Challenge 2026', start_date: `${y}-12-12`, venue: 'GoTeam Sports Complex', status: 'ongoing', draw_public: true, cert_ready: true, group_link: 'https://chat.whatsapp.com/demo' }, entries: ids.map((id, i) => ({ id, name: nm[i], group: 1 })), matches: ms }; }
  if (fn === 'public_tn_proof') { const e = DEMO_DB.entries.find(x => x.ref === a.p_ref); if (e) e.pay_status = 'pending'; return null; }
}

(async () => {
  try {
    if (!demo) { const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: false } }); }
    INFO = await rpc('public_tn_info', { p_slug: slug });
    if (INFO?.ok) { document.title = INFO.t.name; track('view'); try { RES = await rpc('public_tn_results', { p_slug: slug }); } catch { RES = null; }
      try { FEED = (await rpc('public_tn_recent', { p_slug: slug })) || []; } catch { FEED = []; }
      try { const sv = JSON.parse(sessionStorage.getItem('tn_pl') || 'null'); if (sv) await plLogin(sv.ref, sv.phone, true); } catch { /* abaikan */ } }
    render(); startFeed();
  } catch (e) { console.error(e); $('#reg').innerHTML = `<div class="done"><h1>${t('Ralat')}</h1><p class="muted">${esc(e.message || e)}</p></div>`; }
})();
