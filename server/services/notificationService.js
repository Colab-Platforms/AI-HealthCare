const cron = require('node-cron');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const NutritionSummary = require('../models/NutritionSummary');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const HealthReport = require('../models/HealthReport');
const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
const { sendToUser } = require('./fcmService');

// Reminder types this tick can emit. Used to seed the "already sent today" set
// in one query instead of asking the DB once per user per type.
const REMINDER_TYPES = ['food_reminder', 'sleep_reminder', 'macro_update', 'diet_adherence', 'health_insight'];

const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'];

// Push fan-out is HTTP, not DB, but 5k simultaneous FCM calls still bury the
// event loop and trip Firebase's own rate limits. Send in waves.
const FCM_CONCURRENCY = 20;

// insertMany payload cap — keeps any single write well under the 16MB BSON limit.
const INSERT_CHUNK = 500;

const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

// Identity of "this user has already been sent this reminder today"
const sentKey = (userId, type, mealType) => `${userId}:${type}${mealType ? `:${mealType}` : ''}`;

class NotificationService {
    constructor() {
        this.cronJobs = [];
        this.cachedPreferences = new Map(); // In-memory cache
        this.lastCacheUpdate = 0;
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

        // Per-day dedupe set, seeded from the DB once per day (see loadSentToday).
        // This process is the only writer of REMINDER_TYPES notifications, so an
        // in-memory set stays accurate between seeds and lets a tick skip work
        // without touching the database at all.
        this.sentToday = new Set();
        this.sentTodayDate = null;

        // Re-entrancy guard — see checkAndSendUserNotifications.
        this.tickRunning = false;

        this.startSchedulers();
    }

    startSchedulers() {
        // The in-process every-minute scheduler is OFF unless explicitly enabled.
        //
        // This used to be gated on `!process.env.VERCEL`, which meant it stayed ON
        // for every non-Vercel deployment — including Render, where it ran a
        // full per-user scan every 60s against a live production database and
        // held the Mongo connection pool permanently saturated. Production is
        // driven by an Upstash QStash Schedule hitting POST /api/notifications/cron-tick
        // (see routes/notificationRoutes.js); this path is a local-dev convenience
        // only, so it now requires an opt-in rather than an opt-out.
        if (process.env.ENABLE_LOCAL_NOTIFICATION_CRON === 'true') {
            const job = cron.schedule('* * * * *', () => {
                this.checkAndSendUserNotifications();
            });
            this.cronJobs.push(job);
            console.log('🔔 Notification scheduler enabled (node-cron, local mode)');
        } else {
            console.log('🔔 Notification service ready (in-process scheduler disabled; driven by /api/notifications/cron-tick)');
        }
    }

