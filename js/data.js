// Lapisan data: Supabase (sebenar) atau memori (demo). Selebihnya aplikasi
// hanya memanggil fungsi di sini, jadi tidak tahu mod mana yang sedang jalan.
import { CONFIG } from './config.js';
import { todayISO, addDays } from './ui.js';
import { createEngine } from './engine.js';

export const S = {
  mode: 'demo',          // 'supabase' | 'demo'
  client: null,
  session: null,
  profile: null,         // { id, full_name, role, ... }
  t: {},                 // cache jadual: S.t.students = [...]
  needsPassword: false,  // datang daripada pautan jemputan / set semula kata laluan
};

export const ADMIN_TABLES = [
  'settings', 'venues', 'programmes', 'packages', 'student_packages', 'notifications', 'staff', 'profiles', 'parent_tax_info', 'invoice_items', 'expenses', 'leads', 'trials', 'students',
  'classes', 'class_enrolments', 'class_sessions', 'attendance', 'progress_records', 'invoices', 'payments', 'credit_notes', 'guardians', 'student_programmes',
  'leave_requests', 'tournaments', 'tournament_categories', 'tournament_entries', 'tournament_matches', 'session_groups', 'booking_requests',
];
const WINDOWED = new Set(['class_sessions', 'attendance']);   // hanya 90 hari terakhir + akan datang
const WINDOW_DAYS = 90;

const eng = () => createEngine(S.t, newId);
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

/* ---------------------------------------------------------------------
   INIT
   --------------------------------------------------------------------- */
export async function init() {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const authType = hashParams.get('type');
  S.needsPassword = ['invite', 'recovery'].includes(authType);

  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    S.mode = 'supabase';
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    S.client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await S.client.auth.getSession();
    S.session = data.session;
    if (S.session) await loadProfile();
    S.client.auth.onAuthStateChange((event, session) => {
      // Elak panggilan Supabase async di dalam callback ini (risiko deadlock).
      S.session = session;
      if (event === 'PASSWORD_RECOVERY') S.needsPassword = true;
      if (event === 'SIGNED_OUT') { S.profile = null; S.t = {}; setTimeout(() => location.reload(), 0); }
    });
  } else {
    S.mode = 'demo';
  }
}

async function loadProfile() {
  const { data, error } = await S.client.from('profiles').select('*').eq('id', S.session.user.id).maybeSingle();
  if (error) throw error;
  S.profile = data;
}

/* ---------------------------------------------------------------------
   AUTH
   --------------------------------------------------------------------- */
export async function signIn(email, password) {
  email = String(email || '').trim();
  if (!email.includes('@')) { let d = email.replace(/\D/g, ''); if (d.startsWith('0')) d = '6' + d; else if (d.startsWith('1')) d = '60' + d; email = d + '@maxxima.app'; }
  const { data, error } = await S.client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  S.session = data.session; await loadProfile();
}
export async function signOut() {
  if (S.mode === 'supabase') await S.client.auth.signOut();
  else { S.profile = null; location.reload(); }
}
export async function resetPassword(email) {
  const { error } = await S.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}
export async function setPassword(password) {
  const { error } = await S.client.auth.updateUser({ password });
  if (error) throw error;
  S.needsPassword = false;
  history.replaceState(null, '', location.pathname);
  if (!S.profile && S.session) await loadProfile();
}
export function demoLogin(role) {
  S.profile = { id: 'demo-' + role, full_name: { admin: 'Doryn (Demo)', coach: 'Coach Alvi (Demo)', parent: 'Ibu Bapa (Demo)' }[role], role, active: true, email: role + '@demo.local' };
}

/* ---------------------------------------------------------------------
   MUAT DATA
   --------------------------------------------------------------------- */
async function fetchAll(table, sinceISO) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = S.client.from(table).select('*');
    if (WINDOWED.has(table)) q = q.gte('session_date', sinceISO);
    if (table === 'notifications') q = q.eq('user_id', S.session.user.id);
    const { data, error } = await q.order(table === 'settings' ? 'key' : 'id').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const PARENT_TABLES = ['settings', 'venues', 'programmes', 'packages', 'student_packages', 'notifications', 'students', 'classes', 'class_enrolments',
  'class_sessions', 'attendance', 'progress_records', 'invoices', 'payments', 'credit_notes', 'parent_tax_info', 'invoice_items', 'booking_requests', 'session_groups'];
