// Laman web akademi (home.html): maklumat ringkas untuk ibu bapa, jadual langsung dari sistem,
// borang trial / personal / kem / antarabangsa terus ke Leads admin (+ notifikasi), 3 bahasa (BM / EN / 中文).
import { CONFIG } from './config.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const demo = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const WA = '60124965324';
const IMG = n => `assets/site/${n}`, IMG2 = n => `https://maxxima-academy.doryn96.chatgpt.site/academy/${n}`;
const img = (n, alt, cls = '') => `<img src="${IMG(n)}" alt="${esc(alt)}" class="${cls}" loading="lazy" onerror="if(!this.dataset.r){this.dataset.r=1;this.src='${IMG2(n)}'}else{this.remove()}">`;
let client = null, TT = null, LANG = 'ms', VENUE = null, PROG = '', KIND = 'group_trial', SENT = null, BUSY = false;
const F = {};   // nilai borang (kekal semasa tukar bahasa)

/* ======================= TEKS (BM / EN / 中文) ======================= */
const T = {
  ms: {
    nav: ['Program', 'Jadual & lokasi', 'Coach', 'Soalan lazim'], login: 'Log masuk ibu bapa', trialBtn: 'Trial percuma',
    h1: 'Belajar badminton dengan betul, dari pukulan pertama.',
    sub: 'Kelas kumpulan dan personal untuk umur 5 tahun hingga dewasa, di 9 lokasi sekitar Klang, Setia Alam, Puchong, Cyberjaya, Selayang dan Batu Caves.',
    ctaTrial: 'Mohon trial percuma 2 jam', ctaWa: 'WhatsApp admin',
    facts: ['Diketuai bekas pemain kebangsaan', '9 lokasi di Selangor', 'Umur 5 hingga dewasa', 'BM · English · 中文'],
    hcFree: 'RM0', hcTitle: 'Trial kumpulan 2 jam', hcList: ['Untuk pelajar baharu, semua tahap', 'Coach letakkan anak dalam kumpulan yang sesuai', 'Tiada bayaran, tiada komitmen', 'Admin sahkan tarikh melalui WhatsApp'], hcBtn: 'Isi borang (1 minit)',
    findT: 'Cari kelas berdekatan', findL: 'Pilih lokasi untuk lihat hari dan masa kelas. Tekan mana-mana slot untuk terus mohon trial.',
    all: 'Semua', sessions: n => `${n} kelas seminggu`, open: 'Ada tempat', few: 'Hampir penuh', full: 'Penuh (senarai menunggu)',
    noClass: 'Jadual lokasi ini sedang dikemas kini. Isi borang dan admin akan cadangkan slot terbaik.',
    days: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],
    pathT: 'Satu laluan yang jelas', pathL: 'Setiap pelajar bermula di tahap yang sesuai dan naik bila bersedia. Coach menilai setiap bulan dan ibu bapa nampak progres dalam app.',
    stages: [['Foundation', 'Pemula, umur 5 ke atas', ['Cara pegang raket & pukulan asas', 'Footwork dan koordinasi', 'Yakin bermain dalam kumpulan']],
             ['Performance', 'Sudah boleh rally', ['Pukulan lebih konsisten', 'Pergerakan & taktik', 'Latihan perlawanan berpandu']],
             ['Elite', 'Pemain kejohanan', ['Latihan intensiti tinggi', 'Persediaan pertandingan', 'Teknikal & taktikal mendalam']]],
    extras: [['Personal coaching', '1-ke-1, 2-ke-1 atau 3-ke-1. Pilih coach, lokasi dan masa. Sesi penilaian 60 minit untuk bermula.', 'Minta sesi personal', 'personal'],
             ['Kelas dewasa', 'Untuk pemula dan pemain rekreasi yang mahu teknik betul dan stamina lebih baik.', 'Daftar minat', 'adult'],
             ['Kem cuti sekolah', 'Program intensif semasa cuti: teknik, fizikal dan perlawanan setiap hari.', 'Dapatkan jadual kem', 'holiday']],
    coachT: 'Barisan coach', coachL: 'Pengalaman bermain di peringkat kebangsaan dan antarabangsa, mengajar dalam BM, English dan Bahasa Indonesia.',
    coaches: [['Muhaimin', 'Ketua Jurulatih', 'Bekas pemain perseorangan kebangsaan. Mengetuai hala tuju teknikal akademi.'], ['Alvi', 'Coach', 'Pemain dan coach dari Indonesia.'],
              ['Fiqri', 'Coach', 'Pengalaman melatih di Indonesia dan China.'], ['Zamry', 'Coach', 'Bekas wakil Kuala Lumpur.'], ['Doryn', 'Pengurus Akademi', 'Urus operasi dan komunikasi dengan ibu bapa.']],
    winT: 'Kemenangan pelajar kami', winL: 'Hasil latihan yang konsisten — daripada kejohanan sekolah hingga pertandingan terbuka.',
    wins: [['2026', 'Teo Ming Xuan, 12', 'Juara Perseorangan Lelaki B12, MSSD Gombak'], ['2025', 'Gan Giap Han, 13', 'Juara Perseorangan & Beregu Lelaki, MSSD Kuala Langat'],
           ['2026', 'Dashayni, 13', 'Juara Perseorangan Perempuan B13, Four Seasons (Pusingan 6 & 7); gangsa & naib juara Allianz Junior'], ['2026', 'Aydan Naufal, 6', 'Juara B7 Allstarz; Juara Perseorangan Lelaki B6, Kumpoo K1 Cup Malaysia–China']],
    appT: 'Ibu bapa sentiasa tahu', appL: 'Setiap pelajar mendapat akaun portal ibu bapa. Tiada lagi bertanya di WhatsApp untuk perkara asas.',
    feats: [['🔔', 'Peringatan sebelum sesi', '50 jam sebelum (sempat tukar atau cuti) dan 2 jam sebelum latihan.'], ['📈', 'Progres & laporan bulanan', 'Nota coach, gambar & video latihan, sijil kejohanan.'],
            ['📅', 'Tempah, tukar sesi & cuti sendiri', 'Ikut peraturan notis 48 jam, terus dari telefon.'], ['💳', 'Invois & bayaran', 'Bayar dengan QR atau FPX, resit tersedia serta-merta.'], ['⭐', 'Maklum balas setiap sesi', 'Penilaian anda dibaca oleh coach dan pengurusan.']],
    ntf: [['📅 Sesi Aiman — Ahd 3:00 PTG', 'Tidak dapat hadir? Tukar sebelum Jum 1:00 PTG.'], ['🏸 Latihan jam 3:00 PTG', 'Bawa raket, kasut, air & tuala.'], ['✅ Aiman hadir hari ini', 'Nota coach: footwork semakin baik!'], ['⭐ Bagaimana sesi hari ini?', 'Beri penilaian 1–5 bintang.']],
    stepsT: 'Cara bermula', steps: [['Isi borang trial', 'Pilih lokasi dan masa yang sesuai. Tiada bayaran.'], ['Admin hubungi anda', 'Melalui WhatsApp untuk sahkan tarikh, masa dan kumpulan.'], ['Datang trial 2 jam', 'Coach nilai tahap anak dan cadangkan program.'], ['Pilih pakej & mula', 'Invois dalam app. Slot disahkan selepas bayaran.']],
    intlT: 'Berlatih di Malaysia', intlL: 'Untuk pemain dari luar negara: kem intensif jangka pendek dan program bulanan bersama coach berpengalaman antarabangsa.',
    intlList: ['Kem 1–4 minggu: 2 sesi sehari, fizikal & perlawanan', 'Arahan dalam English, BM, 中文 dan Bahasa Indonesia', 'Bantuan penginapan berdekatan dan pengangkutan ke dewan', 'Laporan prestasi & video analisis di akhir program'],
    intlBox: 'Rancang program anda', intlBoxL: 'Beritahu kami tarikh, umur dan tahap pemain. Kami balas dengan cadangan jadual dan anggaran kos dalam 2 hari bekerja.', intlBtn: 'Hantar pertanyaan',
    faqT: 'Soalan lazim',
    faq: [['Siapa layak untuk trial percuma?', 'Pelajar baharu yang belum pernah berlatih dengan Maxxima. Satu trial kumpulan 2 jam bagi setiap pelajar. Personal coaching tidak termasuk.'],
          ['Anak saya tidak pernah main. Boleh sertai?', 'Boleh. Kelas Foundation dibina untuk pemula. Coach akan letakkan anak dalam kumpulan ikut tahap dan umur.'],
          ['Berapa yuran bulanan?', 'Yuran bergantung pada lokasi, program dan bilangan hari seminggu. Admin akan kongsi pakej yang tepat selepas trial.'],
          ['Apa perlu dibawa?', 'Raket (jika ada), kasut sukan tapak tidak berbekas, air, tuala dan baju tambahan. Sila tiba 10–15 minit awal.'],
          ['Bagaimana jika tidak dapat hadir?', 'Mohon cuti atau tukar sesi dalam app sekurang-kurangnya 48 jam sebelum. Pembatalan lewat biasanya dikira sebagai sesi digunakan.'],
          ['Dewasa boleh sertai?', 'Boleh. Kami ada kelas dewasa dan personal coaching. Pilih "Kelas dewasa" dalam borang.'],
          ['Boleh daftar adik-beradik sekali?', 'Boleh. Tulis nama adik-beradik dalam ruang catatan atau hantar borang berasingan.']],
    formT: 'Mohon trial atau maklumat', formL: 'Isi borang ini. Permintaan anda terus masuk ke sistem admin dan kami akan WhatsApp anda — biasanya pada hari yang sama.',
    sidePts: ['Tiada bayaran untuk trial kumpulan', 'Admin sahkan slot melalui WhatsApp', 'Maklumat anda hanya digunakan untuk urusan akademi'],
    kinds: [['group_trial', 'Trial kumpulan percuma'], ['personal', 'Personal coaching'], ['adult', 'Kelas dewasa'], ['holiday', 'Kem cuti'], ['intl', 'Antarabangsa']],
    fl: { child: 'Nama pelajar', age: 'Umur', gender: 'Jantina', g: ['', 'Lelaki', 'Perempuan'], guardian: 'Nama ibu / bapa / penjaga', guardianAdult: 'Nama anda (jika pelajar sendiri, ulang nama)', phone: 'No. WhatsApp', email: 'E-mel', emailOpt: 'E-mel (pilihan)', venue: 'Lokasi pilihan', venueAny: 'Belum pasti — cadangkan', level: 'Tahap sekarang',
      levels: [['new', 'Baru belajar / tidak pernah main'], ['rally', 'Boleh rally, mahu lebih konsisten'], ['match', 'Sudah main pertandingan'], ['unsure', 'Tidak pasti — minta coach nilai']],
      times: 'Hari & masa sesuai', timesPh: 'cth. Sabtu pagi, atau hari biasa selepas 5 petang', country: 'Negara', dates: 'Tarikh dirancang', datesPh: 'cth. 1–21 Disember 2026', notes: 'Catatan / keadaan kesihatan', notesPh: 'cth. adik-beradik, asma, kecederaan lutut',
      consent: 'Saya setuju maklumat ini digunakan oleh Maxxima Badminton Academy untuk menghubungi saya tentang latihan.', submit: 'Hantar permintaan', sending: 'Menghantar…' },
    errs: { child: 'Isi nama pelajar.', phone: 'Isi no. WhatsApp yang betul (cth. 012-345 6789).', consent: 'Tandakan persetujuan di bawah.', email: 'Isi e-mel untuk pertanyaan antarabangsa.', net: 'Tidak dapat menghantar. Semak internet atau WhatsApp admin.' },
    doneT: 'Permintaan diterima', doneL: 'Admin akan WhatsApp anda untuk sahkan tarikh dan masa. Simpan nombor rujukan ini.', doneWa: 'Hantar juga di WhatsApp', doneNew: 'Hantar borang lain',
    waMsg: (r, f) => `Salam admin Maxxima, saya baru hantar borang (Ruj ${r}). Pelajar: ${f.child_name}${f.child_age ? ', ' + f.child_age + ' thn' : ''}. Lokasi: ${f.venue || '-'}.`,
    footTag: 'Asas yang kukuh. Laluan yang jelas.', footLinks: 'Pautan', footContact: 'Hubungi', portal: 'Portal ibu bapa & coach', tn: 'Kejohanan', terms: 'Terma & syarat',
    slotPick: (d, t, v) => `Slot dipilih: ${d} ${t}, ${v}`,
  },
  en: {
    nav: ['Programmes', 'Timetable & locations', 'Coaches', 'FAQ'], login: 'Parent login', trialBtn: 'Free trial',
    h1: 'Learn badminton the right way, from the first stroke.',
    sub: 'Group and personal training for ages 5 to adults, at 9 venues around Klang, Setia Alam, Puchong, Cyberjaya, Selayang and Batu Caves.',
    ctaTrial: 'Request a free 2-hour trial', ctaWa: 'WhatsApp us',
    facts: ['Led by a former national player', '9 venues in Selangor', 'Ages 5 to adult', 'BM · English · 中文'],
    hcFree: 'RM0', hcTitle: '2-hour group trial', hcList: ['For new students of every level', 'Coaches place your child in the right group', 'No payment, no commitment', 'Admin confirms the date on WhatsApp'], hcBtn: 'Fill in the form (1 min)',
    findT: 'Find a class near you', findL: 'Choose a venue to see class days and times. Tap any slot to request a trial for it.',
    all: 'All', sessions: n => `${n} classes a week`, open: 'Places available', few: 'Almost full', full: 'Full (waitlist)',
    noClass: 'This venue’s timetable is being updated. Send the form and admin will suggest the best slot.',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    pathT: 'One clear pathway', pathL: 'Every student starts at the right level and moves up when ready. Coaches assess monthly and parents see progress in the app.',
    stages: [['Foundation', 'Beginners, age 5+', ['Grip and basic strokes', 'Footwork and coordination', 'Confidence in a group']],
             ['Performance', 'Can already rally', ['More consistent strokes', 'Movement and tactics', 'Guided match practice']],
             ['Elite', 'Tournament players', ['High-intensity training', 'Competition preparation', 'Advanced technique and tactics']]],
    extras: [['Personal coaching', '1-to-1, 2-to-1 or 3-to-1. Choose the coach, venue and time. Start with a 60-minute assessment.', 'Ask for personal coaching', 'personal'],
             ['Adult classes', 'For beginners and social players who want proper technique and better fitness.', 'Register interest', 'adult'],
             ['School holiday camps', 'Intensive holiday programme: technique, fitness and matches every day.', 'Get the camp schedule', 'holiday']],
    coachT: 'Our coaches', coachL: 'National and international playing experience, coaching in English, Malay and Indonesian.',
    coaches: [['Muhaimin', 'Head Coach', 'Former national singles player. Leads the academy’s technical direction.'], ['Alvi', 'Coach', 'Player and coach from Indonesia.'],
              ['Fiqri', 'Coach', 'Coaching experience in Indonesia and China.'], ['Zamry', 'Coach', 'Former Kuala Lumpur state player.'], ['Doryn', 'Academy Manager', 'Runs operations and parent communication.']],
    winT: 'Our students’ wins', winL: 'The result of consistent training, from school championships to open tournaments.',
    wins: [['2026', 'Teo Ming Xuan, 12', 'Boys’ Singles U12 Champion, MSSD Gombak'], ['2025', 'Gan Giap Han, 13', 'Boys’ Singles & Doubles Champion, MSSD Kuala Langat'],
           ['2026', 'Dashayni, 13', 'Girls’ Singles U13 Champion, Four Seasons (Rounds 6 & 7); bronze and runner-up, Allianz Junior'], ['2026', 'Aydan Naufal, 6', 'U7 Champion, Allstarz; Boys’ Singles U6 Champion, Kumpoo K1 Cup Malaysia–China']],
    appT: 'Parents always know', appL: 'Every student gets a parent portal account. No more chasing basic updates on WhatsApp.',
    feats: [['🔔', 'Reminders before each session', '50 hours before (time to reschedule or take leave) and 2 hours before training.'], ['📈', 'Progress & monthly reports', 'Coach notes, training photos & videos, tournament certificates.'],
            ['📅', 'Book, reschedule and request leave yourself', 'With a 48-hour notice rule, straight from your phone.'], ['💳', 'Invoices & payment', 'Pay by QR or FPX, with instant receipts.'], ['⭐', 'Feedback after every session', 'Your rating is read by coaches and management.']],
    ntf: [['📅 Aiman’s session — Sun 3:00 PM', 'Can’t make it? Reschedule before Fri 1:00 PM.'], ['🏸 Training at 3:00 PM', 'Bring racket, shoes, water & towel.'], ['✅ Aiman attended today', 'Coach note: footwork is improving!'], ['⭐ How was today’s session?', 'Rate it 1–5 stars.']],
    stepsT: 'How to start', steps: [['Send the trial form', 'Choose a venue and time. No payment.'], ['Admin contacts you', 'On WhatsApp to confirm the date, time and group.'], ['Come for a 2-hour trial', 'The coach assesses the level and recommends a programme.'], ['Choose a package & start', 'Invoice in the app. Your slot is confirmed after payment.']],
    intlT: 'Train in Malaysia', intlL: 'For overseas players: short intensive camps and monthly programmes with internationally experienced coaches.',
    intlList: ['1–4 week camps: 2 sessions a day, fitness & match play', 'Instruction in English, Malay, Chinese and Indonesian', 'Help with nearby accommodation and transport to the hall', 'Performance report & video analysis at the end'],
    intlBox: 'Plan your programme', intlBoxL: 'Tell us the dates, age and level. We’ll reply with a suggested schedule and cost estimate within 2 working days.', intlBtn: 'Send an enquiry',
    faqT: 'Frequently asked questions',
    faq: [['Who can take the free trial?', 'New students who haven’t trained with Maxxima before. One 2-hour group trial per student. Personal coaching is not included.'],
          ['My child has never played. Can they join?', 'Yes. Foundation classes are built for beginners. Coaches group children by level and age.'],
          ['How much are the monthly fees?', 'Fees depend on the venue, programme and days per week. Admin will share the exact packages after the trial.'],
          ['What should we bring?', 'A racket (if you have one), non-marking sports shoes, water, a towel and a spare shirt. Please arrive 10–15 minutes early.'],
          ['What if we can’t attend?', 'Request leave or reschedule in the app at least 48 hours before. Late cancellations normally count as a used session.'],
          ['Can adults join?', 'Yes. We run adult classes and personal coaching. Choose “Adult classes” in the form.'],
          ['Can siblings register together?', 'Yes. Add the siblings’ names in the notes or send separate forms.']],
    formT: 'Request a trial or information', formL: 'Fill in this form. It goes straight into our admin system and we’ll WhatsApp you, usually the same day.',
    sidePts: ['No payment for the group trial', 'Admin confirms your slot on WhatsApp', 'Your details are only used for academy matters'],
    kinds: [['group_trial', 'Free group trial'], ['personal', 'Personal coaching'], ['adult', 'Adult classes'], ['holiday', 'Holiday camp'], ['intl', 'International']],
    fl: { child: 'Student name', age: 'Age', gender: 'Gender', g: ['', 'Male', 'Female'], guardian: 'Parent / guardian name', guardianAdult: 'Your name (repeat if you are the student)', phone: 'WhatsApp number', email: 'Email', emailOpt: 'Email (optional)', venue: 'Preferred venue', venueAny: 'Not sure — please suggest', level: 'Current level',
      levels: [['new', 'New / never played'], ['rally', 'Can rally, wants more consistency'], ['match', 'Already plays tournaments'], ['unsure', 'Not sure — ask a coach to assess']],
      times: 'Suitable days & times', timesPh: 'e.g. Saturday mornings, or weekdays after 5 pm', country: 'Country', dates: 'Planned dates', datesPh: 'e.g. 1–21 December 2026', notes: 'Notes / health conditions', notesPh: 'e.g. siblings, asthma, knee injury',
      consent: 'I agree that Maxxima Badminton Academy may use these details to contact me about training.', submit: 'Send request', sending: 'Sending…' },
    errs: { child: 'Enter the student’s name.', phone: 'Enter a valid WhatsApp number (e.g. +60 12-345 6789).', consent: 'Tick the consent box below.', email: 'Enter an email for international enquiries.', net: 'Could not send. Check your connection or WhatsApp us.' },
    doneT: 'Request received', doneL: 'Admin will WhatsApp you to confirm the date and time. Keep this reference number.', doneWa: 'Also send on WhatsApp', doneNew: 'Send another form',
    waMsg: (r, f) => `Hi Maxxima admin, I just sent the form (Ref ${r}). Student: ${f.child_name}${f.child_age ? ', ' + f.child_age + ' yrs' : ''}. Venue: ${f.venue || '-'}.`,
    footTag: 'Strong fundamentals. A clear path forward.', footLinks: 'Links', footContact: 'Contact', portal: 'Parent & coach portal', tn: 'Tournaments', terms: 'Terms & conditions',
    slotPick: (d, t, v) => `Chosen slot: ${d} ${t}, ${v}`,
  },
  zh: {
    nav: ['课程', '时间表与地点', '教练', '常见问题'], login: '家长登录', trialBtn: '免费试课',
    h1: '从第一拍开始，学对的羽球。',
    sub: '为5岁至成人提供小组及私人训练，9个场地遍布巴生、Setia Alam、蒲种、赛城、士拉央及黑风洞。',
    ctaTrial: '申请2小时免费试课', ctaWa: 'WhatsApp 联系我们',
    facts: ['前国家队球员领军', '雪兰莪9个场地', '5岁至成人', 'BM · English · 中文'],
    hcFree: 'RM0', hcTitle: '2小时小组试课', hcList: ['适合所有程度的新学员', '教练按程度安排合适小组', '无需付费，无需承诺', '管理员通过 WhatsApp 确认日期'], hcBtn: '填写表格（1分钟）',
    findT: '寻找附近的课程', findL: '选择场地查看上课日期与时间。点击任何时段即可申请试课。',
    all: '全部', sessions: n => `每周 ${n} 堂`, open: '有名额', few: '名额不多', full: '已满（候补）',
    noClass: '此场地时间表正在更新。请填写表格，管理员会推荐最合适的时段。',
    days: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    pathT: '清晰的进阶路线', pathL: '每位学员从合适的程度开始，准备好就晋级。教练每月评估，家长可在应用中查看进度。',
    stages: [['Foundation 基础班', '初学者，5岁以上', ['握拍与基本击球', '步法与协调', '在小组中建立信心']],
             ['Performance 提升班', '已能对打', ['击球更稳定', '移动与战术', '有指导的比赛练习']],
             ['Elite 精英班', '比赛选手', ['高强度训练', '比赛准备', '深入技术与战术']]],
    extras: [['私人教练', '1对1、2对1或3对1。自选教练、场地和时间。从60分钟评估课开始。', '申请私人课', 'personal'],
             ['成人班', '适合初学者与休闲球友，学习正确技术、提升体能。', '登记兴趣', 'adult'],
             ['学校假期营', '假期密集训练：每天技术、体能与比赛。', '索取训练营时间表', 'holiday']],
    coachT: '教练团队', coachL: '具国家级及国际比赛经验，可用英语、马来语和印尼语授课。',
    coaches: [['Muhaimin', '总教练', '前国家队单打球员，负责学院技术方向。'], ['Alvi', '教练', '来自印尼的球员与教练。'],
              ['Fiqri', '教练', '曾在印尼和中国执教。'], ['Zamry', '教练', '前吉隆坡州代表。'], ['Doryn', '学院经理', '负责运营与家长沟通。']],
    winT: '学员佳绩', winL: '持续训练的成果——从学校比赛到公开赛。',
    wins: [['2026', 'Teo Ming Xuan，12岁', 'MSSD 鹅唛 男单U12 冠军'], ['2025', 'Gan Giap Han，13岁', 'MSSD 瓜拉冷岳 男单及男双冠军'],
           ['2026', 'Dashayni，13岁', 'Four Seasons 女单U13 冠军（第6、7站）；Allianz 青少年赛 铜牌及亚军'], ['2026', 'Aydan Naufal，6岁', 'Allstarz U7 冠军；Kumpoo K1 杯 马中资格赛 男单U6 冠军']],
    appT: '家长随时掌握', appL: '每位学员都有家长门户账户，基本事项无需再在 WhatsApp 追问。',
    feats: [['🔔', '课前提醒', '课前50小时（可换课或请假）及2小时提醒。'], ['📈', '进度与月度报告', '教练笔记、训练照片与视频、比赛证书。'],
            ['📅', '自行预约、换课与请假', '遵守48小时通知规则，手机直接操作。'], ['💳', '发票与付款', '二维码或 FPX 付款，即时收据。'], ['⭐', '每堂课的反馈', '您的评分由教练与管理层阅读。']],
    ntf: [['📅 Aiman 的课程 — 周日 3:00 PM', '无法出席？请在周五 1:00 PM 前换课。'], ['🏸 3:00 PM 训练', '请带球拍、球鞋、水和毛巾。'], ['✅ Aiman 今天已出席', '教练笔记：步法进步了！'], ['⭐ 今天的课怎么样？', '请给1–5星评分。']],
    stepsT: '如何开始', steps: [['填写试课表格', '选择场地和时间，无需付费。'], ['管理员联系您', '通过 WhatsApp 确认日期、时间和小组。'], ['参加2小时试课', '教练评估程度并推荐课程。'], ['选择配套开始训练', '应用内发票，付款后确认名额。']],
    intlT: '来马来西亚训练', intlL: '为海外球员提供短期密集训练营及月度课程，由具国际经验的教练指导。',
    intlList: ['1–4周训练营：每天2堂，体能与比赛', '英语、马来语、中文及印尼语授课', '协助安排附近住宿及往返球场交通', '课程结束提供表现报告与视频分析'],
    intlBox: '规划您的课程', intlBoxL: '告诉我们日期、年龄和程度。我们会在2个工作日内回复建议时间表与费用预估。', intlBtn: '发送询问',
    faqT: '常见问题',
    faq: [['谁可以免费试课？', '从未在 Maxxima 训练过的新学员，每人一次2小时小组试课。私人课不包括在内。'],
          ['孩子从未打过球，可以参加吗？', '可以。基础班专为初学者设计，教练会按程度和年龄分组。'],
          ['每月学费多少？', '学费视场地、课程和每周次数而定。试课后管理员会提供准确配套。'],
          ['需要带什么？', '球拍（如有）、不留痕运动鞋、水、毛巾和备用衣服。请提早10–15分钟到达。'],
          ['无法出席怎么办？', '请至少提前48小时在应用中请假或换课。迟取消通常算作已使用一堂课。'],
          ['成人可以参加吗？', '可以。我们有成人班和私人教练。请在表格中选择“成人班”。'],
          ['兄弟姐妹可以一起报名吗？', '可以。请在备注写上兄弟姐妹姓名，或分别填写表格。']],
    formT: '申请试课或咨询', formL: '填写此表格，资料会直接进入管理系统，我们通常当天通过 WhatsApp 联系您。',
    sidePts: ['小组试课免费', '管理员通过 WhatsApp 确认时段', '您的资料仅用于学院事务'],
    kinds: [['group_trial', '免费小组试课'], ['personal', '私人教练'], ['adult', '成人班'], ['holiday', '假期营'], ['intl', '海外学员']],
    fl: { child: '学员姓名', age: '年龄', gender: '性别', g: ['', '男', '女'], guardian: '家长/监护人姓名', guardianAdult: '您的姓名（如本人报名请重复填写）', phone: 'WhatsApp 号码', email: '电邮', emailOpt: '电邮（可选）', venue: '首选场地', venueAny: '不确定——请推荐', level: '目前程度',
      levels: [['new', '新手/从未打过'], ['rally', '能对打，想更稳定'], ['match', '已参加比赛'], ['unsure', '不确定——请教练评估']],
      times: '合适的日期与时间', timesPh: '例如：周六上午，或平日下午5点后', country: '国家', dates: '计划日期', datesPh: '例如：2026年12月1–21日', notes: '备注/健康状况', notesPh: '例如：兄弟姐妹、哮喘、膝伤',
      consent: '我同意 Maxxima Badminton Academy 使用这些资料就训练事宜联系我。', submit: '发送申请', sending: '发送中…' },
    errs: { child: '请填写学员姓名。', phone: '请填写正确的 WhatsApp 号码。', consent: '请勾选下方同意框。', email: '海外咨询请填写电邮。', net: '无法发送，请检查网络或 WhatsApp 联系我们。' },
    doneT: '申请已收到', doneL: '管理员会通过 WhatsApp 联系您确认日期和时间。请保存此参考号码。', doneWa: '同时通过 WhatsApp 发送', doneNew: '再填写一份',
    waMsg: (r, f) => `您好 Maxxima，我刚提交了表格（参考号 ${r}）。学员：${f.child_name}${f.child_age ? '，' + f.child_age + '岁' : ''}。场地：${f.venue || '-'}。`,
    footTag: '扎实基础，清晰路线。', footLinks: '链接', footContact: '联系', portal: '家长与教练门户', tn: '比赛', terms: '条款与条件',
    slotPick: (d, t, v) => `已选时段：${d} ${t}，${v}`,
  },
};
const L = () => T[LANG];

