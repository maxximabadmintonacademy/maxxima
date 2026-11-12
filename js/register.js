// Borang pendaftaran online (awam, tanpa log masuk). Hantar melalui RPC public_register (Supabase).
import { CONFIG } from './config.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import './theme.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let client = null, OPT = { programmes: [], venues: [], academy: 'Maxxima Badminton Academy' }, KIDS = 1;
const demo = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const toast = (m, bad) => { const e = $('#toast'); e.textContent = m; e.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(e._t); e._t = setTimeout(() => (e.className = 'toast'), 3500); };
try { const q = new URLSearchParams(location.search).get('lang'); if (q) setLang(q); } catch { /* abaikan */ }

const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
const kidHtml = (i, v = {}) => `<div class="kid" data-k="${i}">
  <div class="kid-h"><b>${t('Pelajar')} ${i + 1}</b>${i ? `<button type="button" class="btn sm danger-o" data-rm="${i}">${t('Buang')}</button>` : ''}</div>
  <div class="form-grid">
    <label class="f full">${t('Nama penuh pelajar')}<input name="s_name" required maxlength="120" value="${esc(v.full_name)}"></label>
    <label class="f">${t('Tarikh lahir')}<input name="s_dob" type="date" value="${esc(v.birth_date)}"></label>
    <label class="f">${t('Jantina')}<select name="s_gender">${opt('', '—', v.gender)}${opt('male', t('Lelaki'), v.gender)}${opt('female', t('Perempuan'), v.gender)}</select></label>
    <label class="f full">${t('Lokasi latihan pilihan')}<select name="s_venue">${opt('', t('— Belum pasti —'), v.venue_id)}${OPT.venues.map(x => opt(x.id, x.name + (x.area && !x.name.includes(x.area) ? ' · ' + x.area : ''), v.venue_id)).join('')}</select></label>
    <div class="f full">${t('Program yang diminati')}<div class="progs">${OPT.programmes.map(p => `<label><input type="checkbox" name="s_prog_${i}" value="${p.id}" ${(v.programmes || []).includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</div></div>
    <label class="f full">${t('Pengalaman / catatan (pilihan)')}<input name="s_notes" maxlength="300" value="${esc(v.notes)}" placeholder="${t('cth. pernah main 1 tahun, ada kejohanan sekolah')}"></label>
  </div></div>`;

function readKids() {
  return [...document.querySelectorAll('.kid')].map(el => ({ full_name: el.querySelector('[name=s_name]').value.trim(), birth_date: el.querySelector('[name=s_dob]').value, gender: el.querySelector('[name=s_gender]').value,
    venue_id: el.querySelector('[name=s_venue]').value, programmes: [...el.querySelectorAll('.progs input:checked')].map(x => x.value), notes: el.querySelector('[name=s_notes]').value.trim() }));
}
function render(keep) {
  const kids = keep?.kids || [{}], g = keep?.g || {}, self = !!keep?.self;
  $('#reg').innerHTML = `
  <div class="reg-top"><div class="auth-brand" style="margin:0"><div class="brand-mark"><img src="assets/logo.png" alt="" class="brand-img"></div><div><div class="brand-name" style="color:var(--ink)">MAXXIMA</div><div class="brand-sub">Badminton Academy</div></div></div>
    <div class="langsw">${LANGS.map(([c, l]) => `<button type="button" class="${c === getLang() ? 'on' : ''}" data-lang="${c}">${l}</button>`).join('')}</div></div>
  <h1>${t('Borang Pendaftaran')}</h1><p class="muted">${t('Isi maklumat di bawah. Admin akan menghubungi anda melalui WhatsApp untuk mengesahkan kelas dan yuran.')}</p>
  ${demo ? `<div class="hint warn" style="margin-top:10px">${t('Mod demo: borang tidak dihantar ke sistem.')}</div>` : ''}
  <form id="rf" novalidate>
    <h3>1. ${t('Maklumat pelajar')}</h3>
    <div id="kids">${kids.map((k, i) => kidHtml(i, k)).join('')}</div>
    <button type="button" class="btn sm" id="addKid">+ ${t('Tambah adik-beradik')}</button>
    <h3>2. ${t('Ibu bapa / penjaga')}</h3>
    <label class="self"><input type="checkbox" name="self" ${self ? 'checked' : ''}><span><b>${t('Saya mendaftar untuk diri sendiri')}</b><br><span class="muted">${t('Untuk pelajar dewasa (18 tahun ke atas). Bahagian ibu bapa tidak perlu diisi.')}</span></span></label>
    <div class="form-grid">
      <label class="f g-only">${t('Hubungan')}<select name="g_rel">${opt('mother', t('Ibu'), g.relationship || 'mother')}${opt('father', t('Bapa'), g.relationship)}${opt('guardian', t('Penjaga'), g.relationship)}</select></label>
      <label class="f g-only">${t('Nama penuh ibu bapa / penjaga')}<input name="g_name" maxlength="120" value="${esc(g.full_name)}"></label>
      <label class="f"><span class="ph-lbl"></span><input name="g_phone" type="tel" required inputmode="tel" placeholder="012-345 6789" value="${esc(g.phone)}"></label>
      <label class="f">${t('E-mel')}<input name="g_email" type="email" maxlength="120" value="${esc(g.email)}" placeholder="${t('untuk akaun portal ibu bapa')}"></label>
      <label class="f full">${t('Alamat (pilihan)')}<input name="g_addr" maxlength="300" value="${esc(g.address)}"></label>
    </div>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label class="f full" style="margin-top:12px">${t('Soalan atau catatan lain (pilihan)')}<textarea name="notes" rows="2" maxlength="500"></textarea></label>
    <label class="consent"><input type="checkbox" name="consent" required><span>${t('Saya bersetuju maklumat ini digunakan oleh akademi untuk urusan pendaftaran, jadual, yuran dan komunikasi, mengikut Akta Perlindungan Data Peribadi 2010.')}</span></label>
    <div class="auth-err" id="err" style="margin-top:12px"></div>
    <button class="btn primary block" type="submit" style="margin-top:14px;width:100%;height:46px">${t('Hantar Pendaftaran')}</button>
  </form>`;
  syncSelf();
}
function syncSelf() {
  const self = $('[name=self]').checked;
  document.querySelectorAll('.g-only').forEach(e => (e.style.display = self ? 'none' : ''));
  $('.ph-lbl').textContent = self ? t('No. WhatsApp anda') : t('No. WhatsApp ibu bapa / penjaga');
  $('[name=g_name]').required = !self;
}
const snapshot = () => ({ kids: readKids(), self: $('[name=self]').checked, g: { relationship: $('[name=g_rel]').value, full_name: $('[name=g_name]').value, phone: $('[name=g_phone]').value, email: $('[name=g_email]').value, address: $('[name=g_addr]').value } });

document.addEventListener('click', e => {
  const l = e.target.closest('[data-lang]'); if (l) { const s = snapshot(); setLang(l.dataset.lang); render(s); return; }
  if (e.target.id === 'addKid') { const k = document.querySelectorAll('.kid').length; if (k >= 6) return toast(t('Maksimum 6 pelajar.'), true); const prev = readKids()[0]; $('#kids').insertAdjacentHTML('beforeend', kidHtml(k, { venue_id: prev?.venue_id })); return; }
  const rm = e.target.closest('[data-rm]'); if (rm) { const s = snapshot(); s.kids.splice(Number(rm.dataset.rm), 1); render(s); }
});
document.addEventListener('change', e => { if (e.target.name === 'self') syncSelf(); });
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, err = $('#err'); err.textContent = '';
  const s = snapshot(), phone = s.g.phone.replace(/\D/g, '');
  if (s.kids.some(k => k.full_name.length < 2)) return (err.textContent = t('Sila isi nama penuh setiap pelajar.'));
  if (!s.self && s.g.full_name.trim().length < 2) return (err.textContent = t('Sila isi nama ibu bapa / penjaga.'));
  if (phone.length < 9 || phone.length > 15) return (err.textContent = t('No. WhatsApp tidak sah.'));
  if (!f.consent.checked) return (err.textContent = t('Sila setuju dengan notis privasi.'));
  const payload = { students: s.kids, self: s.self, guardians: [{ ...s.g, full_name: s.self ? '' : s.g.full_name.trim() }], notes: f.notes.value.trim(), consent: true, lang: getLang(), website: f.website.value };
  const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = t('Menghantar…');
  try {
    if (!demo) { const { error } = await client.rpc('public_register', { p: payload }); if (error) throw error; }
    $('#reg').innerHTML = `<div class="done"><div class="big">🏸</div><h1>${t('Terima kasih!')}</h1><p class="muted" style="margin-top:8px">${t('Pendaftaran {names} telah diterima. Admin akan menghubungi anda melalui WhatsApp dalam masa 1–2 hari bekerja.', { names: '<b>' + s.kids.map(k => esc(k.full_name)).join(', ') + '</b>' })}</p>
      <button class="btn" style="margin-top:18px" onclick="location.reload()">${t('Daftar pelajar lain')}</button></div>`;
  } catch (x) {
    const m = String(x?.message || x); btn.disabled = false; btn.textContent = t('Hantar Pendaftaran');
    err.textContent = /Failed to fetch|NetworkError/i.test(m) ? t('Tiada sambungan ke pelayan. Semak internet anda.') : t(m.replace(/^.*?:\s*/, '')) || t('Sesuatu tidak kena. Cuba lagi.');
  }
});

(async () => {
  if (!demo) {
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data, error } = await client.rpc('public_form_options'); if (error) throw error; OPT = { ...OPT, ...data };
    } catch (x) { console.error(x); $('#reg').innerHTML = `<div class="done"><h1>${t('Borang belum tersedia')}</h1><p class="muted">${t('Sila hubungi akademi melalui WhatsApp.')}</p></div>`; return; }
  } else {
    OPT.programmes = [['p1', 'Foundation'], ['p2', 'Performance'], ['p3', 'Elite'], ['p4', 'Adult'], ['p5', 'Personal Coaching']].map(([id, name]) => ({ id, name }));
    OPT.venues = [['v1', 'GoTeam Sports Complex', 'Bukit Raja'], ['v2', 'Abedeen Clubhouse', 'Cyberjaya']].map(([id, name, area]) => ({ id, name, area }));
  }
  document.title = `${t('Daftar')} — ${OPT.academy || 'Maxxima Badminton Academy'}`;
  render();
})();
