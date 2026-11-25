import { CONFIG } from './config.js';
import './theme.js';

const root = document.querySelector('#reg');
// Bahasa: EN (kunci) / BM / 中文. Pilihan dikongsi dengan app (mx_lang); lalai BM.
const LANGS = [['ms','BM'],['en','EN'],['zh','中文']];
let lang = 'ms';
try { const q = new URLSearchParams(location.search).get('lang'); const v = q || localStorage.getItem('mx_lang'); if (LANGS.some(l => l[0] === v)) lang = v; } catch { /* abaikan */ }
const DICT = {
  'Book a Free Group Trial': ['Tempah Kelas Percubaan Percuma', '预约免费团体体验课'],
  'Choose an available session based on the player’s age, venue and badminton experience.': ['Pilih sesi yang sesuai mengikut umur, lokasi dan pengalaman badminton pemain.', '根据球员的年龄、场地和羽球经验选择合适的课程。'],
  'Demo only. Information is not saved and no booking is made.': ['Demo sahaja. Maklumat tidak disimpan dan tiada tempahan dibuat.', '仅供演示。资料不会保存，也不会预约。'],
  '1. Find a suitable slot': ['1. Cari slot yang sesuai', '1. 寻找合适的时段'],
  'Student’s date of birth': ['Tarikh lahir pelajar', '学生出生日期'],
  'Used to match the age group.': ['Untuk padankan kumpulan umur.', '用于配对年龄组别。'],
  'Training venue': ['Lokasi latihan', '训练场地'],
  'Select a venue': ['Pilih lokasi', '选择场地'],
  'Current badminton level': ['Tahap badminton sekarang', '目前羽球水平'],
  'Select a level': ['Pilih tahap', '选择水平'],
  'Beginner · new to badminton': ['Baru belajar badminton', '初学者 · 刚开始打羽球'],
  'Some experience · can rally': ['Ada pengalaman · boleh rally', '有一些经验 · 能对打'],
  'Competitive · plays matches': ['Kompetitif · pernah main pertandingan', '竞技 · 有参加比赛'],
  'Not sure': ['Tidak pasti', '不确定'],
  'Preferred date': ['Tarikh pilihan', '偏好日期'],
  'Preferred time': ['Masa pilihan', '偏好时间'],
  '(optional)': ['(pilihan)', '（可选）'],
  '(optional, Malaysia time)': ['(pilihan, waktu Malaysia)', '（可选，马来西亚时间）'],
  'Closest suitable slots are shown first. Your preference is not a confirmed booking.': ['Slot paling hampir dengan pilihan anda dipaparkan dahulu. Pilihan ini belum lagi tempahan.', '最接近您偏好的时段会先显示。偏好并非确认预约。'],
  'Enter all three details to see available slots.': ['Isi tiga maklumat di atas untuk melihat slot yang ada.', '填写以上三项资料以查看可用时段。'],
  '2. Add your details': ['2. Isi maklumat anda', '2. 填写您的资料'],
  'Student’s full name': ['Nama penuh pelajar', '学生全名'],
  'Parent/guardian or adult player’s name': ['Nama ibu bapa/penjaga atau pemain dewasa', '家长/监护人或成人球员姓名'],
  'WhatsApp number': ['No. WhatsApp', 'WhatsApp 号码'],
  'I agree that Maxxima may use these details to arrange the trial and contact me about it.': ['Saya bersetuju Maxxima menggunakan maklumat ini untuk mengatur kelas percubaan dan menghubungi saya mengenainya.', '我同意 Maxxima 使用这些资料安排体验课并就此联系我。'],
  'Privacy notice': ['Notis privasi', '隐私声明'],
  'Confirm Trial Slot': ['Sahkan Slot Percubaan', '确认体验时段'],
  'Choose a preferred date from today onward, or clear it.': ['Pilih tarikh mulai hari ini, atau kosongkan.', '请选择今天或之后的日期，或清空。'],
  'Online trial slots are not currently listed for this venue.': ['Slot percubaan dalam talian belum dibuka untuk lokasi ini.', '此场地暂未开放网上体验预约。'],
  'Contact Maxxima': ['Hubungi Maxxima', '联系 Maxxima'],
  'to ask about a trial.': ['untuk bertanya tentang kelas percubaan.', '咨询体验课。'],
  'Looking for suitable slots…': ['Mencari slot yang sesuai…', '正在寻找合适时段…'],
  'No suitable slots at this venue in the next 3 weeks. Try another venue or': ['Tiada slot sesuai di lokasi ini dalam 3 minggu akan datang. Cuba lokasi lain atau', '此场地未来三周没有合适时段。请尝试其他场地或'],
  'ask admin for help': ['minta bantuan admin', '联系管理员'],
  'We couldn’t load slots.': ['Slot tidak dapat dimuatkan.', '无法加载时段。'],
  'Try again': ['Cuba lagi', '重试'],
  'Please enter both names.': ['Sila isi kedua-dua nama.', '请填写两个姓名。'],
  'Enter a valid WhatsApp number including area code.': ['Masukkan no. WhatsApp yang sah termasuk kod kawasan.', '请输入有效的 WhatsApp 号码（含区号）。'],
  'We could not confirm the booking. Try again to check whether it went through.': ['Tempahan belum dapat disahkan. Cuba lagi untuk semak sama ada ia berjaya.', '无法确认预约。请重试以查看是否成功。'],
  'That slot is no longer available. Choose another.': ['Slot itu sudah penuh. Sila pilih slot lain.', '该时段已满，请选择其他时段。'],
  'A trial is already on file for these details. Contact Maxxima for help.': ['Kelas percubaan sudah ada untuk maklumat ini. Hubungi Maxxima untuk bantuan.', '此资料已有体验课记录。请联系 Maxxima。'],
  'Too many bookings from this number. Please contact Maxxima.': ['Terlalu banyak tempahan dari nombor ini. Sila hubungi Maxxima.', '此号码预约次数过多，请联系 Maxxima。'],
  'Online booking is busy right now. Please try again later or contact Maxxima.': ['Tempahan dalam talian sibuk sekarang. Cuba sebentar lagi atau hubungi Maxxima.', '网上预约繁忙，请稍后再试或联系 Maxxima。'],
  'Please check the form details or contact Maxxima for help.': ['Sila semak maklumat borang atau hubungi Maxxima.', '请检查表格资料或联系 Maxxima。'],
  'No venues are taking online trial bookings right now. Please contact Maxxima.': ['Tiada lokasi menerima tempahan dalam talian buat masa ini. Sila hubungi Maxxima.', '目前没有场地接受网上预约。请联系 Maxxima。'],
  'Online trial booking is currently unavailable.': ['Tempahan percubaan dalam talian tidak tersedia buat masa ini.', '网上体验预约暂时无法使用。'],
  'Contact Maxxima on WhatsApp': ['Hubungi Maxxima di WhatsApp', '通过 WhatsApp 联系 Maxxima'],
  'to arrange a trial.': ['untuk atur kelas percubaan.', '安排体验课。'],
  'Trial Portal': ['Portal Percubaan', '体验课门户'],
  'Checking the latest class details…': ['Menyemak maklumat kelas terkini…', '正在查看最新课程资料…'],
  'We couldn’t load your latest trial details. Please try again.': ['Maklumat percubaan tidak dapat dimuatkan. Sila cuba lagi.', '无法加载体验课资料，请重试。'],
  'Demo only. No booking was made.': ['Demo sahaja. Tiada tempahan dibuat.', '仅供演示。未作任何预约。'],
  'Confirmed': ['Disahkan', '已确认'], 'Cancelled': ['Dibatalkan', '已取消'], 'Completed': ['Selesai', '已完成'],
  'Not attended': ['Tidak hadir', '未出席'], 'Session date passed': ['Tarikh sesi sudah lepas', '课程日期已过'], 'Contact admin': ['Hubungi admin', '联系管理员'],
  'Please do not travel to this session. Contact us for another slot.': ['Jangan datang ke sesi ini. Hubungi kami untuk slot lain.', '请勿前往此课程。请联系我们安排其他时段。'],
  'Date': ['Tarikh', '日期'], 'Time (Malaysia)': ['Masa (Malaysia)', '时间（马来西亚）'], 'Venue': ['Lokasi', '场地'], 'Programme': ['Program', '课程'], 'Court': ['Gelanggang', '球场'],
  'To be confirmed': ['Akan dimaklumkan', '待确认'],
  'Bring a racket (if available), non-marking sports shoes and water. Please arrive 10 minutes early.': ['Bawa raket (jika ada), kasut sukan tapak tidak berbekas dan air. Sila tiba 10 minit awal.', '请携带球拍（如有）、不留痕运动鞋和饮用水，并提早10分钟到达。'],
  'Save this private link and reopen it before class to check for updates. The link expires after your trial and is not a push notification.': ['Simpan pautan peribadi ini dan buka semula sebelum kelas untuk semak sebarang perubahan. Pautan tamat selepas kelas percubaan dan tiada notifikasi dihantar.', '请保存此私人链接，并在上课前打开查看更新。链接在体验课后失效，不会发送通知。'],
  'Copy private link': ['Salin pautan peribadi', '复制私人链接'], 'Refresh details': ['Muat semula', '刷新资料'],
  'Link copied': ['Pautan disalin', '链接已复制'], 'Copy the link from your address bar': ['Salin pautan dari bar alamat', '请从地址栏复制链接'],
  'This trial link is invalid or has expired.': ['Pautan percubaan ini tidak sah atau sudah tamat.', '此体验链接无效或已过期。'],
  'for help.': ['untuk bantuan.', '寻求帮助。']
};
const tr = en => { const r = DICT[en]; return lang === 'en' || !r ? en : (lang === 'ms' ? r[0] : r[1]); };
const langSwitch = () => `<div class="langsw" style="margin-left:auto">${LANGS.map(([c,l]) => `<button type="button" class="${c === lang ? 'on' : ''}" data-lang="${c}">${l}</button>`).join('')}</div>`;
const bindLang = again => { try { root.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; try { localStorage.setItem('mx_lang', lang); } catch { /* abaikan */ } document.documentElement.lang = lang; again(); })); } catch { /* tiada DOM penuh */ } };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const by = id => document.getElementById(id);
const portalToken = new URLSearchParams(location.hash.slice(1)).get('reservation');
const demo = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const headerHtml = () => '<div class="reg-top" style="display:flex;align-items:center;gap:10px"><div class="auth-brand" style="margin:0"><div class="brand-mark"><img src="assets/logo.png" alt="" class="brand-img"></div><div><div class="brand-name" style="color:var(--ink)">MAXXIMA</div><div class="brand-sub">Badminton Academy</div></div></div>' + langSwitch() + '</div>';
const levelOptions = () => [['new', tr('Beginner · new to badminton')], ['rally', tr('Some experience · can rally')], ['match', tr('Competitive · plays matches')], ['unsure', tr('Not sure')]];
const dateLabel = date => Intl.DateTimeFormat(lang === 'zh' ? 'zh-MY' : lang === 'ms' ? 'ms-MY' : 'en-MY', {dateStyle:'full',timeZone:'UTC'}).format(new Date(date + 'T00:00:00Z'));
const localDate = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kuala_Lumpur'}).format(new Date());
// Public labels follow the approved preview. An unmatched/ambiguous venue is not sent to booking RPCs.
const catalog = [
  ['goteam', 'GoTeam Sports Complex, Bukit Raja', ['GoTeam', 'GoTeam Sports Complex']],
  ['forum', 'Forum SBA, Setia Alam', ['Forum SBA', 'Forum SBA Setia Alam']],
  ['smash2u', 'Smash2u Sports Hub, Giant Klang', ['Smash2u Sports Hub', 'Smash2u Sport Hub', 'Smash2u Giant Klang', 'Smash2u']],
  ['slk', 'SLK Sport Centre, Batu Caves', ['SLK', 'SLK Batu Caves', 'SLK Badminton Court', 'SLK Sport Centre', 'SLK Sports Centre Batu Caves', 'SLK Badminton Court Batu Caves']],
  ['ultra', 'Ultra Sports Centre, Selayang', ['Ultra Sports Centre', 'Ultra Sport Centre', 'Ultra Sport Centre Selayang', 'Ultra SC Selayang']],
  ['abedeen', 'Abedeen Clubhouse, Cyberjaya', ['Abedeen Clubhouse', 'Abedeen Cyberjaya']],
  ['puchong', 'Puchong Sport Centre, Puchong', ['Puchong Sport Centre', 'Puchong Sports Centre', 'Puchong SC']],
  ['mxspd', 'Arena MXSPD, Telok Panglima Garang', ['Arena MXSPD', 'MXSPD Telok Panglima Garang']],
  ['armanee', 'Armanee, Damansara Damai', ['Armanee', 'Armanee Condominium', 'Armanee Condominium Damansara Damai']]
];
const normalizeVenue = name => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
function matchTrialVenues(online) {
  return catalog.map(([key,name,aliases]) => {
    const names = new Set([name,...aliases].map(normalizeVenue));
    const matches = [...new Set(online.filter(v => v.id && names.has(normalizeVenue(v.name))).map(v => v.id))];
    return {key,name,id: matches.length === 1 ? matches[0] : null};
  });
}
// The dates and times from the slot RPC are Malaysia-local values, not browser-local instants.
function rankTrialSlots(slots, preferredDate, preferredTime) {
  if (!preferredDate && !preferredTime) return [...slots];
  const day = value => Date.parse(value + 'T00:00:00Z') / 86400000;
  const minutes = value => Number(value.slice(0,2))*60 + Number(value.slice(3,5));
  const score = slot =>
    (preferredDate ? Math.abs(day(slot.date)-day(preferredDate))*1440 : 0) +
    (preferredTime ? Math.abs(minutes(slot.start)-minutes(preferredTime)) : 0);
  return [...slots].sort((a,b) => score(a)-score(b));
}
const label = v => v ? esc(v) : tr('To be confirmed');
const wa = 'https://wa.me/60124965324';
let client, demoBooking;
const rpc = async (method, args) => {
  if (!demo) {
    const { data, error } = await client.rpc(method,args);
    if (error) throw error;
    return data;
  }
  if (method === 'shared_trial_venues') return [{id:'goteam',name:'GoTeam Sports Complex, Bukit Raja'},{id:'forum',name:'Forum SBA, Setia Alam'}];
  if (method === 'shared_trial_slots') {
    const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10);
    const age = Number(date.slice(0,4)) - Number(args.p_birth.slice(0,4)) - Number(date.slice(5) < args.p_birth.slice(5));
    if (age < 3 || age > 99 || (args.p_level === 'match' && args.p_venue === 'forum')) return [];
    return [{class_id:args.p_venue,date,start:'09:00',end:'11:00',programme:age >= 18 ? 'Adult' : args.p_level === 'match' ? 'Elite' : 'Foundation',venue:args.p_venue === 'forum' ? 'Forum SBA, Setia Alam' : 'GoTeam Sports Complex, Bukit Raja'}];
  }
  if (method === 'shared_trial_book') return {ok:true};
  return demoBooking ?? null;
};

