// Indian state / UT name -> Shopify province code (ISO 3166-2:IN style, as used
// by the Take Limited store's own orders: Maharashtra -> MH, Delhi -> DL, ...).
// Fastrr gives us the state as a name; Shopify's orderCreate wants the code.

const CODES = {
    'andaman and nicobar islands': 'AN',
    'andhra pradesh': 'AP',
    'arunachal pradesh': 'AR',
    assam: 'AS',
    bihar: 'BR',
    chandigarh: 'CH',
    chhattisgarh: 'CG',
    'dadra and nagar haveli': 'DN',
    'dadra and nagar haveli and daman and diu': 'DN',
    'daman and diu': 'DD',
    delhi: 'DL',
    'nct of delhi': 'DL',
    'new delhi': 'DL',
    goa: 'GA',
    gujarat: 'GJ',
    haryana: 'HR',
    'himachal pradesh': 'HP',
    'jammu and kashmir': 'JK',
    jharkhand: 'JH',
    karnataka: 'KA',
    kerala: 'KL',
    ladakh: 'LA',
    lakshadweep: 'LD',
    'madhya pradesh': 'MP',
    maharashtra: 'MH',
    manipur: 'MN',
    meghalaya: 'ML',
    mizoram: 'MZ',
    nagaland: 'NL',
    odisha: 'OR',
    orissa: 'OR',
    puducherry: 'PY',
    pondicherry: 'PY',
    punjab: 'PB',
    rajasthan: 'RJ',
    sikkim: 'SK',
    'tamil nadu': 'TN',
    telangana: 'TS',
    tripura: 'TR',
    'uttar pradesh': 'UP',
    uttarakhand: 'UK',
    uttaranchal: 'UK',
    'west bengal': 'WB',
};

const VALID = new Set(Object.values(CODES));

const normalise = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/** "Maharashtra" / "MH" / "Tamil  Nadu" -> code, or null if unknown. */
const stateCode = (state) => {
    const raw = String(state || '').trim();
    if (/^[A-Za-z]{2}$/.test(raw) && VALID.has(raw.toUpperCase())) return raw.toUpperCase();
    return CODES[normalise(raw)] || null;
};

module.exports = { stateCode };
