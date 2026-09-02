// Standard 5-zone %-of-max-HR model used to break a session's heart-rate
// samples into effort bands.
const ZONE_BOUNDS = [
  { key: 'zone1', min: 0.5, max: 0.6 },
  { key: 'zone2', min: 0.6, max: 0.7 },
  { key: 'zone3', min: 0.7, max: 0.8 },
  { key: 'zone4', min: 0.8, max: 0.9 },
  { key: 'zone5', min: 0.9, max: Infinity }
];

const FALLBACK_MAX_HR = 190;

function estimateMaxHR(ageYears) {
  const age = Number(ageYears);
  if (age > 0) return 220 - age;
  return FALLBACK_MAX_HR;
}

/**
 * @param {Array<{timestamp: Date|string, bpm: number}>} samples - sorted or unsorted HR points
 * @param {number} maxHR
 * @returns {{zone1:number, zone2:number, zone3:number, zone4:number, zone5:number}} minutes per zone
 */
function computeZones(samples, maxHR) {
  const zones = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
  if (!Array.isArray(samples) || samples.length < 2 || !(maxHR > 0)) return zones;

  const sorted = [...samples].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const minutesElapsed = (new Date(next.timestamp) - new Date(current.timestamp)) / 60000;
    if (!(minutesElapsed > 0) || minutesElapsed > 30) continue; // skip gaps/bad data

    const pctOfMax = current.bpm / maxHR;
    const zone = ZONE_BOUNDS.find((z) => pctOfMax >= z.min && pctOfMax < z.max);
    if (zone) zones[zone.key] += minutesElapsed;
  }

  Object.keys(zones).forEach((k) => { zones[k] = Math.round(zones[k] * 10) / 10; });
  return zones;
}

/**
 * @param {Array<{bpm: number}>} samples
 * @returns {{avg: number, min: number, max: number} | null}
 */
function summarizeHeartRate(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const bpms = samples.map((s) => s.bpm).filter((b) => Number(b) > 0);
  if (bpms.length === 0) return null;

  const sum = bpms.reduce((acc, b) => acc + b, 0);
  return {
    avg: Math.round(sum / bpms.length),
    min: Math.min(...bpms),
    max: Math.max(...bpms)
  };
}

module.exports = { estimateMaxHR, computeZones, summarizeHeartRate, ZONE_BOUNDS };
