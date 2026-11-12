// Pembantu UI dikongsi: ikon, format, lencana, modal, toast, borang.
import { t, getLang } from './i18n.js';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Jambatan supaya modul boleh minta render semula tanpa import bulat */
export const app = { render: () => {}, go: h => { location.hash = h; } };
/* State UI sementara (penapis, carian, tab) */
export const UI = {};

/* ---------- Ikon ---------- */
export const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  userplus: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  tick: '<path d="m5 12 5 5 9-10"/>',
  wallet: '<path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.5"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  shuttle: '<circle cx="12" cy="18" r="3"/><path d="M9.5 16.5 6 4h12l-3.5 12.5"/><path d="M9 4l1.5 12M15 4l-1.5 12M7.5 9h9"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="m16 8 4 4-4 4M20 12H9"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
};
export const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- Tarikh / nombor ---------- */
const MS_M = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const MS_ML = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const MS_D = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const EN_M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_ML = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ZH_M = EN_M.map((_, i) => `${i + 1}月`);
const ZH_D = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/* Ikut bahasa semasa: kod lama yang guna MONTHS[i] / DAYS[i] / LABEL[kod] terus berfungsi */
const byLang = (ms, en, zh) => new Proxy(ms, { get: (o, k) => { const l = getLang(), a = l === 'en' ? en : l === 'zh' ? zh : o; return a && k in a ? a[k] : o[k]; } });
export const MONTHS = byLang(MS_M, EN_M, ZH_M);
export const MONTHS_LONG = byLang(MS_ML, EN_ML, ZH_M);
export const DAYS = byLang(MS_D, EN_D, ZH_D);
const p2 = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const parseISO = s => new Date(s + 'T00:00:00');
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const monthKey = s => (s || todayISO()).slice(0, 7) + '-01';
export const monthLabel = s => { const d = parseISO(s); return getLang() === 'zh' ? `${d.getFullYear()}年${d.getMonth() + 1}月` : `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtDateIn = (l, s) => { if (!s) return '—'; const d = parseISO(String(s).slice(0, 10)); return l === 'zh' ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : `${d.getDate()} ${(l === 'en' ? EN_M : MS_M)[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtDate = s => fmtDateIn(getLang(), s);
export const fmtShort = s => { if (!s) return '—'; const d = parseISO(String(s).slice(0, 10)); return getLang() === 'zh' ? `${d.getMonth() + 1}月${d.getDate()}日` : `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const hm = t => (t ? String(t).slice(0, 5) : '');
export const RM = n => 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const sum = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
export const num = v => (v === '' || v == null ? null : Number(v));
export const val = v => (v === '' || v == null ? null : v);
export const initials = n => String(n || '?').replace(/^(Coach|Puan|Encik|Mr|Mrs|Ms|Cik)\.?\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* ---------- Label & warna status ---------- */
const LABEL_MS = {
  // leads
  new: 'Baru', contacted: 'Dihubungi', trial_scheduled: 'Trial Dijadual', trial_done: 'Trial Selesai', requested: 'Permohonan', enrolled: 'Mendaftar', lost: 'Tidak Berminat',
  // trial
  scheduled: 'Dijadual', done: 'Selesai', no_show: 'Tidak Hadir', cancelled: 'Dibatalkan',
  // pelajar
  pending: 'Menunggu Semakan', awaiting_payment: 'Menunggu Bayaran', active: 'Aktif', paused: 'Digantung', left: 'Berhenti',
  // invois
  issued: 'Belum Bayar', paid: 'Dibayar', void: 'Dibatalkan', overdue: 'Lewat',
  // kehadiran
  booked: 'Ditempah', present: 'Hadir', late: 'Lewat Hadir', absent: 'Tidak Hadir', excused: 'Dimaafkan', late_cancel: 'Batal Lewat',
  // sesi
  held: 'Selesai',
  // pakej
  expired: 'Tamat Tempoh', fixed: 'Jadual Tetap', flexible: 'Fleksibel', package: 'Pakej Sesi',
  // kejohanan
  draft: 'Draf', open: 'Pendaftaran Dibuka', closed: 'Pendaftaran Ditutup', ongoing: 'Sedang Berlangsung', completed: 'Selesai',
  registered: 'Berdaftar', confirmed: 'Disahkan', withdrawn: 'Tarik Diri', walkover: 'Walkover',
  // cuti
  approved: 'Lulus', rejected: 'Ditolak',
  // peranan
  admin: 'Admin', coach: 'Coach', parent: 'Ibu Bapa',
  // jenis
  monthly: 'Yuran Bulanan', registration: 'Pendaftaran', jersey: 'Jersi', personal: 'Personal Coaching', tournament: 'Kejohanan', other: 'Lain-lain',
  full_time: 'Sepenuh Masa', part_time: 'Sambilan', group_trial: 'Trial Berkumpulan', personal_intro: 'Sesi Pengenalan Personal',
  singles: 'Perseorangan', doubles: 'Beregu', boys: 'Lelaki', girls: 'Perempuan', mixed: 'Campuran', male: 'Lelaki', female: 'Perempuan',
  duitnow: 'DuitNow QR', fpx: 'FPX', transfer: 'Pindahan Bank', cash: 'Tunai', card: 'Kad',
};
const LABEL_EN = {
  new: 'New', contacted: 'Contacted', trial_scheduled: 'Trial Scheduled', trial_done: 'Trial Done', requested: 'Requested', enrolled: 'Enrolled', lost: 'Not Interested',
  scheduled: 'Scheduled', done: 'Done', no_show: 'No-show', cancelled: 'Cancelled',
  pending: 'Pending Review', awaiting_payment: 'Awaiting Payment', active: 'Active', paused: 'Paused', left: 'Left',
  issued: 'Unpaid', paid: 'Paid', void: 'Cancelled', overdue: 'Overdue',
  booked: 'Booked', present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused', late_cancel: 'Late Cancel',
  held: 'Completed', expired: 'Expired', fixed: 'Fixed Schedule', flexible: 'Flexible', package: 'Session Package',
  draft: 'Draft', open: 'Registration Open', closed: 'Registration Closed', ongoing: 'Ongoing', completed: 'Completed',
  registered: 'Registered', confirmed: 'Confirmed', withdrawn: 'Withdrawn', walkover: 'Walkover',
  approved: 'Approved', rejected: 'Rejected', admin: 'Admin', coach: 'Coach', parent: 'Parent',
  monthly: 'Monthly Fee', registration: 'Registration', jersey: 'Jersey', personal: 'Personal Coaching', tournament: 'Tournament', other: 'Others',
  full_time: 'Full-time', part_time: 'Part-time', group_trial: 'Group Trial', personal_intro: 'Personal Intro Session',
  singles: 'Singles', doubles: 'Doubles', boys: 'Boys', girls: 'Girls', mixed: 'Mixed', male: 'Male', female: 'Female',
  duitnow: 'DuitNow QR', fpx: 'FPX', transfer: 'Bank Transfer', cash: 'Cash', card: 'Card',
};
const LABEL_ZH = {
  new: '新', contacted: '已联系', trial_scheduled: '已安排试课', trial_done: '试课完成', requested: '申请中', enrolled: '已报名', lost: '无意向',
  scheduled: '已安排', done: '完成', no_show: '未出席', cancelled: '已取消',
  pending: '待审核', awaiting_payment: '待付款', active: '在读', paused: '暂停', left: '已退出',
  issued: '未付款', paid: '已付款', void: '已取消', overdue: '逾期',
  booked: '已预约', present: '出席', late: '迟到', absent: '缺席', excused: '请假', late_cancel: '临时取消',
  held: '已完成', expired: '已过期', fixed: '固定时间', flexible: '灵活预约', package: '课时配套',
  draft: '草稿', open: '报名开放', closed: '报名截止', ongoing: '进行中', completed: '已完成',
  registered: '已登记', confirmed: '已确认', withdrawn: '退出', walkover: '弃权',
  approved: '批准', rejected: '已拒绝', admin: '管理员', coach: '教练', parent: '家长',
  monthly: '月费', registration: '报名费', jersey: '球衣', personal: '私人教练课', tournament: '比赛', other: '其他',
  full_time: '全职', part_time: '兼职', group_trial: '团体试课', personal_intro: '私人体验课',
  singles: '单打', doubles: '双打', boys: '男子', girls: '女子', mixed: '混合', male: '男', female: '女',
  duitnow: 'DuitNow QR', fpx: 'FPX', transfer: '银行转账', cash: '现金', card: '银行卡',
};
export const LABEL = byLang(LABEL_MS, LABEL_EN, LABEL_ZH);
export const labelIn = (l, k) => (l === 'en' ? LABEL_EN : l === 'zh' ? LABEL_ZH : LABEL_MS)[k] ?? LABEL_MS[k] ?? k;
const TONE = {
  new: 'info', contacted: 'purple', trial_scheduled: 'warn', trial_done: 'lime', requested: 'warn', enrolled: 'ok', lost: 'muted',
  scheduled: 'warn', done: 'ok', no_show: 'bad', cancelled: 'muted',
  pending: 'warn', awaiting_payment: 'info', active: 'ok', paused: 'muted', left: 'muted',
  issued: 'warn', paid: 'ok', void: 'muted', overdue: 'bad',
  booked: 'info', expired: 'bad', present: 'ok', late: 'warn', absent: 'bad', excused: 'info', late_cancel: 'bad', held: 'ok',
  draft: 'muted', open: 'ok', closed: 'warn', ongoing: 'info', completed: 'purple',
  registered: 'warn', confirmed: 'ok', withdrawn: 'muted', walkover: 'muted',
  approved: 'ok', rejected: 'bad', admin: 'purple', coach: 'info', parent: 'lime',
  full_time: 'info', part_time: 'purple',
};
export const badge = (code, text) => `<span class="badge b-${TONE[code] || 'muted'}">${esc(text ?? LABEL[code] ?? code)}</span>`;
export const avatar = (name, cls = '') => `<div class="avatar ${cls}">${esc(initials(name))}</div>`;
export const barColor = p => (p >= 85 ? 'var(--ok)' : p >= 70 ? 'var(--warn)' : 'var(--bad)');
export const PROG_COLORS = ['#38BDF8', '#A78BFA', '#84CC16', '#F59E0B', '#F472B6'];

/* ---------- Pautan WhatsApp (nombor Malaysia) ---------- */
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '60' + d.slice(1);
  else if (!d.startsWith('6')) d = '60' + d;
  return d;
}
export const waLink = (phone, text = '') => `https://wa.me/${waNumber(phone)}${text ? '?text=' + encodeURIComponent(text) : ''}`;

/* ---------- Komponen halaman ---------- */
export const pageHead = (title, sub, actions = '') =>
  `<div class="page-head"><div><h1>${title}</h1><p>${sub || ''}</p></div><div class="actions">${actions}</div></div>`;

export function F(label, name, o = {}) {
  const { type = 'text', value = '', req = false, opts = null, ph = '', full = false, min, max, step, id } = o;
  const attrs = `name="${name}" ${id ? `id="${id}"` : ''} ${req ? 'required' : ''}`;
  let ctl;
  if (opts) {
    ctl = `<select ${attrs}>${opts.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  } else if (type === 'textarea') {
    ctl = `<textarea ${attrs} placeholder="${esc(ph)}">${esc(value)}</textarea>`;
  } else {
    ctl = `<input ${attrs} type="${type}" value="${esc(value ?? '')}" placeholder="${esc(ph)}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} ${step ? `step="${step}"` : ''}>`;
  }
  return `<label class="f ${full ? 'full' : ''}">${esc(label)}${ctl}</label>`;
}

/* ---------- Toast ---------- */
export function toast(msg, bad = false) {
  const t = $('#toast'); if (!t) return;
  t.innerHTML = ic(bad ? 'alert' : 'tick', 'sm') + `<span>${esc(msg)}</span>`;
  t.classList.toggle('bad', bad); t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), bad ? 4200 : 2600);
}

/* ---------- Modal ---------- */
let _modalStack = 0;
export function openModal({ title, body, submit, onSubmit, wide = false, cancel }) {
  submit = submit ?? t('Simpan');
  const m = $('#modal');
  m.innerHTML = `<form class="modal" id="mform" novalidate style="${wide ? 'max-width:760px' : ''}">
    <div class="modal-head"><h3>${title}</h3><button type="button" class="icon-btn" data-action="close-modal" aria-label="${t('Tutup')}">${ic('x')}</button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot"><button type="button" class="btn" data-action="close-modal">${cancel || (onSubmit ? t('Batal') : t('Tutup'))}</button>${onSubmit ? `<button class="btn primary" type="submit">${submit}</button>` : ''}</div>
  </form>`;
  m.classList.add('open'); _modalStack++;
  const f = $('#mform');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!onSubmit) return closeModal();
    if (!f.reportValidity()) return;
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    const fd = new FormData(f); const data = {};
    for (const k of new Set(fd.keys())) { const all = fd.getAll(k); data[k] = all.length > 1 ? all : all[0]; }
    f.querySelectorAll('input[type=checkbox]').forEach(c => { if (c.name && !(c.name in data)) data[c.name] = ''; });
    try { const r = await onSubmit(data, f); if (r === false) { btn.disabled = false; return; } closeModal(); }
    catch (err) { console.error(err); toast(friendlyError(err), true); btn.disabled = false; }
  });
  const first = f.querySelector('input:not([type=hidden]),select,textarea'); if (first) setTimeout(() => first.focus(), 40);
  return f;
}
export function closeModal() { const m = $('#modal'); if (!m) return; m.classList.remove('open'); m.innerHTML = ''; }
export function confirmModal({ title, message, ok, danger = false, onOk }) {
  title = title ?? t('Pasti?'); ok = ok ?? t('Ya, teruskan');
  openModal({ title, body: `<p style="font-size:14px">${message}</p>`, submit: ok, onSubmit: async () => { await onOk(); } });
  if (danger) $('#mform [type=submit]')?.classList.add('danger');
}

/* ---------- Ralat mesra pengguna ---------- */
export function friendlyError(e) {
  const m = String(e?.message || e || '');
  const c = e?.code;
  if (c === '23503' || /foreign key|masih digunakan/i.test(m)) return t('Rekod ini masih digunakan di tempat lain, jadi tidak boleh dipadam.');
  if (c === '23505' || /duplicate key/i.test(m)) return t('Rekod pendua — data ini sudah wujud.');
  if (c === '42501' || /row-level security|permission denied/i.test(m)) return t('Anda tidak mempunyai kebenaran untuk tindakan ini.');
  if (/Invalid login credentials/i.test(m)) return t('E-mel atau kata laluan tidak betul.');
  if (/Failed to fetch|NetworkError/i.test(m)) return t('Tiada sambungan ke pelayan. Semak internet anda.');
  return t(m) || t('Sesuatu tidak kena. Cuba lagi.');
}

/* Jalankan tindakan async dengan toast ralat */
export async function run(fn) {
  try { return await fn(); } catch (e) { console.error(e); toast(friendlyError(e), true); }
}