    async checkAndSendUserNotifications() {
        // A slow tick must never stack on top of the next one. Unbounded overlap is
        // what turned this job into permanent load rather than a periodic spike.
        if (this.tickRunning) {
            console.warn('⏭️  Notification tick still in flight — skipping this one');
            return;
        }
        this.tickRunning = true;
        const startedAt = Date.now();

        try {
            const today = startOfToday();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            await this.loadSentToday(today);
            const preferences = await this.getPreferencesWithCache();

            // ---- Pass 1: who is due for what (in memory, no queries) ----
            const dueMeals = new Map();     // userId -> Set<mealType>
            const dueSleep = new Map();     // userId -> targetSleepHours
            const dueMacro = [];            // userId[]
            const dueAdherence = [];        // userId[]
            const dueInsight = [];          // userId[]

            const isDue = (time) => Boolean(time) && currentTime >= time;
            const notSent = (userId, type, mealType) => !this.sentToday.has(sentKey(userId, type, mealType));

            for (const [userId, pref] of preferences) {
                // Quiet hours (Do Not Disturb)
                if (pref.quietHours?.enabled) {
                    const { startTime, endTime } = pref.quietHours;
                    if (startTime && endTime) {
                        // Handle overnight ranges e.g. 22:00 - 07:00
                        const inQuietHours = startTime <= endTime
                            ? currentTime >= startTime && currentTime < endTime
                            : currentTime >= startTime || currentTime < endTime;
                        if (inQuietHours) continue;
                    }
                }

                if (pref.mealReminders?.enabled) {
                    const meals = new Set();
                    for (const mealType of MEAL_TYPES) {
                        if (isDue(pref.mealReminders[mealType]) && notSent(userId, 'food_reminder', mealType)) {
                            meals.add(mealType);
                        }
                    }
                    if (meals.size) dueMeals.set(userId, meals);
                }

                if (pref.sleepReminder?.enabled && isDue(pref.sleepReminder.time) && notSent(userId, 'sleep_reminder')) {
                    dueSleep.set(userId, pref.sleepReminder.targetSleepHours);
                }
                if (pref.macroUpdate?.enabled && isDue(pref.macroUpdate.time) && notSent(userId, 'macro_update')) {
                    dueMacro.push(userId);
                }
                if (pref.dietAdherence?.enabled && isDue(pref.dietAdherence.time) && notSent(userId, 'diet_adherence')) {
                    dueAdherence.push(userId);
                }
                if (pref.healthInsights?.enabled && isDue(pref.healthInsights.time) && notSent(userId, 'health_insight')) {
                    dueInsight.push(userId);
                }
            }

            const totalDue = dueMeals.size + dueSleep.size + dueMacro.length + dueAdherence.length + dueInsight.length;
            if (totalDue === 0) return; // nothing to do — tick costs nothing

            // ---- Pass 2: bulk reads, scoped to only the users who are actually due ----
            const foodLogUserIds = [...new Set([...dueMeals.keys(), ...dueAdherence])];

            const [foodLogs, summaries, dietPlans] = await Promise.all([
                foodLogUserIds.length
                    ? FoodLog.find({
                        userId: { $in: foodLogUserIds },
                        timestamp: { $gte: today, $lt: tomorrow }
                    }).select('userId mealType foodItems.name').lean()
                    : [],
                dueMacro.length
                    ? NutritionSummary.find({ userId: { $in: dueMacro }, date: today }).lean()
                    : [],
                dueAdherence.length
                    ? PersonalizedDietPlan.find({ userId: { $in: dueAdherence }, isActive: true })
                        .select('userId mealPlan').lean()
                    : [],
            ]);

            // Index the bulk results for O(1) lookup in pass 3
            const loggedMeals = new Set();          // `${userId}:${mealType}`
            const logsByUser = new Map();           // userId -> log[]
            for (const log of foodLogs) {
                const uid = log.userId.toString();
                loggedMeals.add(`${uid}:${log.mealType}`);
                if (!logsByUser.has(uid)) logsByUser.set(uid, []);
                logsByUser.get(uid).push(log);
            }
            const summaryByUser = new Map(summaries.map((s) => [s.userId.toString(), s]));
            const planByUser = new Map(dietPlans.map((p) => [p.userId.toString(), p]));

            // ---- Pass 3: build every document in memory, then write once ----
            const docs = [];
            const pushes = [];
            const emit = (doc, push) => {
                docs.push(doc);
                pushes.push({ userId: doc.userId, payload: push, key: sentKey(doc.userId, doc.type, doc.metadata?.mealType) });
            };

            for (const [userId, meals] of dueMeals) {
                for (const mealType of meals) {
                    if (loggedMeals.has(`${userId}:${mealType}`)) continue; // already ate & logged it
                    emit(...buildMealReminder(userId, mealType, tomorrow));
                }
            }
            for (const [userId, targetSleepHours] of dueSleep) {
                emit(...buildSleepReminder(userId, targetSleepHours, tomorrow));
            }
            for (const userId of dueMacro) {
                const summary = summaryByUser.get(userId);
                if (!summary) continue; // nothing logged today — same as before
                emit(...buildMacroUpdate(userId, summary, tomorrow));
            }
            for (const userId of dueAdherence) {
                const plan = planByUser.get(userId);
                if (!plan) continue; // no active plan — same as before
                emit(...buildDietAdherence(userId, plan, logsByUser.get(userId) || [], tomorrow));
            }
            for (const userId of dueInsight) {
                emit(...buildHealthInsight(userId, tomorrow));
            }

            if (docs.length === 0) return;

            // Chunked so one oversized batch can't blow the BSON limit, and unordered
            // so a single bad document doesn't abort the rest of the chunk.
            let written = 0;
            for (let i = 0; i < docs.length; i += INSERT_CHUNK) {
                const chunk = docs.slice(i, i + INSERT_CHUNK);
                const chunkPushes = pushes.slice(i, i + INSERT_CHUNK);
                try {
                    await Notification.insertMany(chunk, { ordered: false });
                    // Only mark as sent once it is durably stored — a failed chunk is
                    // retried on the next tick rather than silently dropped.
                    for (const p of chunkPushes) this.sentToday.add(p.key);
                    written += chunk.length;
                    await this.dispatchPush(chunkPushes);
                } catch (error) {
                    console.error(`Notification insert chunk failed (${chunk.length} docs):`, error.message);
                }
            }

            console.log(`🔔 Notification tick: ${written} sent in ${Date.now() - startedAt}ms`);
        } catch (error) {
            console.error('Error in checkAndSendUserNotifications:', error.message);
        } finally {
            this.tickRunning = false;
        }
    }

