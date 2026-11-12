// Halaman awam kejohanan: tournament.html?t=SLUG
// Maklumat, kategori ikut tahun lahir, format, hadiah, tarikh penting, saiz jersi, peraturan,
// borang daftar 4 langkah, semak status + muat naik bukti bayaran, keputusan langsung.
import { CONFIG } from './config.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import { standings, GROUP_NAMES } from './tn-core.js';
import './theme.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const demo = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const slug = new URLSearchParams(location.search).get('t') || '';
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

function head() {
  return `<div class="reg-top"><div class="auth-brand" style="margin:0"><div class="brand-mark"><img src="assets/logo.png" alt="" class="brand-img"></div><div><div class="brand-name" style="color:var(--ink)">MAXXIMA</div><div class="brand-sub">Badminton Academy</div></div></div>
  <div class="langsw">${LANGS.map(([c, l]) => `<button type="button" class="${c === getLang() ? 'on' : ''}" data-lang="${c}">${l}</button>`).join('')}</div></div>`;
}
const G = { boys: () => t('Lelaki'), girls: () => t('Perempuan'), mixed: () => t('Campuran'), open: () => t('Terbuka') };

function page() {
  if (!INFO?.ok) return head() + `<div class="done"><div class="big">🏸</div><h1>${t('Kejohanan tidak dijumpai')}</h1><p class="muted">${t('Pautan mungkin salah atau halaman belum diterbitkan.')}</p></div>`;
  const T = INFO.t, cats = INFO.cats || [], open = T.status === 'open' && (!T.registration_deadline || T.registration_deadline >= new Date().toISOString().slice(0, 10));
  const rules = String(T.rules || '').split('\n').reduce((acc, l) => { if (/^#\s*/.test(l)) acc.push({ h: l.replace(/^#\s*/, ''), items: [] }); else if (l.trim()) { if (!acc.length) acc.push({ h: t('Peraturan'), items: [] }); acc[acc.length - 1].items.push(l.replace(/^[-•*]\s*/, '')); } return acc; }, []);
  const dates = [[T.early_deadline, t('Akhir daftar awal') + (T.shirt_free ? ' · ' + t('jersi percuma') : '')], [T.registration_deadline, t('Tutup pendaftaran')], [T.list_date, t('Senarai peserta dikongsi')], [T.protest_end, t('Tempoh bantahan tamat')], [T.start_date, t('Hari pertandingan')]].filter(x => x[0]).sort((a, b) => a[0].localeCompare(b[0]));
  const showRes = RES && ['ongoing', 'completed', 'closed'].includes(T.status) && (RES.matches || []).length;
  return head() + `
  <div class="tn-hero">${T.poster_path ? `<img src="${pubUrl(T.poster_path)}" alt="${esc(T.name)}">` : ''}<div class="in">
    <h1>${esc(T.name)}</h1><p>${fd(T.start_date)}${T.start_time ? ' · ' + hm(T.start_time) + (T.end_time ? '–' + hm(T.end_time) : '') : ''} · ${esc(T.venue || '')}${T.venue_area ? ', ' + esc(T.venue_area) : ''}</p>
    ${T.description ? `<p style="margin-top:6px">${esc(T.description)}</p>` : ''}
    <div class="tn-stats"><div><b>${cats.length}</b><small>${t('kategori')}</small></div>${cats[0]?.max ? `<div><b>${cats[0].max}</b><small>${t('pemain setiap kategori')}</small></div>` : ''}<div><b>${RM(T.entry_fee)}</b><small>${t('setiap pemain')}</small></div>${T.registration_deadline ? `<div><b>${fd(T.registration_deadline)}</b><small>${t('tutup pendaftaran')}</small></div>` : ''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${open ? `<a class="btn primary" href="#daftar" data-reg>${t('Daftar sekarang')}</a>` : `<span class="badge b-muted">${t('Pendaftaran ditutup')}</span>`}<a class="btn" href="#semak">${t('Semak status')}</a>${T.contact_phone ? `<a class="btn" target="_blank" rel="noopener" href="${wa(T.contact_phone, 'Hi, saya ingin bertanya tentang ' + T.name)}">WhatsApp</a>` : ''}</div></div></div>
  <nav class="tn-nav"><a href="#kategori">${t('Kategori')}</a><a href="#format">${t('Format')}</a>${T.prizes ? `<a href="#hadiah">${t('Hadiah')}</a>` : ''}${dates.length ? `<a href="#tarikh">${t('Tarikh penting')}</a>` : ''}${rules.length ? `<a href="#peraturan">${t('Peraturan')}</a>` : ''}${showRes ? `<a href="#keputusan">${t('Keputusan')}</a>` : ''}<a href="#daftar">${t('Daftar')}</a><a href="#semak">${t('Semak status')}</a></nav>

  ${showRes ? `<section class="tn-sec" id="keputusan"><h2>${t('Keputusan & kedudukan langsung')}</h2>${results()}</section>` : ''}
  <section class="tn-sec" id="kategori"><h2>${t('Kategori')}</h2><div class="cat-grid">${cats.map(c => { const left = c.max ? c.max - c.taken : null; return `<div class="cat-c ${left === 0 ? 'full' : ''}"><b>${esc(c.name)}</b><span class="muted" style="font-size:12.5px">${G[c.gender]?.() || ''}${c.birth_from || c.birth_to ? ` · ${t('lahir')} ${c.birth_from && c.birth_to && c.birth_from !== c.birth_to ? c.birth_from + '–' + c.birth_to : c.birth_to || c.birth_from}` : ''}</span><div style="font-size:12.5px;margin-top:6px">${RM(c.fee)}${left != null ? ` · ${left > 0 ? t('{n} tempat lagi', { n: left }) : t('penuh')}` : ''}</div>${open && left !== 0 ? `<button class="btn sm" style="margin-top:8px" data-pick="${c.id}">${t('Pilih kategori')}</button>` : ''}</div>`; }).join('')}</div>
    <p class="muted" style="font-size:12.5px;margin-top:8px">${t('Kelayakan ikut tahun lahir, bukan tarikh hari jadi.')}</p></section>
  <section class="tn-sec" id="format"><h2>${t('Format')}</h2><p style="font-size:14px;line-height:1.6">${T.format === 'rr_groups'
    ? t('Round robin berkumpulan: {g} pemain setiap kumpulan, setiap pemain bermain {m} perlawanan kumpulan. Pemenang setiap kumpulan mara ke pusingan akhir round robin untuk menentukan tempat 1–4. Satu game hingga {p} mata.', { g: T.group_size, m: T.group_size - 1, p: T.points_to })
    : t('Kalah mati (knockout). Satu game hingga {p} mata.', { p: T.points_to })} ${t('Cabutan rawak direkod secara dalam talian.')}</p></section>
  ${T.prizes ? `<section class="tn-sec" id="hadiah"><h2>${t('Hadiah')}</h2><p style="white-space:pre-line;font-size:14px;line-height:1.7">${esc(T.prizes)}</p></section>` : ''}
  ${(T.shirt_sizes || []).length ? `<section class="tn-sec"><h2>${t('Jersi acara')}</h2><p style="font-size:14px">${T.shirt_free && T.early_deadline ? t('Jersi percuma untuk pendaftaran yang lengkap dan dibayar penuh sebelum {d}.', { d: fd(T.early_deadline) }) : ''} ${t('Saiz tersedia')}: <b>${T.shirt_sizes.map(esc).join(', ')}</b></p></section>` : ''}
  ${dates.length ? `<section class="tn-sec" id="tarikh"><h2>${t('Tarikh penting')}</h2><div class="dates">${dates.map(([d, l]) => `<div><b>${fd(d)}</b><span>${esc(l)}</span></div>`).join('')}</div></section>` : ''}
  ${rules.length ? `<section class="tn-sec rules" id="peraturan"><h2>${t('Peraturan')}</h2>${rules.map((r, i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(r.h)}</summary><ul>${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</section>` : ''}
  <section class="tn-sec" id="daftar"><h2>${t('Daftar')}</h2>${open ? form() : `<p class="muted">${t('Pendaftaran ditutup.')}</p>`}</section>
  <section class="tn-sec" id="semak"><h2>${t('Semak status & bayaran')}</h2>${lookup()}</section>
  <p class="muted" style="font-size:11.5px;text-align:center;margin-top:26px">${t('Halaman ini hanya mengira lawatan tanpa maklumat peribadi.')}${T.contact_email ? ' · ' + esc(T.contact_email) : ''}</p>`;
}

function form() {
  const T = INFO.t, cats = INFO.cats || [], s = F.step, v = F;
  const elig = cats.filter(c => (!v.birth_year || ((!c.birth_from || v.birth_year >= c.birth_from) && (!c.birth_to || v.birth_year <= c.birth_to))) && (!v.gender || c.gender === 'open' || c.gender === 'mixed' || (c.gender === 'boys' ? v.gender === 'boy' : v.gender === 'girl')) && (!c.max || c.taken < c.max));
  const bar = `<div class="steps">${[1, 2, 3, 4].map(i => `<span class="${i <= s ? 'on' : ''}"></span>`).join('')}</div>`;
  if (F.done) return `<div class="card card-pad" style="text-align:center"><div style="font-size:40px">🎉</div><h3>${t('Pendaftaran diterima!')}</h3><p>${t('No. rujukan anda')}: <b style="font-size:20px">${esc(F.done.ref)}</b></p>
    <p class="muted" style="font-size:13px">${t('Simpan nombor ini. Jumlah bayaran')}: <b>${RM(F.done.fee)}</b></p>${T.pay_note ? `<div class="hint" style="text-align:left;margin-top:10px;white-space:pre-line">${esc(T.pay_note)}</div>` : ''}
    <p class="muted" style="font-size:13px;margin-top:10px">${t('Selepas bayar, muat naik bukti di bahagian Semak status di bawah.')}</p><button class="btn" style="margin-top:10px" data-new>${t('Daftar pemain lain')}</button></div>`;
  const years = []; for (let y = new Date().getFullYear(); y >= 2000; y--) years.push(y);
  let body = '';
  if (s === 1) body = `<h3>1. ${t('Pemain')}</h3><div class="form-grid" style="margin-top:10px">
    <label class="f full">${t('Nama penuh pemain')}<input name="player_name" value="${esc(v.player_name || '')}" maxlength="120"></label>
    <label class="f">${t('Tahun lahir')}<select name="birth_year"><option value="">—</option>${years.map(y => `<option ${Number(v.birth_year) === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <label class="f">${t('Jantina')}<select name="gender"><option value="">—</option><option value="boy" ${v.gender === 'boy' ? 'selected' : ''}>${t('Lelaki')}</option><option value="girl" ${v.gender === 'girl' ? 'selected' : ''}>${t('Perempuan')}</option></select></label>
    <label class="f full">${t('Kategori')}<select name="category_id"><option value="">${v.birth_year && v.gender ? t('Pilih kategori yang layak') : t('Pilih tahun lahir & jantina dahulu')}</option>${elig.map(c => `<option value="${c.id}" ${v.category_id === c.id ? 'selected' : ''}>${esc(c.name)} · ${RM(c.fee)}</option>`).join('')}</select></label>
    <label class="f full">${t('Akademi / kelab / sekolah (pilihan)')}<input name="club" value="${esc(v.club || '')}" maxlength="120"></label></div>`;
  if (s === 2) body = `<h3>2. ${t('Penjaga')}</h3><div class="form-grid" style="margin-top:10px">
    <label class="f full">${t('Nama penjaga')}<input name="guardian_name" value="${esc(v.guardian_name || '')}" maxlength="120"></label>
    <label class="f">${t('No. WhatsApp')}<input name="guardian_phone" inputmode="tel" value="${esc(v.guardian_phone || '')}" placeholder="012-3456789"></label>
    <label class="f">${t('E-mel (untuk sijil digital)')}<input name="guardian_email" type="email" value="${esc(v.guardian_email || '')}"></label></div>`;
  if (s === 3) body = `<h3>3. ${t('Saiz jersi')}</h3>${(T.shirt_sizes || []).length ? `<p class="muted" style="font-size:13px;margin:6px 0 10px">${T.shirt_free && T.early_deadline ? t('Jersi percuma untuk pendaftaran yang lengkap dan dibayar penuh sebelum {d}.', { d: fd(T.early_deadline) }) + ' ' : ''}${t('Saiz muktamad selepas dihantar.')}</p><div class="sizes">${T.shirt_sizes.map(z => `<label><input type="radio" name="shirt_size" value="${esc(z)}" ${v.shirt_size === z ? 'checked' : ''}><span>${esc(z)}</span></label>`).join('')}</div>` : `<p class="muted">${t('Tiada jersi untuk kejohanan ini.')}</p>`}`;
  if (s === 4) { const c = cats.find(x => x.id === v.category_id); body = `<h3>4. ${t('Semak & hantar')}</h3><div class="dates" style="margin-top:10px">
    <div><b>${t('Pemain')}</b><span>${esc(v.player_name)} · ${v.birth_year} · ${v.gender === 'boy' ? t('Lelaki') : t('Perempuan')}</span></div><div><b>${t('Kategori')}</b><span>${esc(c?.name || '')} · ${RM(c?.fee)}</span></div>
    <div><b>${t('Penjaga')}</b><span>${esc(v.guardian_name || '')} · ${esc(v.guardian_phone)}${v.guardian_email ? ' · ' + esc(v.guardian_email) : ''}</span></div>${v.shirt_size ? `<div><b>${t('Jersi')}</b><span>${esc(v.shirt_size)}</span></div>` : ''}</div>
    <label class="consent" style="display:flex;gap:8px;margin-top:14px;font-size:13px"><input type="checkbox" name="agree" style="width:auto;height:auto" ${v.agree ? 'checked' : ''}> <span>${t('Saya mengesahkan maklumat adalah benar, pemain layak mengikut peraturan, dan bersetuju dengan peraturan kejohanan. Yuran tidak dikembalikan selepas pendaftaran lengkap.')}</span></label>`; }
  return `<form id="tnf" class="card card-pad" novalidate>${bar}${body}<div style="display:flex;gap:8px;margin-top:16px">${s > 1 ? `<button type="button" class="btn" data-back>${t('Kembali')}</button>` : ''}<button type="submit" class="btn primary" style="flex:1">${s < 4 ? t('Teruskan') : t('Hantar pendaftaran')}</button></div></form>`;
}

function lookup() {
  const r = LOOK;
  return `<form id="lk" class="card card-pad"><div style="display:flex;gap:8px"><input name="ref" placeholder="${t('No. rujukan, cth. BRBC-7K2Q9M')}" style="flex:1;text-transform:uppercase" value="${esc(r?.ref || '')}"><button class="btn primary">${t('Semak')}</button></div>
  ${r ? r.ok ? `<div class="dates" style="margin-top:12px"><div><b>${t('Pemain')}</b><span>${esc(r.player)}</span></div><div><b>${t('Kategori')}</b><span>${esc(r.category)}</span></div>
    <div><b>${t('Bayaran')}</b><span>${{ unpaid: t('Belum bayar'), pending: t('Bukti diterima — menunggu pengesahan'), paid: t('Dibayar ✓'), waived: t('Percuma'), refunded: t('Dipulangkan') }[r.pay_status]} · ${RM(r.amount)}</span></div>
    <div><b>${t('Status')}</b><span>${r.status === 'confirmed' ? t('Disahkan ✓') : r.status === 'withdrawn' ? t('Tarik diri') : t('Berdaftar')}${r.group ? ' · ' + t('Kumpulan') + ' ' + GROUP_NAMES[r.group - 1] : ''}</span></div></div>
    ${['unpaid', 'pending'].includes(r.pay_status) ? `<div style="margin-top:12px">${INFO.t.pay_note ? `<div class="hint" style="white-space:pre-line;margin-bottom:8px">${esc(INFO.t.pay_note)}</div>` : ''}<label class="f">${t('Muat naik bukti bayaran (gambar / PDF)')}<input type="file" id="proof" accept="image/*,application/pdf"></label><button type="button" class="btn primary" style="margin-top:8px" data-proof>${t('Hantar bukti')}</button></div>` : ''}`
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
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { readForm(); setLang(b.dataset.lang); render(); }));
  document.querySelectorAll('[data-reg]').forEach(b => b.addEventListener('click', () => track('register_click')));
  document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { F.category_id = b.dataset.pick; const c = INFO.cats.find(x => x.id === b.dataset.pick); if (c?.gender === 'boys') F.gender = 'boy'; if (c?.gender === 'girls') F.gender = 'girl'; if (c?.birth_to && !F.birth_year) F.birth_year = c.birth_to; track('register_click'); render(); $('#daftar').scrollIntoView({ behavior: 'smooth' }); }));
  const f = $('#tnf');
  if (f) {
    f.querySelectorAll('select[name=birth_year],select[name=gender]').forEach(x => x.addEventListener('change', () => { readForm(); render(); $('#daftar').scrollIntoView(); }));
    f.querySelector('[data-back]')?.addEventListener('click', () => { readForm(); F.step--; render(); $('#daftar').scrollIntoView(); });
    f.addEventListener('submit', async e => {
      e.preventDefault(); readForm();
      if (F.step === 1 && (!String(F.player_name || '').trim() || !F.birth_year || !F.gender || !F.category_id)) return toast(t('Lengkapkan nama, tahun lahir, jantina dan kategori.'), true);
      if (F.step === 2 && String(F.guardian_phone || '').replace(/\D/g, '').length < 9) return toast(t('Isi no. WhatsApp penjaga yang sah.'), true);
      if (F.step === 3 && (INFO.t.shirt_sizes || []).length && !F.shirt_size) return toast(t('Pilih saiz jersi.'), true);
      if (F.step < 4) { F.step++; render(); $('#daftar').scrollIntoView(); return; }
      if (!F.agree) return toast(t('Sila tanda pengesahan.'), true);
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const r = await rpc('public_tn_register', { p_slug: slug, p: { player_name: F.player_name, birth_year: F.birth_year, gender: F.gender, category_id: F.category_id, club: F.club, guardian_name: F.guardian_name, guardian_phone: F.guardian_phone, guardian_email: F.guardian_email, shirt_size: F.shirt_size } });
        F = { step: 1, done: r }; LOOK = null; INFO = await rpc('public_tn_info', { p_slug: slug }); render(); $('#daftar').scrollIntoView();
      } catch (err) { toast(err.message || String(err), true); btn.disabled = false; }
    });
    f.closest('section')?.querySelector('[data-new]');
  }
  document.querySelector('[data-new]')?.addEventListener('click', () => { F = { step: 1 }; render(); });
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
  const info = { ok: true, t: { name: 'Bukit Raja Badminton Challenge 2026', start_date: `${y}-12-12`, start_time: '13:00', end_time: '21:00', venue: 'GoTeam Sports Complex', venue_area: 'Bukit Raja', entry_fee: 150, status: 'open', registration_deadline: `${y}-12-04`, early_deadline: `${y}-11-30`, list_date: `${y}-12-05`, protest_end: `${y}-12-10`, format: 'rr_groups', group_size: 4, points_to: 20, shirt_free: true, shirt_sizes: ['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL'], prizes: 'Johan: raket + pingat + sijil\nNaib johan: beg + pingat + sijil\nTempat 3 & 4: pingat + sijil', rules: '# Kelayakan\nKelayakan ikut tahun lahir\nPemain negeri/kebangsaan tidak layak\n# Pemarkahan\nSatu game hingga 20 mata, tiada deuce', pay_note: 'DuitNow / Maybank 5xxxxxxxxx (Maxxima Badminton Academy)\nRujukan: no. pendaftaran anda', contact_phone: '0123351291' },
    cats: [{ id: 'c1', name: 'Singles U8', gender: 'open', birth_from: y - 7, birth_to: y - 6, max: 16, fee: 150, taken: 5 }, { id: 'c2', name: "Boys' Singles U12", gender: 'boys', birth_from: y - 11, birth_to: y - 10, max: 16, fee: 150, taken: 16 }, { id: 'c3', name: "Girls' Singles U12", gender: 'girls', birth_from: y - 11, birth_to: y - 10, max: 16, fee: 150, taken: 3 }] };
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
