/**
 * States and union territories offered in the profile's State dropdown.
 *
 * Must stay in sync with INDIAN_STATES in server/config/indiaRegions.js, which
 * maps each one to a cuisine region for the diet prompt. A state offered here
 * but missing there would silently fall back to region "other" — the exact
 * situation this feature exists to remove. The server guards its half with a
 * test that asserts every state maps to a real region, and canonicalises
 * whatever it receives, so a drift here degrades rather than breaks.
 *
 * Alphabetical: the order users scan.
 */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export default INDIAN_STATES;
