// Generates a branded PDF invoice for a paid subscription Payment record.
// Layout follows the reference format the user supplied (OpenRouter-style: header,
// From/Bill-to columns, prominent amount-due line, itemized table, footer).

const PDFDocument = require('pdfkit');

const COMPANY_INFO = {
  name: 'Colab Platforms',
  address: 'Samant Estate, Takshashila Building, B-202, Goregaon East, Mumbai 400063, Maharashtra, India',
  gstin: '27AAACJ0114B1ZG',
  email: 'tech@colabplatforms.com',
};

function generateInvoiceNumber(payment) {
  const date = payment.createdAt || new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const shortId = payment._id.toString().slice(-6).toUpperCase();
  return `INV-${yyyymm}-${shortId}`;
}

// Streams a PDF invoice directly to an Express response.
function streamInvoicePDF(res, { payment, user, plan }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payment.invoiceNumber}.pdf"`);
  doc.pipe(res);

  const issueDate = new Date(payment.createdAt);
  const formattedDate = issueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Title
  doc.fillColor('#000').fontSize(24).font('Helvetica-Bold').text('Invoice');
  doc.moveDown(0.8);

  // Invoice meta (number / date of issue / date due)
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');
  const metaLabelX = 50, metaValueX = 160, metaLineHeight = 16;
  let metaY = doc.y;
  const metaRows = [
    ['Invoice number', payment.invoiceNumber],
    ['Date of issue', formattedDate],
    ['Date due', formattedDate],
  ];
  metaRows.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text(label, metaLabelX, metaY);
    doc.font('Helvetica').fontSize(9).fillColor('#333').text(value, metaValueX, metaY);
    metaY += metaLineHeight;
  });
  doc.moveDown(2);

  // From / Bill to columns
  const colTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(COMPANY_INFO.name, 50, colTop);
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(COMPANY_INFO.address, 50, doc.y + 4, { width: 220 })
    .text(COMPANY_INFO.email, 50, doc.y + 2)
    .text(`GSTIN: ${COMPANY_INFO.gstin}`, 50, doc.y + 2);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('Bill to', 320, colTop);
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(user.name || user.email, 320, doc.y + 4, { width: 220 })
    .text(user.email, 320, doc.y + 2);

  doc.y = Math.max(doc.y, colTop + 90);
  doc.moveDown(1.5);

  // Amount due headline
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#000')
    .text(`Rs. ${payment.amount.toFixed(2)} due ${formattedDate}`, 50, doc.y);
  doc.moveDown(1);

  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(`${plan.name} Plan subscription`, 50, doc.y);
  doc.moveDown(1.5);

  // Line-items table
  const tableTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  doc.text('Description', 50, tableTop, { width: 260 });
  doc.text('Qty', 320, tableTop, { width: 50, align: 'right' });
  doc.text('Unit price', 380, tableTop, { width: 70, align: 'right' });
  doc.text('Amount', 460, tableTop, { width: 90, align: 'right' });
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#ddd').stroke();

  const rowY = tableTop + 25;
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  doc.text(`${plan.name} Plan — ${plan.billingCycle} billing`, 50, rowY, { width: 260 });
  doc.text('1', 320, rowY, { width: 50, align: 'right' });
  doc.text(`Rs. ${payment.amount.toFixed(2)}`, 380, rowY, { width: 70, align: 'right' });
  doc.text(`Rs. ${payment.amount.toFixed(2)}`, 460, rowY, { width: 90, align: 'right' });

  const totalsTop = rowY + 30;
  doc.moveTo(320, totalsTop).lineTo(550, totalsTop).strokeColor('#ddd').stroke();

  const totalsRows = [
    ['Subtotal', payment.amount],
    ['Total', payment.amount],
  ];
  let totalsY = totalsTop + 10;
  totalsRows.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(9).fillColor('#333').text(label, 380, totalsY, { width: 70, align: 'right' });
    doc.text(`Rs. ${value.toFixed(2)}`, 460, totalsY, { width: 90, align: 'right' });
    totalsY += 16;
  });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text('Amount due', 380, totalsY, { width: 70, align: 'right' });
  doc.text(`Rs. ${payment.amount.toFixed(2)}`, 460, totalsY, { width: 90, align: 'right' });

  doc.moveDown(4);
  doc.font('Helvetica').fontSize(8).fillColor('#999').text(
    `Payment ID: ${payment.razorpayPaymentId || 'N/A'} — This is a system-generated invoice.`,
    50, Math.max(doc.y, totalsY + 40), { width: 450 }
  );

  doc.end();
}

module.exports = { generateInvoiceNumber, streamInvoicePDF, COMPANY_INFO };
