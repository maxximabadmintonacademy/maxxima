/* =====================================================================
   NOTIS VERSI BAHARU — semua portal (admin, coach, ibu bapa).
   Setiap 5 minit & bila app dibuka semula, semak version.json di GitHub.
   Jika berbeza daripada APP_VERSION → bar "Muat semula" (tidak muat semula sendiri,
   supaya borang yang sedang diisi tidak hilang). Log masuk kekal — tak perlu log masuk semula.
   ===================================================================== */
import { APP_VERSION } from './ui.js';

let shown = false, last = 0;
async function check(force) {
  if (shown || location.protocol !== 'https:' && !force) return;
  if (!force && Date.now() - last < 60_000) return; last = Date.now();
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return;
    const v = (await r.json())?.v; if (v && v !== APP_VERSION) show(v);
  } catch (_) { /* luar talian — cuba lagi nanti */ }
}
export async function hardReload() {
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (_) {}
  try { const rs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((rs || []).map(r => r.update().catch(() => {}))); } catch (_) {}
  location.replace(location.pathname + '?v=' + Date.now() + location.hash);
}
function show(v) {
  shown = true;
  const en = /^(en|zh)/.test(document.documentElement.lang || '');
  const bar = document.createElement('div');
  bar.id = 'updBar'; bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:9999;max-width:min(560px,calc(100vw - 24px));width:max-content;display:flex;gap:10px;align-items:center;padding:10px 12px 10px 16px;border-radius:14px;background:#0B2545;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.28);font-size:14px;line-height:1.35';
  bar.innerHTML = `<span style="flex:1"><b>${en ? 'New version available' : 'Versi baharu tersedia'}</b> (${v})<br><span style="opacity:.8;font-size:12.5px">${en ? 'Tap refresh to update — you stay logged in.' : 'Tekan muat semula untuk kemas kini — tidak perlu log masuk semula.'}</span></span>
    <button type="button" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#F4C430;color:#0B2545;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap">${en ? 'Refresh' : 'Muat semula'}</button>
    <button type="button" aria-label="Tutup" style="height:40px;width:34px;border:0;background:transparent;color:#fff;opacity:.7;font-size:20px;cursor:pointer">×</button>`;
  const [go, x] = bar.querySelectorAll('button');
  go.onclick = () => { go.disabled = true; go.textContent = '…'; hardReload(); };
  x.onclick = () => { bar.remove(); shown = false; last = Date.now() + 25 * 60_000; };   // tanya semula ~30 minit kemudian
  document.body.appendChild(bar);
}
export function startUpdateCheck() {
  setTimeout(() => check(), 8000);
  setInterval(() => check(), 5 * 60_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', () => check());
}
