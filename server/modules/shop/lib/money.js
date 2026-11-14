// All shop money is stored and compared as integer paise. Shopify and Fastrr
// send decimal strings / floats ("199.00", 1586.6800000000003); convert at the
// boundary and never do arithmetic on rupee floats.

const toPaise = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
};

// For outbound payloads that expect a decimal string (Fastrr catalog API).
const paiseToDecimalString = (paise) => (paise === null || paise === undefined ? null : (paise / 100).toFixed(2));

const paiseToRupees = (paise) => (paise === null || paise === undefined ? null : paise / 100);

module.exports = { toPaise, paiseToDecimalString, paiseToRupees };