/* Lokasi sandaran jika jadual sistem belum diisi */
const FALLBACK_VENUES = [['GoTeam Sports Complex', 'Bukit Raja, Klang'], ['Forum SBA', 'Setia Alam'], ['SLK Sport Centre', 'Batu Caves'], ['Ultra Sport Centre', 'Selayang'], ['Abedeen Clubhouse', 'Cyberjaya'],
  ['Arena MXSPD', 'Telok Panglima Garang'], ['Armanee Condominium', 'Damansara Damai'], ['Puchong Sport Centre', 'Puchong'], ["Michael's BA", 'Puchong']].map(([name, area], i) => ({ id: 'fb' + i, name, area }));
const venues = () => (TT?.venues?.length ? TT.venues : FALLBACK_VENUES);
const classesAt = vid => (TT?.classes || []).filter(c => c.venue_id === vid);
const progName = id => (TT?.programmes || []).find(p => p.id === id)?.name || '';

/* ======================= PAPARAN ======================= */
const courtSvg = (fly = true) => `<div class="court" aria-hidden="true"><svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
  <g fill="none" stroke="rgba(255,255,255,.16)" stroke-width="3">
    <rect x="80" y="70" width="1040" height="560"/><line x1="80" y1="112" x2="1120" y2="112"/><line x1="80" y1="588" x2="1120" y2="588"/>
    <line x1="600" y1="40" x2="600" y2="660" stroke="rgba(255,255,255,.4)" stroke-width="5"/>
    <line x1="440" y1="70" x2="440" y2="630"/><line x1="760" y1="70" x2="760" y2="630"/><line x1="140" y1="70" x2="140" y2="630"/><line x1="1060" y1="70" x2="1060" y2="630"/>
    <line x1="80" y1="350" x2="440" y2="350"/><line x1="760" y1="350" x2="1120" y2="350"/></g>
  ${fly ? `<path class="shuttle-path" d="M260 520 Q 600 -40 980 250" fill="none" stroke="rgba(255,207,51,.75)" stroke-width="3" stroke-linecap="round"/>
  <g class="shuttle-ico" transform="translate(980 250) rotate(35)"><path d="M0 0 L-16 -40 L16 -40 Z" fill="#fff" opacity=".95"/><circle cx="0" cy="2" r="9" fill="#FFCF33"/></g>` : ''}</svg></div>`;

