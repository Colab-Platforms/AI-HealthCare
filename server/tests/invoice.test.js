const test = require('node:test');
const assert = require('node:assert/strict');

const {
    financialYear, formatInvoiceNumber, invoiceFileName, renderInvoiceBuffer, viewFromLegacyPayment,
} = require('../services/invoiceService');

test('financial year flips on 1 April IST, not UTC', () => {
    assert.deepEqual(financialYear(new Date('2026-11-21T10:00:00Z')), { key: '2026-27', short: '26-27' });
    assert.deepEqual(financialYear(new Date('2027-03-31T18:00:00Z')), { key: '2026-27', short: '26-27' }, '31 Mar 23:30 IST');
    assert.deepEqual(financialYear(new Date('2027-03-31T18:30:00Z')), { key: '2027-28', short: '27-28' }, '1 Apr 00:00 IST');
    assert.deepEqual(financialYear(new Date('2099-06-01T00:00:00Z')), { key: '2099-00', short: '99-00' });
});

test('invoice number is sequential-padded and within the 16-char GST limit', () => {
    const n = formatInvoiceNumber('26-27', 1);
    assert.equal(n, 'TL/26-27/000001');
    assert.ok(n.length <= 16);
    assert.equal(formatInvoiceNumber('26-27', 123456), 'TL/26-27/123456');
});

test('file name strips path separators', () => {
    assert.equal(invoiceFileName('TL/26-27/000001'), 'TL-26-27-000001');
    assert.equal(invoiceFileName('INV-202611-A3F9C2'), 'INV-202611-A3F9C2');
});

test('renders a PDF buffer', async () => {
    const view = viewFromLegacyPayment(
        { invoiceNumber: 'TL/26-27/000001', amount: 299, createdAt: new Date(), razorpaySubscriptionId: 'sub_x' },
        { name: 'Test', email: 't@example.com' },
        { name: 'Take Plus', billingCycle: 'monthly' }
    );
    const buf = await renderInvoiceBuffer(view);
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buf.length > 2000);
});