    // Seeds the per-day dedupe set from the DB. Runs once per calendar day (and
    // once on boot), so the cost is one indexed query per day rather than one per
    // user per type per tick.
    async loadSentToday(today) {
        const dayKey = today.toDateString();
        if (this.sentTodayDate === dayKey) return;

        const sent = await Notification.find({
            type: { $in: REMINDER_TYPES },
            createdAt: { $gte: today }
        }).select('userId type metadata.mealType').lean();

        this.sentToday = new Set(
            sent.map((n) => sentKey(n.userId.toString(), n.type, n.metadata?.mealType))
        );
        this.sentTodayDate = dayKey;
        console.log(`🔔 Seeded reminder dedupe set for ${dayKey}: ${this.sentToday.size} already sent`);
    }

    // Push fan-out in bounded waves. Failures are logged, never thrown — a dead FCM
    // token must not stop the rest of the batch or retry the DB write.
    async dispatchPush(entries) {
        for (let i = 0; i < entries.length; i += FCM_CONCURRENCY) {
            const wave = entries.slice(i, i + FCM_CONCURRENCY);
            const results = await Promise.allSettled(
                wave.map((e) => sendToUser(e.userId, e.payload))
            );
            for (const r of results) {
                if (r.status === 'rejected') console.error('FCM push failed:', r.reason?.message || r.reason);
            }
        }
    }

    // ✅ OPTIMIZED: Get preferences with caching
    async getPreferencesWithCache() {
        const now = Date.now();
        
        // Return cache if still valid
        if (this.cachedPreferences.size > 0 && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
            console.log('📦 Using cached preferences');
            return this.cachedPreferences;
        }

        // Fetch from database
        console.log('🔄 Refreshing preferences cache');
        // quietHours belongs in this projection — the tick reads pref.quietHours to
        // honour Do Not Disturb, and without it here the field was always undefined,
        // so quiet hours were silently ignored for every user.
        const preferences = await NotificationPreference.find({})
            .select('userId mealReminders sleepReminder macroUpdate dietAdherence healthInsights quietHours')
            .lean(); // Use lean() for faster queries

        // Build cache map
        this.cachedPreferences.clear();
        for (const pref of preferences) {
            this.cachedPreferences.set(pref.userId.toString(), pref);
        }

        this.lastCacheUpdate = now;
        console.log(`✅ Cached ${this.cachedPreferences.size} user preferences`);
        
        return this.cachedPreferences;
    }

