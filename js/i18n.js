// Bahasa: BM (sumber) / English / 中文. Kunci kamus ialah teks Bahasa Malaysia; jika tiada terjemahan, teks BM dipaparkan.
// Peringkat 1: skrin log masuk, Portal Ibu Bapa, invois, nota kredit dan resit. Portal Admin kekal BM buat masa ini.
const KEY = 'mx_lang';
export const LANGS = [['ms', 'BM'], ['en', 'EN'], ['zh', '中文']];
let lang = 'ms', active = true;
try { const v = localStorage.getItem(KEY); if (LANGS.some(l => l[0] === v)) lang = v; } catch { /* storan tidak tersedia */ }
const apply = () => { try { document.documentElement.lang = active ? lang : 'ms'; } catch { /* tiada DOM */ } };
apply();

/* Bahasa yang sedang dipaparkan (Portal Admin sentiasa 'ms' buat masa ini) */
export const getLang = () => (active ? lang : 'ms');
export const setLang = l => { if (!LANGS.some(x => x[0] === l)) return; lang = l; try { localStorage.setItem(KEY, l); } catch { /* abaikan */ } apply(); };
/* Jalankan fn dalam bahasa tertentu buat sementara (untuk mesej / dokumen pelanggan) */
export function withLang(l, fn) { if (!l || !LANGS.some(x => x[0] === l)) return fn(); const p = lang, a = active; lang = l; active = true; try { return fn(); } finally { lang = p; active = a; } }
export const setI18nActive = on => { active = !!on; apply(); };
/* Bahasa lalai dokumen (invois/resit): ikut pilihan pengguna; di Portal Admin guna lalai yang diberi */
export const docLang = fallback => (active ? lang : fallback);