/* Portal ibu bapa: RLS hanya memulangkan data anak sendiri. */
export async function loadParent() {
  if (S.mode === 'demo') { if (!S.demo) S.demo = (await import('./demo-seed.js')).makeSeed(); S.t = S.demo; return; }
  const since = addDays(todayISO(), -WINDOW_DAYS), next = {};
  await Promise.all(PARENT_TABLES.map(async t => { next[t] = await fetchAll(t, since); }));
  next.staff = await fetchAll('staff_directory');
  next.profiles = []; next.leads = []; next.trials = [];
  S.t = next;
}

/* Portal coach: RLS hanya memulangkan kelas, sesi dan pelajar yang coach itu ajar. */
const COACH_TABLES = ['trials', 'settings', 'venues', 'programmes', 'staff', 'notifications', 'students', 'classes', 'class_enrolments', 'class_sessions', 'attendance', 'progress_records', 'session_groups', 'leave_requests'];
export async function loadCoach() {
  if (S.mode === 'demo') { if (!S.demo) S.demo = (await import('./demo-seed.js')).makeSeed(); S.t = S.demo; return; }
  const since = addDays(todayISO(), -WINDOW_DAYS), next = {};
  await Promise.all(COACH_TABLES.map(async t => { next[t] = await fetchAll(t, since); }));
  next.profiles = []; next.student_packages = []; next.invoices = []; next.payments = []; next.guardians = [];
  S.t = next;
}

/* Muat sesi + kehadiran untuk julat tarikh di luar tetingkap 90 hari (kalendar). */
const loadedRanges = [];
export async function loadRange(from, to) {
  if (S.mode !== 'supabase') return false;
  const since = addDays(todayISO(), -WINDOW_DAYS);
  if (from >= since || loadedRanges.some(([a, b]) => a <= from && b >= to)) return false;
  const end = to < since ? to : since;
  for (const table of ['class_sessions', 'attendance']) {
    for (let i = 0; ; i += 1000) {
      const { data, error } = await S.client.from(table).select('*').gte('session_date', from).lt('session_date', end).order('id').range(i, i + 999);
      if (error) throw error;
      const have = new Set(S.t[table].map(r => r.id));
      S.t[table].push(...data.filter(r => !have.has(r.id)));
      if (data.length < 1000) break;
    }
  }
  loadedRanges.push([from, to]);
  return true;
}

/* Panggilan RPC (pelayan sahaja). */
export async function rpc(name, args) {
  const { data, error } = await S.client.rpc(name, args || {});
  if (error) throw error;
  return data;
}

export async function loadAll() {
  if (S.mode === 'demo') {
    if (!S.demo) S.demo = (await import('./demo-seed.js')).makeSeed();
    S.t = S.demo; return;
  }
  const since = addDays(todayISO(), -WINDOW_DAYS);
  const next = {};
  await Promise.all(ADMIN_TABLES.map(async t => { next[t] = await fetchAll(t, since); }));
  S.t = next;
}

/* ---------------------------------------------------------------------
   CRUD (cache dikemas kini selepas pelayan berjaya)
   --------------------------------------------------------------------- */
const CHILDREN = {
  students: [['expenses', 'student_id', 'null'], ['guardians', 'student_id', 'cascade'], ['student_programmes', 'student_id', 'cascade'], ['student_packages', 'student_id', 'cascade'], ['class_enrolments', 'student_id', 'cascade'], ['attendance', 'student_id', 'cascade'], ['progress_records', 'student_id', 'cascade'], ['invoices', 'student_id', 'cascade'], ['tournament_entries', 'student_id', 'cascade'], ['tournament_entries', 'partner_id', 'null'], ['booking_requests', 'student_id', 'cascade']],
  classes: [['class_enrolments', 'class_id', 'cascade'], ['class_sessions', 'class_id', 'cascade']],
  class_sessions: [['attendance', 'session_id', 'cascade'], ['session_groups', 'session_id', 'cascade'], ['booking_requests', 'session_id', 'null']],
  leads: [['trials', 'lead_id', 'cascade'], ['students', 'lead_id', 'null']],
  invoices: [['invoice_items', 'invoice_id', 'cascade'], ['credit_notes', 'invoice_id', 'restrict'], ['payments', 'invoice_id', 'cascade'], ['tournament_entries', 'invoice_id', 'null'], ['student_packages', 'invoice_id', 'null']],
  staff: [['classes', 'coach_id', 'null'], ['trials', 'coach_id', 'null'], ['leave_requests', 'staff_id', 'cascade'], ['class_sessions', 'coach_id', 'null'], ['session_groups', 'coach_id', 'null']],
  tournaments: [['tournament_categories', 'tournament_id', 'cascade']],
  tournament_categories: [['tournament_entries', 'category_id', 'cascade'], ['tournament_matches', 'category_id', 'cascade']],
  tournament_entries: [['tournament_matches', 'entry_a', 'null'], ['tournament_matches', 'entry_b', 'null'], ['tournament_matches', 'winner', 'null']],
  venues: [['expenses', 'venue_id', 'null'], ['classes', 'venue_id', 'cascade'], ['trials', 'venue_id', 'null'], ['leads', 'venue_id', 'null'], ['students', 'venue_id', 'null'], ['tournaments', 'venue_id', 'null']],
  programmes: [['classes', 'programme_id', 'restrict'], ['student_packages', 'programme_id', 'restrict'], ['packages', 'programme_id', 'cascade'], ['leads', 'programme_id', 'null'], ['students', 'programme_id', 'null']],
  packages: [['student_packages', 'package_id', 'null']],
  student_packages: [['attendance', 'student_package_id', 'null'], ['student_packages', 'renewal_of', 'null']],
};