    // ✅ OPTIMIZED: Batch send notifications
    // ✅ OPTIMIZED: Invalidate cache when preferences change
    invalidateCache() {
        this.cachedPreferences.clear();
        this.lastCacheUpdate = 0;
        console.log('🔄 Notification cache invalidated');
    }

    async sendMealReminders(mealType) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Get all active users
            const users = await User.find({}).select('_id name');

            for (const user of users) {
                // Check if user has already logged this meal today
                const existingLog = await FoodLog.findOne({
                    userId: user._id,
                    mealType,
                    timestamp: { $gte: today, $lt: tomorrow }
                });

                if (!existingLog) {
                    // Check if we already sent a reminder for this meal today
                    const existingReminder = await Notification.findOne({
                        userId: user._id,
                        type: 'food_reminder',
                        'metadata.mealType': mealType,
                        createdAt: { $gte: today }
                    });

                    if (!existingReminder) {
                        const mealNames = {
                            breakfast: 'Breakfast',
                            lunch: 'Lunch',
                            snack: 'Snack',
                            dinner: 'Dinner'
                        };

                        const mealMessages = {
                            breakfast: 'Start your day right! Log your breakfast to track your nutrition goals.',
                            lunch: 'Time for lunch! Don\'t forget to log what you eat to stay on track.',
                            snack: 'Healthy snack time! Log your snack to keep your nutrition on point.',
                            dinner: 'Evening meal time! Log your dinner to complete today\'s nutrition tracking.'
                        };

                        await Notification.create({
                            userId: user._id,
                            type: 'food_reminder',
                            title: `${mealNames[mealType]} Reminder`,
                            message: mealMessages[mealType],
                            icon: '',
                            priority: 'medium',
                            actionUrl: '/nutrition',
                            metadata: { mealType },
                            expiresAt: tomorrow // Expire at end of day
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error sending meal reminders:', error);
        }
    }

    async sendSleepReminders() {
        try {
            const users = await User.find({}).select('_id name');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const user of users) {
                // Check if already sent sleep reminder today
                const existingReminder = await Notification.findOne({
                    userId: user._id,
                    type: 'sleep_reminder',
                    createdAt: { $gte: today }
                });

                if (!existingReminder) {
                    await Notification.create({
                        userId: user._id,
                        type: 'sleep_reminder',
                        title: 'Sleep Tracking Reminder',
                        message: 'Time to wind down! Don\'t forget to log your sleep hours for better health insights.',
                        icon: '',
                        priority: 'medium',
                        actionUrl: '/dashboard',
                        metadata: { reminderType: 'sleep' },
                        expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Expire tomorrow
                    });
                }
            }
        } catch (error) {
            console.error('Error sending sleep reminders:', error);
        }
    }

    async sendMacroUpdates() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const summaries = await NutritionSummary.find({ date: today });

            for (const summary of summaries) {
                // Check if already sent macro update today
                const existingUpdate = await Notification.findOne({
                    userId: summary.userId,
                    type: 'macro_update',
                    createdAt: { $gte: today }
                });

                if (!existingUpdate) {
                    const calPct = summary.calorieGoal ? Math.round((summary.totalCalories / summary.calorieGoal) * 100) : 0;
                    const protPct = summary.proteinGoal ? Math.round((summary.totalProtein / summary.proteinGoal) * 100) : 0;
                    const carbsPct = summary.carbsGoal ? Math.round((summary.totalCarbs / summary.carbsGoal) * 100) : 0;
                    const fatsPct = summary.fatsGoal ? Math.round((summary.totalFats / summary.fatsGoal) * 100) : 0;

                    let statusMsg = '';

                    if (calPct >= 80 && calPct <= 110) {
                        statusMsg = 'You\'re on track with your calorie goal!';
                    } else if (calPct < 50) {
                        statusMsg = `You've only consumed ${calPct}% of your daily calories. Try to eat more balanced meals.`;
                    } else if (calPct > 110) {
                        statusMsg = `You've exceeded your calorie goal by ${calPct - 100}%. Consider lighter options for remaining meals.`;
                    } else {
                        statusMsg = `You've consumed ${calPct}% of your daily calories. Keep it up!`;
                    }

                    await Notification.create({
                        userId: summary.userId,
                        type: 'macro_update',
                        title: 'Daily Macro Check',
                        message: `${statusMsg}\nProtein: ${summary.totalProtein}g/${summary.proteinGoal || '?'}g (${protPct}%) | Carbs: ${summary.totalCarbs}g/${summary.carbsGoal || '?'}g (${carbsPct}%) | Fats: ${summary.totalFats}g/${summary.fatsGoal || '?'}g (${fatsPct}%)`,
                        icon: '',
                        priority: calPct < 50 || calPct > 120 ? 'high' : 'low',
                        actionUrl: '/nutrition',
                        metadata: {
                            calories: { consumed: summary.totalCalories, goal: summary.calorieGoal, pct: calPct },
                            protein: { consumed: summary.totalProtein, goal: summary.proteinGoal, pct: protPct },
                            carbs: { consumed: summary.totalCarbs, goal: summary.carbsGoal, pct: carbsPct },
                            fats: { consumed: summary.totalFats, goal: summary.fatsGoal, pct: fatsPct }
                        },
                        expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                    });
                }
            }
        } catch (error) {
            console.error('Error sending macro updates:', error);
        }
    }

