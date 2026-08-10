const cron = require('node-cron');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const NutritionSummary = require('../models/NutritionSummary');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
const { sendToUser } = require('./fcmService');

class NotificationService {
    constructor() {
        this.cronJobs = [];
        this.cachedPreferences = new Map(); // In-memory cache
        this.lastCacheUpdate = 0;
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
        
        if (!process.env.VERCEL) {
            this.startSchedulers();
            console.log('🚀 Optimized Notification Service Started');
        } else {
            console.log('🔔 Notification service started in serverless mode');
        }
    }

    startSchedulers() {
        // ✅ Local/always-on dev convenience: check every minute for user-specific
        // notification times. On Vercel this never runs (serverless has no persistent
        // process) — production relies on an Upstash QStash Schedule hitting
        // POST /api/notifications/cron-tick instead (see routes/notificationRoutes.js).
        if (!process.env.VERCEL) {
            // Every 5 minutes, not every minute. The due-time checks below use >=,
            // so a coarser tick still delivers everything — it just costs 5x less.
            // The callback is awaited and guarded by _tickInFlight so a slow tick
            // can never overlap with the next one and pile up connection usage.
            const job = cron.schedule('*/5 * * * *', async () => {
                await this.checkAndSendUserNotifications();
            });
            this.cronJobs.push(job);
            console.log('🔔 Notification scheduler enabled (node-cron, every 5 min)');
        }
    }

    // ✅ Check each user's preferences and send notifications once their preferred
    // time has passed for today. Uses >= instead of === so this stays correct
    // regardless of how often the caller ticks (every minute locally via node-cron,
    // every few minutes in production via QStash) — the per-type "already sent
    // today" check inside each sendUser* method prevents duplicates.
    async checkAndSendUserNotifications() {
        // Re-entrancy guard. node-cron fires on a fixed interval regardless of
        // whether the previous run finished; without this, a tick that overruns
        // its interval causes runs to pile up unboundedly, each holding Mongo
        // connections until the pool is exhausted and all HTTP traffic stalls.
        if (this._tickInFlight) {
            console.warn('[Notifications] Previous tick still running — skipping this one');
            return;
        }
        this._tickInFlight = true;
        const startedAt = Date.now();
        try {
            const sent = await this._runNotificationTick();
            if (sent > 0) {
                console.log(`[Notifications] Sent ${sent} in ${Date.now() - startedAt}ms`);
            }
        } catch (error) {
            console.error('Error in checkAndSendUserNotifications:', error.message);
        } finally {
            this._tickInFlight = false;
        }
    }

