// Invois, Nota Kredit & Resit: templat lama Maxxima (ungu, logo kanan atas), dijana sebagai halaman boleh cetak / simpan PDF.
import { S, setting } from './data.js';
import { esc, fmtDateIn } from './ui.js';
import { docLang, docShell, withLang } from './i18n.js';
import { tr } from './i18n-dom.js';
import { langOfStudentId } from './lang-of.js';
import { LOGO_DATA } from './logo-data.js';
import { qrSvg } from './qr.js';

const FALLBACK = {
  name: 'Maxxima Badminton Academy', registration_no: 'LA0064386-M', tagline: 'Badminton coaching across multiple training locations',
  email: 'maxxima.academy@gmail.com', phones: '011-62781291 | 012-4965324 | 016-4261291',
  bank_name: 'Maybank', bank_account: '5142-0866-3231', bank_holder: 'Muhaimin Badminton Academy',
};
const clean = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== '' && v != null));
const acad = () => ({ ...FALLBACK, ...clean(setting('academy', {})), ...clean(Object.fromEntries(['bank_name', 'bank_account', 'bank_holder', 'billplz_url', 'duitnow_note', 'policy_text'].map(k => [k, setting('billing', {})[k]]))), qr_duitnow: setting('billing', {}).qr_duitnow !== false, policy_on: setting('billing', {}).policy_on, qr_billplz: setting('billing', {}).qr_billplz !== false });

