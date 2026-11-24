import { CONFIG } from './config.js';
import './theme.js';

const root = document.querySelector('#reg');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const by = id => document.getElementById(id);
const portalToken = new URLSearchParams(location.hash.slice(1)).get('reservation');
const demo = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const header = '<div class="reg-top"><div class="auth-brand" style="margin:0"><div class="brand-mark"><img src="assets/logo.png" alt="" class="brand-img"></div><div><div class="brand-name" style="color:var(--ink)">MAXXIMA</div><div class="brand-sub">Badminton Academy</div></div></div></div>';
const levelOptions = [['new', 'Beginner · new to badminton'], ['rally', 'Some experience · can rally'], ['match', 'Competitive · plays matches'], ['unsure', 'Not sure']];
const dateLabel = date => Intl.DateTimeFormat('en-MY', {dateStyle:'full',timeZone:'UTC'}).format(new Date(date + 'T00:00:00Z'));
const localDate = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kuala_Lumpur'}).format(new Date());
const label = v => v ? esc(v) : 'To be confirmed';
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
  root.innerHTML = header + '<h1>Trial Portal</h1><p class="muted" role="status">Checking the latest class details…</p>';
  if (!/^[a-f0-9]{64}$/.test(token)) return showExpired();
  let reservation;
  try { reservation = await rpc('shared_trial_portal',{p_token:token}); }
  catch {
    root.innerHTML = header + '<h1>Trial Portal</h1><p role="alert">We couldn’t load your latest trial details. Please try again.</p><button class="btn" id="refresh" type="button">Try again</button>';
    by('refresh').onclick = () => showPortal(token); return;
  }
  if (!reservation) return showExpired();
  const r = reservation, cancelled = r.status === 'cancelled';
  const statuses = {confirmed:'Confirmed',cancelled:'Cancelled',completed:'Completed',not_attended:'Not attended',past:'Session date passed'};
  root.innerHTML = header + `<h1>Trial Portal</h1>
    ${demo ? '<p class="hint warn">Demo only. No booking was made.</p>' : ''}
    <p class="hint ${cancelled ? 'warn' : ''}" role="status"><b>${statuses[r.status] || 'Contact admin'}</b>${cancelled ? ' · Please do not travel to this session. Contact us for another slot.' : ''}</p>
    <dl><dt>Date</dt><dd>${esc(dateLabel(r.date))}</dd><dt>Time (Malaysia)</dt><dd>${label(r.start)}${r.end ? '–' + esc(r.end) : ''}</dd>
    <dt>Venue</dt><dd>${label(r.venue)}</dd><dt>Programme</dt><dd>${label(r.programme)}</dd>
    ${cancelled ? '' : '<dt>Court</dt><dd>' + label(r.court) + '</dd>'}</dl>
    ${r.status === 'confirmed' ? '<p>Bring a racket (if available), non-marking sports shoes and water. Please arrive 10 minutes early.</p>' : ''}
    <p class="muted">Save this private link and reopen it before class to check for updates. The link expires after your trial and is not a push notification.</p>
    <div class="actions"><button class="btn primary" id="copy-portal" type="button">Copy private link</button><button class="btn" id="refresh" type="button">Refresh details</button>
      <a class="btn" href="${wa}" target="_blank" rel="noopener noreferrer">Contact Maxxima</a></div>`;
  by('refresh').onclick = () => showPortal(token);
  by('copy-portal').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); by('copy-portal').textContent = 'Link copied'; }
    catch { by('copy-portal').textContent = 'Copy the link from your address bar'; }
  };
}
function showExpired() {
  root.innerHTML = header + `<h1>Trial Portal</h1><p>This trial link is invalid or has expired. <a href="${wa}" target="_blank" rel="noopener noreferrer">Contact Maxxima</a> for help.</p>`;
}

