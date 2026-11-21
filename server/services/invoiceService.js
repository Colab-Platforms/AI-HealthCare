// Renders the subscription invoice PDF.
// Layout: logo header with invoice no/date/PAID badge, Billed-to / From columns,
// one-line item table, totals, company footer.
//
// Rendering works from a plain "view" object so the same layout serves:
//   - Invoice documents (snapshot taken at issue time)   -> viewFromInvoice
//   - older Payments issued before the Invoice collection -> viewFromLegacyPayment

const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const COMPANY_INFO = {
  name: 'TAKE Limited',
  brand: 'take.health',
  addressLines: ['1702, Parine Crescenzo Bld, Opp. MCA Grnd,', 'BKC, Plot C, Bandra (East), Mumbai - 400051'],
  gstin: '33AABCT3684M1Z0',
  supportEmail: 'support@takelimited.com',
};

// GST: invoice serial must be consecutive and unique within a financial year, max 16 chars.
const INVOICE_PREFIX = 'TL';

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'take-wordmark.png');
const LOGO_AVAILABLE = fs.existsSync(LOGO_PATH);

const COLORS = {
  text: '#1a1a1a',
  body: '#333333',
  muted: '#8a8a8a',
  faint: '#9a9a9a',
  totals: '#5b6b9a',
  line: '#dddddd',
  paidText: '#1e7a3c',
  paidBg: '#e6f4ea',
  paidBorder: '#b7dfc2',
};

const PAGE = { left: 50, right: 545, width: 495 };
const IST_OFFSET_MS = 330 * 60 * 1000;

// Indian financial year (1 April – 31 March, IST) a date falls in.
// 2026-11-21 -> { key: '2026-27', short: '26-27' }
function financialYear(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  const yy = (n) => String(n % 100).padStart(2, '0');
  return { key: `${start}-${yy(start + 1)}`, short: `${yy(start)}-${yy(start + 1)}` };
}

// TL/26-27/000001 (15 chars)
function formatInvoiceNumber(fyShort, seq) {
  return `${INVOICE_PREFIX}/${fyShort}/${String(seq).padStart(6, '0')}`;
}

// Safe for file names / Cloudinary public IDs ("/" is a path separator there).
function invoiceFileName(invoiceNumber) {
  return String(invoiceNumber).replace(/[^A-Za-z0-9-]+/g, '-');
}