/* ---------- Bahasa dokumen: sumber Inggeris -> [BM, 中文] ---------- */
let L = 'en';
const TR = {
  'INVOICE': ['INVOIS', '发票'], 'RECEIPT': ['RESIT', '收据'], 'CREDIT NOTE': ['NOTA KREDIT', '贷记单'],
  'Invoice no.': ['No. invois', '发票号码'], 'Invoice date': ['Tarikh invois', '发票日期'], 'Due date': ['Tarikh akhir', '付款截止日期'], 'Receipt no.': ['No. resit', '收据号码'], 'Payment date': ['Tarikh bayaran', '付款日期'],
  'For invoice': ['Bagi invois', '对应发票'], 'Credit note no.': ['No. nota kredit', '贷记单号码'], 'Date': ['Tarikh', '日期'], 'Against invoice': ['Bagi invois', '对应发票'],
  'BILL TO': ['BIL KEPADA', '账单抬头'], 'PAYER (PARENT / GUARDIAN)': ['PEMBAYAR (IBU BAPA / PENJAGA)', '付款人（家长 / 监护人）'], 'RECEIVED FROM': ['DITERIMA DARIPADA', '付款人'], 'ISSUED TO': ['DIKELUARKAN KEPADA', '开具对象'],
  'Student': ['Pelajar', '学员'], 'Students': ['Pelajar', '学员'], 'Family': ['Keluarga', '家庭'], 'Phone': ['Tel', '电话'],
  'NO.': ['BIL.', '序号'], 'DESCRIPTION': ['BUTIRAN', '项目'], 'QTY': ['KUANTITI', '数量'], 'RATE': ['KADAR', '单价'], 'AMOUNT': ['JUMLAH', '金额'],
  'Subtotal': ['Subjumlah', '小计'], 'Discounts & credits': ['Diskaun & kredit', '折扣与抵扣'], 'Credit note(s)': ['Nota kredit', '贷记单'], 'INVOICE TOTAL': ['JUMLAH INVOIS', '发票总额'],
  'Paid': ['Telah dibayar', '已付'], 'BALANCE DUE': ['BAKI PERLU DIBAYAR', '应付余额'], 'Notes': ['Nota', '备注'],
  'UNPAID': ['BELUM BAYAR', '未付款'], 'PARTIALLY PAID': ['BAYARAN SEPARA', '部分付款'], 'PAID': ['DIBAYAR', '已付款'], 'OVERDUE': ['LEWAT', '逾期'], 'CANCELLED': ['DIBATALKAN', '已取消'],
  'HOW TO PAY': ['CARA BAYARAN', '付款方式'], 'Bank': ['Bank', '银行'], 'Account no.': ['No. akaun', '账号'], 'Account name': ['Nama akaun', '户名'], 'Reference': ['Rujukan', '参考'],
  'Please pay <b>{amt}</b> by <b>{due}</b> and use <b>{no}</b> as the payment reference. After paying, upload the proof in the parent portal or WhatsApp it to {wa}.': ['Sila bayar <b>{amt}</b> sebelum <b>{due}</b> dan guna <b>{no}</b> sebagai rujukan bayaran. Selepas bayar, muat naik bukti di portal ibu bapa atau WhatsApp ke {wa}.', '请在 <b>{due}</b> 前支付 <b>{amt}</b>，并以 <b>{no}</b> 作为付款备注。付款后，请在家长平台上传凭证或 WhatsApp 至 {wa}。'],
  'Thank you — this invoice was paid in full on {d}.': ['Terima kasih — invois ini telah dibayar penuh pada {d}.', '谢谢！本发票已于 {d} 全额付清。'],
  'DuitNow / Maybank QR': ['DuitNow / Maybank QR', 'DuitNow / Maybank QR'], "Touch 'n Go": ["Touch 'n Go", "Touch 'n Go"], 'FPX / card': ['FPX / kad', 'FPX / 银行卡'],
  'Sports tax relief (LHDN): {name} is registered with the Commissioner of Sports Malaysia (Reg. No. {reg}). Training fees may qualify for the annual sports relief; keep this document and your receipt.': ['Pelepasan cukai sukan (LHDN): {name} berdaftar dengan Pesuruhjaya Sukan Malaysia (No. {reg}). Yuran latihan mungkin layak untuk pelepasan sukan tahunan; simpan dokumen ini dan resit anda.', '运动税务减免（LHDN）：{name} 已在马来西亚体育专员署注册（编号 {reg}）。训练费可能符合年度运动减免资格，请保留本文件及收据。'],
  'Thank you for choosing {name}.': ['Terima kasih kerana memilih {name}.', '感谢您选择 {name}。'],
  'NRIC': ['No. KP', '身份证'], 'Passport': ['Pasport', '护照'], 'Army/Police ID': ['No. Tentera/Polis', '军警证'], 'Business Reg. No.': ['No. Pendaftaran Syarikat', '公司注册号'],
  'Training fees': ['Yuran latihan', '训练费'], 'Registration fee': ['Yuran pendaftaran', '报名费'], 'Jersey': ['Jersi', '球衣'], 'Personal coaching': ['Latihan personal', '私人教练课'], 'Tournament': ['Kejohanan', '比赛'], 'Fee': ['Yuran', '费用'],
  '{n} sessions': ['{n} sesi', '{n} 节课'], 'Discount': ['Diskaun', '折扣'], 'BOOKING & CANCELLATION POLICY': ['POLISI TEMPAHAN & PEMBATALAN', '预约与取消条款'],
  'Credit for {t}': ['Kredit untuk {t}', '{t} 的抵扣'], 'Original invoice {no}': ['Invois asal {no}', '原发票 {no}'], 'AMOUNT CREDITED': ['JUMLAH DIKREDITKAN', '抵扣金额'], 'Invoice value after credit': ['Nilai invois selepas kredit', '抵扣后发票金额'],
  'This credit note adjusts invoice {no}.': ['Nota kredit ini melaraskan invois {no}.', '本贷记单用于调整发票 {no}。'],
  'Payment method': ['Kaedah bayaran', '付款方式'], 'AMOUNT RECEIVED': ['JUMLAH DITERIMA', '收款金额'], 'Invoice total': ['Jumlah invois', '发票总额'], 'Paid to date': ['Dibayar setakat ini', '累计已付'], 'Balance': ['Baki', '余额'],
  'For {s}': ['Untuk {s}', '学员：{s}'], 'Payment for invoice {no}': ['Bayaran bagi invois {no}', '发票 {no} 的付款'],
  'This is a computer-generated receipt and requires no signature.': ['Ini ialah resit janaan komputer dan tidak memerlukan tandatangan.', '此为电脑生成的收据，无需签名。'],
  'DuitNow QR': ['DuitNow QR', 'DuitNow QR'], 'FPX': ['FPX', 'FPX'], 'Bank transfer': ['Pindahan bank', '银行转账'], 'Cash': ['Tunai', '现金'], 'Card': ['Kad', '银行卡'], 'Other': ['Lain-lain', '其他'],
};
const x = (k, v) => { let s = L === 'en' ? k : (TR[k]?.[L === 'ms' ? 0 : 1] ?? k); if (v) for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b); return s; };
const PRINT = { ms: 'Cetak / Simpan PDF', en: 'Print / Save PDF', zh: '打印 / 保存 PDF' };