async function showForm() {
  const venues = await rpc('shared_trial_venues');
  root.innerHTML = header + `<h1>Book a Free Group Trial</h1>
    <p class="muted">Choose an available session based on the player’s age, venue and badminton experience.</p>
    ${demo ? '<p class="hint warn">Demo only. Information is not saved and no booking is made.</p>' : ''}
    <form id="shared-trial">
      <h3>1. Find a suitable slot</h3>
      <div class="form-grid">
        <label class="f">Student’s date of birth<input name="birth" type="date" max="${localDate()}" required><small>Used to match the age group.</small></label>
        <label class="f">Training venue<select name="venue" required><option value="">Select a venue</option>${(venues || []).map(v => '<option value="' + esc(v.id) + '">' + esc(v.name) + '</option>').join('')}</select></label>
        <label class="f full">Current badminton level<select name="level" required><option value="">Select a level</option>${levelOptions.map(([k,v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('')}</select></label>
      </div>
      <div id="trial-slots" class="slots" role="status" aria-live="polite" style="margin-top:12px">Enter all three details to see available slots.</div>
      <h3>2. Add your details</h3>
      <div class="form-grid">
        <label class="f full">Student’s full name<input name="child" minlength="2" maxlength="120" required></label>
        <label class="f">Parent/guardian or adult player’s name<input name="guardian" minlength="2" maxlength="120" required></label>
        <label class="f">WhatsApp number<input name="phone" type="tel" maxlength="25" autocomplete="tel" required></label>
      </div>
      <label class="consent"><input type="checkbox" name="consent" required><span>I agree that Maxxima may use these details to arrange the trial and contact me about it. <a href="privacy.html" target="_blank" rel="noopener">Privacy notice</a></span></label>
      <p id="trial-error" role="alert"></p>
      <button class="btn primary lg" type="submit" disabled style="width:100%;margin-top:8px">Confirm Trial Slot</button>
    </form>`;
  const f = by('shared-trial'), fields = f.elements, warning = by('trial-error'), list = by('trial-slots'), submit = f.querySelector('[type=submit]');
  let revision = 0, choices = [], token, busy = false;
  async function loadSlots() {
    const v = ++revision;
    choices = []; submit.disabled = true; warning.textContent = '';
    if (!fields.birth.validity.valid || !fields.venue.value || !fields.level.value) {
      list.textContent = 'Enter all three details to see available slots.'; return;
    }
    list.textContent = 'Looking for suitable slots…';
    try {
      const slots = await rpc('shared_trial_slots',{p_birth:fields.birth.value,p_venue:fields.venue.value,p_level:fields.level.value});
      if (v !== revision) return;
      choices = slots || [];
      list.innerHTML = choices.map((s,i) => `<label class="slot-r"><input required type="radio" name="slot" value="${i}"><span>
        <b>${esc(dateLabel(s.date))} · ${esc(s.start)}–${esc(s.end)}</b><small>${esc(s.programme)} · ${esc(s.venue)}</small></span></label>`).join('') ||
        `<p>No suitable slots at this venue in the next 3 weeks. Try another venue or <a href="${wa}" target="_blank" rel="noopener noreferrer">ask admin for help</a>.</p>`;
    } catch {
      if (v !== revision) return;
      list.innerHTML = '<p>We couldn’t load slots. <button type="button" class="btn sm" id="retry-slots">Try again</button></p>';
      by('retry-slots').onclick = loadSlots;
    }
  }
  for (const k of ['birth','venue','level']) fields[k].addEventListener('change',loadSlots);
  list.addEventListener('change', () => { if (!busy) submit.disabled = !f.querySelector('[name=slot]:checked'); });
  f.onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const picked = f.querySelector('[name=slot]:checked'), s = picked && choices[Number(picked.value)];
    if (!s) return;
    const child = fields.child.value.trim(), guardian = fields.guardian.value.trim(), phone = fields.phone.value.trim();
    if (child.length < 2 || guardian.length < 2) { warning.textContent = 'Please enter both names.'; return; }
    if (!/^\d{9,15}$/.test(phone.replace(/\D/g,''))) { warning.textContent = 'Enter a valid WhatsApp number including area code.'; return; }
    if (!token) token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
    busy = true; warning.textContent = '';
    const payload = {token,child,guardian,phone,birth:fields.birth.value,venue:fields.venue.value,level:fields.level.value,class_id:s.class_id,date:s.date,consent:fields.consent.checked};
    Array.from(fields).forEach(el => el.disabled = true);
    let outcome;
    try { outcome = await rpc('shared_trial_book',{p:payload}); }
    catch { warning.textContent = 'We could not confirm the booking. Try again to check whether it went through.'; }
    if (outcome?.ok) {
      if (demo) demoBooking = {...s,status:'confirmed',court:null};
      history.replaceState(null,'','#reservation=' + token);
      await showPortal(token);
      return;
    }
    busy = false;
    Array.from(fields).forEach(el => el.disabled = false);
    if (outcome?.code === 'slot_unavailable') {
      await loadSlots(); warning.textContent = 'That slot is no longer available. Choose another.';
    } else if (outcome?.code === 'duplicate') {
      warning.textContent = 'A trial is already on file for these details. Contact Maxxima for help.';
    } else if (outcome) {
      warning.textContent = 'Please check the form details or contact Maxxima for help.';
    }
  };
  if (!(venues || []).length) warning.textContent = 'No venues are taking online trial bookings right now. Please contact Maxxima.';
}

(async () => {
  document.documentElement.lang = 'en';
  try {
    if (!demo) {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client = createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:false}});
    }
    if (portalToken !== null) await showPortal(portalToken);
    else await showForm();
  } catch {
    root.innerHTML = header + `<h1>Book a Free Group Trial</h1><p>Online trial booking is currently unavailable. <a href="${wa}" target="_blank" rel="noopener noreferrer">Contact Maxxima on WhatsApp</a> to arrange a trial.</p>`;
  }
})();
