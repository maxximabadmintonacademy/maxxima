// v25: Panduan pengenalan (onboarding tour) untuk portal ibu bapa & coach —
// slaid ciri utama + pasang app ke skrin utama + hidupkan notifikasi. Dipapar sekali; boleh dibuka semula dari Akaun.
import { ACTIONS } from './registry.js';
import { t } from './i18n.js';
import { app, toast } from './ui.js';
import { ensurePush } from './data.js';

const KEY = r => `mx_tour_${r}_v1`;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const SLIDES = {
  parent: [
    ['👋', 'Selamat datang ke Portal Ibu Bapa', 'Semua tentang latihan anak anda di satu tempat — jadual, pakej, bayaran dan progres.'],
    ['🏠', 'Utama', 'Lihat sesi seterusnya, baki sesi pakej, tarikh tamat pakej dan pengumuman akademi.'],
    ['📅', 'Jadual & Tempah', 'Semak jadual kelas, tempah sesi (pakej fleksibel), mohon cuti atau masuk senarai menunggu kelas penuh.'],
    ['💳', 'Yuran', 'Lihat invois, bayar melalui QR / FPX dan muat naik bukti. Resit & invois boleh dimuat turun sebagai PDF.'],
    ['📈', 'Progres', 'Nota coach, gambar & video latihan, laporan bulanan dan sijil kejohanan anak anda.'],
    ['⭐', 'Maklum balas', 'Selepas sesi, beri bintang dan komen — coach & admin membacanya untuk menambah baik latihan.'],
    ['install'], ['notif'],
  ],
  coach: [
    ['👋', 'Selamat datang ke Portal Coach', 'Jadual, kehadiran, pelajar dan pelan latihan anda — terus dari telefon.'],
    ['🏸', 'Hari Ini', 'Sesi anda hari ini. Tekan sesi → tanda kehadiran (Semua hadir / ikut pelajar) dan tulis nota latihan.'],
    ['👧', 'Pelajar', 'Lihat profil & nota kesihatan ⚕, tambah progres dengan gambar atau video. Ibu bapa nampak di portal mereka.'],
    ['📝', 'Pelan Latihan', 'Rancang warm up, footwork, feeding & sparring. Salin templat dan pautkan ke sesi.'],
    ['🗓️', 'Akaun', 'Isi hari & masa anda tersedia, maklumat bank (untuk gaji) dan kenalan kecemasan. Hanya anda & admin boleh lihat.'],
    ['install'], ['notif'],
  ],
};

function slideHtml(s) {
  if (s[0] === 'install') {
    const done = standalone();
    return `<div class="tour-ico">📲</div><h3>${t('Pasang app di skrin utama')}</h3>
      ${done ? `<p>${t('App sudah dipasang ✓ Anda kekal log masuk sehingga menekan "Log keluar".')}</p>` : `<p>${t('Buka app terus dari skrin utama seperti app biasa — tidak perlu log masuk semula setiap kali.')}</p>
      ${window.__installPrompt ? `<button class="btn primary" data-action="pwa-install">${t('Pasang sekarang')}</button>` : isIOS()
        ? `<ol class="tour-steps"><li>${t('Buka pautan ini dalam Safari')}</li><li>${t('Tekan butang Kongsi')} <b>⬆︎</b></li><li>${t('Pilih "Add to Home Screen" / "Tambah ke Skrin Utama"')}</li></ol>`
        : `<ol class="tour-steps"><li>${t('Tekan menu')} <b>⋮</b> ${t('di Chrome (atas kanan)')}</li><li>${t('Pilih "Install app" / "Tambah ke skrin utama"')}</li><li>${t('Buka app Maxxima dari skrin utama')}</li></ol>`}`}`;
  }
  if (s[0] === 'notif') {
    const P = 'Notification' in window ? Notification.permission : 'na';
    return `<div class="tour-ico">🔔</div><h3>${t('Hidupkan notifikasi')}</h3>
      <p>${t('Dapatkan makluman segera: pengumuman, perubahan jadual, invois & peringatan pakej.')}</p>
      ${P === 'granted' ? `<p class="tour-ok">✓ ${t('Notifikasi sudah dihidupkan')}</p>` : P === 'denied'
        ? `<ol class="tour-steps"><li>${t('Notifikasi disekat. Buka Tetapan telefon → Apps → Chrome (atau app Maxxima) → Notifikasi')}</li><li>${t('Benarkan notifikasi, kemudian buka semula app')}</li></ol>`
        : P === 'na' ? `<p class="muted">${isIOS() ? t('Di iPhone: pasang app ke skrin utama dahulu (iOS 16.4+), kemudian buka app untuk menghidupkan notifikasi.') : t('Pelayar ini tidak menyokong notifikasi.')}</p>`
        : `<button class="btn primary" data-action="tour-notif">${t('Benarkan notifikasi')}</button>`}`;
  }
  return `<div class="tour-ico">${s[0]}</div><h3>${t(s[1])}</h3><p>${t(s[2])}</p>`;
}

let cur = null;
function draw() {
  const { el, list, i } = cur;
  el.querySelector('.tour-body').innerHTML = slideHtml(list[i]);
  el.querySelector('.tour-dots').innerHTML = list.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('');
  el.querySelector('[data-tv=prev]').style.visibility = i ? 'visible' : 'hidden';
  el.querySelector('[data-tv=next]').textContent = i === list.length - 1 ? t('Mula guna app') : t('Seterusnya →');
}
function close() { if (!cur) return; try { localStorage.setItem(KEY(cur.role), '1'); } catch { /* abaikan */ } const cb = cur.onClose; cur.el.remove(); cur = null; app.render?.(); cb?.(); }

export function showTour(role, force = false, onClose = null) {
  if (cur || !SLIDES[role]) return false;
  if (!force) { try { if (localStorage.getItem(KEY(role))) return false; } catch { return false; } }
  if (!force && navigator.webdriver && !/[?&]tour/.test(location.search)) return false;   // ujian automatik
  const el = document.createElement('div'); el.className = 'tour';
  el.innerHTML = `<div class="tour-card" role="dialog" aria-modal="true"><button class="tour-x" data-tv="skip" aria-label="Tutup">✕</button><div class="tour-body"></div><div class="tour-dots"></div>
    <div class="tour-nav"><button class="btn" data-tv="prev">← ${t('Kembali')}</button><button class="btn primary" data-tv="next"></button></div></div>`;
  document.body.appendChild(el);
  cur = { el, role, list: SLIDES[role], i: 0, onClose };
  el.addEventListener('click', e => { const b = e.target.closest('[data-tv]'); if (!b) return;
    const k = b.dataset.tv; if (k === 'skip') return close();
    if (k === 'prev') cur.i = Math.max(0, cur.i - 1); else if (cur.i >= cur.list.length - 1) return close(); else cur.i++;
    draw(); });
  let x0 = null; el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) < 50) return; cur.i = Math.min(cur.list.length - 1, Math.max(0, cur.i + (dx < 0 ? 1 : -1))); draw(); });
  draw();
  return true;
}

ACTIONS['tour-open'] = role => showTour(role, true);
ACTIONS['tour-notif'] = async () => { try { const r = await Notification.requestPermission(); if (r === 'granted') ensurePush(); toast(r === 'granted' ? t('Notifikasi dihidupkan ✓') : t('Notifikasi tidak dibenarkan oleh pelayar'), r !== 'granted'); } catch { /* abaikan */ } if (cur) draw(); };
window.addEventListener('beforeinstallprompt', () => { if (cur) setTimeout(draw, 0); });
