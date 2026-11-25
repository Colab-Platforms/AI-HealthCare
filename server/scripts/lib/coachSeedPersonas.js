/**
 * Test personas for the AI Coach on STAGING (used by createCoachTestUser.js).
 * Two users in different age bands, so the app's own targets differ
 * (exerciseGuidanceService: 18-64 adult vs 65+ older adult; age-based sleep
 * range; BMR-based calories from nutritionGoalCalculator):
 *
 *   a  Rahul, 24, male    muscle gain, vegetarian, peanut allergy, low Vit D / B12,
 *                        steps 5k -> 9.5k over 6 months, 2-week sick break ~2 months
 *                        ago, short sleep last night + low recovery, leg day
 *                        yesterday, protein always short, last weigh-in 20 days ago,
 *                        lab report 5 months old, an unanalysed vault file.
 *   b  Sushila, 67, female type 2 diabetes (metformin) + hypertension, knee pain,
 *                        eggetarian, weight loss 88 -> 84.6 kg (last weigh-in 50 days
 *                        ago), fasting sugar 165 -> 135 (last reading 9 days ago),
 *                        two lab reports (HbA1c 8.4 -> 7.6), morning walks + yoga,
 *                        high-carb meals, light sleep with wake-ups.
 *
 * Everything is generated (deterministic PRNG per persona) relative to TODAY,
 * so a re-seed always gives "last night", "yesterday", "5 months ago".
 * Rows are tagged test_seed (deviceType / notes / file name) for clean removal.
 */

const SEED = 'test_seed';
const DAY = 86400000;
const DAYS = 180;