    async sendDietAdherenceNotifications() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Find users with active diet plans
            const dietPlans = await PersonalizedDietPlan.find({ isActive: true });

            for (const plan of dietPlans) {
                // Check if already sent adherence notification today
                const existingNotif = await Notification.findOne({
                    userId: plan.userId,
                    type: 'diet_adherence',
                    createdAt: { $gte: today }
                });

                if (!existingNotif) {
                    // Get today's food logs
                    const foodLogs = await FoodLog.find({
                        userId: plan.userId,
                        timestamp: { $gte: today, $lt: tomorrow }
                    });

                    const mealsLogged = foodLogs.length;
                    const loggedFoods = foodLogs.flatMap(log =>
                        log.foodItems.map(item => item.name.toLowerCase())
                    );

                    // Check if foods match recommended diet
                    let recommendedFoods = [];
                    if (plan.mealPlan) {
                        Object.values(plan.mealPlan).forEach(mealArray => {
                            if (Array.isArray(mealArray)) {
                                mealArray.forEach(meal => {
                                    if (meal.name) recommendedFoods.push(meal.name.toLowerCase());
                                });
                            }
                        });
                    }

                    const matchCount = loggedFoods.filter(food =>
                        recommendedFoods.some(rec => food.includes(rec) || rec.includes(food))
                    ).length;

                    let message = '';
                    let priority = 'low';

                    if (mealsLogged === 0) {
                        message = 'You haven\'t logged any meals today. Your personalized diet plan is waiting for you!';
                        priority = 'medium';
                    } else if (matchCount > 0) {
                        message = `Great job! ${matchCount} of your logged foods match your recommended diet plan. Keep following your personalized nutrition!`;
                    } else {
                        message = `You've logged ${mealsLogged} meal(s) today. Try to include more foods from your personalized diet plan for optimal results.`;
                        priority = 'medium';
                    }

                    await Notification.create({
                        userId: plan.userId,
                        type: 'diet_adherence',
                        title: 'Diet Plan Adherence',
                        message,
                        icon: '',
                        priority,
                        actionUrl: '/diet-plan',
                        metadata: { mealsLogged, matchCount, totalRecommended: recommendedFoods.length },
                        expiresAt: tomorrow
                    });
                }
            }
        } catch (error) {
            console.error('Error sending diet adherence notifications:', error);
        }
    }

    async generateStartupNotifications() {
        try {
            const now = new Date();
            const hour = now.getHours();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Generate meal reminders for any missed meal times
            if (hour >= 8 && hour < 11) await this.sendMealReminders('breakfast');
            if (hour >= 13 && hour < 16) await this.sendMealReminders('lunch');
            if (hour >= 16 && hour < 19) await this.sendMealReminders('snack');
            if (hour >= 19 && hour < 22) await this.sendMealReminders('dinner');
            if (hour >= 22) await this.sendSleepReminders();

            console.log('🔔 Startup notifications check complete');
        } catch (error) {
            console.error('Error in startup notifications:', error);
        }
    }

    // Create a notification for a specific user (can be called from controllers)
    async createNotification(userId, { type, title, message, icon, priority, actionUrl, metadata, expiresAt }) {
        try {
            const notification = await Notification.create({
                userId,
                type,
                title,
                message,
                icon: icon || '',
                priority: priority || 'medium',
                actionUrl,
                metadata,
                expiresAt
            });

            // Fire push notification — non-blocking, never fails the main flow
            sendToUser(userId, { title, body: message, data: { type, actionUrl: actionUrl || '' } })
                .catch(e => console.error('FCM push failed:', e.message));

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }
}

