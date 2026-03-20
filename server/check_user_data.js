const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb+srv://AI-Healthcare:Healthcare123@cluster0.ij9yb3s.mongodb.net/healthcare-ai?retryWrites=true&w=majority');
    const User = require('./models/User');
    const WearableData = require('./models/WearableData');
    const HealthMetric = require('./models/HealthMetric');
    const NutritionSummary = require('./models/NutritionSummary');
    
    // Find the user who most recently logged weight or sleep
    const recentMetrics = await HealthMetric.find({ type: 'weight' }).sort({ updatedAt: -1 }).limit(1);
    const recentWearables = await WearableData.find().sort({ updatedAt: -1 }).limit(1);
    
    let userId;
    if (recentMetrics.length > 0) userId = recentMetrics[0].userId;
    else if (recentWearables.length > 0) userId = recentWearables[0].user;
    
    if (!userId) {
        console.log('No recent data found.');
        process.exit(0);
    }
    
    const user = await User.findById(userId);
    console.log('User:', user?.email, 'ID:', userId.toString());
    
    const wearables = await WearableData.find({ user: userId });
    console.log('\nWearable Records:', wearables.length);
    wearables.forEach(w => {
        console.log('  Device:', w.deviceType);
        console.log('  Last 5 dailyMetrics:', w.dailyMetrics.slice(-5).map(m => `${m.date.toISOString().split('T')[0]}: ${m.steps} steps`));
        console.log('  Last 5 sleepData:', w.sleepData.slice(-5).map(s => `${s.date.toISOString().split('T')[0]}: ${s.totalSleepMinutes} min`));
    });
    
    const weights = await HealthMetric.find({ userId, type: 'weight' }).sort({ recordedAt: -1 }).limit(5);
    console.log('\nLast 5 weight logs:', weights.map(w => `${w.recordedAt.toISOString().split('T')[0]}: ${w.value}kg`));
    
    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