function prng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const dayUTC = (offset) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - offset);
    return d;
};
const at = (offset, hourUTC, minute = 0) => { const d = dayUTC(offset); d.setUTCHours(hourUTC, minute, 0, 0); return d; };
const dayStr = (d) => d.toISOString().slice(0, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const band = (s) => (s >= 85 ? { key: 'optimal', label: 'Optimal' } : s >= 70 ? { key: 'moderate', label: 'Moderate' } : s >= 50 ? { key: 'low', label: 'Low' } : { key: 'very_low', label: 'Very low' });
const weekday = (offset) => dayUTC(offset).getUTCDay(); // 0 Sun ... 6 Sat

// ── food (Indian meals; per item kcal / protein / carbs / fat / fibre) ───────
const F = (name, quantity, calories, protein, carbs, fats, fiber = 2) => ({ name, quantity, nutrition: { calories, protein, carbs, fats, fiber } });
const FOOD = {
    poha: F('Poha', '1 plate', 270, 5, 48, 7, 3),
    alooParatha: F('Aloo paratha', '2 pieces', 520, 12, 66, 22, 6),
    oatsMilk: F('Oats with milk', '1 bowl', 300, 12, 45, 8, 5),
    upma: F('Upma', '1 bowl', 250, 6, 40, 7, 3),
    idli: F('Idli with sambar', '3 idli', 310, 10, 56, 4, 5),
    paneerSandwich: F('Paneer sandwich', '2 slices', 380, 17, 40, 16, 3),
    curd: F('Curd', '1 katori', 100, 6, 7, 5, 0),
    roti2: F('Roti', '2 pieces', 240, 8, 46, 3, 6),
    dal: F('Dal tadka', '1 katori', 180, 9, 24, 5, 6),
    rice: F('Steamed rice', '1 plate', 260, 5, 57, 1, 1),
    rajma: F('Rajma', '1 katori', 210, 11, 30, 5, 8),
    bhindi: F('Bhindi sabzi', '1 katori', 140, 3, 12, 9, 4),
    paneerBhurji: F('Paneer bhurji', '1 katori', 300, 18, 8, 22, 1),
    khichdi: F('Moong dal khichdi', '1 bowl', 320, 12, 55, 6, 5),
    soyaChunks: F('Soya chunks curry', '1 katori', 220, 24, 16, 7, 6),
    chole: F('Chole', '1 katori', 240, 11, 34, 7, 9),
    wheyShake: F('Whey protein shake', '1 scoop in water', 120, 24, 3, 1, 0),
    banana: F('Banana', '1 medium', 105, 1, 27, 0, 3),
    chaiBiscuit: F('Chai with biscuits', '1 cup + 2 biscuits', 160, 3, 24, 6, 0),
    samosa: F('Samosa', '1 piece', 260, 4, 30, 14, 2),
    sprouts: F('Sprouts chaat', '1 bowl', 150, 9, 24, 2, 6),
    boiledEggs: F('Boiled eggs', '2 eggs', 155, 13, 1, 11, 0),
    vegPulao: F('Veg pulao', '1 plate', 330, 7, 58, 8, 3),
    sweets: F('Gulab jamun', '2 pieces', 300, 4, 50, 10, 0),
    lassi: F('Sweet lassi', '1 glass', 220, 7, 34, 6, 0),
    besanChilla: F('Besan chilla', '2 pieces', 280, 14, 30, 11, 5),
    fruitBowl: F('Papaya bowl', '1 bowl', 90, 1, 22, 0, 3),
    eggBhurji: F('Egg bhurji', '2 eggs', 210, 14, 3, 16, 0),
};

// ── persona definitions ─────────────────────────────────────────────────────

const PERSONAS = {
    a: {
        key: 'a',
        email: 'coach-test@example.invalid',
        name: 'Rahul Coach Test',
        seed: 24,
        profile: {
            age: 24, gender: 'male', height: 176, weight: 74,
            dietaryPreference: 'vegetarian',
            allergies: ['Peanut'],
            healthConditions: ['Vitamin Deficiency'],
            isDiabetic: 'no',
            medicalHistory: { currentMedications: [], surgeries: [], familyHistory: ['Father: High Cholesterol'] },
            activityLevel: 'moderately_active',
            profession: 'desk_job',
            goals: ['Build Muscle', 'Better Sleep', 'Improve Energy'],
            // no stepGoal / sleepGoalHours: the app derives them from age
            lifestyle: { smoker: false, alcohol: true, alcoholFrequency: 'occasional', sleepHours: 7, stressLevel: 'moderate', waterGoalMl: 3000 },
        },
        goal: { goal: 'muscle_gain', targetWeight: 78, weeklyGoal: 0.25 },
        limitations: [],
    },
    b: {
        key: 'b',
        email: 'coach-test-b@example.invalid',
        name: 'Sushila Coach Test',
        seed: 67,
        profile: {
            age: 67, gender: 'female', height: 158, weight: 85,
            dietaryPreference: 'eggetarian',
            allergies: [],
            healthConditions: ['Diabetes', 'Hypertension'],
            isDiabetic: 'yes',
            diabetesProfile: { type: 'Type 2', diagnosisYear: 2016, status: 'Controlled' },
            medicalHistory: { currentMedications: ['Metformin 500mg twice daily', 'Amlodipine 5mg once daily'], surgeries: ['Cataract surgery (2023)'], familyHistory: ['Mother: Type 2 Diabetes'] },
            activityLevel: 'lightly_active',
            profession: 'other',
            goals: ['Manage Diabetes', 'Weight Management', 'Healthy Ageing'],
            lifestyle: { smoker: false, alcohol: false, sleepHours: 6.5, stressLevel: 'low', waterGoalMl: 2000 },
        },
        goal: { goal: 'weight_loss', targetWeight: 76, weeklyGoal: 0.25 },
        limitations: ['knee pain (osteoarthritis)'],
    },
};

// ── generators ──────────────────────────────────────────────────────────────

function generateA(uid) {
    const r = prng(PERSONAS.a.seed);
    const sick = (i) => i >= 60 && i <= 73; // flu ~2 months ago
    const sleep = []; const activity = []; const recovery = []; const workouts = []; const sleepByOffset = {};

    // workouts first (recovery depends on yesterday's load)
    const load = {};
    for (let i = DAYS - 1; i >= 1; i--) {
        if (sick(i)) continue;
        const wd = weekday(i);
        const phase = i > 120 ? 'start' : i > 74 ? 'build' : 'steady';
        const plan = phase === 'start' ? { 3: 'push' } : phase === 'build' ? { 1: 'push', 4: 'legs', 6: 'run' } : { 1: 'push', 3: 'pull', 5: 'legs', 6: 'run' };
        let kind = plan[wd];
        if (i === 1) kind = 'legs'; // leg day yesterday (the "tired + gym" test)
        if (!kind || (i > 1 && r() < 0.12)) continue; // missed sessions
        if (kind === 'run') {
            workouts.push({ activityType: 'running', category: 'cardio', duration: 25 + Math.round(r() * 15), intensity: 'medium', caloriesBurned: 280 + Math.round(r() * 80), timestamp: at(i, 1, 0) });
            load[i] = 1;
        } else {
            const high = kind === 'legs' && (i === 1 || r() < 0.5);
            workouts.push({ activityType: 'gym_strength', category: 'strength', duration: 50 + Math.round(r() * 15), intensity: high ? 'high' : 'medium', caloriesBurned: 300 + Math.round(r() * 100), timestamp: at(i, 13, 0), notes: `${kind} day` });
            load[i] = high ? 2 : 1;
        }
    }

    for (let i = DAYS - 1; i >= 0; i--) {
        const date = dayUTC(i);
        const wd = weekday(i);
        const weekend = wd === 0 || wd === 6;
        // Sleep: rows are dated by the morning they end. 10% nights not logged.
        if (i === 0 || r() > 0.1) {
            let mins;
            if (i === 0) mins = 312; // 5h12m last night
            else if (i <= 6) mins = 370 + Math.round(r() * 40); // rough last week
            else if (sick(i)) mins = 500 + Math.round(r() * 40);
            else mins = (weekend ? 470 : 400) + Math.round(r() * 45);
            const deepPct = i === 0 ? 0.10 : 0.15 + r() * 0.06;
            const remPct = i === 0 ? 0.15 : 0.19 + r() * 0.05;
            const awake = i === 0 ? 45 : 15 + Math.round(r() * 20);
            sleep.push({
                date, totalSleepMinutes: mins,
                deepSleepMinutes: Math.round(mins * deepPct), remSleepMinutes: Math.round(mins * remPct),
                lightSleepMinutes: Math.round(mins * (1 - deepPct - remPct)), awakeMinutes: awake,
                bedTime: new Date(date.getTime() - (mins + awake + 30) * 60000 + 1.5 * 3600000), // ~00:30 IST
                wakeTime: new Date(date.getTime() + 1.5 * 3600000), // ~07:00 IST
            });
            sleepByOffset[i] = mins;
        }
        // Steps: 5k -> 9.5k over 6 months; weekends +1.5k; sick break; 6% days missing.
        if (i === 0 || r() > 0.06) {
            let steps;
            if (i === 0) steps = 1200; // morning so far
            else if (sick(i)) steps = 1800 + Math.round(r() * 1500);
            else steps = Math.round(lerp(5000, 9500, (DAYS - i) / (DAYS - 30)) + (weekend ? 1500 : 0) + (r() - 0.5) * 3000);
            activity.push({ date, steps, activeMinutes: Math.round(steps / 190), caloriesBurned: Math.round(steps * 0.045) });
        }
        // Recovery: sleep + yesterday's training load; today very low.
        if (sleepByOffset[i] != null) {
            // usual ~60-75 for a fit 24-year-old; short sleep / hard training pull it down
            const base = 66 + (sleepByOffset[i] - 420) / 5 - (load[i + 1] || 0) * 5 + (r() - 0.5) * 8;
            const score = i === 0 ? 38 : Math.round(clamp(sick(i) ? base - 15 : base, 30, 92));
            recovery.push({ date: dayStr(date), recoveryScore: score, band: band(score) });
        }
    }

    // Food: last 60 days, ~70% of days logged; protein always short of target.
    const meals = [];
    const bf = [FOOD.poha, FOOD.alooParatha, FOOD.oatsMilk, FOOD.paneerSandwich, FOOD.besanChilla, FOOD.upma];
    const lunch = [[FOOD.roti2, FOOD.dal, FOOD.bhindi], [FOOD.rajma, FOOD.rice], [FOOD.chole, FOOD.rice], [FOOD.roti2, FOOD.dal, FOOD.curd], [FOOD.vegPulao, FOOD.curd]];
    const dinner = [[FOOD.roti2, FOOD.paneerBhurji], [FOOD.khichdi, FOOD.curd], [FOOD.roti2, FOOD.soyaChunks], [FOOD.roti2, FOOD.dal, FOOD.bhindi]];
    const snack = [[FOOD.chaiBiscuit], [FOOD.banana, FOOD.wheyShake], [FOOD.samosa, FOOD.chaiBiscuit], [FOOD.sprouts], [FOOD.wheyShake]];
    const pick = (list) => list[Math.floor(r() * list.length)];
    for (let i = 59; i >= 0; i--) {
        if (i === 0) { meals.push({ offset: 0, mealType: 'breakfast', items: [FOOD.poha, FOOD.chaiBiscuit], timestamp: at(0, 3, 0) }); continue; }
        if (r() < 0.3 || sick(i)) continue;
        meals.push({ offset: i, mealType: 'breakfast', items: [pick(bf)], timestamp: at(i, 3, 0) });
        meals.push({ offset: i, mealType: 'lunch', items: pick(lunch), timestamp: at(i, 7, 30) });
        if (r() < 0.75) meals.push({ offset: i, mealType: 'snack', items: pick(snack), timestamp: at(i, 11, 30) });
        if (r() < 0.85) meals.push({ offset: i, mealType: 'dinner', items: pick(dinner), timestamp: at(i, 15, 0) });
    }
    const water = {};
    for (const m of meals) if (m.offset > 0) water[m.offset] = 1500 + Math.round(r() * 8) * 250; // 1.5-3.5 L

    // Weight 71 -> 74 kg, every ~10 days, last one 20 days ago.
    const metrics = [];
    for (let i = 175; i >= 20; i -= 9 + Math.floor(r() * 4)) {
        metrics.push({ type: 'weight', value: Math.round((lerp(71, 73.9, (175 - i) / 155) + (r() - 0.5) * 0.6) * 10) / 10, unit: 'kg', recordedAt: at(i, 2, 0) });
    }
    metrics.push({ type: 'weight', value: 74, unit: 'kg', recordedAt: at(20, 2, 0) });

    const reports = [{
        offset: 150,
        reportType: 'Vitamin & Lipid Profile',
        summary: '• Vitamin D is low at 14 ng/mL and Vitamin B12 is low at 180 pg/mL.\n• LDL cholesterol is high at 142 mg/dL; HDL is normal.\n• Blood count, sugar and thyroid are normal.',
        healthScore: 68,
        metrics: {
            'Vitamin D (25-OH)': { value: 14, unit: 'ng/mL', status: 'low', normalRange: '30-100 ng/mL' },
            'Vitamin B12': { value: 180, unit: 'pg/mL', status: 'low', normalRange: '211-911 pg/mL' },
            'LDL Cholesterol': { value: 142, unit: 'mg/dL', status: 'high', normalRange: '< 100 mg/dL' },
            'HDL Cholesterol': { value: 46, unit: 'mg/dL', status: 'normal', normalRange: '> 40 mg/dL' },
            Triglycerides: { value: 138, unit: 'mg/dL', status: 'normal', normalRange: '< 150 mg/dL' },
            Hemoglobin: { value: 14.6, unit: 'g/dL', status: 'normal', normalRange: '13-17 g/dL' },
            'HbA1c': { value: 5.3, unit: '%', status: 'normal', normalRange: '< 5.7 %' },
            TSH: { value: 2.1, unit: 'mIU/L', status: 'normal', normalRange: '0.4-4.0 mIU/L' },
        },
    }];
    const vault = [{ offset: 10, title: 'Thyroid profile (Dr Lal PathLabs)', originalName: 'thyroid_profile.pdf' }];

    return { sleep, activity, recovery, workouts, meals, water, metrics, reports, vault };
}

function generateB(uid) {
    const r = prng(PERSONAS.b.seed);
    const sleep = []; const activity = []; const recovery = []; const workouts = []; const sleepByOffset = {};
    const walking = (i) => i <= 70; // started morning walks ~10 weeks ago

    for (let i = DAYS - 1; i >= 1; i--) {
        const wd = weekday(i);
        if (walking(i) && [1, 2, 4, 6].includes(wd) && r() > 0.15) {
            workouts.push({ activityType: 'walking', category: 'cardio', duration: 25 + Math.round(r() * 15), intensity: 'low', caloriesBurned: 90 + Math.round(r() * 40), timestamp: at(i, 1, 0) });
        }
        if (walking(i) && [3, 5].includes(wd) && r() > 0.25) {
            workouts.push({ activityType: 'yoga', category: 'flexibility', duration: 30, intensity: 'low', caloriesBurned: 70, timestamp: at(i, 1, 30), notes: 'chair yoga, knee-friendly' });
        }
    }

    for (let i = DAYS - 1; i >= 0; i--) {
        const date = dayUTC(i);
        if (r() > 0.12) {
            const mins = 350 + Math.round(r() * 60); // ~6h-6h50m
            const awake = 40 + Math.round(r() * 35); // wakes up at night
            sleep.push({
                date, totalSleepMinutes: mins,
                deepSleepMinutes: Math.round(mins * (0.10 + r() * 0.04)), remSleepMinutes: Math.round(mins * (0.17 + r() * 0.04)),
                lightSleepMinutes: Math.round(mins * 0.70), awakeMinutes: awake,
                bedTime: new Date(date.getTime() - (mins + awake) * 60000 - 0.5 * 3600000), // ~22:30 IST
                wakeTime: new Date(date.getTime() + 0.5 * 3600000), // ~06:00 IST
            });
            sleepByOffset[i] = mins;
        }
        if (r() > 0.08) {
            const steps = i === 0 ? 900 : Math.round((walking(i) ? lerp(4200, 5600, (70 - i) / 70) : 3200) + (r() - 0.5) * 1600);
            activity.push({ date, steps, activeMinutes: Math.round(steps / 260), caloriesBurned: Math.round(steps * 0.035) });
        }
        if (sleepByOffset[i] != null) {
            const score = Math.round(clamp(55 + (sleepByOffset[i] - 380) / 5 + (r() - 0.5) * 10, 35, 85));
            recovery.push({ date: dayStr(date), recoveryScore: score, band: band(score) });
        }
    }

    // Food: last 45 days, ~55% logged; carb-heavy, sweets twice a week.
    const meals = [];
    const pick = (list) => list[Math.floor(r() * list.length)];
    const bf = [[FOOD.poha, FOOD.chaiBiscuit], [FOOD.idli], [FOOD.upma, FOOD.chaiBiscuit], [FOOD.boiledEggs, FOOD.chaiBiscuit], [FOOD.oatsMilk]];
    const lunch = [[FOOD.rice, FOOD.dal, FOOD.bhindi], [FOOD.roti2, FOOD.dal], [FOOD.vegPulao, FOOD.curd], [FOOD.rice, FOOD.rajma]];
    const dinner = [[FOOD.roti2, FOOD.bhindi], [FOOD.khichdi], [FOOD.roti2, FOOD.eggBhurji], [FOOD.rice, FOOD.dal]];
    for (let i = 44; i >= 1; i--) {
        if (r() < 0.45) continue;
        meals.push({ offset: i, mealType: 'breakfast', items: pick(bf), timestamp: at(i, 2, 30) });
        meals.push({ offset: i, mealType: 'lunch', items: pick(lunch), timestamp: at(i, 7, 0) });
        meals.push({ offset: i, mealType: 'snack', items: r() < 0.3 ? [FOOD.sweets] : r() < 0.5 ? [FOOD.chaiBiscuit] : [FOOD.fruitBowl], timestamp: at(i, 11, 0) });
        meals.push({ offset: i, mealType: 'dinner', items: pick(dinner), timestamp: at(i, 14, 30) });
    }
    const water = {};
    for (const m of meals) water[m.offset] = 1000 + Math.round(r() * 4) * 250; // 1-2 L

    const metrics = [];
    // Weight 88 -> 84.6 kg every ~2 weeks, last 50 days ago (stale).
    for (let i = 178; i >= 50; i -= 13 + Math.floor(r() * 4)) {
        metrics.push({ type: 'weight', value: Math.round((lerp(88, 84.8, (178 - i) / 128) + (r() - 0.5) * 0.5) * 10) / 10, unit: 'kg', recordedAt: at(i, 2, 0) });
    }
    metrics.push({ type: 'weight', value: 84.6, unit: 'kg', recordedAt: at(50, 2, 0) });
    // Fasting sugar 3x a week, 165 -> 135, last reading 9 days ago (stale); some post-meal.
    for (let i = 178; i >= 9; i--) {
        const wd = weekday(i);
        if ([1, 3, 5].includes(wd) && r() > 0.2) {
            metrics.push({ type: 'blood_sugar', value: Math.round(lerp(165, 135, (178 - i) / 169) + (r() - 0.5) * 18), unit: 'mg/dL', readingContext: 'fasting', recordedAt: at(i, 1, 30) });
        }
        if (wd === 0 && r() > 0.3) {
            metrics.push({ type: 'blood_sugar', value: Math.round(lerp(225, 190, (178 - i) / 169) + (r() - 0.5) * 30), unit: 'mg/dL', readingContext: 'after_meal', recordedAt: at(i, 9, 0) });
        }
    }
    metrics.push({ type: 'blood_sugar', value: 138, unit: 'mg/dL', readingContext: 'fasting', recordedAt: at(9, 1, 30) });
    metrics.push({ type: 'hba1c', value: 8.4, unit: '%', recordedAt: at(160, 4, 0) });
    metrics.push({ type: 'hba1c', value: 7.6, unit: '%', recordedAt: at(40, 4, 0) });
    for (const i of [150, 110, 75, 40, 15]) {
        metrics.push({ type: 'blood_pressure', value: 0, unit: 'mmHg', systolic: 132 + Math.round(r() * 14), diastolic: 80 + Math.round(r() * 8), recordedAt: at(i, 3, 0) });
    }

    const reports = [
        {
            offset: 160,
            reportType: 'Diabetes Panel',
            summary: '• HbA1c is high at 8.4%, fasting sugar 168 mg/dL.\n• LDL cholesterol is high at 130 mg/dL.\n• Kidney function (creatinine) is normal.',
            healthScore: 52,
            metrics: {
                'HbA1c': { value: 8.4, unit: '%', status: 'high', normalRange: '< 5.7 % (diabetes target < 7 %)' },
                'Fasting Blood Sugar': { value: 168, unit: 'mg/dL', status: 'high', normalRange: '70-99 mg/dL' },
                'LDL Cholesterol': { value: 130, unit: 'mg/dL', status: 'high', normalRange: '< 100 mg/dL' },
                Creatinine: { value: 0.9, unit: 'mg/dL', status: 'normal', normalRange: '0.5-1.1 mg/dL' },
                TSH: { value: 3.2, unit: 'mIU/L', status: 'normal', normalRange: '0.4-4.0 mIU/L' },
            },
        },
        {
            offset: 40,
            reportType: 'Diabetes Panel',
            summary: '• HbA1c improved to 7.6% (from 8.4%), still above target.\n• Fasting sugar 142 mg/dL.\n• Vitamin D is low at 22 ng/mL. Creatinine normal.',
            healthScore: 61,
            metrics: {
                'HbA1c': { value: 7.6, unit: '%', status: 'high', normalRange: '< 5.7 % (diabetes target < 7 %)' },
                'Fasting Blood Sugar': { value: 142, unit: 'mg/dL', status: 'high', normalRange: '70-99 mg/dL' },
                'LDL Cholesterol': { value: 118, unit: 'mg/dL', status: 'high', normalRange: '< 100 mg/dL' },
                'Vitamin D (25-OH)': { value: 22, unit: 'ng/mL', status: 'low', normalRange: '30-100 ng/mL' },
                Creatinine: { value: 0.9, unit: 'mg/dL', status: 'normal', normalRange: '0.5-1.1 mg/dL' },
            },
        },
    ];
    return { sleep, activity, recovery, workouts, meals, water, metrics, reports, vault: [] };
}

module.exports = { PERSONAS, SEED, DAY, DAYS, dayUTC, at, dayStr, generate: { a: generateA, b: generateB } };