    /**
     * One notification pass, using a fixed number of bulk queries instead of
     * per-user queries.
     *
     * The previous implementation looped every user and ran 2+ findOne guards
     * per notification type per user. Because the due-time test is >=, every
     * type stayed "due" for the rest of the day once its time passed, so late in
     * the day this was ~12 sequential queries per user per tick — tens of
     * thousands of round trips a minute at a few thousand users, which cannot
     * complete within the tick interval.
     *
     * Here the due set is computed in memory (no I/O), then every guard is
     * answered by one bulk query per collection, and all notifications are
     * written with a single insertMany. Cost is now flat in user count.
     */
    async _runNotificationTick() {
        const preferences = await this.getPreferencesWithCache();
        if (!preferences.size) return 0;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // ---- Phase 1: work out who is due, purely in memory ----
        const dueMeals = { breakfast: [], lunch: [], snack: [], dinner: [] };
        const dueSleep = [];   // { userId, targetSleepHours }
        const dueMacro = [];
        const dueDiet = [];
        const dueInsight = [];

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
                for (const meal of ['breakfast', 'lunch', 'snack', 'dinner']) {
                    const at = pref.mealReminders[meal];
                    if (at && currentTime >= at) dueMeals[meal].push(userId);
                }
            }
            if (pref.sleepReminder?.enabled && pref.sleepReminder.time && currentTime >= pref.sleepReminder.time) {
                dueSleep.push({ userId, targetSleepHours: pref.sleepReminder.targetSleepHours });
            }
            if (pref.macroUpdate?.enabled && pref.macroUpdate.time && currentTime >= pref.macroUpdate.time) {
                dueMacro.push(userId);
            }
            if (pref.dietAdherence?.enabled && pref.dietAdherence.time && currentTime >= pref.dietAdherence.time) {
                dueDiet.push(userId);
            }
            if (pref.healthInsights?.enabled && pref.healthInsights.time && currentTime >= pref.healthInsights.time) {
                dueInsight.push(userId);
            }
        }

        const mealCandidates = [...new Set(Object.values(dueMeals).flat())];
        const allCandidates = [...new Set([
            ...mealCandidates,
            ...dueSleep.map(s => s.userId),
            ...dueMacro, ...dueDiet, ...dueInsight,
        ])];
        if (!allCandidates.length) return 0;

        // ---- Phase 2: bulk-resolve every "already sent today?" guard ----
        const alreadySent = await Notification.find({
            userId: { $in: allCandidates },
            type: { $in: ['food_reminder', 'sleep_reminder', 'macro_update', 'diet_adherence', 'health_insight'] },
            createdAt: { $gte: today },
        }).select('userId type metadata.mealType').lean();

        const sentKeys = new Set(alreadySent.map(n => n.type === 'food_reminder'
            ? `${n.userId}:food_reminder:${n.metadata?.mealType}`
            : `${n.userId}:${n.type}`));

        const notSent = (userId, type, mealType) => !sentKeys.has(
            mealType ? `${userId}:${type}:${mealType}` : `${userId}:${type}`
        );

        const docs = [];   // Notification docs to insert
        const pushes = []; // { userId, title, body, data } for FCM

        // ---- Meal reminders: one bulk FoodLog query answers every user ----
        const pendingMeals = [];
        for (const meal of ['breakfast', 'lunch', 'snack', 'dinner']) {
            for (const userId of dueMeals[meal]) {
                if (notSent(userId, 'food_reminder', meal)) pendingMeals.push({ userId, meal });
            }
        }
        if (pendingMeals.length) {
            const logs = await FoodLog.find({
                userId: { $in: [...new Set(pendingMeals.map(m => m.userId))] },
                timestamp: { $gte: today, $lt: tomorrow },
            }).select('userId mealType').lean();
            const loggedKeys = new Set(logs.map(l => `${l.userId}:${l.mealType}`));

            const mealNames = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
            const mealMessages = {
                breakfast: 'Start your day right! Log your breakfast.',
                lunch: 'Time for lunch! Don\'t forget to log it.',
                snack: 'Healthy snack time! Log it now.',
                dinner: 'Evening meal time! Log your dinner.'
            };

            for (const { userId, meal } of pendingMeals) {
                if (loggedKeys.has(`${userId}:${meal}`)) continue; // already ate & logged
                const title = `${mealNames[meal]} Reminder`;
                const message = mealMessages[meal];
                docs.push({
                    userId, type: 'food_reminder', title, message, icon: '',
                    priority: 'medium', actionUrl: '/nutrition',
                    metadata: { mealType: meal }, expiresAt: tomorrow,
                });
                pushes.push({ userId, title, body: message, data: { type: 'food_reminder', actionUrl: '/nutrition' } });
            }
        }

        // ---- Sleep reminders: no extra query needed beyond the guard ----
        for (const { userId, targetSleepHours } of dueSleep) {
            if (!notSent(userId, 'sleep_reminder')) continue;
            const title = 'Sleep Tracking Reminder';
            const message = `Time to wind down! Aim for ${targetSleepHours} hours of sleep. Don't forget to log your sleep hours.`;
            docs.push({
                userId, type: 'sleep_reminder', title, message, icon: '',
                priority: 'medium', actionUrl: '/dashboard',
                metadata: { reminderType: 'sleep', targetHours: targetSleepHours },
                expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            });
            pushes.push({ userId, title, body: message, data: { type: 'sleep_reminder', actionUrl: '/dashboard' } });
        }

        // ---- Macro updates: one bulk NutritionSummary query ----
        const pendingMacro = dueMacro.filter(u => notSent(u, 'macro_update'));
        if (pendingMacro.length) {
            const summaries = await NutritionSummary.find({
                userId: { $in: pendingMacro }, date: today,
            }).lean();

            for (const summary of summaries) {
                const calPct = summary.calorieGoal ? Math.round((summary.totalCalories / summary.calorieGoal) * 100) : 0;
                const protPct = summary.proteinGoal ? Math.round((summary.totalProtein / summary.proteinGoal) * 100) : 0;
                const carbsPct = summary.carbsGoal ? Math.round((summary.totalCarbs / summary.carbsGoal) * 100) : 0;
                const fatsPct = summary.fatsGoal ? Math.round((summary.totalFats / summary.fatsGoal) * 100) : 0;

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

                const macroMessage = `${statusMsg}\nProtein: ${summary.totalProtein}g/${summary.proteinGoal || '?'}g (${protPct}%) | Carbs: ${summary.totalCarbs}g/${summary.carbsGoal || '?'}g (${carbsPct}%) | Fats: ${summary.totalFats}g/${summary.fatsGoal || '?'}g (${fatsPct}%)`;

                docs.push({
                    userId: summary.userId, type: 'macro_update', title: 'Daily Macro Check',
                    message: macroMessage, icon: '',
                    priority: calPct < 50 || calPct > 120 ? 'high' : 'low',
                    actionUrl: '/nutrition',
                    metadata: {
                        calories: { consumed: summary.totalCalories, goal: summary.calorieGoal, pct: calPct },
                        protein: { consumed: summary.totalProtein, goal: summary.proteinGoal, pct: protPct },
                        carbs: { consumed: summary.totalCarbs, goal: summary.carbsGoal, pct: carbsPct },
                        fats: { consumed: summary.totalFats, goal: summary.fatsGoal, pct: fatsPct }
                    },
                    expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                });
                pushes.push({ userId: summary.userId, title: 'Daily Macro Check', body: statusMsg, data: { type: 'macro_update', actionUrl: '/nutrition' } });
            }
        }

        // ---- Diet adherence: two bulk queries (plans + today's logs) ----
        const pendingDiet = dueDiet.filter(u => notSent(u, 'diet_adherence'));
        if (pendingDiet.length) {
            const plans = await PersonalizedDietPlan.find({
                userId: { $in: pendingDiet }, isActive: true,
            }).select('userId mealPlan').lean();

            if (plans.length) {
                const planUserIds = plans.map(p => p.userId);
                const logs = await FoodLog.find({
                    userId: { $in: planUserIds },
                    timestamp: { $gte: today, $lt: tomorrow },
                }).select('userId foodItems').lean();

                const logsByUser = new Map();
                for (const log of logs) {
                    const key = log.userId.toString();
                    if (!logsByUser.has(key)) logsByUser.set(key, []);
                    logsByUser.get(key).push(log);
                }

                for (const plan of plans) {
                    const userLogs = logsByUser.get(plan.userId.toString()) || [];
                    const mealsLogged = userLogs.length;
                    const loggedFoods = userLogs.flatMap(log =>
                        (log.foodItems || []).map(item => (item.name || '').toLowerCase())
                    );

                    const recommendedFoods = [];
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
                        food && recommendedFoods.some(rec => food.includes(rec) || rec.includes(food))
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

                    docs.push({
                        userId: plan.userId, type: 'diet_adherence', title: 'Diet Plan Adherence',
                        message, icon: '', priority, actionUrl: '/diet-plan',
                        metadata: { mealsLogged, matchCount, totalRecommended: recommendedFoods.length },
                        expiresAt: tomorrow,
                    });
                    pushes.push({ userId: plan.userId, title: 'Diet Plan Adherence', body: message, data: { type: 'diet_adherence', actionUrl: '/diet-plan' } });
                }
            }
        }

        // ---- Health insights: no extra query needed ----
        const insights = [
            { title: 'Hydration Tip', message: 'Remember to drink enough water throughout the day. Aim for 8-10 glasses daily!' },
            { title: 'Movement Reminder', message: 'Try to take a short walk today. Even 10 minutes of movement can boost your mood!' },
            { title: 'Stress Management', message: 'Take a few minutes to practice deep breathing or meditation to reduce stress.' },
            { title: 'Nutrition Tip', message: 'Include more colorful vegetables in your meals for better nutrition!' },
            { title: 'Sleep Quality', message: 'Maintain a consistent sleep schedule for better health and energy levels.' }
        ];
        for (const userId of dueInsight) {
            if (!notSent(userId, 'health_insight')) continue;
            const pick = insights[Math.floor(Math.random() * insights.length)];
            docs.push({
                userId, type: 'health_insight', title: pick.title, message: pick.message,
                icon: '', priority: 'low', actionUrl: '/dashboard',
                metadata: { insightType: 'daily_tip' },
                expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            });
            pushes.push({ userId, title: pick.title, body: pick.message, data: { type: 'health_insight', actionUrl: '/dashboard' } });
        }

        if (!docs.length) return 0;

        // ---- Phase 3: one write, then fan out pushes with bounded concurrency ----
        // ordered:false so one bad doc doesn't abort the rest of the batch.
        await Notification.insertMany(docs, { ordered: false }).catch(err => {
            console.error('[Notifications] insertMany partial failure:', err.message);
        });

        for (let i = 0; i < pushes.length; i += 25) {
            await Promise.all(pushes.slice(i, i + 25).map(p =>
                sendToUser(p.userId, { title: p.title, body: p.body, data: p.data })
                    .catch(e => console.error('FCM send failed:', e.message))
            ));
        }

        return docs.length;
    }

    // ✅ OPTIMIZED: Get preferences with caching
    async getPreferencesWithCache() {
        const now = Date.now();
        
        // Return cache if still valid
        if (this.cachedPreferences.size > 0 && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
            return this.cachedPreferences;
        }

        // Fetch from database. quietHours MUST be projected — the tick reads
        // pref.quietHours to honour Do Not Disturb, and leaving it out of this
        // select silently made every user's quiet hours a no-op.
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

    // ---------------------------------------------------------------------
    // DEPRECATED — superseded by the batched _runNotificationTick() above.
    // These issue per-user guard queries and are what made the every-minute
    // tick unable to finish within its interval. Kept only so any external
    // caller keeps working; do not call them from new code, and do not "fix"
    // notification content here — the live copy is in _runNotificationTick().
    // ---------------------------------------------------------------------

    // Helper for specific user reminders
    async sendUserMealReminder(user, mealType) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const existingLog = await FoodLog.findOne({
            userId: user._id,
            mealType,
            timestamp: { $gte: today, $lt: tomorrow }
        });

        if (!existingLog) {
            const existingReminder = await Notification.findOne({
                userId: user._id,
                type: 'food_reminder',
                'metadata.mealType': mealType,
                createdAt: { $gte: today }
            });

            if (!existingReminder) {
                const mealNames = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
                const mealMessages = {
                    breakfast: 'Start your day right! Log your breakfast.',
                    lunch: 'Time for lunch! Don\'t forget to log it.',
                    snack: 'Healthy snack time! Log it now.',
                    dinner: 'Evening meal time! Log your dinner.'
                };

                const title = `${mealNames[mealType]} Reminder`;
                const message = mealMessages[mealType];

                await Notification.create({
                    userId: user._id,
                    type: 'food_reminder',
                    title,
                    message,
                    icon: '',
                    priority: 'medium',
                    actionUrl: '/nutrition',
                    metadata: { mealType },
                    expiresAt: tomorrow
                });

                sendToUser(user._id, { title, body: message, data: { type: 'food_reminder', actionUrl: '/nutrition' } })
                    .catch(e => console.error('FCM meal reminder failed:', e.message));
            }
        }
    }

    // Send sleep reminder for specific user
    async sendUserSleepReminder(user, targetSleepHours) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingReminder = await Notification.findOne({
            userId: user._id,
            type: 'sleep_reminder',
            createdAt: { $gte: today }
        });

        if (!existingReminder) {
            const title = 'Sleep Tracking Reminder';
            const message = `Time to wind down! Aim for ${targetSleepHours} hours of sleep. Don't forget to log your sleep hours.`;

            await Notification.create({
                userId: user._id,
                type: 'sleep_reminder',
                title,
                message,
                icon: '',
                priority: 'medium',
                actionUrl: '/dashboard',
                metadata: { reminderType: 'sleep', targetHours: targetSleepHours },
                expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            });

            sendToUser(user._id, { title, body: message, data: { type: 'sleep_reminder', actionUrl: '/dashboard' } })
                .catch(e => console.error('FCM sleep reminder failed:', e.message));
        }
    }

    // Send macro update for specific user
    async sendUserMacroUpdate(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingUpdate = await Notification.findOne({
            userId,
            type: 'macro_update',
            createdAt: { $gte: today }
        });

        if (!existingUpdate) {
            const summary = await NutritionSummary.findOne({ userId, date: today });

            if (summary) {
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

                const macroMessage = `${statusMsg}\nProtein: ${summary.totalProtein}g/${summary.proteinGoal || '?'}g (${protPct}%) | Carbs: ${summary.totalCarbs}g/${summary.carbsGoal || '?'}g (${carbsPct}%) | Fats: ${summary.totalFats}g/${summary.fatsGoal || '?'}g (${fatsPct}%)`;

                await Notification.create({
                    userId,
                    type: 'macro_update',
                    title: 'Daily Macro Check',
                    message: macroMessage,
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

                sendToUser(userId, { title: 'Daily Macro Check', body: statusMsg, data: { type: 'macro_update', actionUrl: '/nutrition' } })
                    .catch(e => console.error('FCM macro update failed:', e.message));
            }
        }
    }

    // Send diet adherence for specific user
    async sendUserDietAdherence(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const existingNotif = await Notification.findOne({
            userId,
            type: 'diet_adherence',
            createdAt: { $gte: today }
        });

        if (!existingNotif) {
            const dietPlans = await PersonalizedDietPlan.findOne({ userId, isActive: true });

            if (dietPlans) {
                const foodLogs = await FoodLog.find({
                    userId,
                    timestamp: { $gte: today, $lt: tomorrow }
                });

                const mealsLogged = foodLogs.length;
                const loggedFoods = foodLogs.flatMap(log =>
                    log.foodItems.map(item => item.name.toLowerCase())
                );

                let recommendedFoods = [];
                if (dietPlans.mealPlan) {
                    Object.values(dietPlans.mealPlan).forEach(mealArray => {
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
                    userId,
                    type: 'diet_adherence',
                    title: 'Diet Plan Adherence',
                    message,
                    icon: '',
                    priority,
                    actionUrl: '/diet-plan',
                    metadata: { mealsLogged, matchCount, totalRecommended: recommendedFoods.length },
                    expiresAt: tomorrow
                });

                sendToUser(userId, { title: 'Diet Plan Adherence', body: message, data: { type: 'diet_adherence', actionUrl: '/diet-plan' } })
                    .catch(e => console.error('FCM diet adherence failed:', e.message));
            }
        }
    }

    // Send health insight for specific user
    async sendUserHealthInsight(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingInsight = await Notification.findOne({
            userId,
            type: 'health_insight',
            createdAt: { $gte: today }
        });

        if (!existingInsight) {
            // Generate a random health insight based on user data
            const insights = [
                { title: 'Hydration Tip', message: 'Remember to drink enough water throughout the day. Aim for 8-10 glasses daily!' },
                { title: 'Movement Reminder', message: 'Try to take a short walk today. Even 10 minutes of movement can boost your mood!' },
                { title: 'Stress Management', message: 'Take a few minutes to practice deep breathing or meditation to reduce stress.' },
                { title: 'Nutrition Tip', message: 'Include more colorful vegetables in your meals for better nutrition!' },
                { title: 'Sleep Quality', message: 'Maintain a consistent sleep schedule for better health and energy levels.' }
            ];

            const randomInsight = insights[Math.floor(Math.random() * insights.length)];

            await Notification.create({
                userId,
                type: 'health_insight',
                title: randomInsight.title,
                message: randomInsight.message,
                icon: '',
                priority: 'low',
                actionUrl: '/dashboard',
                metadata: { insightType: 'daily_tip' },
                expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            });

            sendToUser(userId, { title: randomInsight.title, body: randomInsight.message, data: { type: 'health_insight', actionUrl: '/dashboard' } })
                .catch(e => console.error('FCM health insight failed:', e.message));
        }
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

module.exports = new NotificationService();
