// Pembantu data & pengiraan khusus akademi (membaca daripada cache S.t).
import { S, setting } from '../data.js';
import { todayISO, addDays, sum, hm, parseISO, DAYS, PROG_COLORS, RM } from '../ui.js';

export const T = n => S.t[n] || [];
export const byId = (t, id) => (id ? T(t).find(x => x.id === id) : undefined);
export const venueName = id => byId('venues', id)?.name || '—';
export const progName = id => byId('programmes', id)?.name || '—';
export const staffName = id => byId('staff', id)?.full_name || '—';
export const studentName = id => byId('students', id)?.full_name || '—';
export const activeStudents = () => T('students').filter(s => s.status === 'active');
export const progColor = id => { const i = T('programmes').findIndex(p => p.id === id); return PROG_COLORS[(i < 0 ? 0 : i) % PROG_COLORS.length]; };
export const academy = () => setting('academy', { name: 'Maxxima Badminton Academy', whatsapp: '' });
export const billing = () => setting('billing', { due_days: 7 });

/* ---- Pakej ---- */
export const CONSUMING = ['present', 'late', 'absent', 'late_cancel'];
export const pkgRemaining = sp => Math.max(Number(sp.sessions_total) - Number(sp.sessions_used || 0), 0);
export const studentPackages = id => T('student_packages').filter(p => p.student_id === id);
/** Pakej aktif pelajar (yang paling awal tamat dahulu). */
export const livePackages = id => studentPackages(id).filter(p => p.status === 'active').sort((a, b) => (a.expires_on || '9999').localeCompare(b.expires_on || '9999'));
export const daysLeft = sp => (sp.expires_on ? Math.round((parseISO(sp.expires_on) - parseISO(todayISO())) / 86400000) : null);
export const pkgLabel = sp => `${sp.name}${sp.schedule_mode === 'flexible' ? ' (fleksibel)' : ''}`;
export const catalogFor = programmeId => T('packages').filter(p => p.active && p.programme_id === programmeId).sort((a, b) => a.sort - b.sort || a.sessions - b.sessions);
export const pendingPayments = () => T('payments').filter(p => p.status === 'pending');
/** Kehadiran yang menolak sesi tetapi belum dipadankan dengan pakej mana-mana. */
export const unallocated = () => T('attendance').filter(a => !a.student_package_id && CONSUMING.includes(a.status));
export const lowPackages = () => T('student_packages').filter(p => p.status === 'active' && pkgRemaining(p) <= 1);
export const expiringPackages = (days = 7) => T('student_packages').filter(p => p.status === 'active' && p.expires_on && daysLeft(p) <= days);

export const invStatus = inv => (inv.status === 'issued' && inv.due_date < todayISO() ? 'overdue' : inv.status);
export const creditOf = inv => sum(T('credit_notes').filter(c => c.invoice_id === inv.id), c => c.amount);
export const paidOf = inv => sum(T('payments').filter(p => p.invoice_id === inv.id && p.status === 'confirmed'), p => p.amount);

/** Kadar kehadiran (hadir+lewat hadir) / (hadir+lewat+tidak hadir+batal lewat); dimaafkan tidak dikira. */
export function attRate(studentId, days = 60) {
  const since = addDays(todayISO(), -days);
  const rows = T('attendance').filter(a => a.student_id === studentId && a.session_date >= since && a.session_date <= todayISO() && !['excused', 'booked'].includes(a.status));
  if (!rows.length) return null;
  const ok = rows.filter(a => a.status === 'present' || a.status === 'late').length;
  return Math.round(ok / rows.length * 100);
}

