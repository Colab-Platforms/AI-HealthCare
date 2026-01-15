const WearableData = require('../models/WearableData');

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
    const { deviceType, metrics } = req.body;
    
    const wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      return res.status(404).json({ message: 'Device not connected' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if today's metrics exist
    const existingIndex = wearable.dailyMetrics.findIndex(
      m => new Date(m.date).toDateString() === today.toDateString()
    );
    
    if (existingIndex >= 0) {
      wearable.dailyMetrics[existingIndex] = { ...wearable.dailyMetrics[existingIndex], ...metrics, date: today };
    } else {
      wearable.dailyMetrics.push({ ...metrics, date: today });
    }
    
    wearable.lastSyncedAt = new Date();
    await wearable.save();
    
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
    const { deviceType, sleepData } = req.body;
    
    const wearable = await WearableData.findOne({ user: req.user._id, deviceType });
    if (!wearable) {
      return res.status(404).json({ message: 'Device not connected' });
    }

    wearable.sleepData.push(sleepData);
    await wearable.save();
    
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const wearable of wearables) {
      const todayData = wearable.dailyMetrics.find(
        m => new Date(m.date).toDateString() === today.toDateString()
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

// Generate demo data for testing
exports.generateDemoData = async (req, res) => {
  try {
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