// "Mon Jul 20 2026" in IST — servers run in UTC, which would show the wrong day
// for payments made between midnight and 05:30 IST.
function formatInvoiceDate(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.weekday} ${parts.month} ${parts.day} ${parts.year}`;
}

// "INR 299" for whole amounts, "INR 299.50" otherwise.
function formatAmount(amount) {
  const n = Number(amount) || 0;
  return `INR ${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function sellerSnapshot() {
  return { name: COMPANY_INFO.name, addressLines: [...COMPANY_INFO.addressLines], gstin: COMPANY_INFO.gstin };
}

function viewFromInvoice(inv) {
  return {
    invoiceNumber: inv.invoiceNumber,
    issuedAt: inv.issuedAt,
    billedTo: inv.billedTo,
    seller: inv.seller,
    item: inv.item,
    amount: inv.amount,
    razorpayPaymentId: inv.razorpayPaymentId,
  };
}

// Payments paid before Invoice documents existed: rendered from live data, as before.
function viewFromLegacyPayment(payment, user, plan) {
  return {
    invoiceNumber: payment.invoiceNumber,
    issuedAt: payment.createdAt,
    billedTo: { name: user.name, email: user.email },
    seller: sellerSnapshot(),
    item: { planName: plan.name, billingCycle: plan.billingCycle, autoRenew: !!payment.razorpaySubscriptionId },
    amount: payment.amount,
    razorpayPaymentId: payment.razorpayPaymentId,
  };
}

function drawLine(doc, y, { from = PAGE.left, to = PAGE.right, color = COLORS.line, width = 1 } = {}) {
  doc.save().moveTo(from, y).lineTo(to, y).lineWidth(width).strokeColor(color).stroke().restore();
}

// Draws the whole invoice onto an open PDFKit document (caller pipes and ends it).
function renderInvoice(doc, view) {
  const { billedTo, seller, item } = view;
  const issueDate = formatInvoiceDate(new Date(view.issuedAt || Date.now()));
  const amount = formatAmount(view.amount);
  const cycle = item.billingCycle || 'monthly';
  const billingNote = item.autoRenew ? `Auto-renews ${cycle}` : 'One-time payment';
  const addressLines = seller.addressLines || [];

  // ── Header ──────────────────────────────────────────────
  const top = 50;
  let brandX = PAGE.left;
  if (LOGO_AVAILABLE) {
    doc.image(LOGO_PATH, PAGE.left, top + 2, { height: 16 });
    brandX = PAGE.left + 74;
  }
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.text).text(COMPANY_INFO.brand, brandX, top + 2);

  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.text)
    .text('INVOICE', PAGE.left, top - 4, { width: PAGE.width, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
    .text(`#${view.invoiceNumber}`, PAGE.left, top + 22, { width: PAGE.width, align: 'right' })
    .text(issueDate, PAGE.left, top + 35, { width: PAGE.width, align: 'right' });

  // PAID pill
  const pillW = 46, pillH = 18, pillX = PAGE.right - pillW, pillY = top + 52;
  doc.save()
    .roundedRect(pillX, pillY, pillW, pillH, 9)
    .fillAndStroke(COLORS.paidBg, COLORS.paidBorder)
    .restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.paidText)
    .text('PAID', pillX, pillY + 5.5, { width: pillW, align: 'center' });

  drawLine(doc, top + 85);

  // ── Billed to / From ────────────────────────────────────
  const partyTop = top + 105;
  const half = PAGE.width / 2;

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    .text('BILLED TO', PAGE.left, partyTop, { characterSpacing: 0.5 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text)
    .text(billedTo.name || billedTo.email, PAGE.left, partyTop + 16, { width: half - 10 });
  if (billedTo.name && billedTo.email) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
      .text(billedTo.email, PAGE.left, doc.y + 3, { width: half - 10 });
  }

  const fromX = PAGE.left + half;
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    .text('FROM', fromX, partyTop, { width: half, align: 'right', characterSpacing: 0.5 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text)
    .text(seller.name, fromX, partyTop + 16, { width: half, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.body);
  let fromY = partyTop + 31;
  addressLines.forEach((line) => {
    doc.text(line, fromX, fromY, { width: half, align: 'right' });
    fromY += 13;
  });
  if (seller.gstin) doc.text(`GSTIN: ${seller.gstin}`, fromX, fromY, { width: half, align: 'right' });

  // ── Item table ──────────────────────────────────────────
  const cols = {
    desc: { x: PAGE.left + 8, w: 240 },
    qty: { x: 300, w: 50 },
    unit: { x: 370, w: 85 },
    amount: { x: 455, w: 82 },
  };
  const tableTop = partyTop + 90;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
  doc.text('DESCRIPTION', cols.desc.x, tableTop, { width: cols.desc.w, characterSpacing: 0.5 });
  doc.text('QTY', cols.qty.x, tableTop, { width: cols.qty.w, align: 'right', characterSpacing: 0.5 });
  doc.text('UNIT PRICE', cols.unit.x, tableTop, { width: cols.unit.w, align: 'right', characterSpacing: 0.5 });
  doc.text('AMOUNT', cols.amount.x, tableTop, { width: cols.amount.w, align: 'right', characterSpacing: 0.5 });
  drawLine(doc, tableTop + 16);

  const rowY = tableTop + 28;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
  doc.text(`${item.planName} (${cycle.toUpperCase()})`, cols.desc.x, rowY, { width: cols.desc.w });
  doc.text('1', cols.qty.x, rowY, { width: cols.qty.w, align: 'right' });
  doc.text(amount, cols.unit.x, rowY, { width: cols.unit.w, align: 'right' });
  doc.text(amount, cols.amount.x, rowY, { width: cols.amount.w, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    .text(billingNote, cols.desc.x, rowY + 14, { width: cols.desc.w });
  drawLine(doc, rowY + 34);

  // ── Totals ──────────────────────────────────────────────
  let totalsY = rowY + 46;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.totals);
  [['Subtotal', amount], ['Total', amount]].forEach(([label, value]) => {
    doc.text(label, cols.unit.x - 40, totalsY, { width: cols.unit.w + 40, align: 'right' });
    doc.text(value, cols.amount.x, totalsY, { width: cols.amount.w, align: 'right' });
    totalsY += 24;
  });
  drawLine(doc, totalsY - 6, { color: COLORS.text, width: 1.2 });

  totalsY += 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
  doc.text('Amount paid', cols.unit.x - 40, totalsY, { width: cols.unit.w + 40, align: 'right' });
  doc.text(amount, cols.amount.x, totalsY, { width: cols.amount.w, align: 'right' });

  // ── Footer ──────────────────────────────────────────────
  const footTop = totalsY + 50;
  drawLine(doc, footTop);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text)
    .text(seller.name, PAGE.left, footTop + 18);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.body);
  let addrY = footTop + 34;
  addressLines.forEach((line) => {
    doc.text(line, PAGE.left, addrY);
    addrY += 13;
  });
  if (seller.gstin) {
    doc.text(`GSTIN: ${seller.gstin}`, PAGE.left, addrY);
    addrY += 13;
  }

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.faint).text(
    `This is a system-generated invoice for your ${COMPANY_INFO.brand} subscription and does not `
    + `require a physical signature. For billing queries, contact ${COMPANY_INFO.supportEmail} `
    + 'and reference the invoice number above.',
    PAGE.left + half, footTop + 18, { width: half, align: 'right', lineGap: 2 }
  );
  if (view.razorpayPaymentId) {
    doc.text(`Payment ID: ${view.razorpayPaymentId}`, PAGE.left + half, doc.y + 4, { width: half, align: 'right' });
  }

  const thanksY = Math.max(doc.y, addrY) + 30;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
    .text(`Thank you for choosing ${COMPANY_INFO.brand}`, PAGE.left, thanksY, { width: PAGE.width, align: 'center' });
}

function newDoc() {
  return new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Invoice', Author: COMPANY_INFO.name } });
}

// Whole PDF in memory — for the email attachment and the Cloudinary upload (~10 KB).
function renderInvoiceBuffer(view) {
  return new Promise((resolve, reject) => {
    const doc = newDoc();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderInvoice(doc, view);
    doc.end();
  });
}

function setPdfHeaders(res, invoiceNumber) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoiceFileName(invoiceNumber)}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
}

// Streams a freshly rendered PDF to an Express response.
function streamInvoicePDF(res, view) {
  const doc = newDoc();
  setPdfHeaders(res, view.invoiceNumber);
  doc.pipe(res);
  renderInvoice(doc, view);
  doc.end();
}

module.exports = {
  COMPANY_INFO,
  financialYear,
  formatInvoiceNumber,
  invoiceFileName,
  sellerSnapshot,
  viewFromInvoice,
  viewFromLegacyPayment,
  renderInvoice,
  renderInvoiceBuffer,
  setPdfHeaders,
  streamInvoicePDF,
};