async function showPortal(token) {
  root.innerHTML = headerHtml() + `<h1>${tr('Trial Portal')}</h1><p class="muted" role="status">${tr('Checking the latest class details…')}</p>`;
  if (!/^[a-f0-9]{64}$/.test(token)) return showExpired();
  let reservation;
  try { reservation = await rpc('shared_trial_portal',{p_token:token}); }
  catch {
    root.innerHTML = headerHtml() + `<h1>${tr('Trial Portal')}</h1><p role="alert">${tr('We couldn’t load your latest trial details. Please try again.')}</p><button class="btn" id="refresh" type="button">${tr('Try again')}</button>`;
    by('refresh').onclick = () => showPortal(token); return;
  }
  if (!reservation) return showExpired();
  const r = reservation, cancelled = r.status === 'cancelled';
  const statuses = {confirmed:tr('Confirmed'),cancelled:tr('Cancelled'),completed:tr('Completed'),not_attended:tr('Not attended'),past:tr('Session date passed')};
  root.innerHTML = headerHtml() + `<h1>${tr('Trial Portal')}</h1>
    ${demo ? '<p class="hint warn">' + tr('Demo only. No booking was made.') + '</p>' : ''}
    <p class="hint ${cancelled ? 'warn' : ''}" role="status"><b>${statuses[r.status] || tr('Contact admin')}</b>${cancelled ? ' · ' + tr('Please do not travel to this session. Contact us for another slot.') : ''}</p>
    <dl><dt>${tr('Date')}</dt><dd>${esc(dateLabel(r.date))}</dd><dt>${tr('Time (Malaysia)')}</dt><dd>${label(r.start)}${r.end ? '–' + esc(r.end) : ''}</dd>
    <dt>${tr('Venue')}</dt><dd>${label(r.venue)}</dd><dt>${tr('Programme')}</dt><dd>${label(r.programme)}</dd>
    ${cancelled ? '' : '<dt>' + tr('Court') + '</dt><dd>' + label(r.court) + '</dd>'}</dl>
    ${r.status === 'confirmed' ? '<p>' + tr('Bring a racket (if available), non-marking sports shoes and water. Please arrive 10 minutes early.') + '</p>' : ''}
    <p class="muted">${tr('Save this private link and reopen it before class to check for updates. The link expires after your trial and is not a push notification.')}</p>
    <div class="actions"><button class="btn primary" id="copy-portal" type="button">${tr('Copy private link')}</button><button class="btn" id="refresh" type="button">${tr('Refresh details')}</button>
      <a class="btn" href="${wa}" target="_blank" rel="noopener noreferrer">${tr('Contact Maxxima')}</a></div>`;
  bindLang(() => showPortal(token));
  by('refresh').onclick = () => showPortal(token);
  by('copy-portal').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); by('copy-portal').textContent = tr('Link copied'); }
    catch { by('copy-portal').textContent = tr('Copy the link from your address bar'); }
  };
}
function showExpired() {
  root.innerHTML = headerHtml() + `<h1>${tr('Trial Portal')}</h1><p>${tr('This trial link is invalid or has expired.')} <a href="${wa}" target="_blank" rel="noopener noreferrer">${tr('Contact Maxxima')}</a> ${tr('for help.')}</p>`;
  bindLang(showExpired);
}