function page() {
  const l = L();
  return `
<header class="top"><div class="wrap">
  <a class="brand" href="#"><img src="assets/logo.png" alt=""><span>MAXXIMA</span></a>
  <nav class="nav" aria-label="Utama">${[['program', 0], ['jadual', 1], ['coach', 2], ['soalan', 3]].map(([h, i]) => `<a href="#${h}">${l.nav[i]}</a>`).join('')}</nav>
  <div class="lang" role="group" aria-label="Bahasa">${[['ms', 'BM'], ['en', 'EN'], ['zh', '中文']].map(([k, n]) => `<button data-lang="${k}" aria-pressed="${LANG === k}">${n}</button>`).join('')}</div>
  <a class="login" href="index.html">${l.login}</a>
  <a class="btn btn-n btn-sm" href="#borang" data-track="cta_trial">${l.trialBtn}</a>
</div></header>

<section class="hero">${courtSvg()}<div class="wrap">
  <div><h1>${l.h1}</h1><p class="sub">${l.sub}</p>
    <div class="ctas"><a class="btn btn-y" href="#borang" data-track="cta_trial">${l.ctaTrial}</a><a class="btn btn-o" href="https://wa.me/${WA}" target="_blank" rel="noopener" data-track="cta_wa">${l.ctaWa}</a></div>
    <ul class="facts">${l.facts.map(f => `<li>${f}</li>`).join('')}</ul></div>
  <div class="hero-card"><span class="free">${l.hcFree}</span><h2>${l.hcTitle}</h2><ul>${l.hcList.map(x => `<li>${x}</li>`).join('')}</ul>
    <a class="btn btn-n" style="width:100%" href="#borang" data-track="cta_trial">${l.hcBtn}</a></div>
</div></section>

<section class="sec" id="jadual"><div class="wrap">
  <div class="sec-head"><div><h2>${l.findT}</h2><p class="lead">${l.findL}</p></div></div>
  <div class="finder"><div class="venues" role="group" aria-label="${l.nav[1]}">${venues().map(v => { const n = classesAt(v.id).length;
    return `<button class="venue" data-venue="${v.id}" aria-pressed="${VENUE === v.id}"><span><b>${esc(v.name)}</b><small>${esc(v.area || '')}</small></span>${n ? `<span class="n">${n}</span>` : ''}</button>`; }).join('')}</div>
  <div class="week" id="week">${weekHtml()}</div></div>
</div></section>

<section class="sec alt" id="program"><div class="wrap">
  <div class="sec-head"><div><h2>${l.pathT}</h2><p class="lead">${l.pathL}</p></div></div>
  <div class="path">${l.stages.map(([n, who, pts], i) => `<div class="stage"><span class="no" aria-hidden="true">${i + 1}</span><h3>${n}</h3><div class="who">${who}</div><ul>${pts.map(p => `<li>${p}</li>`).join('')}</ul></div>`).join('')}</div>
  <div class="extra">${l.extras.map(([n, d, b, k], i) => `<div class="ex ${['', 'g', 'y'][i]}"><h3>${n}</h3><p>${d}</p><a class="btn ${i === 2 ? 'btn-n' : 'btn-w'} btn-sm" href="#borang" data-kind="${k}">${b}</a></div>`).join('')}</div>
</div></section>

<section class="sec" id="coach"><div class="wrap">
  <div class="sec-head"><div><h2>${l.coachT}</h2><p class="lead">${l.coachL}</p></div></div>
  <div class="coaches">${l.coaches.map(([n, r, d]) => `<article class="coach"><div class="ph">${n[0]}${img(`coach-${n.toLowerCase()}.webp`, n)}</div><div class="t"><b>${n}</b><small>${r}</small><p>${d}</p></div></article>`).join('')}</div>
</div></section>

<section class="sec alt"><div class="wrap">
  <div class="sec-head"><div><h2>${l.winT}</h2><p class="lead">${l.winL}</p></div></div>
  <div class="wins">${l.wins.map(([y, n, d]) => `<div class="win"><span class="yr">${y}</span><div><b>${n}</b><p>${d}</p></div></div>`).join('')}</div>
</div></section>

<section class="sec"><div class="wrap appsec">
  <div><h2>${l.appT}</h2><p class="lead" style="margin-top:10px">${l.appL}</p>
    <ul class="feats">${l.feats.map(([i, b, s]) => `<li><span class="ic" aria-hidden="true">${i}</span><div><b>${b}</b><span>${s}</span></div></li>`).join('')}</ul></div>
  <div class="phone" aria-hidden="true"><div class="screen"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><img src="assets/logo.png" style="width:28px" alt=""><b style="font-size:13px">Maxxima</b></div>
    ${l.ntf.map(([b, s]) => `<div class="ntf"><b>${b}</b><span>${s}</span></div>`).join('')}</div></div>
</div></section>

<section class="sec alt"><div class="wrap">
  <div class="sec-head"><div><h2>${l.stepsT}</h2></div></div>
  <ol class="steps">${l.steps.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('')}</ol>
</div></section>

<section class="sec" id="antarabangsa"><div class="wrap"><div class="intl">
  <div><h2>${l.intlT}</h2><p class="lead" style="margin-top:10px">${l.intlL}</p><ul>${l.intlList.map(x => `<li>${x}</li>`).join('')}</ul></div>
  <div class="box"><h3>${l.intlBox}</h3><p style="color:#c7d2ec;margin-bottom:16px">${l.intlBoxL}</p><a class="btn btn-y" href="#borang" data-kind="intl">${l.intlBtn}</a></div>
</div></div></section>

<section class="sec alt" id="soalan"><div class="wrap">
  <div class="sec-head"><div><h2>${l.faqT}</h2></div></div>
  <div class="faq">${l.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
</div></section>

<section class="sec formsec" id="borang">${courtSvg(false)}<div class="wrap formgrid">
  <div><h2>${l.formT}</h2><p class="lead" style="margin-top:10px">${l.formL}</p><ul class="side-points">${l.sidePts.map(x => `<li>${x}</li>`).join('')}</ul>
    <a class="btn btn-o" style="margin-top:26px" href="https://wa.me/${WA}" target="_blank" rel="noopener" data-track="cta_wa">${l.ctaWa}</a></div>
  <div class="form" id="form">${formHtml()}</div>
</div></section>

<footer><div class="wrap">
  <div><a class="brand" href="#" style="color:#fff"><img src="assets/logo.png" alt=""><span>MAXXIMA</span></a><p style="margin-top:10px">${l.footTag}</p></div>
  <div><b>${l.footLinks}</b><ul><li><a href="index.html">${l.portal}</a></li><li><a href="tournament.html">${l.tn}</a></li><li><a href="assets/terms/">${l.terms}</a></li></ul></div>
  <div><b>${l.footContact}</b><ul><li><a href="https://wa.me/${WA}" data-track="cta_wa">WhatsApp +60 12-496 5324</a></li><li><a href="mailto:maxxima.academy@gmail.com">maxxima.academy@gmail.com</a></li>
    <li><a href="https://instagram.com/maxximaba" target="_blank" rel="noopener">Instagram @maxximaba</a></li><li><a href="https://www.tiktok.com/@maxximaba" target="_blank" rel="noopener">TikTok @maxximaba</a></li></ul></div>
</div><div class="wrap" style="display:block;margin-top:26px;font-size:12.5px;opacity:.7">© ${new Date().getFullYear()} Maxxima Badminton Academy · Malaysia (GMT+8)</div></footer>
<div class="mbar"><a class="btn btn-n" href="#borang" data-track="cta_trial">${l.trialBtn}</a><a class="btn btn-y" href="https://wa.me/${WA}" target="_blank" rel="noopener" data-track="cta_wa">WhatsApp</a></div>`;
}

