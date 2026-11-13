// v26: Portal ibu bapa — tetapan peringatan sesi (50 jam & 2 jam sebelum) + status notifikasi push.
import { INPUTS } from '../registry.js';
import { S, rpc, ensurePush } from '../data.js';
import { t } from '../i18n.js';
import { toast } from '../ui.js';

const POL = () => ({ notice_hours: 48, ...((S.t.settings || []).find(x => x.key === 'policy')?.value || {}) });
export function remindCard() {
  const off = new Set(S.profile.notify_off || []), n = POL().notice_hours;
  const perm = 'Notification' in window ? Notification.permission : 'na';
  const row = (k, l, sub) => `<label class="rem-row"><div><b>${l}</b><div class="muted" style="font-size:12.5px">${sub}</div></div><input type="checkbox" class="switch" data-on-change="p-rem-tog" data-key="${k}" ${off.has(k) ? '' : 'checked'}></label>`;
  return `<div class="card card-pad mb"><b>🔔 ${t('Peringatan sesi')}</b>
    ${row('remind50', t('{n} jam sebelum sesi', { n: n + 2 }), t('Sempat mohon cuti / tukar sesi sebelum had notis {n} jam.', { n }))}
    ${row('remind2', t('2 jam sebelum sesi'), t('Peringatan latihan: bawa raket, kasut, air & tuala.'))}
    <p class="muted" style="font-size:12px;margin-top:8px">${perm === 'granted' ? '✓ ' + t('Notifikasi telefon aktif — peringatan sampai walaupun app ditutup.') : perm === 'denied' ? '⚠️ ' + t('Notifikasi disekat dalam tetapan telefon — peringatan hanya dalam app (ikon loceng).') : t('Tekan "Hidupkan notifikasi" di atas supaya peringatan sampai ke telefon.')}</p></div>`;
}
INPUTS['p-rem-tog'] = async (v, el) => {
  const off = new Set(S.profile.notify_off || []), k = el.dataset.key;
  if (el.checked) off.delete(k); else off.add(k);
  const arr = [...off];
  if (S.mode === 'supabase') await rpc('set_notify_off', { p_kinds: arr });
  S.profile.notify_off = arr; toast(t('Tetapan disimpan')); ensurePush();
};