function cleanupChildren(table, id) {
  for (const [child, col, kind] of CHILDREN[table] || []) {
    const rows = (S.t[child] || []).filter(r => r[col] === id);
    if (!rows.length) continue;
    if (kind === 'cascade') { const ids = rows.map(r => r.id); S.t[child] = S.t[child].filter(r => r[col] !== id); ids.forEach(cid => cleanupChildren(child, cid)); }
    else rows.forEach(r => { r[col] = null; });
  }
}

function demoPrepare(table, r) {
  r.id ??= newId();
  if (table === 'invoices') {
    r.number ??= eng().nextInvoiceNo();
    r.status ??= 'issued'; r.issued_on ??= todayISO(); r.due_date ??= addDays(todayISO(), 7); r.kind ??= 'package';
  }
  if (table === 'credit_notes') { r.issued_on ??= todayISO(); r.number ??= 'MBA-CN-' + r.issued_on.replace(/-/g, '') + '-' + String(S.t.credit_notes.length + 1).padStart(4, '0'); }
  if (table === 'attendance') { r.session_date ??= S.t.class_sessions.find(s => s.id === r.session_id)?.session_date; r.student_package_id ??= null; eng().assign(r); }
  if (table === 'payments') eng().paymentBefore(r);
  if (table === 'student_packages') { r.status ??= 'pending'; r.sessions_used ??= 0; r.renewal_sent ??= false; r.invoice_id ??= null; r.renewal_of ??= null; }
  if (table === 'students') r.status ??= 'pending';
  if (table === 'leads') r.status ??= 'new';
  if (table === 'class_sessions') r.status ??= 'scheduled';
  if (table === 'booking_requests') { r.status ??= 'new'; r.pref_days ??= []; }
  if (table === 'tournament_entries') r.status ??= 'registered';
  if (table === 'tournament_matches') r.status ??= 'pending';
  if (table === 'tournaments') r.status ??= 'draft';
  r.created_at ??= new Date().toISOString();
  return r;
}
function demoAfterInsert(table, r) {
  const e = eng();
  if (table === 'credit_notes') { const inv = S.t.invoices.find(i => i.id === r.invoice_id), tot = S.t.credit_notes.filter(c => c.invoice_id === r.invoice_id).reduce((t, c) => t + Number(c.amount), 0); if (inv && tot >= Number(inv.amount) && inv.status === 'issued') inv.status = 'void'; }
  if (table === 'payments') e.applyPayment(r, null, true);
  if (table === 'attendance') e.attendanceAfter(null, r);
  if (table === 'invoices') e.invoiceCreated(r);
}

/* Supabase: trigger pelayan mengubah jadual lain; muat semula jadual yang terjejas. */
const AFFECTS = { credit_notes: ['invoices'], attendance: ['student_packages', 'invoices', 'notifications'], payments: ['student_packages', 'invoices', 'payments', 'attendance', 'notifications'], class_sessions: ['attendance', 'notifications'], invoices: ['notifications'] };
export async function refresh(names) {
  if (S.mode !== 'supabase') return;
  const since = addDays(todayISO(), -WINDOW_DAYS);
  await Promise.all([...new Set(names)].map(async n => { S.t[n] = await fetchAll(n, since); }));
}

export async function insert(table, rows) {
  const many = Array.isArray(rows);
  let arr = many ? rows : [rows];
  if (!arr.length) return many ? [] : null;
  S.t[table] ||= [];
  if (S.mode === 'demo') {
    arr = arr.map(r => demoPrepare(table, { ...r }));
    S.t[table].push(...arr); arr.forEach(r => demoAfterInsert(table, r));
    return many ? arr : arr[0];
  }
  const out = [];
  for (let i = 0; i < arr.length; i += 200) {
    const { data, error } = await S.client.from(table).insert(arr.slice(i, i + 200)).select();
    if (error) throw error;
    out.push(...data);
  }
  S.t[table].push(...out);
  if (AFFECTS[table]) await refresh(AFFECTS[table]);
  return many ? out : out[0];
}