async function showForm() {
  const online = await rpc('shared_trial_venues');
  const venues = matchTrialVenues(Array.isArray(online) ? online : []);
  const selectedVenue = key => venues.find(v => v.key === key)?.id ?? null;
  root.innerHTML = headerHtml() + `<h1>${tr('Book a Free Group Trial')}</h1>
    <p class="muted">${tr('Choose an available session based on the player’s age, venue and badminton experience.')}</p>
    ${demo ? '<p class="hint warn">' + tr('Demo only. Information is not saved and no booking is made.') + '</p>' : ''}
    <form id="shared-trial">
      <h3>${tr('1. Find a suitable slot')}</h3>
      <div class="form-grid">
        <label class="f">${tr('Student’s date of birth')}<input name="birth" type="date" max="${localDate()}" required><small>${tr('Used to match the age group.')}</small></label>
        <label class="f">${tr('Training venue')}<select name="venue" required><option value="">${tr('Select a venue')}</option>${(venues || []).map(v => '<option value="' + esc(v.key) + '">' + esc(v.name) + '</option>').join('')}</select></label>
        <label class="f full">${tr('Current badminton level')}<select name="level" required><option value="">${tr('Select a level')}</option>${levelOptions().map(([k,v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('')}</select></label>
        <label class="f">${tr('Preferred date')} <small>${tr('(optional)')}</small><input name="preferred_date" type="date" min="${localDate()}"></label>
        <label class="f">${tr('Preferred time')} <small>${tr('(optional, Malaysia time)')}</small><input name="preferred_time" type="time"></label>
      </div>
      <p class="muted">${tr('Closest suitable slots are shown first. Your preference is not a confirmed booking.')}</p>
      <div id="trial-slots" class="slots" role="status" aria-live="polite" style="margin-top:12px">${tr('Enter all three details to see available slots.')}</div>
      <h3>${tr('2. Add your details')}</h3>
      <div class="form-grid">
        <label class="f full">${tr('Student’s full name')}<input name="child" minlength="2" maxlength="120" required></label>
        <label class="f">${tr('Parent/guardian or adult player’s name')}<input name="guardian" minlength="2" maxlength="120" required></label>
        <label class="f">${tr('WhatsApp number')}<input name="phone" type="tel" maxlength="25" autocomplete="tel" required></label>
      </div>
      <label class="consent"><input type="checkbox" name="consent" required><span>${tr('I agree that Maxxima may use these details to arrange the trial and contact me about it.')} <a href="privacy.html" target="_blank" rel="noopener">${tr('Privacy notice')}</a></span></label>
      <p id="trial-error" role="alert"></p>
      <button class="btn primary lg" type="submit" disabled style="width:100%;margin-top:8px">${tr('Confirm Trial Slot')}</button>
    </form>`;
  const f = by('shared-trial'), fields = f.elements, warning = by('trial-error'), list = by('trial-slots'), submit = f.querySelector('[type=submit]');
  let revision = 0, choices = [], token, busy = false;
  async function loadSlots() {
    const v = ++revision;
    choices = []; submit.disabled = true; warning.textContent = ''; list.textContent = '';
    if (fields.preferred_date.value && !fields.preferred_date.validity.valid) {
      list.textContent = tr('Choose a preferred date from today onward, or clear it.'); return;
    }
    if (!fields.birth.validity.valid || !fields.venue.value || !fields.level.value) {
      list.textContent = tr('Enter all three details to see available slots.'); return;
    }
    const venueId = selectedVenue(fields.venue.value);
    if (!venueId) {
      list.innerHTML = `<p>${tr('Online trial slots are not currently listed for this venue.')} <a href="${wa}" target="_blank" rel="noopener noreferrer">${tr('Contact Maxxima')}</a> ${tr('to ask about a trial.')}</p>`;
      return;
    }
    list.textContent = tr('Looking for suitable slots…');
    try {
      const slots = await rpc('shared_trial_slots',{p_birth:fields.birth.value,p_venue:venueId,p_level:fields.level.value});
      if (v !== revision) return;
      choices = rankTrialSlots(slots || [], fields.preferred_date.value, fields.preferred_time.value);
      list.innerHTML = choices.map((s,i) => `<label class="slot-r"><input required type="radio" name="slot" value="${i}"><span>
        <b>${esc(dateLabel(s.date))} · ${esc(s.start)}–${esc(s.end)}</b><small>${esc(s.programme)} · ${esc(s.venue)}</small></span></label>`).join('') ||
        `<p>${tr('No suitable slots at this venue in the next 3 weeks. Try another venue or')} <a href="${wa}" target="_blank" rel="noopener noreferrer">${tr('ask admin for help')}</a>.</p>`;
    } catch {
      if (v !== revision) return;
      list.innerHTML = `<p>${tr('We couldn’t load slots.')} <button type="button" class="btn sm" id="retry-slots">${tr('Try again')}</button></p>`;
      by('retry-slots').onclick = loadSlots;
    }
  }
  for (const k of ['birth','venue','level','preferred_date','preferred_time']) fields[k].addEventListener('change',loadSlots);
  list.addEventListener('change', () => { if (!busy) submit.disabled = !f.querySelector('[name=slot]:checked'); });
  f.onsubmit = async e => {
    e.preventDefault(); if (busy || submit.disabled) return;
    const picked = f.querySelector('[name=slot]:checked'), s = picked && choices[Number(picked.value)];
    if (!s) return;
    const child = fields.child.value.trim(), guardian = fields.guardian.value.trim(), phone = fields.phone.value.trim();
    if (child.length < 2 || guardian.length < 2) { warning.textContent = tr('Please enter both names.'); return; }
    if (!/^\d{9,15}$/.test(phone.replace(/\D/g,''))) { warning.textContent = tr('Enter a valid WhatsApp number including area code.'); return; }
    if (!token) token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
    busy = true; warning.textContent = '';
    const payload = {token,child,guardian,phone,birth:fields.birth.value,venue:selectedVenue(fields.venue.value),level:fields.level.value,class_id:s.class_id,date:s.date,consent:fields.consent.checked};
    Array.from(fields).forEach(el => el.disabled = true);
    let outcome;
    try { outcome = await rpc('shared_trial_book',{p:payload}); }
    catch { warning.textContent = tr('We could not confirm the booking. Try again to check whether it went through.'); }
    if (outcome?.ok) {
      if (demo) demoBooking = {...s,status:'confirmed',court:null};
      history.replaceState(null,'','#reservation=' + token);
      await showPortal(token);
      return;
    }
    busy = false;
    Array.from(fields).forEach(el => el.disabled = false);
    if (outcome?.code === 'slot_unavailable') {
      await loadSlots(); warning.textContent = tr('That slot is no longer available. Choose another.');
    } else if (outcome?.code === 'duplicate') {
      warning.textContent = tr('A trial is already on file for these details. Contact Maxxima for help.');
    } else if (outcome?.code === 'too_many') {
      warning.textContent = tr('Too many bookings from this number. Please contact Maxxima.');
    } else if (outcome?.code === 'busy') {
      warning.textContent = tr('Online booking is busy right now. Please try again later or contact Maxxima.');
    } else if (outcome) {
      warning.textContent = tr('Please check the form details or contact Maxxima for help.');
    }
  };
  bindLang(async () => {
    const keep = Object.fromEntries(['birth','venue','level','preferred_date','preferred_time','child','guardian','phone'].map(k => [k, fields[k].value]));
    await showForm();
    const g = by('shared-trial').elements;
    Object.entries(keep).forEach(([k,v]) => { g[k].value = v; });
    if (keep.birth && keep.venue && keep.level) g.level.dispatchEvent(new Event('change'));
  });
  if (!(venues || []).length) warning.textContent = tr('No venues are taking online trial bookings right now. Please contact Maxxima.');
}

(async () => {
  document.documentElement.lang = lang;
  try {
    if (!demo) {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client = createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:false}});
    }
    if (portalToken !== null) await showPortal(portalToken);
    else await showForm();
  } catch {
    root.innerHTML = headerHtml() + `<h1>${tr('Book a Free Group Trial')}</h1><p>${tr('Online trial booking is currently unavailable.')} <a href="${wa}" target="_blank" rel="noopener noreferrer">${tr('Contact Maxxima on WhatsApp')}</a> ${tr('to arrange a trial.')}</p>`;
  }
})();