const D = {
  // --- umum / log masuk ---
  'Log Masuk': ['Log In', '登录'], 'Log keluar': ['Log out', '退出登录'], 'Simpan': ['Save', '保存'], 'Batal': ['Cancel', '取消'], 'Tutup': ['Close', '关闭'],
  'Pasti?': ['Are you sure?', '确定吗？'], 'Ya, teruskan': ['Yes, continue', '是，继续'], 'Bahasa': ['Language', '语言'], 'Tetapan paparan': ['Display settings', '显示设置'], 'Tema': ['Theme', '主题'], 'Cerah': ['Light', '浅色'], 'Gelap': ['Dark', '深色'], 'Auto': ['Auto', '自动'],
  'Mod demo: pilih peranan untuk pratonton.': ['Demo mode: choose a role to preview.', '演示模式：请选择角色预览。'],
  'Masuk dengan e-mel dan kata laluan anda.': ['Sign in with your email and password.', '请使用电邮和密码登录。'],
  'Masuk sebagai Admin': ['Enter as Admin', '以管理员身份进入'], 'Masuk sebagai Coach': ['Enter as Coach', '以教练身份进入'], 'Masuk sebagai Ibu Bapa': ['Enter as Parent', '以家长身份进入'],
  'E-mel atau No. Telefon': ['Email or phone number', '电邮或电话号码'], 'Kata laluan': ['Password', '密码'], 'Lupa kata laluan?': ['Forgot password?', '忘记密码？'], 'Sedang masuk…': ['Signing in…', '登录中…'],
  'Tetapkan Kata Laluan': ['Set Your Password', '设置密码'], 'Cipta kata laluan untuk akaun anda (sekurang-kurangnya 8 aksara).': ['Create a password for your account (at least 8 characters).', '请为您的账户设置密码（至少 8 个字符）。'],
  'Kata laluan baharu': ['New password', '新密码'], 'Ulang kata laluan': ['Repeat password', '再次输入密码'], 'Simpan & Masuk': ['Save & Enter', '保存并进入'],
  'Kata laluan mesti sekurang-kurangnya 8 aksara.': ['Password must be at least 8 characters.', '密码至少需要 8 个字符。'], 'Kata laluan tidak sepadan.': ['Passwords do not match.', '两次输入的密码不一致。'],
  'Set Semula Kata Laluan': ['Reset Password', '重设密码'], 'Hantar Pautan': ['Send Link', '发送链接'], 'E-mel': ['Email', '电邮'],
  'Kami akan menghantar pautan untuk menetapkan kata laluan baharu.': ['We will send you a link to set a new password.', '我们会发送一个链接，让您设置新密码。'],
  'Pautan dihantar. Semak e-mel anda.': ['Link sent. Check your email.', '链接已发送，请查看您的电邮。'],
  // --- ralat ---
  'Rekod ini masih digunakan di tempat lain, jadi tidak boleh dipadam.': ['This record is still in use elsewhere, so it cannot be deleted.', '此记录仍在其他地方使用，无法删除。'],
  'Rekod pendua — data ini sudah wujud.': ['Duplicate record — this data already exists.', '重复记录 — 此数据已存在。'],
  'Anda tidak mempunyai kebenaran untuk tindakan ini.': ['You do not have permission for this action.', '您没有权限执行此操作。'],
  'E-mel atau kata laluan tidak betul.': ['Incorrect email or password.', '电邮或密码不正确。'],
  'Tiada sambungan ke pelayan. Semak internet anda.': ['Cannot reach the server. Check your internet connection.', '无法连接服务器，请检查网络。'],
  'Sesuatu tidak kena. Cuba lagi.': ['Something went wrong. Please try again.', '出了点问题，请再试一次。'],
  'Ralat memaparkan halaman.': ['Error displaying this page.', '页面显示出错。'], 'Gagal memuatkan data.': ['Failed to load data.', '数据加载失败。'],
  // --- shell ibu bapa ---
  'Portal Ibu Bapa': ['Parent Portal', '家长平台'], 'Ibu Bapa': ['Parent', '家长'], 'Notifikasi': ['Notifications', '通知'], 'Tiada notifikasi.': ['No notifications.', '暂无通知。'],
  'Utama': ['Home', '首页'], 'Jadual': ['Schedule', '课程表'], 'Yuran': ['Fees', '学费'], 'Progres': ['Progress', '进度'], 'Akaun': ['Account', '账户'],
  'Memuatkan data anak anda…': ["Loading your child's data…", '正在加载孩子的资料…'],
  'Belum ada anak dipautkan.': ['No child linked yet.', '尚未关联孩子。'],
  'Hubungi admin akademi untuk memautkan akaun anda kepada anak anda.': ['Please contact the academy admin to link your account to your child.', '请联系学院管理员，将您的账户与孩子关联。'],
  // --- utama ---
  'Selamat datang': ['Welcome', '欢迎'], 'Salam, {name} 👋': ['Hello, {name} 👋', '您好，{name} 👋'],
  'Ringkasan anak anda di Maxxima Badminton Academy': ["Your child's summary at Maxxima Badminton Academy", '孩子在 Maxxima Badminton Academy 的概况'],
  'Yuran belum dijelaskan': ['Outstanding fees', '未缴学费'],
  'Bayar melalui QR atau pindahan bank, kemudian muat naik bukti.': ['Pay by QR or bank transfer, then upload your proof of payment.', '请通过二维码或银行转账付款，然后上传付款凭证。'],
  'akhir {d}': ['due {d}', '截止 {d}'], 'dibayar {d}': ['paid {d}', '已于 {d} 付款'], 'Bayar': ['Pay', '付款'],
  '{n} kehadiran menunggu pengesahan anda': ['{n} attendance record(s) awaiting your confirmation', '有 {n} 条出席记录等待您确认'],
  'Sahkan anak benar-benar hadir.': ['Confirm that your child really attended.', '请确认孩子确实出席。'], 'Semak': ['Review', '查看'],
  'sesi': ['sessions', '节课'], 'Sah hingga {d}': ['Valid until {d}', '有效期至 {d}'], 'sah hingga {d}': ['valid until {d}', '有效期至 {d}'],
  'hampir habis': ['almost used up', '即将用完'], 'invois pembaharuan akan dikeluarkan': ['a renewal invoice will be issued', '续费发票即将发出'],
  'Tiada pakej aktif': ['No active package', '没有有效配套'], 'menunggu bayaran': ['awaiting payment', '等待付款'],
  'Sesi seterusnya:': ['Next session:', '下一节课：'], 'Tiada sesi akan datang dijadualkan.': ['No upcoming session scheduled.', '暂无已安排的课程。'],
  // --- jadual ---
  'Sesi akan datang, tempahan dan sejarah kehadiran': ['Upcoming sessions, bookings and attendance history', '即将上课、预约与出席记录'],
  'Sesi akan datang': ['Upcoming sessions', '即将上课'], '30 hari seterusnya': ['Next 30 days', '未来 30 天'],
  'Ditempah': ['Booked', '已预约'], 'Kelas tetap': ['Fixed class', '固定班'], 'Tiada sesi dijadualkan dalam 30 hari ini.': ['No sessions scheduled in the next 30 days.', '未来 30 天没有已安排的课程。'],
  'Tempah sesi': ['Book a session', '预约课程'], 'Tempah': ['Book', '预约'], 'Tempah sesi?': ['Book this session?', '预约这节课？'],
  'Pakej fleksibel anda: baki <b>{n}</b> sesi': ['Your flexible package: <b>{n}</b> session(s) left', '您的灵活配套：剩余 <b>{n}</b> 节课'],
  'Pembatalan perlu dibuat sekurang-kurangnya {h} jam sebelum kelas.': ['Cancellations must be made at least {h} hours before class.', '取消须在上课前至少 {h} 小时提出。'],
  '{n} tempat kosong': ['{n} place(s) left', '剩余 {n} 个名额'], 'penuh': ['full', '已满'],
  'Tiada sesi tersedia untuk ditempah dalam 21 hari.': ['No sessions available to book in the next 21 days.', '未来 21 天没有可预约的课程。'],
  'Sejarah kehadiran': ['Attendance history', '出席记录'], 'Sahkan kehadiran anak selepas setiap sesi': ["Confirm your child's attendance after each session", '请在每节课后确认孩子的出席'],
  'Disahkan': ['Confirmed', '已确认'], 'Sahkan': ['Confirm', '确认'], 'Belum ada rekod kehadiran.': ['No attendance records yet.', '暂无出席记录。'],
  '1 sesi akan ditolak daripada pakej fleksibel apabila anak hadir.': ['1 session will be deducted from the flexible package when your child attends.', '孩子出席后，将从灵活配套中扣除 1 节课。'],
  'Tiada pakej fleksibel aktif untuk program ini.': ['No active flexible package for this programme.', '此课程没有有效的灵活配套。'],
  'Sesi ditempah': ['Session booked', '课程已预约'], 'Batalkan tempahan?': ['Cancel this booking?', '取消预约？'], 'Batalkan Tempahan': ['Cancel Booking', '取消预约'], 'Tempahan dibatalkan': ['Booking cancelled', '预约已取消'],
  'Sesi akan dipulangkan ke pakej anda jika dibatalkan dalam tempoh notis yang dibenarkan.': ['The session is returned to your package if you cancel within the allowed notice period.', '如在规定通知期内取消，该节课将退回您的配套。'],
  'Kehadiran disahkan': ['Attendance confirmed', '出席已确认'],
  // --- yuran ---
  'Invois, bayaran dan resit': ['Invoices, payments and receipts', '发票、付款与收据'], 'Belum dijelaskan': ['Outstanding', '未付款'], 'Sejarah': ['History', '历史记录'],
  'Semua yuran telah dijelaskan. Terima kasih! 🎉': ['All fees are paid. Thank you! 🎉', '所有学费已缴清，谢谢！🎉'],
  'Nota Kredit': ['Credit Notes', '贷记单'], 'Cetak': ['Print', '打印'], 'Invois': ['Invoice', '发票'], 'Resit': ['Receipt', '收据'], 'kredit': ['credit', '抵扣'],
  'Bayaran {a} menunggu pengesahan admin': ['Payment of {a} awaiting admin confirmation', '付款 {a} 等待管理员确认'],
  'Bayaran ditolak:': ['Payment rejected:', '付款被拒绝：'], 'sila semak bukti dan hantar semula': ['please check your proof and submit again', '请检查凭证后重新提交'],
  'Hantar Bukti Bayaran': ['Submit Proof of Payment', '提交付款凭证'], 'Atau pindahan bank:': ['Or bank transfer:', '或银行转账：'],
  'Sila masukkan <b>{no}</b> dalam rujukan bayaran.': ['Please include <b>{no}</b> in the payment reference.', '请在付款备注中注明 <b>{no}</b>。'],
  'Amaun dibayar (RM)': ['Amount paid (RM)', '付款金额 (RM)'], 'Kaedah': ['Method', '付款方式'], 'Pindahan Bank': ['Bank Transfer', '银行转账'],
  'Tarikh bayaran': ['Payment date', '付款日期'], 'No. rujukan (jika ada)': ['Reference no. (if any)', '参考号码（如有）'],
  'Bukti bayaran (tangkapan skrin / PDF)': ['Proof of payment (screenshot / PDF)', '付款凭证（截图 / PDF）'],
  'Admin akan menyemak bukti anda. Resit tersedia di sini selepas bayaran disahkan.': ['The admin will review your proof. Your receipt will be available here once payment is confirmed.', '管理员将审核您的凭证。付款确认后，可在此查看收据。'],
  'Amaun mesti antara RM0.01 dan {max}.': ['Amount must be between RM0.01 and {max}.', '金额须介于 RM0.01 与 {max} 之间。'], 'Fail terlalu besar (maksimum 5MB).': ['File is too large (maximum 5MB).', '文件过大（最大 5MB）。'],
  'Bukti dihantar. Admin akan mengesahkan tidak lama lagi.': ['Proof submitted. The admin will confirm it shortly.', '凭证已提交，管理员将尽快确认。'],
  // --- progres ---
  'Penilaian daripada jurulatih (skala 1–5)': ['Assessments from the coach (scale 1–5)', '教练评估（1–5 分）'], 'Belum ada penilaian untuk {name}.': ['No assessments yet for {name}.', '{name} 暂无评估。'],
  'Gerak kaki': ['Footwork', '步法'], 'Pukulan': ['Strokes', '击球'], 'Taktikal': ['Tactics', '战术'], 'Fizikal': ['Fitness', '体能'], 'Sikap': ['Attitude', '态度'],
  // --- akaun ---
  'Tukar kata laluan': ['Change password', '更改密码'], 'Tukar Kata Laluan': ['Change Password', '更改密码'], 'Anak anda': ['Your children', '您的孩子'],
  'Untuk menukar maklumat anak atau nombor telefon, hubungi admin akademi.': ["To change your child's details or your phone number, please contact the academy admin.", '如需更改孩子资料或电话号码，请联系学院管理员。'],
  'Maklumat cukai & e-invois': ['Tax & e-invoice details', '税务与电子发票资料'], 'Maklumat Cukai & E-Invois': ['Tax & E-Invoice Details', '税务与电子发票资料'],
  'Untuk invois atas nama anda dan tuntutan pelepasan cukai sukan (LHDN).': ['For invoices in your name and the sports tax relief claim (LHDN).', '用于以您名义开具发票及申报运动税务减免（LHDN）。'],
  'Edit': ['Edit', '编辑'], 'Isi': ['Fill in', '填写'],
  'Belum diisi. Anda boleh isi sekarang supaya invois terus memaparkan maklumat anda.': ['Not filled in yet. Fill it in now so your invoices show your details.', '尚未填写。现在填写后，发票将显示您的资料。'],
  'No. Kad Pengenalan (NRIC)': ['NRIC no.', '身份证号码 (NRIC)'], 'No. Pasport': ['Passport no.', '护照号码'], 'No. Tentera/Polis': ['Army/Police ID no.', '军警证号码'], 'No. Pendaftaran Syarikat': ['Business registration no.', '公司注册号码'],
  'Nama penuh (seperti dalam kad pengenalan)': ['Full name (as in your identity card)', '全名（与身份证一致）'], 'Jenis ID': ['ID type', '证件类型'], 'No. ID': ['ID no.', '证件号码'],
  'No. TIN LHDN (jika ada)': ['LHDN TIN (if any)', 'LHDN 税务编号 TIN（如有）'], 'Alamat': ['Address', '地址'], 'Telefon': ['Phone', '电话'],
  'Maklumat ini hanya boleh dilihat oleh anda dan admin akademi, dan digunakan pada invois serta e-invois.': ['Only you and the academy admin can see this information. It is used on invoices and e-invoices.', '此资料仅您和学院管理员可见，并用于发票及电子发票。'],
  'Nama dan No. ID diperlukan.': ['Name and ID no. are required.', '姓名和证件号码为必填。'], 'Maklumat cukai disimpan': ['Tax details saved', '税务资料已保存'],
  'Kata laluan baharu (min. 8 aksara)': ['New password (min. 8 characters)', '新密码（至少 8 个字符）'], 'Mod demo: tiada perubahan.': ['Demo mode: nothing was changed.', '演示模式：未作更改。'], 'Kata laluan dikemas kini': ['Password updated', '密码已更新'],
  // --- resit ---
  'RESIT': ['RECEIPT', '收据'], 'Diterima daripada': ['Received from', '付款人'], '<b>{g}</b> — penjaga kepada <b>{s}</b>': ['<b>{g}</b> — guardian of <b>{s}</b>', '<b>{g}</b> — <b>{s}</b> 的监护人'],
  '{n} sesi · sah {d} hari': ['{n} sessions · valid {d} days', '{n} 节课 · 有效期 {d} 天'], 'Rujukan': ['Reference', '参考号码'], 'Jumlah dibayar': ['Amount paid', '已付金额'], 'Baki invois': ['Invoice balance', '发票余额'], 'DIBAYAR': ['PAID', '已付款'],
  'Ini ialah resit yang dijana komputer dan tidak memerlukan tandatangan. Terima kasih kerana bersama {name}.': ['This is a computer-generated receipt and does not require a signature. Thank you for being with {name}.', '此为电脑生成的收据，无需签名。感谢您选择 {name}。'],
  // --- borang pendaftaran online ---
  'Pelajar': ['Student', '学员'], 'Buang': ['Remove', '删除'], 'Nama penuh pelajar': ["Student's full name", '学员全名'], 'Tarikh lahir': ['Date of birth', '出生日期'], 'Jantina': ['Gender', '性别'], 'Lelaki': ['Male', '男'], 'Perempuan': ['Female', '女'],
  'Lokasi latihan pilihan': ['Preferred training location', '首选训练地点'], '— Belum pasti —': ['— Not sure yet —', '— 尚未确定 —'], 'Program yang diminati': ['Programme of interest', '感兴趣的课程'],
  'Pengalaman / catatan (pilihan)': ['Experience / notes (optional)', '经验 / 备注（可选）'], 'cth. pernah main 1 tahun, ada kejohanan sekolah': ['e.g. played for 1 year, school tournaments', '例如：打过 1 年，参加过学校比赛'],
  'Borang Pendaftaran': ['Registration Form', '报名表'], 'Isi maklumat di bawah. Admin akan menghubungi anda melalui WhatsApp untuk mengesahkan kelas dan yuran.': ['Fill in the details below. Our admin will contact you on WhatsApp to confirm the class and fees.', '请填写以下资料。管理员将通过 WhatsApp 与您确认班级和学费。'],
  'Mod demo: borang tidak dihantar ke sistem.': ['Demo mode: the form is not sent to the system.', '演示模式：表格不会提交到系统。'], 'Maklumat pelajar': ['Student details', '学员资料'], 'Tambah adik-beradik': ['Add sibling', '添加兄弟姐妹'],
  'Ibu bapa / penjaga': ['Parent / guardian', '家长 / 监护人'], 'Saya mendaftar untuk diri sendiri': ['I am registering myself', '我为自己报名'], 'Untuk pelajar dewasa (18 tahun ke atas). Bahagian ibu bapa tidak perlu diisi.': ['For adult students (18 and above). The parent section is not needed.', '适用于成人学员（18 岁及以上），无需填写家长资料。'],
  'Hubungan': ['Relationship', '关系'], 'Ibu': ['Mother', '母亲'], 'Bapa': ['Father', '父亲'], 'Penjaga': ['Guardian', '监护人'], 'Nama penuh ibu bapa / penjaga': ['Parent / guardian full name', '家长 / 监护人全名'],
  'No. WhatsApp anda': ['Your WhatsApp number', '您的 WhatsApp 号码'], 'No. WhatsApp ibu bapa / penjaga': ['Parent / guardian WhatsApp number', '家长 / 监护人 WhatsApp 号码'], 'untuk akaun portal ibu bapa': ['for the parent portal account', '用于家长平台账户'],
  'Alamat (pilihan)': ['Address (optional)', '地址（可选）'], 'Soalan atau catatan lain (pilihan)': ['Other questions or notes (optional)', '其他问题或备注（可选）'],
  'Saya bersetuju maklumat ini digunakan oleh akademi untuk urusan pendaftaran, jadual, yuran dan komunikasi, mengikut Akta Perlindungan Data Peribadi 2010.': ['I agree that the academy may use this information for registration, scheduling, fees and communication, in line with the Personal Data Protection Act 2010.', '我同意学院根据《2010 年个人资料保护法》使用这些资料处理报名、课程安排、学费及联络事宜。'],
  'Hantar Pendaftaran': ['Submit Registration', '提交报名'], 'Menghantar…': ['Sending…', '提交中…'], 'Maksimum 6 pelajar.': ['Maximum 6 students.', '最多 6 名学员。'],
  'Sila isi nama penuh setiap pelajar.': ["Please fill in each student's full name.", '请填写每位学员的全名。'], 'Sila isi nama ibu bapa / penjaga.': ["Please fill in the parent / guardian's name.", '请填写家长 / 监护人姓名。'],
  'No. WhatsApp tidak sah.': ['Invalid WhatsApp number.', 'WhatsApp 号码无效。'], 'Sila setuju dengan notis privasi.': ['Please agree to the privacy notice.', '请同意隐私声明。'],
  'Terlalu banyak pendaftaran daripada nombor ini. Sila hubungi akademi.': ['Too many registrations from this number. Please contact the academy.', '此号码的报名次数过多，请联系学院。'], 'Masukkan 1 hingga 6 pelajar.': ['Enter 1 to 6 students.', '请输入 1 至 6 名学员。'], 'Nama pelajar diperlukan.': ['Student name is required.', '需要填写学员姓名。'],
  'Terima kasih!': ['Thank you!', '谢谢！'], 'Pendaftaran {names} telah diterima. Admin akan menghubungi anda melalui WhatsApp dalam masa 1–2 hari bekerja.': ['Registration for {names} has been received. Our admin will contact you on WhatsApp within 1–2 working days.', '{names} 的报名已收到。管理员将在 1–2 个工作日内通过 WhatsApp 联系您。'],
  'Daftar pelajar lain': ['Register another student', '为其他学员报名'], 'Borang belum tersedia': ['The form is not available yet', '表格暂不可用'], 'Sila hubungi akademi melalui WhatsApp.': ['Please contact the academy on WhatsApp.', '请通过 WhatsApp 联系学院。'], 'Daftar': ['Register', '报名'],
};