function weekHtml() {
  const l = L(), v = venues().find(x => x.id === VENUE) || venues()[0];
  if (!v) return `<div class="empty-week">${l.noClass}</div>`;
  const all = classesAt(v.id), progs = [...new Set(all.map(c => c.programme_id))];
  const list = all.filter(c => !PROG || c.programme_id === PROG);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return `<div class="week-head"><div><h3>${esc(v.name)}</h3><small style="color:var(--muted)">${esc(v.area || '')}${all.length ? ' · ' + l.sessions(all.length) : ''}</small></div>
    ${progs.length > 1 ? `<div class="progf">${[['', l.all], ...progs.map(p => [p, progName(p)])].map(([k, n]) => `<button data-prog="${k}" aria-pressed="${PROG === k}">${esc(n)}</button>`).join('')}</div>` : ''}</div>
  ${list.length ? `<div class="days">${order.map(d => { const cs = list.filter(c => c.weekday === d);
      return `<div class="day ${cs.length ? '' : 'none'}"><h4>${l.days[d]}</h4><div>${cs.map(c => `<button class="slot ${c.seats}" data-slot="${d}|${c.start}|${c.programme_id}"><b>${c.start}–${c.end}</b><span>${esc(progName(c.programme_id))}</span><i>${l[c.seats]}</i></button>`).join('')}</div></div>`; }).join('')}</div>
    <div class="legend"><span>${l.open}</span><span class="few">${l.few}</span><span class="full">${l.full}</span></div>`
    : `<div class="empty-week">${l.noClass}<div style="margin-top:14px"><a class="btn btn-n btn-sm" href="#borang" data-venue-pick="${v.id}">${l.ctaTrial}</a></div></div>`}`;
}