// ---------------------------------------------------------------------------
// Reminder builders.
//
// Each returns [notificationDoc, pushPayload] and touches no I/O — all the data
// they need is handed in by the tick's bulk reads. Keeping them pure is what
// lets the tick construct an entire batch in memory and write it with a single
// insertMany, instead of interleaving a read and a write per user.
// ---------------------------------------------------------------------------

const MEAL_NAMES = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const MEAL_MESSAGES = {
    breakfast: 'Start your day right! Log your breakfast.',
    lunch: 'Time for lunch! Don\'t forget to log it.',
    snack: 'Healthy snack time! Log it now.',
    dinner: 'Evening meal time! Log your dinner.'
};

const HEALTH_INSIGHTS = [
    { title: 'Hydration Tip', message: 'Remember to drink enough water throughout the day. Aim for 8-10 glasses daily!' },
    { title: 'Movement Reminder', message: 'Try to take a short walk today. Even 10 minutes of movement can boost your mood!' },
    { title: 'Stress Management', message: 'Take a few minutes to practice deep breathing or meditation to reduce stress.' },
    { title: 'Nutrition Tip', message: 'Include more colorful vegetables in your meals for better nutrition!' },
    { title: 'Sleep Quality', message: 'Maintain a consistent sleep schedule for better health and energy levels.' }
];

const push = (title, message, type, actionUrl) => ({
    title,
    body: message,
    data: { type, actionUrl }
});

function buildMealReminder(userId, mealType, expiresAt) {
    const title = `${MEAL_NAMES[mealType]} Reminder`;
    const message = MEAL_MESSAGES[mealType];
    return [{
        userId,
        type: 'food_reminder',
        title,
        message,
        icon: '',
        priority: 'medium',
        actionUrl: '/nutrition',
        metadata: { mealType },
        expiresAt
    }, push(title, message, 'food_reminder', '/nutrition')];
}

function buildSleepReminder(userId, targetSleepHours, expiresAt) {
    const title = 'Sleep Tracking Reminder';
    const message = `Time to wind down! Aim for ${targetSleepHours} hours of sleep. Don't forget to log your sleep hours.`;
    return [{
        userId,
        type: 'sleep_reminder',
        title,
        message,
        icon: '',
        priority: 'medium',
        actionUrl: '/dashboard',
        metadata: { reminderType: 'sleep', targetHours: targetSleepHours },
        expiresAt
    }, push(title, message, 'sleep_reminder', '/dashboard')];
}