export const classLabel = c => `${DAYS[c.weekday]} ${hm(c.start_time)}–${hm(c.end_time)} · ${progName(c.programme_id)} · ${venueName(c.venue_id)}`;
export const enrolledIn = classId => T('class_enrolments').filter(e => e.class_id === classId);
export const classHours = c => { const [a, b] = [c.start_time, c.end_time].map(t => { const [h, m] = String(t).split(':'); return +h + (+m || 0) / 60; }); return b - a; };
export function ageOf(birth) {
  if (!birth) return null;
  const b = parseISO(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
export function entryLabel(e) {
  if (!e) return '—';
  const a = studentName(e.student_id), p = e.partner_id ? studentName(e.partner_id) : null;
  return p ? `${a} / ${p}` : a;
}

/** Rantaian persediaan: Lokasi + Coach -> Kelas -> Pakej -> Pelajar. Setiap langkah mengira apa yang masih kurang. */
export function setupChain() {
  const venues = T('venues').filter(v => v.active), coaches = T('staff').filter(s => s.active && /jurulatih|coach/i.test(s.position || ''));
  const progs = T('programmes').filter(p => p.active), classes = T('classes').filter(c => c.active);
  const noCoach = classes.filter(c => !c.coach_id), empty = classes.filter(c => !enrolledIn(c.id).length);
  const progNoPkg = progs.filter(p => classes.some(c => c.programme_id === p.id) && !catalogFor(p.id).length);
  const progNoClass = progs.filter(p => catalogFor(p.id).length && !classes.some(c => c.programme_id === p.id));
  const studs = T('students').filter(s => s.status === 'active');
  const noPkg = studs.filter(s => !livePackages(s.id).length);
  return [
    { id: 'venue', n: 1, title: 'Lokasi', count: venues.length, unit: 'lokasi', href: 'tetapan', ok: venues.length > 0, issues: [], hint: 'Tempat latihan (gelanggang).' },
    { id: 'coach', n: 2, title: 'Coach', count: coaches.length, unit: 'coach', href: 'coach', ok: coaches.length > 0, issues: [], hint: 'Jurulatih yang akan ditetapkan pada kelas.' },
    { id: 'prog', n: 3, title: 'Program', count: progs.length, unit: 'program', href: 'tetapan', ok: progs.length > 0, issues: [], hint: 'Foundation, Performance, Elite… menyambungkan kelas dengan pakej.' },
    { id: 'class', n: 4, title: 'Kelas (lokasi + coach + hari/masa + program)', count: classes.length, unit: 'kelas', href: 'jadual', ok: classes.length > 0 && !noCoach.length, issues: [...noCoach.map(c => `Kelas ${classLabel(c)} belum ada coach`)], hint: 'Setiap kelas memilih lokasi, coach, hari, masa dan program sekali sahaja.' },
    { id: 'pkg', n: 5, title: 'Pakej (ikut program)', count: T('packages').filter(p => p.active).length, unit: 'pakej', href: 'pakej', ok: T('packages').some(p => p.active) && !progNoPkg.length, issues: [...progNoPkg.map(p => `Program ${p.name} ada kelas tetapi belum ada pakej`), ...progNoClass.map(p => `Program ${p.name} ada pakej tetapi belum ada kelas`)], hint: 'Bilangan sesi, harga dan tempoh sah. Terpakai pada semua kelas program yang sama.' },
    { id: 'student', n: 6, title: 'Pelajar → pakej → invois automatik', count: studs.length, unit: 'pelajar aktif', href: 'kemasukan', ok: studs.length > 0 && !noPkg.length, issues: noPkg.length ? [`${noPkg.length} pelajar aktif tiada pakej aktif`] : [], hint: 'Pilih pakej + kelas semasa pendaftaran. Invois pembaharuan keluar sendiri apabila baki tinggal 1 sesi.' },
  ];
}
export const setupGaps = () => setupChain().filter(s => !s.ok || s.issues.length);

/** Senarai tugasan yang memerlukan tindakan admin (dashboard + loceng). */
export function tasks() {
  const out = [];
  const add = (n, icon, tone, text, href) => { if (n > 0) out.push({ n, icon, tone, text: text.replace('{n}', n), href }); };
  add(T('leads').filter(l => l.status === 'new').length, 'target', 't-info', '{n} lead baharu belum dihubungi', 'leads');
  add(T('trials').filter(t => t.status === 'scheduled' && t.trial_date < todayISO()).length, 'flag', 't-warn', '{n} trial sudah lepas — rekod keputusan', 'trial');
  add(T('students').filter(s => s.status === 'pending').length, 'userplus', 't-warn', '{n} permohonan menunggu semakan', 'kemasukan');
  add(T('students').filter(s => s.status === 'awaiting_payment').length, 'wallet', 't-info', '{n} pelajar menunggu pengesahan bayaran', 'kemasukan');
  add(pendingPayments().length, 'wallet', 't-warn', '{n} bayaran ibu bapa menunggu pengesahan', 'yuran');
  add(T('invoices').filter(i => invStatus(i) === 'overdue').length, 'alert', 't-bad', '{n} invois lewat dibayar', 'yuran');
  add(T('student_packages').filter(sp => sp.status === 'active' && T('invoices').find(i => i.id === sp.invoice_id)?.status === 'issued').length, 'wallet', 't-warn', '{n} pakej aktif dengan bayaran separa (invois keluarga)', 'pakej');
  add(lowPackages().length, 'tag', 't-info', '{n} pakej tinggal 1 sesi atau kurang (invois pembaharuan auto)', 'pakej');
  add(expiringPackages().length, 'clock', 't-warn', '{n} pakej akan tamat tempoh dalam 7 hari', 'pakej');
  add(unallocated().length, 'alert', 't-bad', '{n} kehadiran belum dipadankan dengan pakej', 'pakej');
  add(T('leave_requests').filter(l => l.status === 'pending').length, 'briefcase', 't-purple', '{n} permohonan cuti menunggu kelulusan', 'hr');
  add(T('tournaments').filter(t => t.status === 'open' && t.registration_deadline && t.registration_deadline <= addDays(todayISO(), 7)).length, 'trophy', 't-warn', '{n} kejohanan hampir tutup pendaftaran', 'kejohanan');
  return out;
}

export { RM };