function formHtml() {
  const l = L(), fl = l.fl;
  if (SENT) return `<div class="done"><div style="font-size:44px">🏸</div><h3 style="font-size:32px">${l.doneT}</h3><div class="ref">${esc(SENT.ref)}</div><p style="color:var(--muted);max-width:42ch;margin:0 auto 18px">${l.doneL}</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-y" target="_blank" rel="noopener" href="https://wa.me/${WA}?text=${encodeURIComponent(l.waMsg(SENT.ref, SENT.f))}">${l.doneWa}</a><button class="btn btn-o" data-new>${l.doneNew}</button></div></div>`;
  const adult = KIND === 'adult', intl = KIND === 'intl', vs = venues();
  const v = n => esc(F[n] ?? '');
  return `<div class="kinds" role="group">${l.kinds.map(([k, n]) => `<button type="button" data-k="${k}" aria-pressed="${KIND === k}">${n}</button>`).join('')}</div>
  ${F.slot ? `<p style="font-size:13.5px;background:#e6f2ee;color:var(--court);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-weight:600">${esc(F.slot)}</p>` : ''}
  <form class="fg" novalidate>
    <label class="f full">${fl.child}<input name="child_name" value="${v('child_name')}" autocomplete="off" required></label>
    <label class="f">${fl.age}<input name="child_age" type="number" min="3" max="80" inputmode="numeric" value="${v('child_age')}"></label>
    <label class="f">${fl.gender}<select name="gender">${fl.g.map((g, i) => `<option value="${['', 'L', 'P'][i]}" ${F.gender === ['', 'L', 'P'][i] ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    <label class="f full">${adult ? fl.guardianAdult : fl.guardian}<input name="guardian_name" value="${v('guardian_name')}" autocomplete="name"></label>
    <label class="f">${fl.phone}<input name="phone" type="tel" inputmode="tel" value="${v('phone')}" placeholder="${intl ? '+65 9123 4567' : '012-345 6789'}" autocomplete="tel" required></label>
    <label class="f">${intl ? fl.email : fl.emailOpt}<input name="email" type="email" value="${v('email')}" autocomplete="email"></label>
    ${intl ? `<label class="f">${fl.country}<input name="country" value="${v('country')}" autocomplete="country-name"></label><label class="f">${fl.dates}<input name="dates" value="${v('dates')}" placeholder="${fl.datesPh}"></label>`
      : `<label class="f">${fl.venue}<select name="venue_id"><option value="">${fl.venueAny}</option>${vs.map(x => `<option value="${x.id}" ${F.venue_id === x.id ? 'selected' : ''}>${esc(x.name)}${x.area ? ' — ' + esc(x.area) : ''}</option>`).join('')}</select></label>`}
    <label class="f ${intl ? 'full' : ''}">${fl.level}<select name="experience">${fl.levels.map(([k, n]) => `<option value="${k}" ${F.experience === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${intl ? '' : `<label class="f full">${fl.times}<input name="pref_times" value="${v('pref_times')}" placeholder="${fl.timesPh}"></label>`}
    <label class="f full">${fl.notes}<textarea name="notes" placeholder="${fl.notesPh}">${v('notes')}</textarea></label>
    <label class="consent"><input type="checkbox" name="consent" ${F.consent ? 'checked' : ''}> <span>${fl.consent}</span></label>
    <div class="err" id="ferr" role="alert"></div>
    <button class="btn btn-n" style="grid-column:1/-1" ${BUSY ? 'disabled' : ''}>${BUSY ? fl.sending : fl.submit}</button>
  </form>`;
}

/* ======================= INTERAKSI ======================= */
const toast = m => { const e = $('#toast'); e.textContent = m; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('show'), 3500); };
const tracked = new Set();
const track = k => { if (demo || tracked.has(k)) return; tracked.add(k); client?.rpc('public_site_track', { p_kind: k }).then(() => {}, () => {}); };
const readForm = () => { const f = $('#form form'); if (!f) return; new FormData(f).forEach((val, k) => { F[k] = val; }); F.consent = f.consent?.checked || false; };
const utm = (() => { try { const q = new URLSearchParams(location.search), o = {}; ['utm_source', 'utm_medium', 'utm_campaign', 'src', 'ref'].forEach(k => { if (q.get(k)) o[k] = q.get(k); }); if (document.referrer) o.referrer = document.referrer.slice(0, 120); return o; } catch { return {}; } })();

function render() {
  document.documentElement.lang = LANG === 'zh' ? 'zh' : LANG;
  $('#app').innerHTML = page(); bind();
}
function rerenderForm() { $('#form').innerHTML = formHtml(); bindForm(); }
function bind() {
  document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { readForm(); LANG = b.dataset.lang; try { localStorage.setItem('mx_site_lang', LANG); } catch { /* abaikan */ } render(); });
  document.querySelectorAll('[data-venue]').forEach(b => b.onclick = () => { VENUE = b.dataset.venue; PROG = ''; document.querySelectorAll('[data-venue]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#week').innerHTML = weekHtml(); bindWeek(); track('venue_view'); });
  document.querySelectorAll('[data-kind]').forEach(a => a.addEventListener('click', () => { readForm(); KIND = a.dataset.kind; SENT = null; rerenderForm(); }));
  document.querySelectorAll('[data-track]').forEach(a => a.addEventListener('click', () => track(a.dataset.track)));
  bindWeek(); bindForm();
}
function bindWeek() {
  document.querySelectorAll('[data-prog]').forEach(b => b.onclick = () => { PROG = b.dataset.prog; $('#week').innerHTML = weekHtml(); bindWeek(); });
  document.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
    const [d, tm, pid] = b.dataset.slot.split('|'), v = venues().find(x => x.id === VENUE) || venues()[0];
    readForm(); KIND = 'group_trial'; SENT = null; F.venue_id = v.id; F.programme_id = pid; F.slot = L().slotPick(L().days[d], tm, v.name);
    F.pref_times = `${T.ms.days[d]} ${tm} (${progName(pid)})`; rerenderForm(); track('slot_click');
    $('#borang').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  document.querySelectorAll('[data-venue-pick]').forEach(a => a.addEventListener('click', () => { readForm(); F.venue_id = a.dataset.venuePick; rerenderForm(); }));
}
function bindForm() {
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { readForm(); KIND = b.dataset.k; rerenderForm(); });
  $('#form [data-new]')?.addEventListener('click', () => { SENT = null; Object.keys(F).forEach(k => delete F[k]); rerenderForm(); });
  const f = $('#form form'); if (!f) return;
  f.addEventListener('input', () => track('form_start'), { once: true });
  f.onsubmit = async e => {
    e.preventDefault(); readForm(); const l = L(), err = m => { $('#ferr').textContent = m; };
    if ((F.child_name || '').trim().length < 2) return err(l.errs.child);
    const ph = String(F.phone || '').replace(/\D/g, ''); if (ph.length < 9 || ph.length > 15) return err(l.errs.phone);
    if (KIND === 'intl' && !/^\S+@\S+\.\S+$/.test(F.email || '')) return err(l.errs.email);
    if (!F.consent) return err(l.errs.consent);
    const vn = venues().find(x => x.id === F.venue_id), real = id => (id && !String(id).startsWith('fb') ? id : null);
    const notes = [F.notes, KIND === 'intl' ? `Negara: ${F.country || '-'} · Tarikh: ${F.dates || '-'}` : '', vn && !real(vn.id) ? `Lokasi: ${vn.name}` : '', F.slot ? `Slot dipilih dari laman: ${F.pref_times}` : ''].filter(Boolean).join('\n');
    const payload = { kind: KIND, child_name: F.child_name.trim(), child_age: F.child_age || null, gender: F.gender || null, guardian_name: F.guardian_name || null, phone: F.phone, email: F.email || null,
      venue_id: real(F.venue_id), programme_id: real(F.programme_id), experience: F.experience || null, pref_times: F.pref_times || null, notes: notes || null, country: F.country || null, lang: LANG, consent: true, utm };
    BUSY = true; rerenderForm();
    try {
      let r;
      if (demo) r = { ok: true, ref: 'MX' + new Date().toISOString().slice(2, 7).replace('-', '') + '-DEMO' };
      else { const { data, error } = await client.rpc('public_lead_submit', { p: payload }); if (error) throw error; r = data; }
      BUSY = false;
      if (!r?.ok) { rerenderForm(); return $('#ferr') && ($('#ferr').textContent = r?.error || l.errs.net); }
      SENT = { ref: r.ref, f: { child_name: payload.child_name, child_age: payload.child_age, venue: vn?.name } }; rerenderForm();
      $('#borang').scrollIntoView({ block: 'start' });
    } catch (ex) { console.warn(ex); BUSY = false; rerenderForm(); $('#ferr').textContent = l.errs.net; }
  };
}

