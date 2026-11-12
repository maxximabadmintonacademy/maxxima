// Data DEMO (rekaan) — hanya digunakan apabila config.js kosong. Nama pelajar,
// harga dan kejohanan di sini adalah contoh; lokasi & nama coach daripada laman web akademi.
import { todayISO, addDays, iso, parseISO } from './ui.js';
import { buildDraw } from './admin/bracket.js';
import { createEngine } from './engine.js';

let _id = 0;
const id = p => `${p}${String(++_id).padStart(3, '0')}`;
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

export function makeSeed() {
  const today = todayISO();
  const t = Object.fromEntries(['settings', 'venues', 'programmes', 'packages', 'student_packages', 'notifications', 'staff', 'profiles', 'leads', 'trials', 'students', 'classes', 'class_enrolments', 'class_sessions', 'attendance', 'progress_records', 'invoices', 'payments', 'credit_notes', 'guardians', 'student_programmes', 'parent_tax_info', 'invoice_items', 'expenses', 'leave_requests', 'tournaments', 'tournament_categories', 'tournament_entries', 'tournament_matches'].map(k => [k, []]));

  t.settings.push(
    { key: 'academy', value: { name: 'Maxxima Badminton Academy', whatsapp: '60124965324', email: 'maxxima.academy@gmail.com', instagram: '@maxximaba' } },
    { key: 'billing', value: { due_days: 7, cancel_notice_hours: 48, bank_name: 'Maybank (contoh)', bank_account: '5123 4567 8901', bank_holder: 'Maxxima Badminton Academy', duitnow_note: 'DuitNow ID 012-496 5324. Letak nama pelajar sebagai rujukan.' } });

  const V = {};
  [['GoTeam Sports Complex', 'Bukit Raja, Klang'], ['Forum SBA', 'Setia Alam'], ['SLK Sport Centre', 'Batu Caves'], ['Ultra Sport Centre', 'Selayang'], ['Abedeen Clubhouse', 'Cyberjaya'], ['Arena MXSPD', 'Telok Panglima Garang'], ['Armanee Condominium', 'Damansara Damai'], ['Puchong Sport Centre', 'Puchong'], ["Michael's BA", 'Puchong']]
    .forEach(([name, area]) => { const v = { id: id('v'), name, area, active: true }; V[name] = v.id; t.venues.push(v); });
  const P = {};
  [['Foundation', 'group'], ['Performance', 'group'], ['Elite', 'group'], ['Adult', 'group'], ['Personal Coaching', 'personal']].forEach(([name, kind], i) => { const p = { id: id('p'), name, kind, sort: i + 1, active: true, description: '' }; P[name] = p.id; t.programmes.push(p); });

  const SF = {};
  [['Muhaimin', 'Ketua Jurulatih'], ['Alvi', 'Jurulatih'], ['Fiqri', 'Jurulatih'], ['Zamry', 'Jurulatih'], ['Doryn', 'Pengurus Akademi']]
    .forEach(([full_name, position]) => { const s = { id: id('s'), full_name, position, active: true, profile_id: null, employment_type: null, pay_basis: null, pay_rate: null, phone: null, certification: null }; SF[full_name] = s.id; t.staff.push(s); });
  const sample = { id: id('s'), full_name: 'Coach Sampel (demo)', position: 'Jurulatih', active: true, profile_id: null, employment_type: 'part_time', pay_basis: 'hourly', pay_rate: 40, phone: '012-000 0000', certification: 'Contoh' };
  SF.sample = sample.id; t.staff.push(sample);

  // Profil (akaun log masuk)
  t.profiles.push(
    { id: 'demo-admin', full_name: 'Doryn (Demo)', email: 'admin@demo.local', role: 'admin', active: true, phone: null },
    { id: 'demo-coach', full_name: 'Coach Alvi (Demo)', email: 'alvi@demo.local', role: 'coach', active: true, phone: null },
    { id: 'demo-parent', full_name: 'Puan Rohana (Demo)', email: 'rohana@demo.local', role: 'parent', active: true, phone: null });
  t.staff.find(s => s.id === SF.Alvi).profile_id = 'demo-coach';

  // Katalog pakej: kadar Foundation/Elite/Adult ialah kadar rujukan akademi; Performance ialah CONTOH (tetapkan sendiri).
  const pk = (prog, sessions, price, valid_days, mode = 'fixed') => { const p = { id: id('pk'), programme_id: P[prog], name: `${prog} · ${sessions} sesi`, sessions, price, valid_days, schedule_mode: mode, sort: t.packages.filter(x => x.programme_id === P[prog]).length + 1, active: true }; t.packages.push(p); return p; };
  const PK = {
    f4: pk('Foundation', 4, 140, 31), f8: pk('Foundation', 8, 240, 62), f24: pk('Foundation', 24, 700, 180), f40: pk('Foundation', 40, 1000, 365),
    p4: pk('Performance', 4, 200, 31), p8: pk('Performance', 8, 360, 62),
    e4: pk('Elite', 4, 240, 31), e8: pk('Elite', 8, 440, 62), e24: pk('Elite', 24, 1200, 180), e40: pk('Elite', 40, 1800, 365),
    a4: pk('Adult', 4, 200, 31), a8: pk('Adult', 8, 360, 62),
  };

  // Kelas mingguan
  const cls = (venue, prog, weekday, start, end, coach, court, cap) => { const c = { id: id('c'), venue_id: V[venue], programme_id: P[prog], weekday, start_time: start, end_time: end, court, coach_id: SF[coach], capacity: cap, active: true }; t.classes.push(c); return c; };
  const C = [
    cls('GoTeam Sports Complex', 'Foundation', 1, '16:30', '18:30', 'Alvi', 'Gelanggang 1', 12),
    cls('GoTeam Sports Complex', 'Performance', 1, '19:00', '21:00', 'Fiqri', 'Gelanggang 2', 10),
    cls('GoTeam Sports Complex', 'Elite', 3, '20:00', '22:00', 'Muhaimin', 'Gelanggang 3', 8),
    cls('Forum SBA', 'Foundation', 2, '16:30', '18:30', 'Zamry', 'Gelanggang 1', 12),
    cls('Forum SBA', 'Performance', 4, '19:00', '21:00', 'Alvi', 'Gelanggang 1', 10),
    cls('Puchong Sport Centre', 'Foundation', 6, '09:00', '11:00', 'Alvi', 'Gelanggang 2', 12),
    cls('Puchong Sport Centre', 'Performance', 6, '11:00', '13:00', 'Fiqri', 'Gelanggang 2', 10),
    cls('GoTeam Sports Complex', 'Elite', 5, '20:00', '22:00', 'Muhaimin', 'Gelanggang 3', 8),
    cls('GoTeam Sports Complex', 'Foundation', 3, '16:30', '18:30', 'Zamry', 'Gelanggang 1', 12),
    cls('Forum SBA', 'Elite', 0, '09:00', '11:00', 'Muhaimin', 'Gelanggang 2', 8),
  ];

  // Pelajar
  const yb = a => `${parseISO(today).getFullYear() - a}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`;
  const stu = (name, age, prog, venue, status, classes, guardian, phone, extra = {}) => {
    const s = { id: id('st'), full_name: name, birth_date: yb(age), gender: rnd() > .5 ? 'male' : 'female', guardian_id: null, guardian_name: guardian, guardian_phone: phone, family_ref: null, programme_id: P[prog], venue_id: V[venue], status, joined_on: status === 'active' ? addDays(today, -Math.floor(40 + rnd() * 500)) : null, lead_id: null, notes: null, ...extra };
    t.students.push(s); classes.forEach(ci => t.class_enrolments.push({ id: id('ce'), class_id: C[ci].id, student_id: s.id })); return s;
  };
  const S1 = stu('Aiman Hakimi', 10, 'Foundation', 'GoTeam Sports Complex', 'active', [0], 'Puan Rohana', '012-345 6789');
  S1.guardian_id = 'demo-parent';
  stu('Chloe Tan', 12, 'Performance', 'GoTeam Sports Complex', 'active', [1], 'Mr Tan Wei', '016-221 9087');
  stu('Darshan Raj', 14, 'Performance', 'Forum SBA', 'active', [4], 'Encik Raj Kumar', '017-889 1203');
  stu('Nur Aisyah', 9, 'Foundation', 'Forum SBA', 'active', [3], 'Puan Salmah', '013-552 7781');
  stu('Haziq Danial', 15, 'Elite', 'GoTeam Sports Complex', 'active', [2, 7], 'Encik Zulkifli', '012-998 4410');
  stu('Lim Jia Hui', 11, 'Performance', 'GoTeam Sports Complex', 'active', [1], 'Puan Wong', '016-774 3321');
  stu('Irfan Harith', 13, 'Performance', 'Puchong Sport Centre', 'active', [6], 'Puan Norliza', '019-201 5567');
  const SOF = stu('Sofea Qistina', 8, 'Foundation', 'Puchong Sport Centre', 'active', [], 'Encik Kamal', '011-3321 0098');   // pakej fleksibel
  stu('Ryan Lee', 16, 'Elite', 'GoTeam Sports Complex', 'active', [2, 7], 'Mr Lee Chong', '012-661 7754');
  stu('Adam Mikail', 10, 'Foundation', 'GoTeam Sports Complex', 'active', [0, 8], 'Puan Hasnah', '017-554 9021');
  stu('Kavitha Devi', 12, 'Performance', 'Forum SBA', 'active', [4], 'Puan Lakshmi', '014-882 3310');
  stu('Umar Al-Fateh', 14, 'Elite', 'Forum SBA', 'active', [9, 2], 'Encik Ahmad', '013-447 2290');
  stu('Danish Iskandar', 7, 'Foundation', 'GoTeam Sports Complex', 'pending', [], 'Puan Farah', '019-221 4400');
  const E = stu('Ethan Ong', 9, 'Foundation', 'Forum SBA', 'awaiting_payment', [3], 'Ms Grace Ong', '016-903 1188');

  // Sesi (3 minggu lepas hingga 2 minggu depan) + kehadiran
  const tendency = {}; t.students.forEach(s => { tendency[s.id] = s.full_name === 'Adam Mikail' ? .5 : s.full_name === 'Nur Aisyah' ? .62 : .75 + rnd() * .23; });
  for (let d = -21; d <= 14; d++) {
    const date = addDays(today, d), wd = parseISO(date).getDay();
    for (const c of t.classes.filter(c => c.weekday === wd)) {
      const past = d < 0, ses = { id: id('ss'), class_id: c.id, session_date: date, status: past ? 'held' : 'scheduled', coach_id: null, lesson_plan: null, cancel_reason: null };
      t.class_sessions.push(ses);
      if (past) for (const e of t.class_enrolments.filter(e => e.class_id === c.id && t.students.find(s => s.id === e.student_id).status === 'active')) {
        const r = rnd(), tn = tendency[e.student_id];
        t.attendance.push({ id: id('at'), session_id: ses.id, student_id: e.student_id, session_date: date, status: r < tn ? (r < tn * .1 ? 'late' : 'present') : r < tn + .06 ? 'excused' : 'absent', note: null, marked_by: 'demo-coach', parent_confirmed: false, parent_confirmed_at: null });
      }
    }
  }

  // Pakej + invois + bayaran (melalui enjin yang sama seperti trigger pelayan)
  const eng = createEngine(t, () => id('x'));
  const sold = (name, pkg, { price, paidDaysAgo = 21, mode = 'fixed' } = {}) => {
    const st = t.students.find(s => s.full_name === name), amount = price ?? pkg.price, paidOn = addDays(today, -paidDaysAgo);
    const inv = { id: id('iv'), number: eng.nextInvoiceNo(), student_id: st.id, kind: 'package', description: pkg.name, amount, issued_on: addDays(paidOn, -2), due_date: addDays(paidOn, 5), status: 'issued', paid_on: null, created_at: new Date().toISOString() };
    t.invoices.push(inv);
    t.student_packages.push({ id: id('sp'), student_id: st.id, package_id: pkg.id, programme_id: pkg.programme_id, name: pkg.name, sessions_total: pkg.sessions, sessions_used: 0, price: amount, valid_days: pkg.valid_days, schedule_mode: mode, status: 'pending', starts_on: null, expires_on: null, invoice_id: inv.id, renewal_of: null, renewal_sent: false, notes: null, created_at: new Date().toISOString() });
    const pay = { id: id('py'), invoice_id: inv.id, amount, method: ['duitnow', 'fpx', 'transfer', 'cash'][t.payments.length % 4], paid_on: paidOn, reference: null, status: 'confirmed', proof_path: null, submitted_by: null, verified_by: 'demo-admin', note: null };
    eng.paymentBefore(pay); t.payments.push(pay); eng.applyPayment(pay, null, true);
    return st;
  };
  // Mereka membeli pakej 21 hari lalu; kehadiran tiga minggu lalu dipadankan dan baki dikira.
  sold('Aiman Hakimi', PK.f4); sold('Chloe Tan', PK.p8); sold('Darshan Raj', PK.p4); sold('Nur Aisyah', PK.f8);
  sold('Haziq Danial', PK.e8); sold('Lim Jia Hui', PK.p4); sold('Irfan Harith', PK.p8); sold('Ryan Lee', PK.e8);
  sold('Adam Mikail', PK.f8); sold('Kavitha Devi', PK.p4, { price: 150 });      // kadar lama kekal
  sold('Umar Al-Fateh', PK.e8);
  sold('Sofea Qistina', PK.f8, { paidDaysAgo: 18, mode: 'flexible' });
  // sejarah kehadiran selepas pakej aktif -> tolak baki (kehadiran tertua dahulu) -> invois pembaharuan auto bila baki <= 1
  t.attendance.slice().sort((a, b) => (a.session_date || '').localeCompare(b.session_date || '')).forEach(a => { const old = { ...a }; eng.assign(a); eng.attendanceAfter(old, a); });
  // Sofea (fleksibel): hadir 2 sesi, tempah 2 sesi akan datang
  const sofPkg = t.student_packages.find(p => p.student_id === SOF.id);
  const fSess = t.class_sessions.filter(s => s.class_id === C[5].id).sort((a, b) => a.session_date.localeCompare(b.session_date));
  fSess.filter(s => s.session_date < today).slice(0, 2).forEach(s => { const a = { id: id('at'), session_id: s.id, student_id: SOF.id, session_date: s.session_date, status: 'present', note: null, marked_by: 'demo-coach', parent_confirmed: false, parent_confirmed_at: null, student_package_id: null }; eng.assign(a); t.attendance.push(a); eng.attendanceAfter(null, a); });
  fSess.filter(s => s.session_date >= today).slice(0, 2).forEach(s => t.attendance.push({ id: id('at'), session_id: s.id, student_id: SOF.id, session_date: s.session_date, status: 'booked', note: null, marked_by: null, parent_confirmed: false, parent_confirmed_at: null, student_package_id: sofPkg.id }));
  // Darshan: invois pembaharuan sudah lewat; Aiman: ibu bapa sudah hantar bukti bayaran (menunggu pengesahan)
  const renewalOf = n => t.invoices.find(i => i.student_id === t.students.find(s => s.full_name === n).id && i.description?.startsWith('Pembaharuan') && i.status === 'issued');
  const rd = renewalOf('Darshan Raj'); if (rd) rd.due_date = addDays(today, -3);
  const ra = renewalOf('Aiman Hakimi');
  if (ra) { const pay = { id: id('py'), invoice_id: ra.id, amount: ra.amount, method: 'duitnow', paid_on: today, reference: 'DN-882913', status: 'pending', proof_path: 'demo/bukti-bayaran.jpg', submitted_by: 'demo-parent', submitted_at: new Date().toISOString(), verified_by: null, receipt_no: null, note: null }; t.payments.push(pay); eng.applyPayment(pay, null, true); }
  // Ethan: menunggu bayaran (pakej + pendaftaran)
  { const inv = { id: id('iv'), number: eng.nextInvoiceNo(), student_id: E.id, kind: 'package', description: PK.f4.name, amount: 140, issued_on: addDays(today, -1), due_date: addDays(today, 6), status: 'issued', paid_on: null, created_at: new Date().toISOString() };
    t.invoices.push(inv);
    t.student_packages.push({ id: id('sp'), student_id: E.id, package_id: PK.f4.id, programme_id: PK.f4.programme_id, name: PK.f4.name, sessions_total: 4, sessions_used: 0, price: 140, valid_days: 31, schedule_mode: 'fixed', status: 'pending', starts_on: null, expires_on: null, invoice_id: inv.id, renewal_of: null, renewal_sent: false, notes: null, created_at: new Date().toISOString() });
    t.invoices.push({ id: id('iv'), number: eng.nextInvoiceNo(), student_id: E.id, kind: 'registration', description: 'Yuran pendaftaran', amount: 30, issued_on: addDays(today, -1), due_date: addDays(today, 6), status: 'issued', paid_on: null, created_at: new Date().toISOString() }); }

  // Leads & trial
  const lead = (child_name, child_age, guardian_name, phone, source, prog, venue, status, daysAgo) => { const l = { id: id('l'), child_name, child_age, guardian_name, phone, source, programme_id: P[prog], venue_id: V[venue], status, notes: null, created_at: addDays(today, -daysAgo) + 'T09:00:00Z' }; t.leads.push(l); return l; };
  lead('Alya Sofia', 10, 'Encik Hisham', '012-778 3302', 'Instagram', 'Foundation', 'Forum SBA', 'new', 1);
  lead('Ammar Zikri', 12, 'Puan Zaleha', '011-5520 7731', 'WhatsApp', 'Performance', 'GoTeam Sports Complex', 'new', 0);
  const L3 = lead('Kai Chen', 10, 'Mrs Chen', '016-118 2290', 'Rujukan', 'Foundation', 'Puchong Sport Centre', 'trial_scheduled', 3);
  const L4 = lead('Priya Kumar', 11, 'Mr Kumar', '017-334 9012', 'Facebook', 'Performance', 'Forum SBA', 'trial_done', 9);
  lead('Faris Aqil', 13, 'Encik Rizal', '019-662 0187', 'Laman Web', 'Performance', 'GoTeam Sports Complex', 'contacted', 4);
  lead('Hana Marissa', 8, 'Puan Aini', '013-290 6641', 'TikTok', 'Foundation', 'Forum SBA', 'lost', 20);
  t.trials.push(
    { id: id('tr'), lead_id: L3.id, kind: 'group_trial', venue_id: V['Puchong Sport Centre'], coach_id: SF.Alvi, trial_date: addDays(today, 3), trial_time: '09:00', status: 'scheduled', recommended_programme_id: null, notes: null },
    { id: id('tr'), lead_id: L4.id, kind: 'group_trial', venue_id: V['Forum SBA'], coach_id: SF.Alvi, trial_date: addDays(today, -4), trial_time: '19:00', status: 'done', recommended_programme_id: P.Performance, notes: 'Footwork baik, perlu kuatkan backhand.' });

  t.leave_requests.push({ id: id('lv'), staff_id: SF.sample, leave_type: 'Cuti Tahunan', from_date: addDays(today, 5), to_date: addDays(today, 6), status: 'pending', note: 'Urusan keluarga', decided_by: null });

  // Kejohanan: satu dibuka pendaftaran, satu sedang berlangsung (dengan cabutan)
  const T1 = { id: id('tn'), name: 'Maxxima Open 2026 (contoh)', venue_id: V['GoTeam Sports Complex'], venue_note: null, start_date: addDays(today, 24), end_date: addDays(today, 25), registration_deadline: addDays(today, 10), entry_fee: 40, status: 'open', description: 'Kejohanan dalaman untuk pelajar akademi.', created_at: new Date().toISOString() };
  const T2 = { id: id('tn'), name: 'Kejohanan Mini Akademi (contoh)', venue_id: V['Forum SBA'], venue_note: null, start_date: addDays(today, -1), end_date: addDays(today, 1), registration_deadline: addDays(today, -7), entry_fee: 20, status: 'ongoing', description: '', created_at: new Date().toISOString() };
  t.tournaments.push(T1, T2);
  const cat = (tn, name, kind, gender, age_group) => { const c = { id: id('tc'), tournament_id: tn.id, name, kind, gender, age_group, max_entries: null }; t.tournament_categories.push(c); return c; };
  const c1 = cat(T1, 'Perseorangan Lelaki B12', 'singles', 'boys', 'B12'), c2 = cat(T1, 'Perseorangan Perempuan B12', 'singles', 'girls', 'B12'), c3 = cat(T2, 'Perseorangan Terbuka', 'singles', 'open', 'Terbuka');
  const ent = (c, sname, seed = null) => { const e = { id: id('te'), category_id: c.id, student_id: t.students.find(s => s.full_name === sname).id, partner_id: null, status: 'confirmed', seed, invoice_id: null }; t.tournament_entries.push(e); return e; };
  ent(c1, 'Aiman Hakimi'); ent(c1, 'Adam Mikail'); ent(c2, 'Chloe Tan');
  const ents = [ent(c3, 'Haziq Danial', 1), ent(c3, 'Ryan Lee', 2), ent(c3, 'Umar Al-Fateh'), ent(c3, 'Darshan Raj'), ent(c3, 'Irfan Harith')];
  buildDraw(ents.map(e => ({ id: e.id, seed: e.seed })), false).forEach(m => t.tournament_matches.push({ id: id('tm'), category_id: c3.id, court: null, play_date: null, play_time: null, ...m }));
  return t;
}
