const cron = require('node-cron');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const NutritionSummary = require('../models/NutritionSummary');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const HealthReport = require('../models/HealthReport');
const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');

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
        // 🔴 COMMENTED OUT: Notification system disabled for now
        // Will be enabled later with proper testing
        
        // ✅ OPTIMIZED: Check every minute for user-specific notification times
        // This respects each user's personal preferences and timezone
        
        // const job = cron.schedule('* * * * *', () => {
        //     console.log(`⏰ Checking for user-specific notifications at ${new Date().toISOString()}`);
        //     this.checkAndSendUserNotifications();
        // });
        // this.cronJobs.push(job);

        // Check on startup for any pending notifications
        if (!process.env.VERCEL) {
            // setTimeout(() => this.generateStartupNotifications(), 5000);
            console.log('🔔 Notification scheduler disabled - will enable later');
        }
    }

    // 🔴 COMMENTED OUT: User-specific notification checking
    // ✅ NEW: Check each user's preferences and send notifications at their specific times
    async checkAndSendUserNotifications() {
        // DISABLED FOR NOW - Will implement later
        // try {
        //     const preferences = await this.getPreferencesWithCache();
        //     const now = new Date();
        //     const currentHour = now.getHours();
        //     const currentMinute = now.getMinutes();
        //     const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        //     for (const [userId, pref] of preferences) {
        //         try {
        //             // Check meal reminders
        //             if (pref.mealReminders?.enabled) {
        //                 if (pref.mealReminders.breakfast === currentTime) {
        //                     await this.sendUserMealReminder(userId, 'breakfast');
        //                 }
        //                 if (pref.mealReminders.lunch === currentTime) {
        //                     await this.sendUserMealReminder(userId, 'lunch');
        //                 }
        //                 if (pref.mealReminders.snack === currentTime) {
        //                     await this.sendUserMealReminder(userId, 'snack');
        //                 }
        //                 if (pref.mealReminders.dinner === currentTime) {
        //                     await this.sendUserMealReminder(userId, 'dinner');
        //                 }
        //             }

        //             // Check sleep reminder
        //             if (pref.sleepReminder?.enabled && pref.sleepReminder.time === currentTime) {
        //                 await this.sendUserSleepReminder(userId, pref.sleepReminder.targetSleepHours);
        //             }

        //             // Check macro update
        //             if (pref.macroUpdate?.enabled && pref.macroUpdate.time === currentTime) {
        //                 await this.sendUserMacroUpdate(userId);
        //             }

        //             // Check diet adherence
        //             if (pref.dietAdherence?.enabled && pref.dietAdherence.time === currentTime) {
        //                 await this.sendUserDietAdherence(userId);
        //             }

        //             // Check health insights
        //             if (pref.healthInsights?.enabled && pref.healthInsights.time === currentTime) {
        //                 await this.sendUserHealthInsight(userId);
        //             }
        //         } catch (error) {
        //             console.error(`Error processing notifications for user ${userId}:`, error.message);
        //         }
        //     }
        // } catch (error) {
        //     console.error('Error in checkAndSendUserNotifications:', error.message);
        // }
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
        const preferences = await NotificationPreference.find({})
            .select('userId mealReminders sleepReminder macroUpdate dietAdherence healthInsights')
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
                const mealNames = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', snack: '🍎 Snack', dinner: '🌙 Dinner' };
                const mealMessages = {
                    breakfast: 'Start your day right! Log your breakfast.',
                    lunch: 'Time for lunch! Don\'t forget to log it.',
                    snack: 'Healthy snack time! Log it now.',
                    dinner: 'Evening meal time! Log your dinner.'
                };

                await Notification.create({
                    userId: user._id,
                    type: 'food_reminder',
                    title: `${mealNames[mealType]} Reminder`,
                    message: mealMessages[mealType],
                    icon: mealType === 'breakfast' ? '🌅' : mealType === 'lunch' ? '☀️' : mealType === 'snack' ? '🍎' : '🌙',
                    priority: 'medium',
                    actionUrl: '/nutrition',
                    metadata: { mealType },
                    expiresAt: tomorrow
                });
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
            await Notification.create({
                userId: user._id,
                type: 'sleep_reminder',
                title: '😴 Sleep Tracking Reminder',
                message: `Time to wind down! Aim for ${targetSleepHours} hours of sleep. Don't forget to log your sleep hours.`,
                icon: '🌙',
                priority: 'medium',
                actionUrl: '/dashboard',
                metadata: { reminderType: 'sleep', targetHours: targetSleepHours },
                expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            });
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

                let statusEmoji = '📊';
                let statusMsg = '';

                if (calPct >= 80 && calPct <= 110) {
                    statusEmoji = '✅';
                    statusMsg = 'You\'re on track with your calorie goal!';
                } else if (calPct < 50) {
                    statusEmoji = '⚠️';
                    statusMsg = `You've only consumed ${calPct}% of your daily calories. Try to eat more balanced meals.`;
                } else if (calPct > 110) {
                    statusEmoji = '🔴';
                    statusMsg = `You've exceeded your calorie goal by ${calPct - 100}%. Consider lighter options for remaining meals.`;
                } else {
                    statusMsg = `You've consumed ${calPct}% of your daily calories. Keep it up!`;
                }

                await Notification.create({
                    userId,
                    type: 'macro_update',
                    title: `${statusEmoji} Daily Macro Check`,
                    message: `${statusMsg}\n🥩 Protein: ${summary.totalProtein}g/${summary.proteinGoal || '?'}g (${protPct}%) | 🍞 Carbs: ${summary.totalCarbs}g/${summary.carbsGoal || '?'}g (${carbsPct}%) | 🥑 Fats: ${summary.totalFats}g/${summary.fatsGoal || '?'}g (${fatsPct}%)`,
                    icon: statusEmoji,
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
                let icon = '📋';
                let priority = 'low';

                if (mealsLogged === 0) {
                    message = 'You haven\'t logged any meals today. Your personalized diet plan is waiting for you!';
                    icon = '🍽️';
                    priority = 'medium';
                } else if (matchCount > 0) {
                    message = `Great job! ${matchCount} of your logged foods match your recommended diet plan. Keep following your personalized nutrition!`;
                    icon = '🌟';
                } else {
                    message = `You've logged ${mealsLogged} meal(s) today. Try to include more foods from your personalized diet plan for optimal results.`;
                    icon = '💡';
                    priority = 'medium';
                }

                await Notification.create({
                    userId,
                    type: 'diet_adherence',
                    title: `${icon} Diet Plan Adherence`,
                    message,
                    icon,
                    priority,
                    actionUrl: '/diet-plan',
                    metadata: { mealsLogged, matchCount, totalRecommended: recommendedFoods.length },
                    expiresAt: tomorrow
                });
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
                { title: '💧 Hydration Tip', message: 'Remember to drink enough water throughout the day. Aim for 8-10 glasses daily!' },
                { title: '🚶 Movement Reminder', message: 'Try to take a short walk today. Even 10 minutes of movement can boost your mood!' },
                { title: '🧘 Stress Management', message: 'Take a few minutes to practice deep breathing or meditation to reduce stress.' },
                { title: '🥗 Nutrition Tip', message: 'Include more colorful vegetables in your meals for better nutrition!' },
                { title: '😴 Sleep Quality', message: 'Maintain a consistent sleep schedule for better health and energy levels.' }
            ];

            const randomInsight = insights[Math.floor(Math.random() * insights.length)];

            await Notification.create({
                userId,
                type: 'health_insight',
                title: randomInsight.title,
                message: randomInsight.message,
                icon: '💡',
                priority: 'low',
                actionUrl: '/dashboard',
                metadata: { insightType: 'daily_tip' },
                expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            });
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
                            breakfast: '🌅 Breakfast',
                            lunch: '☀️ Lunch',
                            snack: '🍎 Snack',
                            dinner: '🌙 Dinner'
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
                            icon: mealType === 'breakfast' ? '🌅' : mealType === 'lunch' ? '☀️' : mealType === 'snack' ? '🍎' : '🌙',
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
                        title: '😴 Sleep Tracking Reminder',
                        message: 'Time to wind down! Don\'t forget to log your sleep hours for better health insights.',
                        icon: '🌙',
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

                    let statusEmoji = '📊';
                    let statusMsg = '';

                    if (calPct >= 80 && calPct <= 110) {
                        statusEmoji = '✅';
                        statusMsg = 'You\'re on track with your calorie goal!';
                    } else if (calPct < 50) {
                        statusEmoji = '⚠️';
                        statusMsg = `You've only consumed ${calPct}% of your daily calories. Try to eat more balanced meals.`;
                    } else if (calPct > 110) {
                        statusEmoji = '🔴';
                        statusMsg = `You've exceeded your calorie goal by ${calPct - 100}%. Consider lighter options for remaining meals.`;
                    } else {
                        statusMsg = `You've consumed ${calPct}% of your daily calories. Keep it up!`;
                    }

                    await Notification.create({
                        userId: summary.userId,
                        type: 'macro_update',
                        title: `${statusEmoji} Daily Macro Check`,
                        message: `${statusMsg}\n🥩 Protein: ${summary.totalProtein}g/${summary.proteinGoal || '?'}g (${protPct}%) | 🍞 Carbs: ${summary.totalCarbs}g/${summary.carbsGoal || '?'}g (${carbsPct}%) | 🥑 Fats: ${summary.totalFats}g/${summary.fatsGoal || '?'}g (${fatsPct}%)`,
                        icon: statusEmoji,
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
                    let icon = '📋';
                    let priority = 'low';

                    if (mealsLogged === 0) {
                        message = 'You haven\'t logged any meals today. Your personalized diet plan is waiting for you!';
                        icon = '🍽️';
                        priority = 'medium';
                    } else if (matchCount > 0) {
                        message = `Great job! ${matchCount} of your logged foods match your recommended diet plan. Keep following your personalized nutrition!`;
                        icon = '🌟';
                    } else {
                        message = `You've logged ${mealsLogged} meal(s) today. Try to include more foods from your personalized diet plan for optimal results.`;
                        icon = '💡';
                        priority = 'medium';
                    }

                    await Notification.create({
                        userId: plan.userId,
                        type: 'diet_adherence',
                        title: `${icon} Diet Plan Adherence`,
                        message,
                        icon,
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
            return await Notification.create({
                userId,
                type,
                title,
                message,
                icon: icon || '🔔',
                priority: priority || 'medium',
                actionUrl,
                metadata,
                expiresAt
            });
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }
}

module.exports = new NotificationService();