/* ======================= MULA ======================= */
(async () => {
  try { const q = new URLSearchParams(location.search).get('lang') || localStorage.getItem('mx_site_lang'); if (T[q]) LANG = q; else if (/^zh/i.test(navigator.language)) LANG = 'zh'; } catch { /* abaikan */ }
  const k = new URLSearchParams(location.search).get('kind'); if (k && T.ms.kinds.some(x => x[0] === k)) KIND = k;
  render();
  try {
    if (!demo) { const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: false } }); }
    track('view');
    TT = demo ? demoTT() : (await client.rpc('public_timetable')).data;
    if (TT) { readForm(); VENUE = venues()[0]?.id || null; render(); }
  } catch (e) { console.warn('jadual', e); }
})();

function demoTT() {
  const vs = FALLBACK_VENUES.map((v, i) => ({ ...v, id: 'v' + i })), ps = [{ id: 'p1', name: 'Foundation' }, { id: 'p2', name: 'Performance' }, { id: 'p3', name: 'Elite' }];
  const cl = []; vs.forEach((v, i) => [[6, '09:00', '11:00', 'p1', 'open'], [6, '11:00', '13:00', 'p2', 'few'], [0, '15:00', '17:00', 'p1', 'open'], [3, '17:00', '19:00', 'p2', 'open'], [5, '20:00', '22:00', 'p3', 'full']]
    .slice(0, 3 + (i % 3)).forEach(([d, s, e, p, st]) => cl.push({ venue_id: v.id, programme_id: p, weekday: d, start: s, end: e, seats: st })));
  return { venues: vs, programmes: ps, classes: cl, packages: [] };
}