function buildMacroUpdate(userId, summary, expiresAt) {
    const pct = (value, goal) => (goal ? Math.round((value / goal) * 100) : 0);
    const calPct = pct(summary.totalCalories, summary.calorieGoal);
    const protPct = pct(summary.totalProtein, summary.proteinGoal);
    const carbsPct = pct(summary.totalCarbs, summary.carbsGoal);
    const fatsPct = pct(summary.totalFats, summary.fatsGoal);

    let statusMsg;
    if (calPct >= 80 && calPct <= 110) {
        statusMsg = 'You\'re on track with your calorie goal!';
    } else if (calPct < 50) {
        statusMsg = `You've only consumed ${calPct}% of your daily calories. Try to eat more balanced meals.`;
    } else if (calPct > 110) {
        statusMsg = `You've exceeded your calorie goal by ${calPct - 100}%. Consider lighter options for remaining meals.`;
    } else {
        statusMsg = `You've consumed ${calPct}% of your daily calories. Keep it up!`;
    }

    const message = `${statusMsg}\nProtein: ${summary.totalProtein}g/${summary.proteinGoal || '?'}g (${protPct}%) | Carbs: ${summary.totalCarbs}g/${summary.carbsGoal || '?'}g (${carbsPct}%) | Fats: ${summary.totalFats}g/${summary.fatsGoal || '?'}g (${fatsPct}%)`;

    return [{
        userId,
        type: 'macro_update',
        title: 'Daily Macro Check',
        message,
        icon: '',
        priority: calPct < 50 || calPct > 120 ? 'high' : 'low',
        actionUrl: '/nutrition',
        metadata: {
            calories: { consumed: summary.totalCalories, goal: summary.calorieGoal, pct: calPct },
            protein: { consumed: summary.totalProtein, goal: summary.proteinGoal, pct: protPct },
            carbs: { consumed: summary.totalCarbs, goal: summary.carbsGoal, pct: carbsPct },
            fats: { consumed: summary.totalFats, goal: summary.fatsGoal, pct: fatsPct }
        },
        expiresAt
    }, push('Daily Macro Check', statusMsg, 'macro_update', '/nutrition')];
}

function buildDietAdherence(userId, plan, todaysLogs, expiresAt) {
    const mealsLogged = todaysLogs.length;
    const loggedFoods = todaysLogs.flatMap((log) =>
        (log.foodItems || []).map((item) => item.name?.toLowerCase()).filter(Boolean)
    );

    const recommendedFoods = [];
    if (plan.mealPlan) {
        Object.values(plan.mealPlan).forEach((mealArray) => {
            if (Array.isArray(mealArray)) {
                mealArray.forEach((meal) => {
                    if (meal?.name) recommendedFoods.push(meal.name.toLowerCase());
                });
            }
        });
    }

    const matchCount = loggedFoods.filter((food) =>
        recommendedFoods.some((rec) => food.includes(rec) || rec.includes(food))
    ).length;

    let message;
    let priority = 'low';
    if (mealsLogged === 0) {
        message = 'You haven\'t logged any meals today. Your personalized diet plan is waiting for you!';
        priority = 'medium';
    } else if (matchCount > 0) {
        message = `Great job! ${matchCount} of your logged foods match your recommended diet plan. Keep following your personalized nutrition!`;
    } else {
        message = `You've logged ${mealsLogged} meal(s) today. Try to include more foods from your personalized diet plan for optimal results.`;
        priority = 'medium';
    }

    return [{
        userId,
        type: 'diet_adherence',
        title: 'Diet Plan Adherence',
        message,
        icon: '',
        priority,
        actionUrl: '/diet-plan',
        metadata: { mealsLogged, matchCount, totalRecommended: recommendedFoods.length },
        expiresAt
    }, push('Diet Plan Adherence', message, 'diet_adherence', '/diet-plan')];
}

function buildHealthInsight(userId, expiresAt) {
    const insight = HEALTH_INSIGHTS[Math.floor(Math.random() * HEALTH_INSIGHTS.length)];
    return [{
        userId,
        type: 'health_insight',
        title: insight.title,
        message: insight.message,
        icon: '',
        priority: 'low',
        actionUrl: '/dashboard',
        metadata: { insightType: 'daily_tip' },
        expiresAt
    }, push(insight.title, insight.message, 'health_insight', '/dashboard')];
}

module.exports = new NotificationService();
