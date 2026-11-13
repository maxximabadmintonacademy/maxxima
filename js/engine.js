// Enjin MOD DEMO: meniru trigger pangkalan data (supabase/schema.sql) supaya
// demo berkelakuan sama: kehadiran -> tolak baki -> invois pembaharuan auto,
// bayaran disahkan -> invois lunas -> pakej aktif -> resit, notifikasi.
// Dalam mod Supabase, SEMUA ini dilakukan oleh trigger di pelayan (bukan fail ini).
import { todayISO, addDays } from './ui.js';

const CONSUMES = new Set(['present', 'late', 'absent', 'late_cancel']);
export const consumes = s => CONSUMES.has(s);
const pad = (n, w = 4) => String(n).padStart(w, '0');

const toMin = x => { const [h, m] = String(x || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
export function createEngine(t, newId) {
  const attHours = a => {
    if (a.hours != null && a.hours !== '') return Number(a.hours);
    const ses = t.class_sessions.find(s => s.id === a.session_id), c = ses && t.classes.find(x => x.id === ses.class_id);
    return c ? Math.max((toMin(ses.end_time || c.end_time) - toMin(ses.start_time || c.start_time)) / 60, 0) : 1;
  };
  const now = () => new Date().toISOString();
  const yymm = () => todayISO().slice(2, 4) + todayISO().slice(5, 7);
  const nextNo = (prefix, rows, field) => {
    let n = rows.length + 1;
    while (rows.some(r => r[field] === `${prefix}-${yymm()}-${pad(n)}`)) n++;
    return `${prefix}-${yymm()}-${pad(n)}`;
  };
  const setting = k => t.settings.find(s => s.key === k)?.value || {};

  const notify = (user_id, kind, title, body, link = null) => {
    if (user_id) t.notifications.push({ id: newId(), user_id, kind, title, body, link, read_at: null, created_at: now() });
  };
  const notifyAdmins = (kind, ...a) => t.profiles.filter(p => p.role === 'admin' && p.active && !(p.notify_off || []).includes(kind)).forEach(p => notify(p.id, kind, ...a));

  const E = {
    nextInvoiceNo: () => nextNo('INV', t.invoices, 'number'),

    /* ---- kehadiran ---- */
    assign(att) {
      if (!consumes(att.status) || att.student_package_id) return;
      const ses = t.class_sessions.find(s => s.id === att.session_id), cls = ses && t.classes.find(c => c.id === ses.class_id);
      if (!cls) return;
      const date = att.session_date || ses.session_date;
      const pk = t.student_packages
        .filter(p => p.student_id === att.student_id && p.status === 'active' && p.programme_id === cls.programme_id && p.sessions_used < p.sessions_total && (!p.expires_on || p.expires_on >= date))
        .sort((a, b) => (a.expires_on || '9999').localeCompare(b.expires_on || '9999') || (a.created_at || '').localeCompare(b.created_at || ''))[0];
      att.student_package_id = pk?.id ?? null;
    },
    recount(id) {
      const p = t.student_packages.find(x => x.id === id); if (!p) return;
      const used = t.attendance.filter(a => a.student_package_id === id && consumes(a.status));
      p.sessions_used = p.unit === 'jam' ? Math.round(used.reduce((n, a) => n + attHours(a), 0) * 100) / 100 : used.length;
      if (p.auto_start && ['active', 'completed', 'expired'].includes(p.status)) {   // tempoh sah bermula pada sesi pertama dihadiri
        const d = used.map(a => a.session_date).filter(Boolean).sort()[0] || null;
        p.starts_on = d; p.expires_on = d ? addDays(d, Number(p.valid_days) + Number(p.extended_days || 0)) : null;
      }
      if (p.status === 'active' && p.sessions_used >= p.sessions_total) p.status = 'completed';
      else if (p.status === 'completed' && p.sessions_used < p.sessions_total) p.status = 'active';
    },
    maybeRenew(id) {
      const sp = t.student_packages.find(x => x.id === id);
      if (!sp || !['active', 'completed'].includes(sp.status) || sp.renewal_sent) return;
      if (sp.sessions_total - sp.sessions_used > 1) return;
      const st = t.students.find(s => s.id === sp.student_id);
      if (!st || st.status !== 'active') return;
      sp.renewal_sent = true;
      if (t.student_packages.some(x => x.student_id === sp.student_id && x.programme_id === sp.programme_id && x.id !== sp.id && (x.status === 'pending' || (x.status === 'active' && x.sessions_used < x.sessions_total)))) return;
      const inv = { id: newId(), number: E.nextInvoiceNo(), student_id: sp.student_id, kind: 'package', description: 'Pembaharuan pakej: ' + sp.name, amount: sp.price, issued_on: todayISO(), due_date: addDays(todayISO(), setting('billing').due_days ?? 7), status: 'issued', paid_on: null, created_at: now() };
      t.invoices.push(inv); E.invoiceCreated(inv);
      t.student_packages.push({ id: newId(), student_id: sp.student_id, package_id: sp.package_id, programme_id: sp.programme_id, name: sp.name, sessions_total: sp.sessions_total, sessions_used: 0, price: sp.price, valid_days: sp.valid_days, schedule_mode: sp.schedule_mode, status: 'pending', starts_on: null, expires_on: null, invoice_id: inv.id, renewal_of: sp.id, renewal_sent: false, notes: null, created_at: now() });
      notifyAdmins('renewal', 'Invois pembaharuan dikeluarkan', `${st.full_name} tinggal ${Math.max(sp.sessions_total - sp.sessions_used, 0)} sesi — invois pembaharuan dijana automatik.`, 'yuran');
    },
    /** dipanggil selepas baris kehadiran ditambah / diubah / dipadam */
    attendanceAfter(oldRow, newRow) {
      if (oldRow?.student_package_id) E.recount(oldRow.student_package_id);
      if (newRow?.student_package_id) { E.recount(newRow.student_package_id); E.maybeRenew(newRow.student_package_id); }
    },
    allocateOrphans(studentId) {
      t.attendance.filter(a => a.student_id === studentId && !a.student_package_id && consumes(a.status)).sort((a, b) => (a.session_date || '').localeCompare(b.session_date || ''))
        .forEach(a => { const old = { ...a }; E.assign(a); if (a.student_package_id) E.attendanceAfter(old, a); });
    },

    /* ---- bayaran ---- */
    paymentBefore(p) {
      p.status ??= 'confirmed';
      if (p.status === 'confirmed' && !p.receipt_no) p.receipt_no = nextNo('RCP', t.payments, 'receipt_no');
      if (p.status === 'pending' && !p.submitted_at) p.submitted_at = now();
    },
    applyPayment(p, oldStatus, isInsert) {
      const inv = t.invoices.find(i => i.id === p.invoice_id); if (!inv) return;
      const st = t.students.find(s => s.id === inv.student_id);
      if (isInsert && p.status === 'pending') notifyAdmins('payment', 'Bayaran baharu menunggu pengesahan', `${st?.full_name || ''} · ${inv.number} · RM${p.amount}`, 'yuran');
      if ((isInsert && p.status === 'confirmed') || (!isInsert && oldStatus === 'pending' && p.status === 'confirmed')) notify(st?.guardian_id, 'payment', 'Bayaran disahkan', `Resit ${p.receipt_no} untuk ${inv.number} sudah tersedia.`, 'bayaran');
      if (!isInsert && oldStatus === 'pending' && p.status === 'rejected') notify(st?.guardian_id, 'payment', 'Bayaran tidak dapat disahkan', p.note || 'Sila semak bukti bayaran dan hantar semula.', 'bayaran');
      const total = t.payments.filter(x => x.invoice_id === inv.id && x.status === 'confirmed').reduce((s, x) => s + Number(x.amount), 0);
      const fam = new Set((t.invoice_items || []).filter(i => i.invoice_id === inv.id && i.student_id).map(i => i.student_id)).size > 1;
      if (total >= Number(inv.amount) && inv.status === 'issued') { inv.status = 'paid'; inv.paid_on = p.paid_on; }
      if ((total >= Number(inv.amount) || (fam && p.status === 'confirmed' && total > 0)) && inv.status !== 'void') {
        t.student_packages.filter(sp => sp.invoice_id === inv.id && sp.status === 'pending').forEach(sp => {
          sp.status = 'active'; if (sp.auto_start === undefined) sp.auto_start = true; if (sp.auto_start) { sp.starts_on = null; sp.expires_on = null; } else { sp.starts_on = sp.starts_on || p.paid_on; sp.expires_on = sp.expires_on || addDays(p.paid_on, sp.valid_days); }
          E.allocateOrphans(sp.student_id); E.recount(sp.id);
        });
      }
    },
    invoiceCreated(inv) {
      const st = t.students.find(s => s.id === inv.student_id);
      notify(st?.guardian_id, 'invoice', `Invois baharu: RM${inv.amount}`, `${inv.description || inv.number} · ${st?.full_name || ''}`, 'bayaran');
    },

    /* ---- sesi ---- */
    sessionCancelled(ses) {
      const ids = new Set([...t.class_enrolments.filter(e => e.class_id === ses.class_id).map(e => e.student_id), ...t.attendance.filter(a => a.session_id === ses.id).map(a => a.student_id)]);
      new Set([...ids].map(id => t.students.find(s => s.id === id)).filter(s => s?.guardian_id && s.status === 'active').map(s => s.guardian_id))
        .forEach(g => notify(g, 'class', 'Kelas dibatalkan', `Sesi ${ses.session_date} dibatalkan${ses.cancel_reason ? ': ' + ses.cancel_reason : ''}. Baki sesi tidak ditolak.`, 'jadual'));
      t.attendance = t.attendance.filter(a => !(a.session_id === ses.id && a.status === 'booked'));
    },

    /* ---- luput ---- */
    expirePackages() {
      const list = t.student_packages.filter(p => p.status === 'active' && p.expires_on && p.expires_on < todayISO());
      list.forEach(p => { p.status = 'expired'; });
      return list.length;
    },
  };
  return E;
}