/* t('teks BM', { n: 3 }) -> teks dalam bahasa semasa; force = paksa bahasa tertentu (untuk dokumen) */
export function t(k, vars, force) {
  const l = force || getLang();
  let s = l === 'ms' ? k : (D[k]?.[l === 'en' ? 0 : 1] ?? k);
  if (vars) for (const [a, b] of Object.entries(vars)) s = String(s).split('{' + a + '}').join(b);
  return s;
}
export const hasKey = k => k in D;

/* Butang pilihan bahasa (tindakan 'set-lang' didaftar di main.js) */
export const langSwitch = () => `<div class="langsw" role="group" aria-label="Language">${LANGS.map(([c, l]) => `<button type="button" class="${c === lang ? 'on' : ''}" data-action="set-lang" data-id="${c}">${l}</button>`).join('')}</div>`;

/* Kerangka dokumen cetak (invois / nota kredit / resit) dengan tiga bahasa; butang di atas menukar bahasa sebelum cetak */
export function docShell({ title, css, render, def, printLabel }) {
  return `<!doctype html><html lang="${def}"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
.lg{display:none}.lg.on{display:block}.btns{flex-wrap:wrap}.btns .lb{background:#fff;color:#333;border:1px solid #999;padding:10px 14px}.btns .lb.on{background:#333;color:#fff}</style></head><body>
<div class="btns">${LANGS.map(([c, l]) => `<button class="lb ${c === def ? 'on' : ''}" data-l="${c}">${l}</button>`).join('')}<button id="pb" onclick="window.print()">${printLabel[def]}</button></div>
${LANGS.map(([c]) => `<div class="lg ${c === def ? 'on' : ''}" data-l="${c}">${render(c)}</div>`).join('')}
<script>var P=${JSON.stringify(printLabel)};document.querySelectorAll('.lb').forEach(function(b){b.onclick=function(){var l=b.dataset.l;document.querySelectorAll('.lb,.lg').forEach(function(e){e.classList.toggle('on',e.dataset.l===l)});document.getElementById('pb').textContent=P[l];document.documentElement.lang=l}})<\/script></body></html>`;
}
