// Templat mesej WhatsApp kepada ibu bapa. Ikut bahasa yang dipilih admin (BM / English / 中文).
import { getLang, withLang, LANGS } from '../i18n.js';
import { langOf } from '../lang-of.js';
import { $, esc, ic, openModal, waLink } from '../ui.js';
import { tr } from '../i18n-dom.js';
const L = () => getLang();
const pick = (ms, en, zh) => ({ ms, en, zh }[L()] ?? ms);
const hi = n => pick(`Salam ${n || ''},`, `Hi ${n || ''},`, `${n || ''} 您好，`);

export const msgInvoiceReminder = ({ guardian, student, item, amount, number, due, academy }) => (item = tr(item || ''), pick(
  `${hi(guardian)} ini peringatan mesra daripada ${academy}. ${item} untuk ${student} berjumlah ${amount} (invois ${number}, tarikh akhir ${due}) masih belum dijelaskan. Sila hubungi kami jika ada sebarang pertanyaan. Terima kasih! 🏸`,
  `${hi(guardian)} this is a friendly reminder from ${academy}. ${item} for ${student} amounting to ${amount} (invoice ${number}, due ${due}) is still outstanding. Please contact us if you have any questions. Thank you! 🏸`,
  `${hi(guardian)}这是来自 ${academy} 的温馨提醒。${student} 的 ${item}，金额 ${amount}（发票 ${number}，截止日期 ${due}）尚未缴付。如有任何疑问，欢迎联系我们。谢谢！🏸`));

export const msgPackageLow = ({ guardian, student, pkg, left, until, academy }) => (pkg = tr(pkg || ''), pick(
  `${hi(guardian)} baki pakej ${pkg} bagi ${student} tinggal ${left} sesi${until ? ` (sah hingga ${until})` : ''}. Invois pembaharuan telah dikeluarkan — sila rujuk aplikasi atau hubungi kami. Terima kasih! 🏸 — ${academy}`,
  `${hi(guardian)} ${student}'s package ${pkg} has ${left} session(s) left${until ? ` (valid until ${until})` : ''}. A renewal invoice has been issued — please check the app or contact us. Thank you! 🏸 — ${academy}`,
  `${hi(guardian)}${student} 的配套 ${pkg} 剩余 ${left} 节课${until ? `（有效期至 ${until}）` : ''}。续费发票已发出，请在应用中查看或联系我们。谢谢！🏸 — ${academy}`));

export const msgLeadThanks = ({ guardian, child }) => pick(
  `${hi(guardian)} terima kasih kerana berminat dengan Maxxima Badminton Academy untuk ${child}. `,
  `${hi(guardian)} thank you for your interest in Maxxima Badminton Academy for ${child}. `,
  `${hi(guardian)}感谢您为 ${child} 咨询 Maxxima Badminton Academy。`);

export const msgTrialReminder = ({ guardian, child, date, time, venue }) => pick(
  `${hi(guardian)} peringatan: sesi trial ${child} pada ${date}${time ? ' jam ' + time : ''} di ${venue}. Sila datang 10–15 minit lebih awal, bawa raket, kasut sukan, air dan tuala.`,
  `${hi(guardian)} a reminder: ${child}'s trial session is on ${date}${time ? ' at ' + time : ''} at ${venue}. Please arrive 10–15 minutes early and bring a racket, sports shoes, water and a towel.`,
  `${hi(guardian)}温馨提醒：${child} 的试课时间为 ${date}${time ? ' ' + time : ''}，地点 ${venue}。请提早 10–15 分钟到达，并携带球拍、运动鞋、水和毛巾。`);

export const msgEnrolEnquiry = ({ guardian, student }) => pick(
  `${hi(guardian)} mengenai permohonan ${student} di Maxxima Badminton Academy…`,
  `${hi(guardian)} regarding ${student}'s application at Maxxima Badminton Academy…`,
  `${hi(guardian)}关于 ${student} 在 Maxxima Badminton Academy 的报名申请…`);

export const msgEnrolInvoice = ({ guardian, student, amount, numbers }) => pick(
  `${hi(guardian)} invois pendaftaran ${student} berjumlah ${amount} (${numbers}) menunggu pembayaran. Tempat disahkan selepas bayaran penuh diterima. Terima kasih!`,
  `${hi(guardian)} ${student}'s enrolment invoice of ${amount} (${numbers}) is awaiting payment. The place is confirmed once full payment is received. Thank you!`,
  `${hi(guardian)}${student} 的报名发票金额 ${amount}（${numbers}）正在等待付款。全额付款后名额即确认。谢谢！`);

/* Tetingkap mesej WhatsApp: bahasa lalai ikut ibu bapa; admin boleh tukar sebelum hantar. */
const LNAME = { ms: 'Bahasa Malaysia', en: 'English', zh: '中文' };
export function msgModal({ title, student: s, build }) {
  const pref = langOf(s), start = pref || getLang();
  const body = l => { const msg = withLang(l, build); return { msg, html: `<pre class="copybox" id="remindText">${esc(msg)}</pre>
    <div class="actions" style="margin-top:12px">${s?.guardian_phone ? `<a class="btn primary" id="waGo" href="${waLink(s.guardian_phone, msg)}" target="_blank" rel="noopener">${ic('msg', 'sm')} Buka WhatsApp</a>` : ''}<button type="button" class="btn" data-action="copy-remind">Salin mesej</button></div>` }; };
  const f = openModal({ title, cancel: 'Tutup', body: `<p class="muted" style="margin-bottom:10px">Semak mesej, kemudian hantar melalui WhatsApp kepada ${esc(s?.guardian_name || 'penjaga')} (${esc(s?.guardian_phone || 'tiada nombor')}). Mesej dihantar secara manual — tiada hantaran automatik.</p>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><span class="muted" style="font-size:12.5px">Bahasa mesej${pref ? ` (pilihan ibu bapa: ${LNAME[pref]})` : ''}</span>
      <div class="langsw" id="msgLang">${LANGS.map(([c, l]) => `<button type="button" class="${c === start ? 'on' : ''}" data-l="${c}">${l}</button>`).join('')}</div></div>
    <div id="msgBox">${body(start).html}</div>` });
  f.querySelector('#msgLang').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return;
    f.querySelectorAll('#msgLang button').forEach(x => x.classList.toggle('on', x === b)); f.querySelector('#msgBox').innerHTML = body(b.dataset.l).html; });
}
