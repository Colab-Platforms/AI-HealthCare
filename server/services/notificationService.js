const cron = require('node-cron');
const Notification = require('../models/Notification');
const NutritionSummary = require('../models/NutritionSummary');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const HealthReport = require('../models/HealthReport');
const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');

class NotificationService {
    constructor() {
        this.startSchedulers();
        console.log('🔔 Notification service started');
    }

    startSchedulers() {
        // Breakfast reminder at 8:00 AM
        cron.schedule('0 8 * * *', () => this.sendMealReminders('breakfast'));

        // Lunch reminder at 1:00 PM
        cron.schedule('0 13 * * *', () => this.sendMealReminders('lunch'));

        // Snack reminder at 4:00 PM
        cron.schedule('0 16 * * *', () => this.sendMealReminders('snack'));

        // Dinner reminder at 7:00 PM
        cron.schedule('0 19 * * *', () => this.sendMealReminders('dinner'));

        // Sleep reminder at 10:00 PM
        cron.schedule('0 22 * * *', () => this.sendSleepReminders());

        // Macro progress check at 6:00 PM
        cron.schedule('0 18 * * *', () => this.sendMacroUpdates());

        // Diet adherence check at 8:00 PM
        cron.schedule('0 20 * * *', () => this.sendDietAdherenceNotifications());

        // Check on startup for any pending notifications
        setTimeout(() => this.generateStartupNotifications(), 5000);
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
    static async createNotification(userId, { type, title, message, icon, priority, actionUrl, metadata, expiresAt }) {
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
