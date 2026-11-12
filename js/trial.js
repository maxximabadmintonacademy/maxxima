// Borang trial peribadi untuk lead (awam, tanpa log masuk): trial.html?t=TOKEN
import { CONFIG } from './config.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import './theme.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const demo = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const token = new URLSearchParams(location.search).get('t') || '';
const toast = (m, bad) => { const e = $('#toast'); e.textContent = m; e.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(e._t); e._t = setTimeout(() => (e.className = 'toast'), 4000); };
try { const q = new URLSearchParams(location.search).get('lang'); if (q) setLang(q); } catch { /* abaikan */ }
const DAYS = () => [t('Ahad'), t('Isnin'), t('Selasa'), t('Rabu'), t('Khamis'), t('Jumaat'), t('Sabtu')];
let client = null, INFO = null, VAL = {};

const ageOn = (birth, on) => { if (!birth) return null; const b = new Date(birth + 'T00:00:00'), d = new Date(on + 'T00:00:00'); let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--; return a; };
const catOf = (birth, on) => { const a = ageOn(birth, on); if (a == null) return null; return (INFO.age_groups || []).find(g => a >= Number(g.min) && a <= Number(g.max))?.code || null; };
const fmt = d => { const x = new Date(d + 'T00:00:00'); return `${DAYS()[x.getDay()]}, ${x.getDate()}/${x.getMonth() + 1}`; };
const head = () => `<div class="reg-top"><div class="auth-brand" style="margin:0"><div class="brand-mark"><img src="assets/logo.png" alt="" class="brand-img"></div><div><div class="brand-name" style="color:var(--ink)">MAXXIMA</div><div class="brand-sub">Badminton Academy</div></div></div>
  <div class="langsw">${LANGS.map(([c, l]) => `<button type="button" class="${c === getLang() ? 'on' : ''}" data-lang="${c}">${l}</button>`).join('')}</div></div>`;

