// Chat -> app logs for water, sleep, smoking and alcohol (25 Nov, user request).
//
// Flow: the classifier extracts `activityLogs`; `prepare` turns them into exact
// entries and the coach shows them ("Log: Water 2 glasses (500 ml)? yes / no");
// on "yes" `save` writes them through services/activityLogService.js, the same
// code the app's screens use. Nothing is saved without that yes, and nothing is
// guessed: no amount -> ask; unknown drink -> ask; a drink size not said ->
// the catalog's standard size, shown in ml on the card so the user can see it.

const activityLog = require('../../../services/activityLogService');
const { isValidDrinkType, getSizeDefaults } = require('../../../config/drinkCatalog');

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY = 86400000;
// The user's own calendar day (India), like the app's screens use.
const istDateKey = (now, daysBack = 0) => new Date(now.getTime() + IST_OFFSET_MS - daysBack * DAY).toISOString().slice(0, 10);
const BOTTLE_ML = 1000;

const fmtMinutes = (min) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
};

function waterEntry(log, glassMl) {
    let ml;
    let shown;
    if (log.unit === 'ml') { ml = log.amount; shown = `${Math.round(ml)} ml`; }
    else if (log.unit === 'litre') { ml = log.amount * 1000; shown = `${log.amount} L`; }
    else if (log.unit === 'bottle') { ml = log.amount * BOTTLE_ML; shown = `${log.amount} bottle${log.amount === 1 ? '' : 's'} (${Math.round(ml)} ml)`; }
    else { ml = log.amount * glassMl; shown = `${log.amount} glass${log.amount === 1 ? '' : 'es'} (${Math.round(ml)} ml)`; }
    if (!(ml > 0 && ml <= 6000)) return null;
    return { kind: 'water', addMl: Math.round(ml), label: `Water: ${shown}` };
}

function sleepEntry(log, now) {
    const minutes = log.unit === 'minutes' ? log.amount : log.amount * 60;
    if (!(minutes >= 30 && minutes <= 16 * 60)) return null;
    // Sleep is dated by the morning you wake up (as the app shows it).
    const dateKey = istDateKey(now, log.when === 'yesterday' ? 1 : 0);
    const when = log.when === 'yesterday' ? 'the night before last' : 'last night';
    return { kind: 'sleep', minutes: Math.round(minutes), dateKey, label: `Sleep ${when}: ${fmtMinutes(minutes)}` };
}

function smokeEntry(log, now) {
    const count = Math.round(log.amount);
    if (!(count >= 1 && count <= 100)) return null;
    const dateKey = istDateKey(now, log.when === 'yesterday' ? 1 : 0);
    return { kind: 'smoke', count, dateKey, label: `Cigarettes${log.when === 'yesterday' ? ' (yesterday)' : ''}: ${count}` };
}

function alcoholEntry(log, now) {
    const count = Math.round(log.amount);
    if (!(count >= 1 && count <= 20)) return null;
    if (!log.drinkType || log.drinkType === 'other' || !isValidDrinkType(log.drinkType)) return 'needs_type';
    const size = ['small', 'medium', 'large'].includes(log.drinkSize) ? log.drinkSize : 'small';
    const defaults = getSizeDefaults(log.drinkType, size);
    if (!defaults) return 'needs_type';
    const name = log.drinkType.replace(/_/g, ' ');
    return {
        kind: 'alcohol', drinkType: log.drinkType, size, count,
        dateKey: istDateKey(now, log.when === 'yesterday' ? 1 : 0),
        label: `${count} × ${name} (${defaults.volumeMl} ml${count > 1 ? ' each' : ''})${log.when === 'yesterday' ? ', yesterday' : ''}`,
    };
}

function createActivityLogTools({ service = activityLog, logger = console } = {}) {
    // -> { entries, needsAmount: [kind], needsDrinkType: bool }
    async function prepare(userId, logs = [], { now = new Date() } = {}) {
        const entries = [];
        const needsAmount = [];
        let needsDrinkType = false;
        let glassMl = null;
        for (const log of logs) {
            if (!(log.amount > 0)) { needsAmount.push(log.kind); continue; }
            let entry = null;
            if (log.kind === 'water') {
                glassMl = glassMl ?? await service.getGlassSizeMl(userId).catch(() => 250);
                entry = waterEntry(log, glassMl);
            } else if (log.kind === 'sleep') entry = sleepEntry(log, now);
            else if (log.kind === 'smoke') entry = smokeEntry(log, now);
            else if (log.kind === 'alcohol') entry = alcoholEntry(log, now);
            if (entry === 'needs_type') needsDrinkType = true;
            else if (entry) entries.push(entry);
            else needsAmount.push(log.kind); // amount out of range: ask again rather than save it
        }
        return { entries, needsAmount: [...new Set(needsAmount)], needsDrinkType };
    }

    // Writes each confirmed entry; one failure doesn't stop the others.
    // -> [{ kind, label, ok, detail }]
    async function save(userId, entries = [], { now = new Date() } = {}) {
        const results = [];
        for (const e of entries) {
            try {
                if (e.kind === 'water') {
                    const dateKey = istDateKey(now);
                    const current = await service.getWaterTotal(userId, dateKey);
                    const { totalMl } = await service.setWaterTotal(userId, current + e.addMl, dateKey);
                    results.push({ kind: e.kind, label: e.label, ok: true, detail: `today's total now ${totalMl} ml` });
                } else if (e.kind === 'sleep') {
                    await service.saveSleep(userId, { deviceType: 'manual', sleepData: { date: e.dateKey, totalSleepMinutes: e.minutes } });
                    results.push({ kind: e.kind, label: e.label, ok: true });
                } else if (e.kind === 'smoke') {
                    const { dayCount } = await service.addSmokes(userId, { count: e.count, dateKey: e.dateKey });
                    results.push({ kind: e.kind, label: e.label, ok: true, detail: `${dayCount} logged for that day` });
                } else if (e.kind === 'alcohol') {
                    let day = null;
                    for (let i = 0; i < e.count; i++) {
                        ({ day } = await service.logAlcoholDrink(userId, { drinkType: e.drinkType, size: e.size, date: e.dateKey }));
                    }
                    results.push({ kind: e.kind, label: e.label, ok: true, detail: day?.count ? `${day.count} drink(s) logged for that day` : undefined });
                }
            } catch (err) {
                logger.error(`[AICoach] ${e.kind} log failed: ${err.message}`);
                results.push({ kind: e.kind, label: e.label, ok: false });
            }
        }
        return results;
    }

    return { prepare, save };
}

module.exports = { createActivityLogTools, istDateKey, waterEntry, sleepEntry, smokeEntry, alcoholEntry };
