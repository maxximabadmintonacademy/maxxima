/* =====================================================================
   PASANG APP (PWA) — kad "Pasang app di skrin utama" untuk portal coach & ibu bapa.
   • Chrome/Android: butang Pasang terus (beforeinstallprompt)
   • iPhone/iPad: langkah Safari → Kongsi → Add to Home Screen
   • Sudah dipasang: tunjuk ✓
   ===================================================================== */
import { t } from './i18n.js';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const inApp = () => /FBAN|FBAV|Instagram|Line\/|WhatsApp|wv\)/i.test(navigator.userAgent);   // pelayar dalam app (WhatsApp/FB) tidak boleh pasang

export function installCard({ compact = false } = {}) {
  if (standalone()) return compact ? '' : `<div class="card card-pad mb"><b>📲 ${t('App Maxxima')}</b><div class="muted" style="margin-top:6px;font-size:13px">✓ ${t('App sudah dipasang di skrin utama. Anda kekal log masuk sehingga menekan "Log keluar".')}</div></div>`;
  const steps = inApp()
    ? `<ol class="tour-steps" style="margin-top:8px"><li>${t('Anda membuka pautan dari WhatsApp/Facebook. Tekan menu')} <b>⋮</b> ${t('atau')} <b>⋯</b></li><li>${t('Pilih "Buka dalam Chrome" / "Open in Safari"')}</li><li>${t('Kemudian pasang app dari situ')}</li></ol>`
    : window.__installPrompt ? ''
    : isIOS()
      ? `<ol class="tour-steps" style="margin-top:8px"><li>${t('Buka pautan ini dalam Safari')}</li><li>${t('Tekan butang Kongsi')} <b>⬆︎</b> ${t('(bawah skrin)')}</li><li>${t('Pilih "Add to Home Screen" / "Tambah ke Skrin Utama"')}</li></ol>`
      : `<ol class="tour-steps" style="margin-top:8px"><li>${t('Tekan menu')} <b>⋮</b> ${t('di Chrome (atas kanan)')}</li><li>${t('Pilih "Install app" / "Tambah ke skrin utama"')}</li><li>${t('Buka app Maxxima dari skrin utama')}</li></ol>`;
  return `<div class="card card-pad mb" style="border-left:4px solid var(--brand)"><div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
    <div style="flex:1;min-width:200px"><b>📲 ${t('Pasang app di skrin utama')}</b><div class="muted" style="margin-top:4px;font-size:13px">${t('Buka terus seperti app biasa, terima notifikasi, dan tidak perlu log masuk semula setiap kali.')}</div></div>
    ${window.__installPrompt && !inApp() ? `<button class="btn primary" data-action="pwa-install">📲 ${t('Pasang sekarang')}</button>` : ''}${compact ? `<button class="btn sm" data-action="install-hide" aria-label="${t('Tutup')}">✕</button>` : ''}</div>${steps}</div>`;
}

/** Banner kecil di halaman utama (boleh ditutup 14 hari). */
export function installBanner() {
  try { if (standalone() || Number(localStorage.getItem('mx_install_hide') || 0) > Date.now()) return ''; } catch (_) { if (standalone()) return ''; }
  return installCard({ compact: true });
}
import { ACTIONS } from './registry.js';
ACTIONS['install-hide'] = () => { try { localStorage.setItem('mx_install_hide', String(Date.now() + 14 * 864e5)); } catch (_) {} import('./ui.js').then(m => m.app.render?.()); };
