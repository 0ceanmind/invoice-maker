/* Invoice Maker — editor, live preview, storage and printing. No build step, no dependencies. */
(function () {
  'use strict';

  const { LABELS, COMPANY, BLOCKS, SAMPLES, PAGE_SIZES } = window.IM_DATA;
  const KEYS = { company: 'im.company', invoices: 'im.invoices', current: 'im.current', ui: 'im.ui' };
  const PX_PER_IN = 96;

  /* ------------------------------------------------------------------ utils */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), obj);
    target[last] = value;
  }

  const ICONS = {
    grip: '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    files: '<path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    newdoc: '<path d="M12 5v14M5 12h14"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  const iconFill = (name) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;

  /* ------------------------------------------------------------------ state */
  let company = Object.assign(clone(COMPANY), load(KEYS.company, {}));
  let invoices = load(KEYS.invoices, []);
  let currentId = load(KEYS.current, null);
  let doc = null;
  const ui = Object.assign({ collapsed: { company: true, settings: true } }, load(KEYS.ui, {}));
  const openIds = new Set();
  let activeId = null;
  let history = [];
  let future = [];
  let lastSnapshot = null;

  function withIds(d) {
    d.blocks = (d.blocks || []).map((b) => Object.assign({ id: uid() }, b));
    d.headerFields = d.headerFields || [];
    return d;
  }

  function nextNumber() {
    let max = 0; let width = 4;
    invoices.forEach((inv) => {
      const n = parseInt(String(inv.doc.number || '').replace(/\D/g, ''), 10);
      if (Number.isFinite(n) && n > max) { max = n; width = Math.max(width, String(inv.doc.number).replace(/\D/g, '').length); }
    });
    return String(max + 1).padStart(width, '0');
  }

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function blankDoc(lang) {
    const L = LABELS[lang];
    return withIds({
      lang, digits: 'auto', pageSize: (doc && doc.pageSize) || 'letter', decimals: 'auto',
      title: L.docTitle, number: nextNumber(), date: today(),
      clientLabel: L.billedTo, client: '', headerFields: [],
      showLogo: true, showFooter: true,
      blocks: [
        Object.assign({ type: 'heading' }, BLOCKS.heading.make(L)),
        Object.assign({ type: 'items' }, BLOCKS.items.make(L)),
        Object.assign({ type: 'payment' }, BLOCKS.payment.make(L)),
        Object.assign({ type: 'signature' }, BLOCKS.signature.make(L), { width: 'half' })
      ]
    });
  }

  function addInvoice(d) {
    const inv = { id: uid(), created: Date.now(), updated: Date.now(), doc: d };
    invoices.unshift(inv);
    return inv;
  }

  function openInvoice(id) {
    const inv = invoices.find((i) => i.id === id) || invoices[0];
    currentId = inv.id;
    doc = inv.doc;
    withIdsInPlace(doc);
    history = []; future = []; lastSnapshot = JSON.stringify(doc);
    openIds.clear(); activeId = null;
    save(KEYS.current, currentId);
    renderAll();
  }
  function withIdsInPlace(d) {
    d.headerFields = d.headerFields || [];
    d.blocks.forEach((b) => { if (!b.id) b.id = uid(); });
  }

  // First run: start with the two original bills so the tool opens with real content.
  if (!invoices.length) {
    addInvoice(withIds(clone(SAMPLES.haifa.doc)));
    addInvoice(withIds(clone(SAMPLES.gcoeat.doc)));
    save(KEYS.invoices, invoices);
  }

  /* -------------------------------------------------------------- formatting */
  const L = () => LABELS[doc.lang] || LABELS.en;
  const useArabicDigits = () => doc.digits === 'arabic' || (doc.digits === 'auto' && doc.lang === 'ar');
  function digits(str) {
    if (!useArabicDigits()) return str;
    return String(str).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]).replace(/,/g, '٬').replace(/\.(?=[٠-٩])/g, '٫');
  }
  function fmtNumber(n) {
    const fixed = doc.decimals === '3';
    const s = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fixed ? 3 : 0,
      maximumFractionDigits: 3
    }).format(Math.round(n * 1000) / 1000);
    return digits(s);
  }
  function money(n, long) {
    const cur = (long ? company.currencyLong : company.currency)[doc.lang] || '';
    return `${fmtNumber(n)} ${cur}`.trim();
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d);
    const locale = doc.lang === 'ar' ? 'ar-EG-u-nu-latn-ca-gregory' : 'en-GB';
    return digits(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date));
  }
  const pick = (v) => (v && typeof v === 'object' ? (v[doc.lang] != null && v[doc.lang] !== '' ? v[doc.lang] : v.en) : v) || '';

  function totals(b) {
    const lines = (b.rows || []).map((r) => (b.showQty ? num(r.qty) * num(r.price) : num(r.price)));
    const subtotal = lines.reduce((a, v) => a + v, 0);
    const discount = Math.max(0, num(b.discount));
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * num(b.taxRate) / 100;
    const total = taxable + tax;
    const deposit = num(b.deposit) > 0 ? total * num(b.deposit) / 100 : 0;
    return { lines, subtotal, discount, tax, total, deposit, balance: total - deposit };
  }
  function docTotal(d) {
    const prev = doc; doc = d;
    const items = d.blocks.filter((b) => b.type === 'items');
    const t = items.reduce((a, b) => a + totals(b).total, 0);
    const out = items.length ? money(t) : '';
    doc = prev;
    return out;
  }

  /* ---------------------------------------------------------------- document */
  function renderSheet() {
    const sheet = $('#sheet');
    const lb = L();
    const size = PAGE_SIZES[doc.pageSize] || PAGE_SIZES.letter;
    sheet.setAttribute('dir', doc.lang === 'ar' ? 'rtl' : 'ltr');
    sheet.setAttribute('lang', doc.lang);
    sheet.style.setProperty('--page-w', size.w);
    sheet.style.setProperty('--page-h', size.h);

    const meta = [];
    if (doc.date) meta.push([lb.date, fmtDate(doc.date)]);
    if (doc.number) meta.push([lb.number, `<span class="num">${esc(doc.number)}</span>`, true]);
    doc.headerFields.forEach((f) => { if (f.label || f.value) meta.push([f.label, esc(f.value), true]); });

    const phone = company.phone ? `<span>${esc(lb.phone)}: <bdi dir="ltr" class="num">${esc(company.phone)}</bdi></span>` : '';
    const email = company.email ? `<span>${esc(lb.email)}: <bdi dir="ltr">${esc(company.email)}</bdi></span>` : '';

    const head = `
      <header class="doc-head" data-go="invoice">
        <div>
          <dl class="doc-meta">${meta.map(([k, v, raw]) => `<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join('')}</dl>
          <div class="issuer">
            <span class="issuer-name">${esc(pick(company.name))}</span>
            <span>${esc(pick(company.owner))}</span>
            ${phone}${email}
          </div>
        </div>
        ${doc.showLogo && company.logo ? `<img class="doc-logo" src="${esc(company.logo)}" alt="${esc(pick(company.name))}">` : '<span></span>'}
      </header>
      <section class="title-row" data-go="invoice">
        <h1 class="doc-title">${esc(doc.title)}</h1>
        <div class="client-bar">
          ${doc.clientLabel ? `<span class="client-label">${esc(doc.clientLabel)}</span>` : ''}
          <span class="client-name">${esc(doc.client) || '&nbsp;'}</span>
        </div>
      </section>`;

    const body = `<main class="doc-body">${doc.blocks.map(renderBlock).join('')}</main>`;

    const foot = doc.showFooter ? `
      <footer class="doc-foot"><div class="foot-inner">
        <span>${esc(pick(company.name))}</span>
        <span>${[company.phone ? `<bdi dir="ltr">${esc(company.phone)}</bdi>` : '', company.email ? `<bdi dir="ltr">${esc(company.email)}</bdi>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</span>
      </div></footer>` : '';

    sheet.innerHTML = head + body + foot;
    $$('img', sheet).forEach((img) => { if (!img.complete) img.addEventListener('load', layoutPreview, { once: true }); });
    layoutPreview();
  }

  function renderBlock(b) {
    const width = ['list', 'note', 'fields', 'payment', 'signature'].includes(b.type) && b.width === 'half' ? 'w-half' : 'w-full';
    const cls = `blk blk-${b.type} ${width}${b.id === activeId ? ' is-active' : ''}`;
    return `<div class="${cls}" data-id="${b.id}">${blockHTML(b)}</div>`;
  }

  function blockHTML(b) {
    const lb = L();
    switch (b.type) {
      case 'heading':
        return `<h2 class="b-heading s-${esc(b.size || 'lg')} a-${esc(b.align || 'center')}">${esc(b.text)}</h2>`;

      case 'items': {
        const t = totals(b);
        const q = !!b.showQty;
        const cols = q ? 4 : 2;
        const h = b.head || {};
        const rows = (b.rows || []).map((r, i) => `
          <tr>
            <td class="c-desc">${esc(r.desc)}${r.details ? `<span class="row-details">${esc(r.details)}</span>` : ''}</td>
            ${q ? `<td class="c-qty num">${esc(digits(String(num(r.qty))))}</td><td class="c-price num">${esc(money(num(r.price)))}</td>` : ''}
            <td class="c-total num">${esc(money(t.lines[i]))}</td>
          </tr>`).join('') || `<tr class="empty-row"><td colspan="${cols}">Add a row in the editor</td></tr>`;
        const sum = [];
        const hasExtras = t.discount > 0 || num(b.taxRate) > 0;
        if (hasExtras) sum.push([lb.subtotal, money(t.subtotal)]);
        if (t.discount > 0) sum.push([lb.discount, `− ${money(t.discount)}`]);
        if (num(b.taxRate) > 0) sum.push([`${b.taxLabel || lb.tax} (${digits(String(num(b.taxRate)))}%)`, money(t.tax)]);
        const sumRows = sum.map(([k, v]) => `<tr class="sum"><td class="sum-label" colspan="${cols - 1}">${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join('');
        const grand = `<tr class="grand"><td class="sum-label" colspan="${cols - 1}">${esc(b.totalLabel || lb.grandTotal)}</td><td class="num">${esc(money(t.total, b.longCurrency))}</td></tr>`;
        const dep = t.deposit > 0 ? `
          <tr class="sum"><td class="sum-label" colspan="${cols - 1}">${esc(lb.deposit)} (${esc(digits(String(num(b.deposit))))}%)</td><td class="num">${esc(money(t.deposit))}</td></tr>
          <tr class="sum"><td class="sum-label" colspan="${cols - 1}"><strong>${esc(lb.balance)}</strong></td><td class="num"><strong>${esc(money(t.balance))}</strong></td></tr>` : '';
        return `
          <table class="items${q ? '' : ' no-qty'}">
            <thead><tr>
              <th class="c-desc">${esc(h.desc)}</th>
              ${q ? `<th class="c-qty">${esc(h.qty)}</th><th class="c-price">${esc(h.price)}</th>` : ''}
              <th class="c-total">${esc(q ? h.total : h.price)}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot>${sumRows}${grand}${dep}</tfoot>
          </table>
          ${b.note ? `<p class="items-note">${esc(b.note)}</p>` : ''}`;
      }

      case 'list': {
        const items = String(b.items || '').split('\n').map((s) => s.trim()).filter(Boolean);
        const li = items.map((s) => {
          const i = s.indexOf(':');
          if (b.boldLabel && i > 0 && i < 60) return `<li><b>${esc(s.slice(0, i + 1))}</b>${esc(s.slice(i + 1))}</li>`;
          return `<li>${esc(s)}</li>`;
        }).join('');
        return `<div class="b-list tone-${esc(b.tone || 'ink')}">${b.title ? `<h3 class="b-title">${esc(b.title)}</h3>` : ''}<ul>${li}</ul></div>`;
      }

      case 'note':
        return `<p class="b-note tone-${esc(b.tone || 'plain')} a-${esc(b.align || 'start')}">${esc(b.text) || '&nbsp;'}</p>`;

      case 'fields': {
        const rows = (b.rows || []).filter((r) => r.label || r.value);
        return `<div class="b-fields">${b.title ? `<h3 class="b-title">${esc(b.title)}</h3>` : ''}<dl class="kv">${rows.map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`).join('')}</dl></div>`;
      }

      case 'payment': {
        const rows = [];
        if (b.showBank) {
          rows.push([lb.accName, esc(pick(company.accountName))]);
          rows.push([lb.accNo, `<bdi dir="ltr" class="num">${esc(company.accountNo)}</bdi>`]);
          rows.push([lb.bank, esc(pick(company.bank))]);
        }
        if (b.showPhone) rows.push([lb.phoneTransfer, `<bdi dir="ltr" class="num">${esc(company.phone)}</bdi>`]);
        return `<div class="b-payment">${b.title ? `<h3 class="b-title">${esc(b.title)}</h3>` : ''}<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
      }

      case 'signature': {
        const own = b.showOwn ? `
          <div class="sign-own">
            ${b.closing ? `<span>${esc(b.closing)}</span>` : ''}
            ${b.showImage && company.signature ? `<img src="${esc(company.signature)}" alt="Signature">` : '<span class="sign-gap"></span>'}
            <span>${esc(pick(company.name))}</span>
          </div>` : '';
        const client = b.showClient ? `<div class="sign-client"><div class="line">${esc(b.clientLabel || lb.clientSig)}</div></div>` : '';
        return `<div class="b-sign">${client}${own}</div>`;
      }

      case 'spacer':
        return `<div class="b-spacer" style="height:${Math.max(0, num(b.size))}pt"></div>`;
      case 'divider':
        return '<hr class="b-divider">';
      case 'pagebreak':
        return '<div class="b-pagebreak"></div>';
      default:
        return '';
    }
  }

  /* Scale the page to fit and draw approximate page-break guides. */
  function layoutPreview() {
    const sheet = $('#sheet');
    const frame = $('#sheetFrame');
    const preview = $('#preview');
    const size = PAGE_SIZES[doc.pageSize] || PAGE_SIZES.letter;
    const [pw, ph] = size.px;
    const padY = 0.45 * PX_PER_IN;
    const perPage = ph - 2 * padY;

    $$('.page-guide', sheet).forEach((g) => g.remove());
    sheet.style.minHeight = '0px';

    // Walk blocks and find where printed pages will break.
    const guides = [];
    let limit = padY + perPage;
    const unbreakable = (el) => !el.classList.contains('blk-items') && !el.classList.contains('blk-list');
    const pieces = [...$$('.doc-head, .title-row', sheet), ...$$('.blk', sheet), ...$$('.doc-foot', sheet)];
    pieces.forEach((el) => {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (el.classList.contains('blk-pagebreak')) { guides.push(bottom); limit = bottom + perPage; return; }
      while (bottom > limit) {
        const at = unbreakable(el) && top < limit && top > limit - perPage ? top : limit;
        guides.push(at);
        limit = at + perPage;
      }
    });
    const pages = guides.length + 1;
    sheet.style.minHeight = `${pages * ph}px`;
    guides.forEach((y, i) => {
      const g = document.createElement('div');
      g.className = 'page-guide';
      g.style.top = `${y}px`;
      g.innerHTML = `<span>Page ${i + 2}</span>`;
      sheet.appendChild(g);
    });

    const avail = preview.clientWidth - (window.innerWidth <= 900 ? 32 : 48);
    const scale = Math.min(1.25, Math.max(0.3, avail / pw));
    sheet.style.transform = `scale(${scale})`;
    frame.style.width = `${pw * scale}px`;
    frame.style.height = `${sheet.offsetHeight * scale}px`;
    $('#pageCount').textContent = `${size.label} · ${pages} page${pages > 1 ? 's' : ''}`;
  }

  /* ------------------------------------------------------------------ editor */
  const bind = (scope, path) => `data-bind="${scope}.${path}"`;
  const valOf = (scope, path) => getPath(scope === 'c' ? company : doc, path);

  function fText(label, scope, path, o = {}) {
    const v = valOf(scope, path);
    const id = `f-${scope}-${path.replace(/\./g, '-')}`;
    return `<label class="field" for="${id}"><span>${esc(label)}</span>
      <input id="${id}" type="${o.type || 'text'}" dir="${o.dir || 'auto'}" ${bind(scope, path)} value="${esc(v == null ? '' : v)}" placeholder="${esc(o.placeholder || '')}"${o.num ? ' data-num="1" step="any" inputmode="decimal"' : ''}${o.min != null ? ` min="${o.min}"` : ''}>
      ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</label>`;
  }
  const fNum = (label, scope, path, o = {}) => fText(label, scope, path, Object.assign({ type: 'number', num: true, dir: 'ltr' }, o));
  function fArea(label, scope, path, o = {}) {
    const id = `f-${scope}-${path.replace(/\./g, '-')}`;
    return `<label class="field" for="${id}"><span>${esc(label)}</span>
      <textarea id="${id}" dir="auto" rows="${o.rows || 4}" ${bind(scope, path)} placeholder="${esc(o.placeholder || '')}">${esc(valOf(scope, path) || '')}</textarea>
      ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</label>`;
  }
  function fSelect(label, scope, path, options, o = {}) {
    const v = String(valOf(scope, path));
    const id = `f-${scope}-${path.replace(/\./g, '-')}`;
    return `<label class="field" for="${id}"><span>${esc(label)}</span>
      <select id="${id}" ${bind(scope, path)}${o.rerender ? ' data-rerender="1"' : ''}>
        ${options.map(([val, lab]) => `<option value="${esc(val)}"${String(val) === v ? ' selected' : ''}>${esc(lab)}</option>`).join('')}
      </select></label>`;
  }
  function fCheck(label, scope, path, o = {}) {
    const id = `f-${scope}-${path.replace(/\./g, '-')}`;
    return `<label class="check" for="${id}"><input id="${id}" type="checkbox" ${bind(scope, path)} data-bool="1"${o.rerender ? ' data-rerender="1"' : ''}${valOf(scope, path) ? ' checked' : ''}>${esc(label)}</label>`;
  }
  function fSeg(label, scope, path, options, o = {}) {
    const v = String(valOf(scope, path));
    return `<div class="field"><span class="field-label">${esc(label)}</span>
      <div class="seg" role="group" aria-label="${esc(label)}">
        ${options.map(([val, lab]) => `<button type="button" data-seg="${scope}.${path}" data-value="${esc(val)}"${o.rerender ? ' data-rerender="1"' : ''} aria-pressed="${String(val) === v}">${esc(lab)}</button>`).join('')}
      </div></div>`;
  }
  function fBi(label, path) {
    const v = company[path] || {};
    return `<div class="field"><span class="field-label">${esc(label)}</span>
      <div class="bi">
        <input type="text" dir="ltr" aria-label="${esc(label)} (English)" ${bind('c', path + '.en')} value="${esc(v.en || '')}" placeholder="English">
        <input type="text" dir="rtl" aria-label="${esc(label)} (Arabic)" ${bind('c', path + '.ar')} value="${esc(v.ar || '')}" placeholder="العربية">
      </div></div>`;
  }

  function section(key, title, body, extra = '') {
    const collapsed = ui.collapsed[key];
    return `<section class="section${collapsed ? ' is-collapsed' : ''}" data-section="${key}">
      <button class="section-head" type="button" data-action="toggle-section" data-key="${key}" aria-expanded="${!collapsed}">
        <h2>${esc(title)}</h2>${extra}<span class="chev">${icon('chev')}</span>
      </button>
      <div class="section-body">${body}</div>
    </section>`;
  }

  function renderEditor() {
    const ed = $('#editor');
    const scroll = ed.scrollTop;

    const invoiceBody = `
      ${fSeg('Language', 'd', 'lang', [['en', 'English'], ['ar', 'العربية']], { rerender: true })}
      <div class="grid2">
        ${fText('Document title', 'd', 'title')}
        ${fText('Invoice number', 'd', 'number', { dir: 'ltr' })}
      </div>
      <div class="grid2">
        ${fText('Date', 'd', 'date', { type: 'date', dir: 'ltr' })}
        ${fText('Client label', 'd', 'clientLabel')}
      </div>
      ${fText('Client name', 'd', 'client', { placeholder: 'Who is this invoice for?' })}
      <div class="field"><span class="field-label">Extra header fields</span>
        <div class="rep">
          ${doc.headerFields.map((f, i) => `
            <div class="rep-row rep-kv">
              <input type="text" dir="auto" aria-label="Field name" placeholder="Field name, e.g. Due date" ${bind('d', `headerFields.${i}.label`)} value="${esc(f.label)}">
              <input type="text" dir="auto" aria-label="Field value" placeholder="Value" ${bind('d', `headerFields.${i}.value`)} value="${esc(f.value)}">
              <button class="icon-btn danger" type="button" data-action="hf-del" data-i="${i}" aria-label="Remove field">${icon('x')}</button>
            </div>`).join('')}
          <button class="btn btn-sm" type="button" data-action="hf-add">${icon('plus')} Add header field</button>
        </div>
      </div>`;

    const blocksBody = `
      <div class="blocks" id="blockList">${doc.blocks.map(cardHTML).join('')}</div>
      <div class="add-grid" id="addGrid" aria-label="Add a block">
        ${Object.entries(BLOCKS).map(([type, def]) => `<button type="button" data-action="add-block" data-type="${type}"><strong>+ ${esc(def.name)}</strong><small>${esc(def.hint)}</small></button>`).join('')}
      </div>`;

    const settingsBody = `
      <div class="grid2">
        ${fSelect('Page size', 'd', 'pageSize', Object.entries(PAGE_SIZES).map(([k, v]) => [k, v.label]), { rerender: true })}
        ${fSelect('Numbers', 'd', 'digits', [['auto', 'Automatic'], ['latin', '0123 (Latin)'], ['arabic', '٠١٢٣ (Arabic)']])}
      </div>
      ${fSelect('Decimals in amounts', 'd', 'decimals', [['auto', 'Only when needed (30 · 12.5)'], ['3', 'Always 3 (30.000 · 12.500)']])}
      <div class="checks">
        ${fCheck('Show logo', 'd', 'showLogo')}
        ${fCheck('Show footer line', 'd', 'showFooter')}
      </div>`;

    const img = (key, label) => `
      <div class="field"><span class="field-label">${esc(label)}</span>
        <div class="img-pick">
          <span class="thumb">${company[key] ? `<img src="${esc(company[key])}" alt="">` : ''}</span>
          <button class="btn btn-sm" type="button" data-action="pick-image" data-key="${key}">Upload new</button>
          <button class="btn btn-sm btn-quiet" type="button" data-action="reset-image" data-key="${key}">Use original</button>
        </div></div>`;

    const companyBody = `
      <p class="field"><span class="hint">Used on every invoice. English on the left, Arabic on the right.</span></p>
      ${fBi('Company name', 'name')}
      ${fBi('Owner name', 'owner')}
      <div class="grid2">
        ${fText('Phone', 'c', 'phone', { dir: 'ltr' })}
        ${fText('Email (optional)', 'c', 'email', { dir: 'ltr', type: 'email' })}
      </div>
      ${fBi('Account holder', 'accountName')}
      ${fText('Account number', 'c', 'accountNo', { dir: 'ltr' })}
      ${fBi('Bank', 'bank')}
      ${fBi('Currency (in rows)', 'currency')}
      ${fBi('Currency (in totals, long form)', 'currencyLong')}
      <div class="grid2">${img('logo', 'Logo')}${img('signature', 'Signature')}</div>`;

    ed.innerHTML =
      section('invoice', 'Invoice', invoiceBody) +
      section('blocks', 'Blocks', blocksBody, `<span class="count">${doc.blocks.length}</span>`) +
      section('settings', 'Page settings', settingsBody) +
      section('company', 'Company profile', companyBody);

    ed.scrollTop = scroll;
    renderChrome();
  }

  function summary(b) {
    const s = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    switch (b.type) {
      case 'heading': return s(b.text) || 'Empty title';
      case 'items': { const t = totals(b); return `${b.rows.length} row${b.rows.length === 1 ? '' : 's'} · ${money(t.total)}`; }
      case 'list': return s(b.title) || s(b.items).slice(0, 60) || 'Empty list';
      case 'note': return s(b.text) || 'Empty text';
      case 'fields': return s(b.title) || `${b.rows.length} field(s)`;
      case 'payment': return [b.showBank && 'Bank', b.showPhone && 'Phone'].filter(Boolean).join(' + ') || 'Nothing selected';
      case 'signature': return [b.showOwn && 'Your signature', b.showClient && 'Client line'].filter(Boolean).join(' + ') || 'Nothing selected';
      case 'spacer': return `${num(b.size)} pt`;
      case 'divider': return 'Thin line';
      case 'pagebreak': return 'Next block starts a new page';
      default: return '';
    }
  }

  function cardHTML(b, i) {
    const def = BLOCKS[b.type] || { name: b.type };
    const open = openIds.has(b.id);
    const halfable = ['list', 'note', 'fields', 'payment', 'signature'].includes(b.type);
    return `
      <div class="card${open ? ' is-open' : ''}${b.id === activeId ? ' is-active' : ''}" data-card="${b.id}">
        <div class="card-head">
          <span class="handle" data-handle title="Drag to reorder" aria-hidden="true">${iconFill('grip')}</span>
          <button class="card-title" type="button" data-action="toggle-card" data-id="${b.id}" aria-expanded="${open}">
            <strong>${esc(def.name)}${halfable && b.width === 'half' ? '<span class="pill">½ width</span>' : ''}</strong>
            <small data-summary="${b.id}" dir="auto">${esc(summary(b))}</small>
          </button>
          <span class="card-tools">
            <button class="icon-btn" type="button" data-action="move" data-dir="-1" data-id="${b.id}" aria-label="Move up"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>
            <button class="icon-btn" type="button" data-action="move" data-dir="1" data-id="${b.id}" aria-label="Move down"${i === doc.blocks.length - 1 ? ' disabled' : ''}>${icon('down')}</button>
            <button class="icon-btn" type="button" data-action="dup" data-id="${b.id}" aria-label="Duplicate">${icon('copy')}</button>
            <button class="icon-btn danger" type="button" data-action="del" data-id="${b.id}" aria-label="Delete">${icon('trash')}</button>
          </span>
        </div>
        ${open ? `<div class="card-body">${cardBody(b, i)}</div>` : ''}
      </div>`;
  }

  function cardBody(b, i) {
    const p = (k) => `blocks.${i}.${k}`;
    const width = fSeg('Width', 'd', p('width'), [['full', 'Full'], ['half', 'Half']], { rerender: true });
    switch (b.type) {
      case 'heading':
        return `${fText('Title text', 'd', p('text'))}
          <div class="grid2">
            ${fSeg('Align', 'd', p('align'), [['start', 'Start'], ['center', 'Center']])}
            ${fSeg('Size', 'd', p('size'), [['sm', 'S'], ['md', 'M'], ['lg', 'L']])}
          </div>`;

      case 'items': {
        const t = totals(b);
        const rows = b.rows.map((r, ri) => `
          <div class="rep-row">
            <div class="rep-main">
              <input type="text" dir="auto" aria-label="Description" placeholder="Service or product" ${bind('d', p(`rows.${ri}.desc`))} value="${esc(r.desc)}">
              <input type="text" dir="auto" aria-label="Details" placeholder="Details (optional, shown smaller)" ${bind('d', p(`rows.${ri}.details`))} value="${esc(r.details || '')}">
              <div class="rep-nums${b.showQty ? '' : ' two'}">
                ${b.showQty ? `<label>Qty<input type="number" step="any" inputmode="decimal" dir="ltr" data-num="1" ${bind('d', p(`rows.${ri}.qty`))} value="${esc(r.qty)}"></label>` : ''}
                <label>${b.showQty ? 'Unit price' : 'Price'}<input type="number" step="any" inputmode="decimal" dir="ltr" data-num="1" ${bind('d', p(`rows.${ri}.price`))} value="${esc(r.price)}"></label>
                <label>Line total<span class="line-total" data-line="${b.id}.${ri}">${esc(money(t.lines[ri]))}</span></label>
              </div>
            </div>
            <div class="rep-tools">
              <button class="icon-btn" type="button" data-action="row-move" data-path="${p('rows')}" data-i="${ri}" data-dir="-1" aria-label="Move row up"${ri === 0 ? ' disabled' : ''}>${icon('up')}</button>
              <button class="icon-btn" type="button" data-action="row-move" data-path="${p('rows')}" data-i="${ri}" data-dir="1" aria-label="Move row down"${ri === b.rows.length - 1 ? ' disabled' : ''}>${icon('down')}</button>
              <button class="icon-btn danger" type="button" data-action="row-del" data-path="${p('rows')}" data-i="${ri}" aria-label="Remove row">${icon('trash')}</button>
            </div>
          </div>`).join('');
        return `
          ${fCheck('Show quantity and unit price columns', 'd', p('showQty'), { rerender: true })}
          <div class="rep">${rows}
            <button class="btn btn-sm" type="button" data-action="row-add" data-path="${p('rows')}" data-kind="item">${icon('plus')} Add row</button>
          </div>
          <div class="grid3">
            ${fNum('Discount (amount)', 'd', p('discount'), { min: 0 })}
            ${fNum('Tax %', 'd', p('taxRate'), { min: 0, hint: 'e.g. 5 for VAT' })}
            ${fNum('Advance %', 'd', p('deposit'), { min: 0, hint: 'Shows balance due' })}
          </div>
          <div class="grid2">
            ${fText('Total row label', 'd', p('totalLabel'))}
            ${fText('Tax label', 'd', p('taxLabel'))}
          </div>
          ${fText('Note under the table (optional)', 'd', p('note'), { placeholder: 'e.g. 50% advance payment before work starts' })}
          ${fCheck('Write currency in full in the total (e.g. ريال عماني)', 'd', p('longCurrency'))}
          <div class="field"><span class="field-label">Column headings</span>
            <div class="grid2">
              <input type="text" dir="auto" aria-label="Description heading" ${bind('d', p('head.desc'))} value="${esc(b.head.desc)}">
              ${b.showQty ? `<input type="text" dir="auto" aria-label="Quantity heading" ${bind('d', p('head.qty'))} value="${esc(b.head.qty)}">
              <input type="text" dir="auto" aria-label="Price heading" ${bind('d', p('head.price'))} value="${esc(b.head.price)}">
              <input type="text" dir="auto" aria-label="Total heading" ${bind('d', p('head.total'))} value="${esc(b.head.total)}">`
              : `<input type="text" dir="auto" aria-label="Price heading" ${bind('d', p('head.price'))} value="${esc(b.head.price)}">`}
            </div>
          </div>`;
      }

      case 'list':
        return `${fText('Heading', 'd', p('title'))}
          ${fArea('Bullet points', 'd', p('items'), { rows: 5, placeholder: 'One bullet per line', hint: 'One bullet per line.' })}
          <div class="grid2">
            ${fSeg('Color', 'd', p('tone'), [['ink', 'Black'], ['accent', 'Red']])}
            ${width}
          </div>
          ${fCheck('Make the text before “:” bold', 'd', p('boldLabel'))}`;

      case 'note':
        return `${fArea('Text', 'd', p('text'), { rows: 3 })}
          ${fSelect('Style', 'd', p('tone'), [['plain', 'Regular'], ['bold', 'Bold'], ['large', 'Large bold'], ['accent', 'Red bold'], ['muted', 'Small grey']])}
          <div class="grid2">
            ${fSeg('Align', 'd', p('align'), [['start', 'Start'], ['center', 'Center'], ['end', 'End']])}
            ${width}
          </div>`;

      case 'fields':
        return `${fText('Heading', 'd', p('title'))}
          <div class="rep">
            ${b.rows.map((r, ri) => `
              <div class="rep-row rep-kv">
                <input type="text" dir="auto" aria-label="Label" placeholder="Label" ${bind('d', p(`rows.${ri}.label`))} value="${esc(r.label)}">
                <input type="text" dir="auto" aria-label="Value" placeholder="Value" ${bind('d', p(`rows.${ri}.value`))} value="${esc(r.value)}">
                <button class="icon-btn danger" type="button" data-action="row-del" data-path="${p('rows')}" data-i="${ri}" aria-label="Remove field">${icon('x')}</button>
              </div>`).join('')}
            <button class="btn btn-sm" type="button" data-action="row-add" data-path="${p('rows')}" data-kind="kv">${icon('plus')} Add field</button>
          </div>
          ${width}`;

      case 'payment':
        return `${fText('Heading', 'd', p('title'))}
          <div class="checks">
            ${fCheck('Bank account', 'd', p('showBank'))}
            ${fCheck('Phone transfer', 'd', p('showPhone'))}
          </div>
          <p class="field"><span class="hint">Account details come from the Company profile section below.</span></p>
          ${width}`;

      case 'signature':
        return `<div class="checks">
            ${fCheck('Your signature', 'd', p('showOwn'), { rerender: true })}
            ${fCheck('Client signature line', 'd', p('showClient'), { rerender: true })}
          </div>
          ${b.showOwn ? `${fText('Closing line', 'd', p('closing'))}${fCheck('Include signature image', 'd', p('showImage'))}` : ''}
          ${b.showClient ? fText('Client line label', 'd', p('clientLabel')) : ''}
          ${width}`;

      case 'spacer':
        return fNum('Height (pt)', 'd', p('size'), { min: 0 });
      default:
        return '<p class="field"><span class="hint">Nothing to set for this block.</span></p>';
    }
  }

  function renderChrome() {
    const title = [doc.number && `#${doc.number}`, doc.client].filter(Boolean).join(' · ') || 'Untitled invoice';
    $('#brandDoc').textContent = title;
    $('#undoBtn').disabled = !history.length;
    $('#redoBtn').disabled = !future.length;
    const count = $('[data-section="blocks"] .count');
    if (count) count.textContent = doc.blocks.length;
  }

  function renderAll() {
    renderEditor();
    renderSheet();
    const size = PAGE_SIZES[doc.pageSize] || PAGE_SIZES.letter;
    $('#page-rule').textContent = `@page { size: ${doc.pageSize === 'a4' ? 'A4' : 'letter'}; margin: 0.45in 0; }`;
    document.documentElement.style.setProperty('--print-page-h', size.h);
  }

  // Refresh the bits of the editor that show computed values, without touching inputs.
  function refreshLive() {
    doc.blocks.forEach((b) => {
      const s = $(`[data-summary="${b.id}"]`);
      if (s) s.textContent = summary(b);
      if (b.type === 'items') {
        const t = totals(b);
        t.lines.forEach((v, ri) => { const el = $(`[data-line="${b.id}.${ri}"]`); if (el) el.textContent = money(v); });
      }
    });
    renderChrome();
  }

  /* ---------------------------------------------------------- change + save */
  let saveTimer = null;
  let histTimer = null;
  function changed(opts = {}) {
    if (opts.editor) renderEditor(); else refreshLive();
    renderSheet();
    if (opts.page) renderAll();
    $('#saveState').textContent = 'Saving…';
    $('#saveState').classList.add('is-dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 350);
    clearTimeout(histTimer);
    if (opts.now) snapshot(); else histTimer = setTimeout(snapshot, 500);
  }
  function snapshot() {
    const s = JSON.stringify(doc);
    if (s === lastSnapshot) return;
    if (lastSnapshot) history.push(lastSnapshot);
    if (history.length > 100) history.shift();
    future = [];
    lastSnapshot = s;
    renderChrome();
  }
  function persist() {
    const inv = invoices.find((i) => i.id === currentId);
    if (inv) { inv.doc = doc; inv.updated = Date.now(); }
    const ok = save(KEYS.invoices, invoices) && save(KEYS.company, company);
    $('#saveState').textContent = ok ? 'Saved on this device' : 'Could not save — browser storage is full or blocked';
    $('#saveState').classList.toggle('is-dirty', !ok);
    if (!$('#drawer').hidden) renderInvoiceList();
  }
  function undo() {
    clearTimeout(histTimer); snapshot();
    if (!history.length) return;
    future.push(lastSnapshot);
    lastSnapshot = history.pop();
    restore(lastSnapshot);
  }
  function redo() {
    if (!future.length) return;
    history.push(lastSnapshot);
    lastSnapshot = future.pop();
    restore(lastSnapshot);
  }
  function restore(s) {
    const d = JSON.parse(s);
    Object.keys(doc).forEach((k) => delete doc[k]);
    Object.assign(doc, d);
    renderAll();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 200);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2400);
  }

  // When switching language, swap any label still set to the old language's default.
  function swapLanguageDefaults(from, to) {
    const A = LABELS[from]; const B = LABELS[to];
    const map = new Map(Object.keys(A).map((k) => [A[k], B[k]]));
    const swap = (v) => (typeof v === 'string' && map.has(v) ? map.get(v) : v);
    ['title', 'clientLabel'].forEach((k) => { doc[k] = swap(doc[k]); });
    doc.blocks.forEach((b) => {
      ['text', 'title', 'totalLabel', 'taxLabel', 'closing', 'clientLabel'].forEach((k) => { if (k in b) b[k] = swap(b[k]); });
      if (b.head) Object.keys(b.head).forEach((k) => { b.head[k] = swap(b.head[k]); });
    });
  }

  /* ------------------------------------------------------------------ events */
  const editor = $('#editor');

  function applyBinding(el, value) {
    const [scope, ...rest] = el.getAttribute('data-bind').split('.');
    const path = rest.join('.');
    const root = scope === 'c' ? company : doc;
    const prev = getPath(root, path);
    if (path === 'lang' && scope === 'd' && prev !== value) swapLanguageDefaults(prev, value);
    setPath(root, path, value);
  }

  editor.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.hasAttribute('data-bind') || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    applyBinding(el, el.hasAttribute('data-num') ? (el.value === '' ? '' : num(el.value)) : el.value);
    changed();
  });
  editor.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.hasAttribute('data-bind')) return;
    if (el.type === 'checkbox') applyBinding(el, el.checked);
    else if (el.tagName === 'SELECT') applyBinding(el, el.value);
    else return;
    changed({ editor: el.hasAttribute('data-rerender'), page: el.getAttribute('data-bind') === 'd.pageSize', now: true });
  });
  editor.addEventListener('focusin', (e) => {
    const card = e.target.closest('[data-card]');
    setActive(card ? card.getAttribute('data-card') : null, false);
  });

  const confirmState = new WeakMap();
  function confirmClick(btn, run) {
    if (confirmState.get(btn)) { run(); return; }
    confirmState.set(btn, true);
    const html = btn.innerHTML;
    btn.classList.add('is-confirm');
    btn.textContent = 'Delete?';
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove('is-confirm'); btn.innerHTML = html; confirmState.delete(btn); } }, 2600);
  }

  editor.addEventListener('click', (e) => {
    const seg = e.target.closest('[data-seg]');
    if (seg) {
      const [scope, ...rest] = seg.getAttribute('data-seg').split('.');
      const path = rest.join('.');
      const root = scope === 'c' ? company : doc;
      const value = seg.getAttribute('data-value');
      if (path === 'lang' && getPath(root, path) !== value) swapLanguageDefaults(getPath(root, path), value);
      setPath(root, path, value);
      $$('button', seg.parentElement).forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
      changed({ editor: seg.hasAttribute('data-rerender'), now: true });
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    const idx = doc.blocks.findIndex((b) => b.id === id);

    switch (a) {
      case 'toggle-section': {
        const k = btn.getAttribute('data-key');
        ui.collapsed[k] = !ui.collapsed[k];
        save(KEYS.ui, ui);
        btn.closest('.section').classList.toggle('is-collapsed', ui.collapsed[k]);
        btn.setAttribute('aria-expanded', String(!ui.collapsed[k]));
        break;
      }
      case 'toggle-card':
        if (openIds.has(id)) openIds.delete(id); else openIds.add(id);
        setActive(id, false);
        renderEditor();
        break;
      case 'move': {
        const to = idx + num(btn.getAttribute('data-dir'));
        if (to < 0 || to >= doc.blocks.length) return;
        const [b] = doc.blocks.splice(idx, 1);
        doc.blocks.splice(to, 0, b);
        changed({ editor: true, now: true });
        break;
      }
      case 'dup': {
        const copy = Object.assign(clone(doc.blocks[idx]), { id: uid() });
        doc.blocks.splice(idx + 1, 0, copy);
        openIds.add(copy.id);
        activeId = copy.id;
        changed({ editor: true, now: true });
        toast('Block duplicated');
        break;
      }
      case 'del':
        confirmClick(btn, () => {
          doc.blocks.splice(idx, 1);
          openIds.delete(id);
          changed({ editor: true, now: true });
          toast('Block deleted — press Undo to bring it back');
        });
        break;
      case 'add-block': {
        const type = btn.getAttribute('data-type');
        const b = Object.assign({ id: uid(), type }, BLOCKS[type].make(L()));
        doc.blocks.push(b);
        openIds.add(b.id);
        activeId = b.id;
        changed({ editor: true, now: true });
        requestAnimationFrame(() => {
          const card = $(`[data-card="${b.id}"]`);
          if (card) { card.scrollIntoView({ block: 'center', behavior: 'smooth' }); const f = $('input, textarea', card); if (f) f.focus({ preventScroll: true }); }
        });
        break;
      }
      case 'row-add': {
        const arr = getPath(doc, btn.getAttribute('data-path'));
        arr.push(btn.getAttribute('data-kind') === 'kv' ? { label: '', value: '' } : { desc: '', details: '', qty: 1, price: 0 });
        changed({ editor: true, now: true });
        break;
      }
      case 'row-del': {
        const arr = getPath(doc, btn.getAttribute('data-path'));
        arr.splice(num(btn.getAttribute('data-i')), 1);
        changed({ editor: true, now: true });
        break;
      }
      case 'row-move': {
        const arr = getPath(doc, btn.getAttribute('data-path'));
        const i = num(btn.getAttribute('data-i'));
        const to = i + num(btn.getAttribute('data-dir'));
        if (to < 0 || to >= arr.length) return;
        const [r] = arr.splice(i, 1);
        arr.splice(to, 0, r);
        changed({ editor: true, now: true });
        break;
      }
      case 'hf-add':
        doc.headerFields.push({ label: '', value: '' });
        changed({ editor: true, now: true });
        break;
      case 'hf-del':
        doc.headerFields.splice(num(btn.getAttribute('data-i')), 1);
        changed({ editor: true, now: true });
        break;
      case 'pick-image': {
        const input = $('#imageFile');
        input.dataset.key = btn.getAttribute('data-key');
        input.value = '';
        input.click();
        break;
      }
      case 'reset-image':
        company[btn.getAttribute('data-key')] = COMPANY[btn.getAttribute('data-key')];
        changed({ editor: true, now: true });
        break;
      default:
    }
  });

  $('#imageFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      company[e.target.dataset.key] = reader.result;
      changed({ editor: true, now: true });
      toast('Image updated');
    };
    reader.readAsDataURL(file);
  });

  function setActive(id, fromPreview) {
    activeId = id;
    $$('.card').forEach((c) => c.classList.toggle('is-active', c.getAttribute('data-card') === id));
    $$('#sheet .blk').forEach((c) => c.classList.toggle('is-active', c.getAttribute('data-id') === id));
    if (fromPreview && id) {
      ui.collapsed.blocks = false;
      openIds.add(id);
      renderEditor();
      if (window.innerWidth <= 900) setView('edit');
      const card = $(`[data-card="${id}"]`);
      if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // Click on the page to jump to that part of the editor.
  $('#sheet').addEventListener('click', (e) => {
    const blk = e.target.closest('.blk');
    if (blk) { setActive(blk.getAttribute('data-id'), true); return; }
    const go = e.target.closest('[data-go]');
    if (go) {
      ui.collapsed.invoice = false;
      renderEditor();
      if (window.innerWidth <= 900) setView('edit');
      const sec = $('[data-section="invoice"]');
      sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const f = $(e.target.closest('.client-bar') ? '[data-bind="d.client"]' : '[data-bind="d.number"]');
      if (f) f.focus({ preventScroll: true });
    }
  });

  /* Drag and drop to reorder block cards. */
  let dragId = null;
  editor.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-handle]');
    if (h) h.closest('.card').setAttribute('draggable', 'true');
  });
  editor.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    dragId = card.getAttribute('data-card');
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* ignore */ }
  });
  editor.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    const r = card.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    $$('.card').forEach((c) => c.classList.remove('drop-before', 'drop-after'));
    if (card.getAttribute('data-card') !== dragId) card.classList.add(after ? 'drop-after' : 'drop-before');
  });
  editor.addEventListener('drop', (e) => {
    if (!dragId) return;
    const card = e.target.closest('.card');
    e.preventDefault();
    if (card && card.getAttribute('data-card') !== dragId) {
      const after = card.classList.contains('drop-after');
      const from = doc.blocks.findIndex((b) => b.id === dragId);
      const [moved] = doc.blocks.splice(from, 1);
      let to = doc.blocks.findIndex((b) => b.id === card.getAttribute('data-card'));
      if (after) to += 1;
      doc.blocks.splice(to, 0, moved);
      changed({ editor: true, now: true });
    }
    endDrag();
  });
  editor.addEventListener('dragend', endDrag);
  function endDrag() {
    dragId = null;
    $$('.card').forEach((c) => { c.classList.remove('is-dragging', 'drop-before', 'drop-after'); c.removeAttribute('draggable'); });
  }

  /* --------------------------------------------------------------- top bar */
  $('#undoBtn').innerHTML = icon('undo');
  $('#redoBtn').innerHTML = icon('redo');
  $('#printBtn').innerHTML = `${icon('print')}<span>Print / Save PDF</span>`;
  $('#invoicesBtn').innerHTML = `${icon('files')}<span class="hide-narrow">My invoices</span>`;
  $('#newBtn').innerHTML = `${icon('newdoc')}<span>New</span>`;
  $('#drawerClose').innerHTML = icon('x');
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) { if (e.key === 'Escape') closeMenus(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    if (e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
    if (e.key.toLowerCase() === 'p') { e.preventDefault(); printNow(); }
  });

  const newMenu = $('#newMenu');
  newMenu.innerHTML = `
    <button type="button" data-new="en"><strong>New English invoice</strong><small>Next number, today’s date</small></button>
    <button type="button" data-new="ar"><strong>فاتورة جديدة بالعربية</strong><small>New Arabic invoice</small></button>
    <button type="button" data-new="dup"><strong>Duplicate this invoice</strong><small>Same content, new number and date</small></button>
    <hr>
    ${Object.entries(SAMPLES).map(([k, s]) => `<button type="button" data-new="sample:${k}"><strong>Original bill</strong><small>${esc(s.label)}</small></button>`).join('')}`;
  $('#newBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = newMenu.hidden;
    closeMenus();
    newMenu.hidden = !open;
    $('#newBtn').setAttribute('aria-expanded', String(open));
  });
  newMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-new]');
    if (!b) return;
    const kind = b.getAttribute('data-new');
    persist();
    let d;
    if (kind === 'en' || kind === 'ar') d = blankDoc(kind);
    else if (kind === 'dup') d = Object.assign(withIds(clone(doc)), { number: nextNumber(), date: today() });
    else d = withIds(clone(SAMPLES[kind.split(':')[1]].doc));
    const inv = addInvoice(d);
    save(KEYS.invoices, invoices);
    closeMenus();
    openInvoice(inv.id);
    toast(kind === 'dup' ? 'Copy created' : 'New invoice created');
  });
  function closeMenus() { newMenu.hidden = true; $('#newBtn').setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) closeMenus(); });

  /* Saved invoices drawer */
  function openDrawer() { $('#drawer').hidden = false; $('#scrim').hidden = false; renderInvoiceList(); $('#drawerSearch').focus(); }
  function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; }
  $('#invoicesBtn').addEventListener('click', () => { persist(); openDrawer(); });
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });
  $('#drawerSearch').addEventListener('input', renderInvoiceList);

  function renderInvoiceList() {
    const q = $('#drawerSearch').value.trim().toLowerCase();
    const list = invoices.filter((inv) => {
      const d = inv.doc;
      const hay = [d.number, d.client, d.title, ...(d.blocks || []).filter((b) => b.type === 'heading').map((b) => b.text)].join(' ').toLowerCase();
      return !q || hay.includes(q);
    });
    $('#invoiceList').innerHTML = list.length ? list.map((inv) => {
      const d = inv.doc;
      const heading = (d.blocks.find((b) => b.type === 'heading') || {}).text || '';
      const when = new Date(inv.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return `<div class="inv-row${inv.id === currentId ? ' is-current' : ''}">
        <button class="inv-open" type="button" data-open="${inv.id}">
          <strong dir="auto">${esc(d.client || 'No client yet')}</strong>
          <small dir="auto">${esc([d.number && `#${d.number}`, heading].filter(Boolean).join(' · ') || '—')}</small>
          <small>Edited ${esc(when)}${inv.id === currentId ? ' · open now' : ''}</small>
        </button>
        <span class="inv-amount" dir="auto">${esc(docTotal(d))}</span>
        <span class="inv-tools">
          <button class="btn btn-sm btn-quiet" type="button" data-export="${inv.id}">Export</button>
          <button class="btn btn-sm btn-quiet btn-danger" type="button" data-remove="${inv.id}">Delete</button>
        </span>
      </div>`;
    }).join('') : '<p class="empty">No invoices match.</p>';
  }
  $('#invoiceList').addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { persist(); openInvoice(o.getAttribute('data-open')); closeDrawer(); return; }
    const x = e.target.closest('[data-export]');
    if (x) {
      const inv = invoices.find((i) => i.id === x.getAttribute('data-export'));
      download(`invoice-${inv.doc.number || inv.id}.json`, { kind: 'invoice', version: 1, doc: inv.doc });
      return;
    }
    const r = e.target.closest('[data-remove]');
    if (r) {
      confirmClick(r, () => {
        const id = r.getAttribute('data-remove');
        invoices = invoices.filter((i) => i.id !== id);
        if (!invoices.length) addInvoice(blankDoc(doc.lang));
        save(KEYS.invoices, invoices);
        if (id === currentId) openInvoice(invoices[0].id);
        renderInvoiceList();
        toast('Invoice deleted');
      });
    }
  });

  function download(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $('#backupBtn').addEventListener('click', () => {
    persist();
    download(`invoices-backup-${today()}.json`, { kind: 'backup', version: 1, company, invoices });
  });
  $('#restoreBtn').addEventListener('click', () => { $('#importFile').value = ''; $('#importFile').click(); });
  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.kind === 'backup' && Array.isArray(data.invoices)) {
          const known = new Set(invoices.map((i) => i.id));
          const added = data.invoices.filter((i) => i && i.doc && !known.has(i.id));
          invoices = added.concat(invoices);
          if (data.company) company = Object.assign(clone(COMPANY), data.company);
          save(KEYS.invoices, invoices); save(KEYS.company, company);
          renderAll(); renderInvoiceList();
          toast(`Restored ${added.length} invoice${added.length === 1 ? '' : 's'}`);
        } else if (data.doc && Array.isArray(data.doc.blocks)) {
          const inv = addInvoice(withIds(data.doc));
          save(KEYS.invoices, invoices);
          openInvoice(inv.id); closeDrawer();
          toast('Invoice imported');
        } else {
          toast('That file is not an invoice or backup from this app');
        }
      } catch (err) {
        toast('Could not read that file. Choose a .json file exported from this app.');
      }
    };
    reader.readAsText(file);
  });

  /* Print: copy the page, unscaled, into a print-only container. */
  function preparePrint() {
    let root = $('.print-root');
    if (!root) { root = document.createElement('div'); root.className = 'print-root'; document.body.appendChild(root); }
    const sheet = $('#sheet').cloneNode(true);
    sheet.removeAttribute('id');
    sheet.style.transform = 'none';
    sheet.style.minHeight = '';
    $$('.page-guide', sheet).forEach((g) => g.remove());
    $$('.is-active', sheet).forEach((g) => g.classList.remove('is-active'));
    root.innerHTML = '';
    root.appendChild(sheet);
  }
  function cleanupPrint() { const r = $('.print-root'); if (r) r.remove(); }
  function printNow() {
    persist();
    preparePrint();
    const prevTitle = document.title;
    document.title = [doc.title, doc.number, doc.client].filter(Boolean).join(' - ');
    const done = () => { document.title = prevTitle; };
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => setTimeout(() => { window.print(); done(); }, 50));
  }
  $('#printBtn').addEventListener('click', printNow);
  window.addEventListener('beforeprint', () => { if (!$('.print-root')) preparePrint(); });
  window.addEventListener('afterprint', cleanupPrint);

  /* Mobile view switch */
  function setView(v) {
    $('#app').setAttribute('data-view', v);
    $$('.view-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === v)));
    if (v === 'preview') requestAnimationFrame(layoutPreview);
  }
  $$('.view-switch button').forEach((b) => b.addEventListener('click', () => setView(b.getAttribute('data-view'))));

  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layoutPreview, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layoutPreview());
  window.addEventListener('beforeunload', persist);

  openInvoice(currentId);
})();