export const DEFAULT_POLICY = `Why we ask for notice: personal training slots are reserved just for your child. The coach and the court are held for you, and other families are often waiting for a slot. A last-minute cancellation is very hard to fill, yet the coach and court still have to be paid.
• Cancel or reschedule at least 48 hours before the session: no charge. A replacement session depends on coach and court availability.
• Less than 48 hours' notice or no-show: the court fee is forfeited and 50% of the coaching fee is charged.
• Illness or emergency with supporting proof: only the court fee is forfeited; coaching may be rescheduled.
• If the academy cancels (e.g. coach unavailable): a replacement session is arranged at no extra charge.
• Replacement sessions and carry-forward arrangements need Admin confirmation.`;
const POLICY = { en: DEFAULT_POLICY,
  ms: `Mengapa kami memerlukan notis: slot latihan personal ditempah khas untuk anak anda. Jurulatih dan gelanggang dikhaskan untuk anda, dan sering ada keluarga lain yang menunggu slot. Pembatalan saat akhir amat sukar diganti, sedangkan jurulatih dan gelanggang tetap perlu dibayar.
• Batal atau tukar tarikh sekurang-kurangnya 48 jam sebelum sesi: tiada caj. Sesi ganti tertakluk kepada kekosongan jurulatih dan gelanggang.
• Notis kurang 48 jam atau tidak hadir: yuran gelanggang hangus dan 50% yuran latihan dikenakan.
• Sakit atau kecemasan dengan bukti sokongan: hanya yuran gelanggang hangus; latihan boleh dijadualkan semula.
• Jika akademi membatalkan (cth. jurulatih tidak dapat hadir): sesi ganti diatur tanpa caj tambahan.
• Sesi ganti dan bawa ke hadapan memerlukan pengesahan Admin.`,
  zh: `为什么需要提前通知：私人训练时段是专为您的孩子预留的。教练和场地都已为您保留，而且常有其他家庭在等候时段。临时取消很难找到人补上，但教练和场地费用仍须支付。
• 至少在课前 48 小时取消或改期：不收费。补课视教练和场地的空档而定。
• 少于 48 小时通知或缺席：场地费不予退还，并收取 50% 教练费。
• 生病或紧急情况（附证明）：仅场地费不予退还；训练可另行安排。
• 如学院取消（例如教练无法到场）：将安排补课，不另收费。
• 补课及课时顺延须经管理员确认。` };
const needsPolicy = (inv, a) => a.policy_on !== false && ((inv.kind === 'personal') || (S.t.invoice_items || []).some(i => i.invoice_id === inv.id && (i.unit === 'jam' || i.kind === 'court')));
const policyText = a => (a.policy_text && a.policy_text.trim() !== DEFAULT_POLICY.trim() ? a.policy_text : POLICY[L]);
const policyBlock = (inv, a) => needsPolicy(inv, a) ? `<div class="fbox"><h5>${esc(x('BOOKING & CANCELLATION POLICY'))}</h5>${esc(policyText(a)).split('\n').map(l => l.startsWith('•') ? `<div class="pl">${l}</div>` : `<p>${l}</p>`).join('')}</div>` : '';
const reliefBlock = a => a.sports_reg_no ? `<div class="fbox relief">${x('Sports tax relief (LHDN): {name} is registered with the Commissioner of Sports Malaysia (Reg. No. {reg}). Training fees may qualify for the annual sports relief; keep this document and your receipt.', { name: esc(a.name), reg: esc(a.sports_reg_no) })}</div>` : '';
const asset = f => new URL('assets/' + f, document.baseURI).href;
const UNITS = { sesi: { en: ['session', 'sessions'], ms: 'sesi', zh: '节' }, jam: { en: ['hour', 'hours'], ms: 'jam', zh: '小时' }, bulan: { en: ['month', 'months'], ms: 'bulan', zh: '个月' }, unit: { en: ['item', 'items'], ms: 'unit', zh: '项' }, kali: { en: ['time', 'times'], ms: 'kali', zh: '次' } };
const unitTxt = (u, q) => { const d = UNITS[u] || UNITS.unit; return L === 'en' ? d.en[Number(q) === 1 ? 0 : 1] : d[L]; };
const ID_LBL = { nric: 'NRIC', passport: 'Passport', army: 'Army/Police ID', brn: 'Business Reg. No.' };
const METHOD = { duitnow: 'DuitNow QR', fpx: 'FPX', transfer: 'Bank transfer', cash: 'Cash', card: 'Card', other: 'Other' };
const d8 = s => fmtDateIn(L, s);
const money = n => 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EN_ML = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], MS_ML = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const monthTxt = s => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return L === 'zh' ? `${d.getFullYear()}年${d.getMonth() + 1}月` : (L === 'ms' ? MS_ML : EN_ML)[d.getMonth()] + ' ' + d.getFullYear(); };
const tl = s => (L === 'ms' || !s ? s : withLang(L, () => tr(s)));   // teks sistem BM (cth. "Pembaharuan pakej: …") ikut bahasa dokumen
export const creditOf = invId => (S.t.credit_notes || []).filter(c => c.invoice_id === invId).reduce((s, c) => s + Number(c.amount), 0);
const paidOf = invId => (S.t.payments || []).filter(p => p.invoice_id === invId && p.status === 'confirmed').reduce((t, p) => t + Number(p.amount), 0);

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#e9e6f2;font:12px/1.45 Arial,Helvetica,'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif;color:#222}
.btns{max-width:794px;margin:14px auto;display:flex;gap:8px;justify-content:center}.btns button{font:600 14px Arial;padding:10px 20px;border:0;border-radius:8px;background:#3b2370;color:#fff;cursor:pointer}
.page{width:794px;margin:0 auto 24px;background:#fff;padding:38px 46px 30px;position:relative}
.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:1.5px solid #3b2370;padding-bottom:12px}
.brand h1{margin:0 0 6px;font-size:20px;letter-spacing:.14em;color:#3b2370;font-weight:700}.brand div{font-size:10.5px;line-height:1.55;color:#333}.brand .tag{color:#6b5f8a}
.logo{width:84px;height:84px;object-fit:contain;flex:none}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-top:18px;gap:20px}
.top h2{margin:0;font-size:28px;letter-spacing:.1em;color:#3b2370;line-height:1}
.pill{display:inline-block;margin-top:9px;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.1em;border:1.5px solid}
.p-unpaid{color:#9a6700;border-color:#e3b341;background:#fff8e1}.p-part{color:#1d4ed8;border-color:#93c5fd;background:#eff6ff}.p-paid{color:#15803d;border-color:#86efac;background:#f0fdf4}.p-over,.p-void{color:#b42318;border-color:#fca5a5;background:#fef2f2}
.kv{min-width:270px;font-size:11.5px}.kv div{display:flex;justify-content:space-between;gap:16px;padding:3px 0}.kv span:first-child{color:#555}.kv .strong{font-weight:700}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
.box{border:1px solid #d9d6e3;border-radius:6px;padding:10px 12px;font-size:11.5px;line-height:1.5}.box h5{margin:0 0 5px;font-size:9.5px;letter-spacing:.16em;color:#3b2370}.box b.nm{display:block;font-size:13.5px;margin-bottom:2px}.box .mut{color:#555}
table.items{width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed}
.items th{background:#eeeaf7;color:#3b2370;font-size:9.5px;letter-spacing:.14em;text-align:left;padding:8px 10px}
.items td{padding:7px 10px;font-size:11.5px;border-bottom:1px solid #e4e1ec;vertical-align:top}
.items .r{text-align:right;white-space:nowrap}.items td b{font-weight:700}.items .sub{font-size:10.5px;color:#666;margin-top:2px}.items .u{font-size:10px;color:#777}
.items tr.neg td{color:#b42318}.items tr.grp td{background:#f6f4fb;color:#3b2370;font-weight:700;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border-bottom:1px solid #e4e1ec}
.sum{display:grid;grid-template-columns:1fr 290px;gap:18px;margin-top:12px;align-items:start}
.notes{font-size:11px;color:#444}.notes h5{margin:0 0 4px;font-size:9.5px;letter-spacing:.16em;color:#3b2370}
.tot div{display:flex;justify-content:space-between;padding:5px 10px;font-size:11.5px}.tot .neg{color:#b42318}
.tot .band{background:#eeeaf7;color:#3b2370;font-weight:700;font-size:13px;padding:8px 10px;margin-top:3px}
.tot .due{background:#3b2370;color:#fff;font-weight:700;font-size:14px;padding:10px;margin-top:3px;letter-spacing:.02em}
.pay{margin-top:16px;border:1px solid #d9d6e3;border-radius:6px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:16px;page-break-inside:avoid}
.pay h5{margin:0 0 6px;font-size:9.5px;letter-spacing:.16em;color:#3b2370}.pay p{margin:6px 0 0;font-size:11px;color:#333}
.bank div{display:flex;font-size:11.5px;padding:3px 0}.bank span:first-child{width:110px;color:#555}.bank span:last-child{font-weight:700}
.qrs{display:flex;gap:10px}.qr{width:96px;text-align:center}.qr img,.qr svg{width:88px;height:88px;display:block;margin:0 auto 3px}.qr b{display:block;font-size:9px;color:#3b2370;line-height:1.3}
.paidnote{margin-top:16px;padding:10px 12px;border-radius:6px;background:#f0fdf4;color:#15803d;font-size:11.5px;font-weight:700}
.foot{display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px}
.fbox{border:1px solid #e4e1ec;border-radius:6px;padding:8px 10px;font-size:9.5px;color:#555;line-height:1.45;page-break-inside:avoid}.fbox h5{margin:0 0 3px;font-size:9px;letter-spacing:.14em;color:#3b2370}.fbox p{margin:0 0 3px}.fbox .pl{margin:1px 0 1px 6px}
.fbox.relief{background:#f6f4fb;border-left:3px solid #3b2370}
.ft{margin-top:14px;border-top:1.5px solid #3b2370;padding-top:8px;font-size:10px;color:#6b5f8a;display:flex;justify-content:space-between;gap:10px}
.stamp{position:absolute;right:60px;top:250px;border:3px solid;padding:4px 14px;font-weight:700;font-size:18px;letter-spacing:.14em;border-radius:6px;transform:rotate(-8deg);opacity:.75}
.stamp.ok{color:#15803d}.stamp.bad{color:#b42318}
.amt{margin-top:16px;display:flex;justify-content:space-between;align-items:center;background:#3b2370;color:#fff;padding:14px 14px;border-radius:4px}.amt span{font-size:11px;letter-spacing:.16em;font-weight:700}.amt b{font-size:22px}
@media print{body{background:#fff}.btns{display:none}.page{margin:0;width:794px;padding:0;zoom:.86}@page{size:A4;margin:10mm}.fbox,.pay,.sum{break-inside:avoid}}`;

const logoUrl = () => LOGO_DATA;
const head = a => {
  const reg = [a.legal_name && a.legal_name !== a.name ? esc(a.legal_name) : '', a.registration_no ? esc(a.registration_no) : '', a.tin ? 'TIN ' + esc(a.tin) : '', a.sst_no ? 'SST ' + esc(a.sst_no) : ''].filter(Boolean).join(' · ');
  const contact = [esc(a.email), esc(a.phones)].filter(Boolean).join(' · ');
  return `<div class="hd"><div class="brand"><h1>${esc(a.name).toUpperCase()}</h1>${reg ? `<div>${reg}</div>` : ''}${a.address ? `<div>${esc(a.address).replace(/\n/g, ', ')}</div>` : ''}<div>${contact}</div><div class="tag">${esc(a.tagline)}</div></div><img class="logo" src="${logoUrl()}" alt=""></div>`;
};
const docDef = studentId => (S.profile?.role !== 'parent' && langOfStudentId(studentId)) || docLang('en');
const doc = (title, def, render) => docShell({ title: esc(title), css: CSS, def, printLabel: PRINT, render: l => { L = l; return `<div class="page">${render()}</div>`; } });
const kv = rows => `<div class="kv">${rows.map(([k, v, strong]) => `<div class="${strong ? 'strong' : ''}"><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;

/* ---------- Konteks: pelajar, pembayar, program ---------- */
function context(inv) {
  const st = S.t.students.find(s => s.id === inv.student_id) || {};
  const ven = S.t.venues.find(v => v.id === st.venue_id), prog = S.t.programmes.find(p => p.id === st.programme_id);
  const place = [ven?.name, ven?.area && !String(ven.name).includes(ven.area) ? ven.area : ''].filter(Boolean).join(', ');
  const lines = String(inv.description || '').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('[Import'));
  const pkg = S.t.student_packages?.find(p => p.invoice_id === inv.id);
  const fallback = x({ package: 'Training fees', registration: 'Registration fee', jersey: 'Jersey', personal: 'Personal coaching', tournament: 'Tournament', other: 'Fee' }[inv.kind] || 'Fee');
  const kidIds = [...new Set([inv.student_id, ...(S.t.invoice_items || []).filter(i => i.invoice_id === inv.id).map(i => i.student_id)].filter(Boolean))];
  return { kids: kidIds.map(id => (S.t.students.find(x => x.id === id) || {}).full_name).filter(Boolean), st, tax: (S.t.parent_tax_info || []).find(t => t.id === st.guardian_id), place, prog: prog?.name || '', title: tl(lines[0] || '') || fallback, extra: lines.slice(1), pkgSub: pkg ? x('{n} sessions', { n: pkg.sessions_total }) : '' };
}
const parties = (inv, c, leftTitle, rightTitle = 'PAYER (PARENT / GUARDIAN)') => {
  const left = `<div class="box"><h5>${x(leftTitle)}</h5><b class="nm">${esc(inv.bill_to || c.st.full_name || '')}</b>${c.kids.length > 1 ? `<div class="mut">${x('Students')}: ${c.kids.map(esc).join(', ')}</div>` : inv.bill_to && c.st.full_name && inv.bill_to !== c.st.full_name ? `<div class="mut">${x('Student')}: ${esc(c.st.full_name)}</div>` : ''}${c.prog || c.place ? `<div class="mut">${esc([c.prog, c.place].filter(Boolean).join(' · '))}</div>` : ''}<div class="mut">${monthTxt(inv.issued_on)}</div></div>`;
  const t = c.tax, gName = t?.legal_name || c.st.guardian_name, gPhone = t?.phone || c.st.guardian_phone;
  const right = gName ? `<div class="box"><h5>${x(rightTitle)}</h5><b class="nm">${esc(gName)}</b>${t?.id_no ? `<div class="mut">${x(ID_LBL[t.id_type] || 'NRIC')}: ${esc(t.id_no)}</div>` : ''}${t?.tin ? `<div class="mut">TIN: ${esc(t.tin)}</div>` : ''}${t?.address ? `<div class="mut">${esc(t.address).replace(/\n/g, ', ')}</div>` : ''}${gPhone ? `<div class="mut">${x('Phone')}: ${esc(gPhone)}</div>` : ''}</div>` : '<div></div>';
  return `<div class="parties">${left}${right}</div>`;
};
const th = () => `<colgroup><col style="width:46px"><col><col style="width:86px"><col style="width:96px"><col style="width:106px"></colgroup><thead><tr><th>${x('NO.')}</th><th>${x('DESCRIPTION')}</th><th class="r">${x('QTY')}</th><th class="r">${x('RATE')}</th><th class="r">${x('AMOUNT')}</th></tr></thead>`;
const items = inv => (S.t.invoice_items || []).filter(i => i.invoice_id === inv.id).sort((a, b) => a.sort - b.sort);
function itemRows(inv, c) {
  const its = items(inv);
  if (!its.length) return `<tr><td>1</td><td><b>${esc(c.title)}</b>${c.pkgSub && !/sesi|session|节/i.test(c.title) ? `<div class="sub">${esc(c.pkgSub)}</div>` : ''}</td><td class="r">1</td><td class="r">${money(inv.amount)}</td><td class="r"><b>${money(inv.amount)}</b></td></tr>`;
  const sids = [...new Set(its.map(i => i.student_id).filter(Boolean))], fam = sids.length > 1;
  const nm = id => (S.t.students.find(x => x.id === id) || {}).full_name || '';
  const order = fam ? [inv.student_id, ...sids.filter(x => x !== inv.student_id)] : [];
  const list = fam ? order.flatMap(id => its.filter(i => i.student_id === id)).concat(its.filter(i => !i.student_id || !order.includes(i.student_id))) : its;
  let lastStu = null, n = 0;
  return list.map(it => { const i = n++; let grp = '';
    if (fam && it.student_id !== lastStu) { lastStu = it.student_id; const sub = its.filter(x => x.student_id === it.student_id).reduce((t, x) => t + Number(x.amount), 0); grp = `<tr class="grp"><td colspan="4">${esc(nm(it.student_id) || x('Family'))}</td><td class="r">${money(sub)}</td></tr>`; }
    return grp + rowOf(it, i); }).join('');
  function rowOf(it, i) { const neg = Number(it.amount) < 0, sub = it.kind === 'package' && c.pkgSub && !/sesi|session|节/i.test(it.description) ? c.pkgSub : '';
    return `<tr class="${neg ? 'neg' : ''}"><td>${i + 1}</td><td><b>${esc(tl(it.description))}</b>${it.details ? `<div class="sub">${esc(it.details).replace(/\n/g, '<br>')}</div>` : ''}${sub ? `<div class="sub">${esc(sub)}</div>` : ''}${Number(it.discount) > 0 ? `<div class="sub">${x('Discount')}: − ${money(it.discount)}</div>` : ''}</td>
      <td class="r">${neg ? '' : `${+Number(it.qty).toFixed(2)} <span class="u">${unitTxt(it.unit, it.qty)}</span>`}</td><td class="r">${neg ? '' : money(it.unit_price)}</td><td class="r"><b>${neg ? '− ' + money(Math.abs(it.amount)) : money(it.amount)}</b></td></tr>`; }
}
function totals(inv) {
  const its = items(inv), pos = its.length ? its.filter(i => Number(i.amount) > 0).reduce((t, i) => t + Number(i.amount), 0) : Number(inv.amount);
  const neg = its.filter(i => Number(i.amount) < 0).reduce((t, i) => t + Number(i.amount), 0), cr = creditOf(inv.id), total = Number(inv.amount) - cr, paid = paidOf(inv.id);
  return { pos, neg, cr, total, paid, due: Math.max(total - paid, 0) };
}
const statusOf = (inv, t) => inv.status === 'void' ? ['CANCELLED', 'p-void'] : t.due <= 0.004 ? ['PAID', 'p-paid'] : t.paid > 0 ? ['PARTIALLY PAID', 'p-part'] : inv.due_date < new Date().toISOString().slice(0, 10) ? ['OVERDUE', 'p-over'] : ['UNPAID', 'p-unpaid'];

function payBlock(a, inv, t) {
  const qrs = [];
  if (a.qr_duitnow) qrs.push(`<div class="qr"><img src="${asset('qr-maybank.png')}" alt=""><b>${x('DuitNow / Maybank QR')}</b></div>`, `<div class="qr"><img src="${asset('qr-tng.png')}" alt=""><b>${x("Touch 'n Go")}</b></div>`);
  if (a.qr_billplz && a.billplz_url) qrs.push(`<div class="qr">${qrSvg(a.billplz_url, { size: 88 })}<b>${x('FPX / card')}</b></div>`);
  return `<div class="pay"><div><h5>${x('HOW TO PAY')}</h5><div class="bank"><div><span>${x('Bank')}</span><span>${esc(a.bank_name)}</span></div><div><span>${x('Account no.')}</span><span>${esc(a.bank_account)}</span></div><div><span>${x('Account name')}</span><span>${esc(a.bank_holder)}</span></div><div><span>${x('Reference')}</span><span>${esc(inv.number)}</span></div></div>
    <p>${x('Please pay <b>{amt}</b> by <b>{due}</b> and use <b>{no}</b> as the payment reference. After paying, upload the proof in the parent portal or WhatsApp it to {wa}.', { amt: money(t.due), due: d8(inv.due_date), no: esc(inv.number), wa: esc(String(a.whatsapp || a.phones).split('|')[0].trim()) })}</p>${a.duitnow_note ? `<p>${esc(a.duitnow_note)}</p>` : ''}</div>
    ${qrs.length ? `<div class="qrs">${qrs.join('')}</div>` : ''}</div>`;
}

export function invoiceHtml(invId) {
  const inv = S.t.invoices.find(i => i.id === invId); if (!inv) throw new Error('Invois tidak dijumpai.');
  const a = acad();
  return doc(`Invoice ${inv.number}`, docDef(inv.student_id), () => {
    const c = context(inv), t = totals(inv), [stt, cls] = statusOf(inv, t);
    const lastPaid = (S.t.payments || []).filter(p => p.invoice_id === inv.id && p.status === 'confirmed').map(p => p.paid_on).sort().pop() || inv.paid_on;
    const notes = [...c.extra.map(tl), c.st.billing_note || ''].filter(Boolean);
    return `${head(a)}
  <div class="top"><div><h2>${x('INVOICE')}</h2><span class="pill ${cls}">${x(stt)}</span></div>${kv([[x('Invoice no.'), esc(inv.number), 1], [x('Invoice date'), d8(inv.issued_on)], [x('Due date'), d8(inv.due_date), 1]])}</div>
  ${parties(inv, c, 'BILL TO')}
  <table class="items">${th()}<tbody>${itemRows(inv, c)}</tbody></table>
  <div class="sum"><div class="notes">${notes.length ? `<h5>${x('Notes')}</h5>${notes.map(n => `<div>${esc(n)}</div>`).join('')}` : ''}</div>
   <div class="tot">${t.neg || t.cr ? `<div><span>${x('Subtotal')}</span><span>${money(t.pos)}</span></div>` : ''}${t.neg ? `<div class="neg"><span>${x('Discounts & credits')}</span><span>− ${money(Math.abs(t.neg))}</span></div>` : ''}${t.cr ? `<div class="neg"><span>${x('Credit note(s)')}</span><span>− ${money(t.cr)}</span></div>` : ''}
    <div class="band"><span>${x('INVOICE TOTAL')}</span><span>${money(t.total)}</span></div>
    ${t.paid ? `<div><span>${x('Paid')}</span><span>− ${money(t.paid)}</span></div>` : ''}${inv.status !== 'void' && t.due > 0.004 ? `<div class="due"><span>${x('BALANCE DUE')}</span><span>${money(t.due)}</span></div>` : ''}</div></div>
  ${inv.status === 'issued' && t.due > 0.004 ? payBlock(a, inv, t) : inv.status === 'void' ? `<div class="paidnote" style="background:#fef2f2;color:#b42318">${x('CANCELLED')}</div>` : `<div class="paidnote">${x('Thank you — this invoice was paid in full on {d}.', { d: d8(lastPaid) })}</div>`}
  <div class="foot">${policyBlock(inv, a)}${reliefBlock(a)}</div>
  <div class="ft"><span>${x('Thank you for choosing {name}.', { name: esc(a.name) })}</span><span>${esc(inv.number)}</span></div>`; });
}

export function creditNoteHtml(cnId) {
  const cn = (S.t.credit_notes || []).find(c => c.id === cnId); if (!cn) throw new Error('Nota kredit tidak dijumpai.');
  const inv = S.t.invoices.find(i => i.id === cn.invoice_id), a = acad();
  return doc(`Credit Note ${cn.number}`, docDef(inv.student_id), () => { const c = context(inv), after = Number(inv.amount) - creditOf(inv.id); return `${head(a)}
  <div class="top"><div><h2>${x('CREDIT NOTE')}</h2></div>${kv([[x('Credit note no.'), esc(cn.number), 1], [x('Date'), d8(cn.issued_on)], [x('Against invoice'), esc(inv.number), 1]])}</div>
  ${parties(inv, c, 'ISSUED TO')}
  <table class="items">${th()}<tbody><tr><td>1</td><td><b>${x('Credit for {t}', { t: esc(c.title) })}</b>${cn.reason ? `<div class="sub">${esc(cn.reason)}</div>` : ''}</td><td class="r">1</td><td class="r">${money(cn.amount)}</td><td class="r"><b>${money(cn.amount)}</b></td></tr></tbody></table>
  <div class="sum"><div class="notes">${x('This credit note adjusts invoice {no}.', { no: esc(inv.number) })}</div><div class="tot"><div><span>${x('Original invoice {no}', { no: esc(inv.number) })}</span><span>${money(inv.amount)}</span></div><div class="band"><span>${x('AMOUNT CREDITED')}</span><span>− ${money(cn.amount)}</span></div><div><span>${x('Invoice value after credit')}</span><span>${money(after)}</span></div></div></div>
  <div class="ft"><span>${x('Thank you for choosing {name}.', { name: esc(a.name) })}</span><span>${esc(cn.number)}</span></div>`; });
}

/* ---------- Resit: gaya sama seperti invois ---------- */
export function receiptHtml(paymentId) {
  const p = (S.t.payments || []).find(q => q.id === paymentId);
  if (!p || p.status !== 'confirmed') throw new Error('Resit hanya tersedia selepas bayaran disahkan.');
  const inv = S.t.invoices.find(i => i.id === p.invoice_id), a = acad();
  return doc(`Receipt ${p.receipt_no || ''}`, docDef(inv?.student_id), () => {
    const c = context(inv), t = totals(inv);
    const upto = (S.t.payments || []).filter(q => q.invoice_id === inv.id && q.status === 'confirmed' && (q.paid_on < p.paid_on || (q.paid_on === p.paid_on && String(q.receipt_no || '') <= String(p.receipt_no || '')))).reduce((s, q) => s + Number(q.amount), 0);
    const bal = Math.max(t.total - upto, 0);
    return `${head(a)}
  <div class="top"><div><h2>${x('RECEIPT')}</h2><span class="pill ${bal <= 0.004 ? 'p-paid' : 'p-part'}">${x(bal <= 0.004 ? 'PAID' : 'PARTIALLY PAID')}</span></div>${kv([[x('Receipt no.'), esc(p.receipt_no || '—'), 1], [x('Payment date'), d8(p.paid_on)], [x('For invoice'), esc(inv.number), 1]])}</div>
  ${parties(inv, c, 'BILL TO', 'RECEIVED FROM')}
  <table class="items"><colgroup><col style="width:46px"><col><col style="width:130px"></colgroup><thead><tr><th>${x('NO.')}</th><th>${x('DESCRIPTION')}</th><th class="r">${x('AMOUNT')}</th></tr></thead><tbody>
   <tr><td>1</td><td><b>${x('Payment for invoice {no}', { no: esc(inv.number) })}</b><div class="sub">${esc(c.title)}${c.pkgSub && !/sesi|session|节/i.test(c.title) ? ' · ' + esc(c.pkgSub) : ''}</div><div class="sub">${x('Payment method')}: ${x(METHOD[p.method] || 'Other')}${p.reference ? ` · ${x('Reference')}: ${esc(p.reference)}` : ''}</div></td><td class="r"><b>${money(p.amount)}</b></td></tr></tbody></table>
  <div class="amt"><span>${x('AMOUNT RECEIVED')}</span><b>${money(p.amount)}</b></div>
  <div class="sum"><div class="notes">${x('This is a computer-generated receipt and requires no signature.')}</div><div class="tot"><div><span>${x('Invoice total')}</span><span>${money(t.total)}</span></div><div><span>${x('Paid to date')}</span><span>${money(upto)}</span></div><div class="band"><span>${x('Balance')}</span><span>${money(bal)}</span></div></div></div>
  <div class="foot">${reliefBlock(a)}</div>
  <div class="ft"><span>${x('Thank you for choosing {name}.', { name: esc(a.name) })}</span><span>${esc(p.receipt_no || '')}</span></div>`; });
}

function openDoc(html, filename) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) { const el = document.createElement('a'); el.href = url; el.download = filename; el.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const openInvoice = id => openDoc(invoiceHtml(id), 'invois.html');
export const openCreditNote = id => openDoc(creditNoteHtml(id), 'nota-kredit.html');
export const openReceiptDoc = id => openDoc(receiptHtml(id), 'resit.html');
