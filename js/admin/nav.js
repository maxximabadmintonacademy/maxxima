// Konfigurasi menu Portal Admin. Tambah/ubah menu di sini sahaja.
import { reviewCount } from './review.js';
import { S } from '../data.js';
import { T, invStatus, pendingPayments, lowPackages, unallocated, setupGaps } from './helpers.js';
import { sessionGaps } from './sessions.js';

export const NAV = [
  { group: 'Utama', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'persediaan', label: 'Persediaan', icon: 'grid', count: () => setupGaps().length },
    { id: 'semak', label: 'Perlu Semak', icon: 'alert', count: () => reviewCount(), red: true },
    { id: 'padanan', label: 'Padankan Nama', icon: 'users', count: () => (S.t.import_matches ? new Set(S.t.import_matches.map(m => m.raw_name.toLowerCase())).size : 0) },
  ] },
  { group: 'Pengurusan Pelajar', items: [
    { id: 'leads', label: 'Leads', icon: 'target', count: () => T('leads').filter(l => l.status === 'new').length },
    { id: 'trial', label: 'Kelas Percubaan', icon: 'flag', count: () => T('trials').filter(t => t.status === 'scheduled').length },
    { id: 'kemasukan', label: 'Pendaftaran', icon: 'userplus', count: () => T('students').filter(s => ['pending', 'awaiting_payment'].includes(s.status)).length },
    { id: 'pelajar', label: 'Senarai Pelajar', icon: 'users' },
    { id: 'tempahan', label: 'Tempahan', icon: 'calendar', count: () => T('booking_requests').filter(b => b.status === 'new').length, red: true },
  ] },
  { group: 'Operasi', items: [
    { id: 'kalendar', label: 'Kalendar Sesi', icon: 'calendar', count: () => sessionGaps().length, red: true },
    { id: 'jadual', label: 'Jadual Mingguan', icon: 'grid' },
    { id: 'kehadiran', label: 'Kehadiran', icon: 'check' },
    { id: 'kejohanan', label: 'Kejohanan', icon: 'trophy' },
  ] },
  { group: 'Kewangan', items: [
    { id: 'yuran', label: 'Invois & Bayaran', icon: 'wallet', count: () => T('invoices').filter(i => invStatus(i) === 'overdue').length + pendingPayments().length, red: true },
    { id: 'bilpersonal', label: 'Bil Personal & Walk-in', icon: 'wallet' },
    { id: 'perbelanjaan', label: 'Perbelanjaan', icon: 'trend' },
    { id: 'pakej', label: 'Pakej', icon: 'tag', count: () => lowPackages().length + unallocated().length },
  ] },
  { group: 'Pasukan', items: [
    { id: 'coach', label: 'Coach', icon: 'award' },
    { id: 'hr', label: 'HR & Staf', icon: 'briefcase', count: () => T('leave_requests').filter(l => l.status === 'pending').length },
  ] },
  { group: 'Sistem', items: [
    { id: 'pengguna', label: 'Pengguna & Akses', icon: 'key' },
    { id: 'tetapan', label: 'Tetapan', icon: 'cog' },
  ] },
];
export const ALL_ITEMS = NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.group })));
export const BOTTOM_NAV = [
  { id: 'dashboard', label: 'Utama', icon: 'home' },
  { id: 'pelajar', label: 'Pelajar', icon: 'users' },
  { id: 'kalendar', label: 'Kalendar', icon: 'calendar' },
  { id: 'yuran', label: 'Yuran', icon: 'wallet' },
];
