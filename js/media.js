// Muat naik & paparan media (gambar / video) ke Supabase Storage.
// public-media  : gambar pengumuman & poster kejohanan (awam)
// progress-media: gambar / video progres anak (persendirian — URL bertandatangan)
import { S } from './data.js';
import { CONFIG } from './config.js';

const DEMO = new Map();      // mod demo: laluan -> object URL
const SIGNED = new Map();    // cache URL bertandatangan

/** Kecilkan gambar sebelum muat naik (jimat storan & data mudah alih). */
export async function shrinkImage(file, max = 1600, q = 0.82) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 350 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

const safe = n => String(n || 'fail').toLowerCase().replace(/[^\w.\-]+/g, '_').slice(-60);
export async function uploadMedia(bucket, folder, file, { maxMB = 10 } = {}) {
  if (!file || !file.size) return null;
  if (file.type.startsWith('image/')) file = await shrinkImage(file);
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Fail terlalu besar (maksimum ${maxMB}MB).`);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe(file.name)}`;
  if (S.mode !== 'supabase') { DEMO.set(path, URL.createObjectURL(file)); return path; }
  const { error } = await S.client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
export function publicUrl(path) {
  if (!path) return '';
  if (DEMO.has(path)) return DEMO.get(path);
  if (/^https?:/.test(path)) return path;
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/public-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}
/** URL bertandatangan (1 jam) untuk media progres persendirian. */
export async function privateUrl(path) {
  if (!path) return '';
  if (DEMO.has(path)) return DEMO.get(path);
  const c = SIGNED.get(path); if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await S.client.storage.from('progress-media').createSignedUrl(path, 3600);
  if (error) { console.warn(error); return ''; }
  SIGNED.set(path, { url: data.signedUrl, exp: Date.now() + 3500 * 1000 });
  return data.signedUrl;
}
/** Isi <img data-pmedia> / <video data-pmedia> selepas render. */
export function hydratePrivate(root = document) {
  root.querySelectorAll('[data-pmedia]:not([src])').forEach(async el => { const u = await privateUrl(el.dataset.pmedia); if (u) el.src = u; });
}
export const isVideo = m => /^video\//.test(m?.type || '') || /\.(mp4|mov|webm)$/i.test(m?.path || '');
if (typeof document !== 'undefined' && document.body) {
  let q = false;
  new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; hydratePrivate(); }); }).observe(document.body, { childList: true, subtree: true });
}
const escA = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Grid gambar/video progres (persendirian) */
export function mediaGrid(list) {
  const m = Array.isArray(list) ? list : []; if (!m.length) return '';
  return `<div class="media-grid">${m.map(x => isVideo(x) ? `<video controls playsinline preload="metadata" data-pmedia="${escA(x.path)}"></video>` : `<a href="javascript:void 0" onclick="this.querySelector('img').src&&window.open(this.querySelector('img').src,'_blank')"><img loading="lazy" alt="" data-pmedia="${escA(x.path)}"></a>`).join('')}</div>`;
}

/* Avatar bergambar: staf (public-media) atau pelajar (progress-media, persendirian). */
const escP = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ini = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
export function photoAvatar(name, path, { priv = false, cls = '', size } = {}) {
  const st = size ? `width:${size}px;height:${size}px;` : '';
  if (!path) return `<div class="avatar ${cls}" style="${st}">${escP(ini(name))}</div>`;
  return `<div class="avatar ${cls}" style="${st}padding:0;overflow:hidden"><img alt="" style="width:100%;height:100%;object-fit:cover" ${priv ? `data-pmedia="${escP(path)}"` : `src="${escP(publicUrl(path))}"`}></div>`;
}
