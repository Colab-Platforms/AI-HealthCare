const WearableData = require('../models/WearableData');
const cache = require('../utils/cache');

// Connect a new wearable device
exports.connectDevice = async (req, res) => {
  try {
    const { deviceType, deviceName } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });

    if (wearable) {
      wearable.isConnected = true;
      wearable.deviceName = deviceName || wearable.deviceName;
      wearable.lastSyncedAt = new Date();
      await wearable.save();
    } else {
      wearable = await WearableData.create({
        user: req.user._id,
        deviceType,
        deviceName,
        isConnected: true
      });
    }

    res.status(201).json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Disconnect device
exports.disconnectDevice = async (req, res) => {
  try {
    const wearable = await WearableData.findOneAndUpdate(
      { user: req.user._id, deviceType: req.params.deviceType },
      { isConnected: false },
      { new: true }
    );

    if (!wearable) {
      return res.status(404).json({ message: 'Device not found' });
    }

    res.json({ message: 'Device disconnected', wearable });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all connected devices
exports.getConnectedDevices = async (req, res) => {
  try {
    const devices = await WearableData.find({ user: req.user._id });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Sync daily metrics (simulated - in real app would come from device API)
exports.syncDailyMetrics = async (req, res) => {
  try {
    const { deviceType = 'other', metrics } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      if (deviceType === 'other') {
        wearable = await WearableData.create({
          user: req.user._id,
          deviceType: 'other',
          deviceName: 'Manual Entry',
          isConnected: true,
          dailyMetrics: []
        });
      } else {
        return res.status(404).json({ message: 'Device not connected' });
      }
    }

    // Use date from metrics or fallback to today
    // IMPORTANT: Parse date strings like "2026-03-13" as UTC directly to avoid timezone shift
    let targetDate;
    if (metrics.date && typeof metrics.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(metrics.date)) {
      // Parse YYYY-MM-DD as UTC midnight directly
      const [y, m, d] = metrics.date.split('-').map(Number);
      targetDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      targetDate = metrics.date ? new Date(metrics.date) : new Date();
      targetDate.setUTCHours(0, 0, 0, 0);
    }
    const targetDateString = targetDate.toISOString().split('T')[0];

    // Check if entry for this date exists
    const existingIndex = wearable.dailyMetrics.findIndex(m => {
      const d = new Date(m.date);
      return d.getUTCFullYear() === targetDate.getUTCFullYear() &&
             d.getUTCMonth() === targetDate.getUTCMonth() &&
             d.getUTCDate() === targetDate.getUTCDate();
    });

    if (existingIndex >= 0) {
      // Merge metrics
      const existing = wearable.dailyMetrics[existingIndex].toObject();
      const updatedMetrics = { ...existing, ...metrics };

      // If additive flag is present, add steps/calories instead of replacing
      if (req.body.isAdditive) {
        if (metrics.steps !== undefined) updatedMetrics.steps = (existing.steps || 0) + Number(metrics.steps);
        if (metrics.caloriesBurned !== undefined) updatedMetrics.caloriesBurned = (existing.caloriesBurned || 0) + Number(metrics.caloriesBurned);
        if (metrics.activeMinutes !== undefined) updatedMetrics.activeMinutes = (existing.activeMinutes || 0) + Number(metrics.activeMinutes);
        if (metrics.distance !== undefined) updatedMetrics.distance = (existing.distance || 0) + Number(metrics.distance);
      }

      wearable.dailyMetrics[existingIndex] = {
        ...updatedMetrics,
        date: targetDate
      };
      wearable.markModified('dailyMetrics');
    } else {
      wearable.dailyMetrics.push({ ...metrics, date: targetDate });
    }

    wearable.lastSyncedAt = new Date();
    await wearable.save();

    // Invalidate server-side dashboard cache so next fetch returns fresh data
    cache.delete(`dashboard:${req.user._id}`);

    res.json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add heart rate reading
exports.addHeartRate = async (req, res) => {
  try {
    const { deviceType, bpm, type } = req.body;

    const wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      return res.status(404).json({ message: 'Device not connected' });
    }

    wearable.heartRate.push({ bpm, type, timestamp: new Date() });

    // Keep only last 100 readings
    if (wearable.heartRate.length > 100) {
      wearable.heartRate = wearable.heartRate.slice(-100);
    }

    await wearable.save();
    res.json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add sleep data
exports.addSleepData = async (req, res) => {
  try {
    const { deviceType = 'other', sleepData } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      if (deviceType === 'other') {
        wearable = await WearableData.create({
          user: req.user._id,
          deviceType: 'other',
          deviceName: 'Manual Entry',
          isConnected: true,
          sleepData: []
        });
      } else {
        return res.status(404).json({ message: 'Device not connected' });
      }
    }

    // IMPORTANT: Parse date strings like "2026-03-13" as UTC directly to avoid timezone shift
    let targetDate;
    if (sleepData.date && typeof sleepData.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sleepData.date)) {
      const [y, m, d] = sleepData.date.split('-').map(Number);
      targetDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      targetDate = sleepData.date ? new Date(sleepData.date) : new Date();
      targetDate.setUTCHours(0, 0, 0, 0);
    }
    const targetDateString = targetDate.toISOString().split('T')[0];

    const existingIndex = wearable.sleepData.findIndex(s => {
      const d = new Date(s.date);
      return d.getUTCFullYear() === targetDate.getUTCFullYear() &&
             d.getUTCMonth() === targetDate.getUTCMonth() &&
             d.getUTCDate() === targetDate.getUTCDate();
    });

    if (existingIndex >= 0) {
      const existing = wearable.sleepData[existingIndex].toObject();
      const updatedSleep = { ...existing, ...sleepData };

      // If additive flag is present, add totalSleepMinutes/remSleepMinutes etc instead of replacing
      if (req.body.isAdditive) {
        if (sleepData.totalSleepMinutes !== undefined) updatedSleep.totalSleepMinutes = (existing.totalSleepMinutes || 0) + Number(sleepData.totalSleepMinutes);
        if (sleepData.remSleepMinutes !== undefined) updatedSleep.remSleepMinutes = (existing.remSleepMinutes || 0) + Number(sleepData.remSleepMinutes);
        if (sleepData.deepSleepMinutes !== undefined) updatedSleep.deepSleepMinutes = (existing.deepSleepMinutes || 0) + Number(sleepData.deepSleepMinutes);
      }

      wearable.sleepData[existingIndex] = {
        ...updatedSleep,
        date: targetDate
      };
      wearable.markModified('sleepData');
    } else {
      wearable.sleepData.push({ ...sleepData, date: targetDate });
    }

    await wearable.save();

    // Invalidate server-side dashboard cache so next fetch returns fresh data
    cache.delete(`dashboard:${req.user._id}`);

    res.json(wearable);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get wearable dashboard data
exports.getWearableDashboard = async (req, res) => {
  try {
    const wearables = await WearableData.find({ user: req.user._id, isConnected: true });

    if (!wearables.length) {
      return res.json({ connected: false, devices: [] });
    }

    // Aggregate data from all devices
    const dashboard = {
      connected: true,
      devices: wearables.map(w => ({
        type: w.deviceType,
        name: w.deviceName,
        lastSynced: w.lastSyncedAt
      })),
      todayMetrics: null,
      recentHeartRate: [],
      recentSleep: [],
      weeklyTrend: []
    };

    // Get today's metrics
    const targetDate = new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
    const targetDateString = targetDate.toISOString().split('T')[0];

    for (const wearable of wearables) {
      const todayData = wearable.dailyMetrics.find(
        m => new Date(m.date).toISOString().split('T')[0] === targetDateString
      );

      if (todayData) {
        dashboard.todayMetrics = dashboard.todayMetrics || { steps: 0, caloriesBurned: 0, activeMinutes: 0, distance: 0 };
        dashboard.todayMetrics.steps += todayData.steps || 0;
        dashboard.todayMetrics.caloriesBurned += todayData.caloriesBurned || 0;
        dashboard.todayMetrics.activeMinutes += todayData.activeMinutes || 0;
        dashboard.todayMetrics.distance += todayData.distance || 0;
      }

      // Get recent heart rate (last 10 readings)
      if (wearable.heartRate.length) {
        dashboard.recentHeartRate.push(...wearable.heartRate.slice(-10));
      }

      // Get recent sleep data (last 7 days)
      if (wearable.sleepData.length) {
        dashboard.recentSleep.push(...wearable.sleepData.slice(-7));
      }

      // Get weekly trend
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyData = wearable.dailyMetrics.filter(m => new Date(m.date) >= weekAgo);
      dashboard.weeklyTrend.push(...weeklyData);
    }

    // Sort by date
    dashboard.recentHeartRate.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    dashboard.recentSleep.sort((a, b) => new Date(b.date) - new Date(a.date));
    dashboard.weeklyTrend.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Generate demo data for testing - DISABLED IN PRODUCTION
exports.generateDemoData = async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        message: 'Demo data generation is disabled in production',
        error: 'DEMO_DATA_DISABLED'
      });
    }

    const { deviceType } = req.body;

    let wearable = await WearableData.findOne({ user: req.user._id, deviceType });

    if (!wearable) {
      wearable = await WearableData.create({
        user: req.user._id,
        deviceType,
        deviceName: `Demo ${deviceType}`,
        isConnected: true
      });
    }

    // Generate 7 days of demo data
    const dailyMetrics = [];
    const heartRate = [];
    const sleepData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      dailyMetrics.push({
        date,
        steps: Math.floor(5000 + Math.random() * 8000),
        caloriesBurned: Math.floor(1500 + Math.random() * 1000),
        activeMinutes: Math.floor(20 + Math.random() * 60),
        distance: parseFloat((3 + Math.random() * 7).toFixed(2)),
        floorsClimbed: Math.floor(Math.random() * 20)
      });

      // Heart rate readings throughout the day
      for (let h = 0; h < 6; h++) {
        const timestamp = new Date(date);
        timestamp.setHours(8 + h * 2);
        heartRate.push({
          timestamp,
          bpm: Math.floor(60 + Math.random() * 40),
          type: Math.random() > 0.7 ? 'active' : 'resting'
        });
      }

      sleepData.push({
        date,
        totalSleepMinutes: Math.floor(360 + Math.random() * 120),
        deepSleepMinutes: Math.floor(60 + Math.random() * 60),
        lightSleepMinutes: Math.floor(180 + Math.random() * 60),
        remSleepMinutes: Math.floor(60 + Math.random() * 30),
        awakeMinutes: Math.floor(10 + Math.random() * 20),
        sleepScore: Math.floor(60 + Math.random() * 35)
      });
    }

    wearable.dailyMetrics = dailyMetrics;
    wearable.heartRate = heartRate;
    wearable.sleepData = sleepData;
    wearable.lastSyncedAt = new Date();

    await wearable.save();

    res.json({ message: 'Demo data generated', wearable });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