function read() {
  const f = $('#tf'); if (!f) return;
  VAL = { child: f.child.value, birth: f.birth.value, gender: f.gender.value, guardian: f.guardian.value, medical: f.medical.value, notes: f.notes.value, slot: f.querySelector('[name=slot]:checked')?.value || VAL.slot || '', prog: f.prog.value };
}
function render() {
  if (!INFO) return;
  if (!INFO.ok) { $('#reg').innerHTML = head() + `<div class="done"><div class="big">🔗</div><h1>${t('Pautan tidak sah')}</h1><p class="muted">${t('Sila hubungi admin Maxxima melalui WhatsApp untuk mendapatkan pautan baharu.')}</p></div>`; return bindLang(); }
  if (INFO.done) { $('#reg').innerHTML = head() + `<div class="done"><div class="big">✅</div><h1>${t('Trial sudah dijadualkan')}</h1><p class="muted">${t('Terima kasih! Admin akan menghubungi anda jika ada perubahan. Jumpa di gelanggang!')}</p></div>`; return bindLang(); }
  const L = INFO.lead, v = { child: L.child_name, birth: L.birth_date || '', gender: L.gender || '', guardian: L.guardian_name || '', medical: '', notes: '', slot: '', prog: L.programme_id || '', ...VAL };
  const progs = [...new Map((INFO.slots || []).map(s => [s.programme_id, s.programme])).entries()];
  const slots = (INFO.slots || []).filter(s => !v.prog || s.programme_id === v.prog);
  $('#reg').innerHTML = head() + `
  <h1>${t('Borang Kelas Percubaan')}</h1><p class="muted">${t('Satu sesi kumpulan percuma untuk pelajar baharu. Isi butiran dan pilih slot — slot disahkan terus.')}</p>
  ${demo ? `<div class="hint warn" style="margin-top:10px">${t('Mod demo: borang tidak dihantar ke sistem.')}</div>` : ''}
  <form id="tf" novalidate>
    <h3>1. ${t('Maklumat pelajar')}</h3>
    <div class="form-grid">
      <label class="f full">${t('Nama penuh pelajar')}<input name="child" required maxlength="120" value="${esc(v.child)}"></label>
      <label class="f">${t('Tarikh lahir')}<input name="birth" type="date" value="${esc(v.birth)}"></label>
      <label class="f">${t('Jantina')}<select name="gender"><option value="">—</option><option value="male" ${v.gender === 'male' ? 'selected' : ''}>${t('Lelaki')}</option><option value="female" ${v.gender === 'female' ? 'selected' : ''}>${t('Perempuan')}</option></select></label>
      <label class="f full">${t('Nama ibu bapa / penjaga')}<input name="guardian" maxlength="120" value="${esc(v.guardian)}"></label>
      <label class="f full">${t('Masalah kesihatan / alahan (jika ada)')}<input name="medical" maxlength="300" value="${esc(v.medical)}" placeholder="${t('cth. asma')}"></label>
    </div>
    <h3>2. ${t('Pilih slot trial')}</h3>
    <label class="f full">${t('Program')}<select name="prog"><option value="">${t('Semua program')}</option>${progs.map(([id, n]) => `<option value="${id}" ${v.prog === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="slots" style="margin-top:10px">${slots.map(s => { const key = s.class_id + '|' + s.date, cat = catOf(v.birth, s.date), full = Number(s.left) <= 0;
      return `<label class="slot-r ${full ? 'full' : ''}"><input type="radio" name="slot" value="${key}" ${v.slot === key ? 'checked' : ''} ${full ? 'disabled' : ''}><span><b>${fmt(s.date)} · ${s.start}–${s.end}</b><small>${esc(s.programme)} · ${esc(s.venue)}${(s.categories || []).length ? ' · ' + s.categories.map(esc).join('/') : ''}</small>${cat ? `<br><small class="cat">${t('Kategori anak')}: ${esc(cat)}</small>` : ''}${full ? `<br><small>${t('penuh')}</small>` : ''}</span></label>`; }).join('') || `<p class="muted">${t('Tiada slot terbuka dalam 3 minggu ini.')}</p>`}</div>
    <label class="f full" style="margin-top:12px">${t('Catatan (pilihan)')}<input name="notes" maxlength="300" value="${esc(v.notes)}"></label>
    <label class="consent"><input type="checkbox" name="ok" required> <span>${t('Saya bersetuju dengan Terma & Syarat Maxxima dan membenarkan maklumat ini digunakan untuk tujuan latihan.')}</span></label>
    <button class="btn primary lg" type="submit" style="width:100%;margin-top:16px">${t('Hantar & sahkan trial')}</button>
  </form>`;
  bindLang();
  const f = $('#tf');
  f.prog.addEventListener('change', () => { read(); render(); });
  f.birth.addEventListener('change', () => { read(); render(); });
  f.addEventListener('submit', async e => {
    e.preventDefault(); read();
    if (!VAL.child.trim()) return toast(t('Isi nama pelajar.'), true);
    if (!VAL.slot) return toast(t('Pilih satu slot trial.'), true);
    if (!f.ok.checked) return toast(t('Sila setuju Terma & Syarat.'), true);
    const [cid, d] = VAL.slot.split('|'), btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (!demo) { const { error } = await client.rpc('public_trial_submit', { p_token: token, p_child: VAL.child.trim(), p_birth: VAL.birth || null, p_gender: VAL.gender || null, p_guardian: VAL.guardian || null, p_class: cid, p_date: d, p_medical: VAL.medical || null, p_notes: VAL.notes || null }); if (error) throw error; }
      const s = INFO.slots.find(x => x.class_id === cid && x.date === d);
      $('#reg').innerHTML = head() + `<div class="done"><div class="big">🏸</div><h1>${t('Trial disahkan!')}</h1><p><b>${esc(VAL.child)}</b><br>${fmt(d)} · ${s?.start}–${s?.end}<br>${esc(s?.programme || '')} · ${esc(s?.venue || '')}</p><p class="muted" style="margin-top:12px">${t('Sila tiba 10 minit awal dengan kasut sukan (tapak tidak berbekas), raket (jika ada) dan air minuman.')}</p></div>`;
      bindLang();
    } catch (err) { console.error(err); toast(err.message || String(err), true); btn.disabled = false; }
  });
}
function bindLang() { document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { read(); setLang(b.dataset.lang); render(); })); }

(async () => {
  try {
    if (demo) {
      const d = i => { const x = new Date(); x.setDate(x.getDate() + i); return x.toISOString().slice(0, 10); };
      INFO = { ok: !!token || true, done: false, lead: { child_name: 'Adiliah Hana', guardian_name: 'Salbiah', birth_date: '', gender: '' }, age_groups: [{ code: 'U8', min: 0, max: 8 }, { code: 'U12', min: 9, max: 12 }, { code: 'U17', min: 13, max: 17 }, { code: 'Dewasa', min: 18, max: 99 }],
        slots: [{ class_id: 'a', date: d(2), start: '16:30', end: '18:30', programme: 'Foundation', programme_id: 'p1', venue: 'GoTeam Sports Complex', categories: ['U8', 'U12'], left: 5 }, { class_id: 'b', date: d(4), start: '09:00', end: '11:00', programme: 'Foundation', programme_id: 'p1', venue: 'Puchong Sport Centre', categories: [], left: 0 }] };
    } else {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data, error } = await client.rpc('public_trial_info', { p_token: token }); if (error) throw error; INFO = data;
    }
    render();
  } catch (e) { console.error(e); $('#reg').innerHTML = `<div class="done"><h1>${t('Ralat')}</h1><p class="muted">${esc(e.message || e)}</p></div>`; }
})();