export async function update(table, id, patch) {
  const row = S.t[table].find(r => r.id === id);
  if (S.mode === 'demo') {
    const old = { ...row }, e = eng();
    Object.assign(row, patch);
    if (table === 'attendance') { if ('status' in patch) e.assign(row); e.attendanceAfter(old, row); }
    if (table === 'payments' && 'status' in patch) { e.paymentBefore(row); e.applyPayment(row, old.status, false); }
    if (table === 'class_sessions' && patch.status === 'cancelled' && old.status !== 'cancelled') e.sessionCancelled(row);
    return row;
  }
  const { data, error } = await S.client.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  if (row) Object.assign(row, data); else S.t[table].push(data);
  if (AFFECTS[table] && (table !== 'class_sessions' || patch.status === 'cancelled')) await refresh(AFFECTS[table]);
  return row || data;
}

export async function remove(table, id) {
  const old = S.t[table].find(r => r.id === id);
  if (S.mode === 'demo') {
    const blocked = (CHILDREN[table] || []).find(([child, col, kind]) => kind === 'restrict' && S.t[child].some(r => r[col] === id));
    if (blocked) throw new Error('Rekod ini masih digunakan di tempat lain (masih digunakan oleh ' + blocked[0] + ').');
  } else {
    const { error } = await S.client.from(table).delete().eq('id', id);
    if (error) throw error;
  }
  cleanupChildren(table, id);
  S.t[table] = S.t[table].filter(r => r.id !== id);
  if (table === 'attendance' && old) { if (S.mode === 'demo') eng().attendanceAfter(old, null); else await refresh(['student_packages']); }
}

/* Luput pakej (admin): pakej aktif melepasi tarikh tamat -> 'expired'. */
export async function expirePackages() {
  if (S.mode === 'demo') return eng().expirePackages();
  const { data, error } = await S.client.rpc('expire_packages');
  if (error) throw error;
  if (data) await refresh(['student_packages']);
  return data;
}

/* Notifikasi sendiri */
export async function markRead(ids) {
  const list = S.t.notifications.filter(n => ids.includes(n.id) && !n.read_at);
  if (!list.length) return;
  const at = new Date().toISOString();
  if (S.mode === 'supabase') { const { error } = await S.client.from('notifications').update({ read_at: at }).in('id', list.map(n => n.id)); if (error) throw error; }
  list.forEach(n => { n.read_at = at; });
}
export function subscribeNotifications(onNew) {
  if (S.mode !== 'supabase' || S.notifChannel) return;
  S.notifChannel = S.client.channel('notif-' + S.session.user.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${S.session.user.id}` },
      p => { if (!S.t.notifications.some(n => n.id === p.new.id)) S.t.notifications.unshift(p.new); onNew?.(p.new); })
    .subscribe();
}

/* Simpan tetapan JSON (jadual settings: key -> value) */
export async function saveSetting(key, value) {
  const existing = S.t.settings.find(s => s.key === key);
  if (S.mode === 'demo') { if (existing) existing.value = value; else S.t.settings.push({ key, value }); return; }
  const { error } = await S.client.from('settings').upsert({ key, value });
  if (error) throw error;
  if (existing) existing.value = value; else S.t.settings.push({ key, value });
}
export const setting = (key, fallback = {}) => S.t.settings?.find(s => s.key === key)?.value ?? fallback;

/* Jemput pengguna melalui Edge Function (kunci service-role kekal di pelayan) */
export async function inviteUser(payload) {
  if (S.mode === 'demo') {
    const id = newId();
    S.t.profiles.push({ id, full_name: payload.full_name || '', email: payload.email, role: payload.role, active: true, created_at: new Date().toISOString() });
    (payload.student_ids || []).forEach(sid => { const st = S.t.students.find(s => s.id === sid); if (st) st.guardian_id = id; });
    if (payload.staff_id) { const sf = S.t.staff.find(s => s.id === payload.staff_id); if (sf) sf.profile_id = id; }
    return { ok: true };
  }
  const { data, error } = await S.client.functions.invoke('invite-user', { body: { ...payload, redirect_to: location.origin + location.pathname } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* abaikan */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  // muat semula profil, pelajar & staf yang terjejas
  for (const t of ['profiles', 'students', 'staff']) S.t[t] = await fetchAll(t, '');
  return data;
}
