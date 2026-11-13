// v25: Penjana sijil kongsi (admin, portal ibu bapa, portal peserta).
// - Sijil PENYERTAAN: reka bentuk penuh + logo + tandatangan.
// - Sijil PEMENANG: mod "kosong" (teks sahaja, untuk dicetak atas kertas sijil urus setia) atau reka bentuk penuh.
// Tetapan dari settings.cert: { signers:[{name,title,img}], winner_mode:'plain'|'design', plain_top_mm, plain_lines }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const PLACE_MS = { 1: 'JUARA', 2: 'NAIB JUARA', 3: 'TEMPAT KETIGA', 4: 'TEMPAT KEEMPAT' };
export const PLACE_EN = { 1: 'Champion', 2: 'Runner-up', 3: 'Third Place', 4: 'Fourth Place' };

/**
 * @param items [{ name, cat, place (0-4), ref }]
 * @param o { event, dates, venue, academy, logo, cfg, imgUrl(path) }
 */
export function certDoc(items, o) {
  const cfg = o.cfg || {}, plainWin = (cfg.winner_mode || 'plain') === 'plain';
  const signers = (cfg.signers || []).filter(s => s && (s.name || s.title || s.img)).slice(0, 3);
  const sigs = (signers.length ? signers : [{ title: 'Ketua Jurulatih' }, { title: 'Pengarah Kejohanan' }])
    .map(s => `<div class="sg"><div class="sgimg">${s.img ? `<img src="${esc(o.imgUrl ? o.imgUrl(s.img) : s.img)}" alt="">` : ''}</div><span></span><b>${esc(s.name || '')}</b><small>${esc(s.title || '')}</small></div>`).join('');
  const design = x => `<section class="cert ${x.place ? 'win' : ''}"><div class="in">
      ${o.logo ? `<img src="${esc(o.logo)}" class="logo" alt="">` : ''}
      <div class="kicker">${x.place ? 'SIJIL PENCAPAIAN' : 'SIJIL PENYERTAAN'}</div>
      <div class="title">${x.place ? 'Certificate of Achievement' : 'Certificate of Participation'}</div>
      <div class="pre">Dengan ini disahkan bahawa</div>
      <div class="name">${esc(x.name)}</div>
      <div class="pre">${x.place ? `telah meraih <b>${PLACE_MS[x.place]}</b> dalam kategori` : 'telah menyertai kategori'} <b>${esc(x.cat)}</b></div>
      <div class="event">${esc(o.event)}</div>
      <div class="pre">${esc(o.dates || '')}${o.venue ? ' · ' + esc(o.venue) : ''}</div>
      <div class="signs">${sigs}</div>
      <div class="foot">${esc(o.academy || 'Maxxima Badminton Academy')}${x.ref ? ' · ' + esc(x.ref) : ''}</div></div></section>`;
  const plain = x => `<section class="cert plain"><div class="pin" style="padding-top:${Number(cfg.plain_top_mm ?? 78)}mm">
      <div class="pname">${esc(x.name)}</div>
      <div class="pplace">${PLACE_MS[x.place]} · ${PLACE_EN[x.place]}</div>
      <div class="pcat">${esc(x.cat)}</div>
      ${cfg.plain_event === false ? '' : `<div class="pev">${esc(o.event)}${o.dates ? ' · ' + esc(o.dates) : ''}</div>`}</div></section>`;
  const pages = items.map(x => (x.place && plainWin ? plain(x) : design(x))).join('');
  const nWin = items.filter(x => x.place).length;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sijil — ${esc(o.event)}</title><style>
  @page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Georgia,'Times New Roman',serif;background:#ddd;color:#1b1b2f}
  .bar{position:sticky;top:0;z-index:2;background:#071637;color:#fff;padding:10px 16px;font:14px system-ui;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.bar button{font:inherit;padding:7px 16px;border-radius:8px;border:0;background:#c6f432;cursor:pointer;font-weight:700}
  .wrap{overflow-x:auto}.cert{width:297mm;height:210mm;margin:10px auto;background:#fff;padding:12mm;page-break-after:always;position:relative}
  .in{height:100%;border:3px solid #071637;outline:1px solid #c6a84a;outline-offset:-9px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8mm 18mm}
  .win .in{border-color:#a8841c}.logo{width:72px;height:72px;object-fit:contain;margin-bottom:6px}
  .kicker{letter-spacing:.35em;font:700 13px system-ui;color:#6b6b80}.title{font-size:34px;margin:4px 0 12px;font-style:italic}
  .pre{font-size:17px;margin:5px 0;color:#333}.name{font-size:40px;font-weight:700;margin:6px 0 4px;border-bottom:2px solid #c6a84a;padding:0 24px 4px}
  .event{font-size:24px;font-weight:700;margin:10px 0 2px}
  .signs{display:flex;gap:60px;margin-top:16px;font:12.5px system-ui;color:#444;justify-content:center}.sg{width:190px;text-align:center}
  .sgimg{height:46px;display:flex;align-items:flex-end;justify-content:center}.sgimg img{max-height:46px;max-width:170px;mix-blend-mode:multiply}
  .sg span{display:block;border-bottom:1px solid #333;margin:2px 0 5px}.sg b{display:block;font-size:12.5px;color:#1b1b2f}.sg small{color:#666}
  .foot{position:absolute;bottom:17mm;left:0;right:0;text-align:center;font:11px system-ui;color:#888}
  .plain{padding:0}.pin{text-align:center;height:100%}.pname{font-size:38px;font-weight:700}.pplace{font-size:24px;font-weight:700;margin-top:10mm;letter-spacing:.04em}
  .pcat{font-size:20px;margin-top:5mm}.pev{font-size:15px;margin-top:6mm;color:#333}
  .screen-note{display:none}@media screen{.plain{outline:1px dashed #bbb;outline-offset:-6mm}.plain::after{content:"Kertas sijil urus setia — teks sahaja (garis putus tidak dicetak)";position:absolute;bottom:4mm;left:0;right:0;text-align:center;font:10px system-ui;color:#aaa}}
  @media print{body{background:#fff}.bar{display:none}.cert{margin:0}}</style></head><body>
  <div class="bar"><b>${items.length} sijil${nWin ? ` · ${nWin} pemenang` : ''}</b><button onclick="print()">Cetak / Simpan PDF</button><span style="opacity:.75">A4 Landscape · Margin: None${nWin && plainWin ? ' · Sijil pemenang: masukkan kertas sijil urus setia' : ''}</span></div><div class="wrap">${pages}</div></body></html>`;
}
