// Pemapar dokumen dalam app (invois, resit, sijil, laporan) — ada butang Kembali, Cetak/PDF & Muat turun.
// Penting untuk app di skrin utama (PWA): tetingkap baharu tiada butang kembali.
import { t } from './i18n.js';

let open = null;
function close(fromPop) {
  if (!open) return;
  const o = open; open = null; o.el.remove(); document.body.style.overflow = '';
  setTimeout(() => URL.revokeObjectURL(o.url), 1000);
  if (!fromPop && history.state?.mxDoc) history.back();
}
window.addEventListener('popstate', () => { if (open) close(true); });

export function openDoc(html, filename = 'dokumen.html') {
  close(true);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const el = document.createElement('div');
  el.className = 'docview';
  el.innerHTML = `<div class="docview-bar"><button type="button" class="btn" data-dv="back">← ${t('Kembali')}</button><span class="grow"></span>
    <button type="button" class="btn primary" data-dv="print">${t('Cetak / PDF')}</button><a class="btn" data-dv="dl" href="${url}" download="${filename}">${t('Muat turun')}</a>
    <a class="btn hide-m" href="${url}" target="_blank" rel="noopener">${t('Tab baharu')}</a></div><iframe title="doc"></iframe>`;
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  const fr = el.querySelector('iframe');
  // Muatkan dokumen A4 ke lebar skrin telefon (paparan sahaja — cetakan kekal saiz A4)
  fr.onload = () => { try { const d = fr.contentDocument, w = d.documentElement.scrollWidth, W = fr.clientWidth;
    if (w > W + 4) { const st = d.createElement('style'); st.textContent = `@media screen{html{zoom:${(W / w).toFixed(3)}}}`; d.head.appendChild(st); } } catch { /* abaikan */ } };
  fr.srcdoc = html;
  el.querySelector('[data-dv=back]').onclick = () => close();
  el.querySelector('[data-dv=print]').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { window.open(url, '_blank'); } };
  open = { el, url };
  history.pushState({ mxDoc: 1 }, '');
}
export const closeDoc = () => close();
