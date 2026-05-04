const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// @desc    Get all activity logs (Admin only)
// @route   GET /api/activity
exports.getActivityLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      category, 
      action, 
      userId, 
      search,
      startDate,
      endDate,
      hour
    } = req.query;

    console.log('🔍 Backend Received:', { page, limit, category, action, userId, search, startDate, endDate, hour });  // DEBUG LOG

    const query = {};

    if (category) query.category = category;
    if (action) query.action = action;
    if (userId) query.user = userId;

    if (startDate || endDate || hour) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
      
      // If hour is specified, filter by that specific hour
      if (hour !== undefined && hour !== null && hour !== '') {
        const hourNum = parseInt(hour);
        if (!isNaN(hourNum) && hourNum >= 0 && hourNum < 24) {
          // Use startDate if available, otherwise use today
          const baseDate = startDate ? new Date(startDate) : new Date();
          
          const startOfHour = new Date(baseDate);
          startOfHour.setHours(hourNum, 0, 0, 0);
          
          const endOfHour = new Date(baseDate);
          endOfHour.setHours(hourNum, 59, 59, 999);
          
          query.timestamp = {
            $gte: startOfHour,
            $lte: endOfHour
          };
          
          console.log('⏰ Hour Filter Applied:', { hour: hourNum, startOfHour, endOfHour });  // DEBUG LOG
        }
      }
    }

    console.log('📋 Final Query:', JSON.stringify(query, null, 2));  // DEBUG LOG

    if (search) {
      // Find users matching search term to filter logs
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.gender': { $regex: `^${search}$`, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      query.$or = [
        { user: { $in: userIds } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await ActivityLog.find(query)
      .populate('user', 'name email profile.avatar')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await ActivityLog.countDocuments(query);

    console.log('✅ Query Results:', { total, logsReturned: logs.length });  // DEBUG LOG

    res.json({
      success: true,
      logs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get activity stats for dashboard
// @route   GET /api/activity/stats
exports.getActivityStats = async (req, res) => {
  try {
    const { category, search, startDate, endDate } = req.query;
    
    // Build filter for stats
    const filter = {};
    if (category) filter.category = category;
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.gender': { $regex: `^${search}$`, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(u => u._id);
      filter.$or = [
        { user: { $in: userIds } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    const totalLogs = await ActivityLog.countDocuments(filter);
    const now = new Date();
    
    // Calculate Live Active Users (Currently active - last 5 minutes for real-time accuracy)
    // This matches how Clarity tracks "live" users
    const liveUsersThreshold = new Date(now.getTime() - (5 * 60 * 1000)); // Last 5 minutes
    const liveActiveUsersCount = await ActivityLog.distinct('user', { 
      timestamp: { $gte: liveUsersThreshold } 
    }).then(users => users.length);
    
    // Calculate Active Users (Unique users within the applied filters)
    // If no date filter is applied, default to last 24h for "active" users
    let activeUsersFilter = { ...filter };
    if (!filter.timestamp) {
      const activeUsersThreshold = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      activeUsersFilter.timestamp = { $gte: activeUsersThreshold };
    }
    const activeUsersCount = await ActivityLog.distinct('user', activeUsersFilter).then(users => users.length);

    // Identify users active within the filter criteria to scope demographics
    const activeFilterUserIds = await ActivityLog.distinct('user', filter);

    // Demographic Intelligence (Gender & Diabetic Status - Scoped to filtered users)
    const [genderStats, diabeticStats] = await Promise.all([
      User.aggregate([
        { $match: { _id: { $in: activeFilterUserIds }, profile: { $exists: true } } },
        { $group: { _id: '$profile.gender', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { _id: { $in: activeFilterUserIds }, profile: { $exists: true } } },
        { $group: { _id: '$profile.isDiabetic', count: { $sum: 1 } } }
      ])
    ]);

    // Group by category
    const categoryStats = await ActivityLog.aggregate([
      { $match: filter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Activity over last 7 days vs previous 7 days (Respecting filters)
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));

    const [thisWeekCount, lastWeekCount] = await Promise.all([
      ActivityLog.countDocuments({ ...filter, timestamp: { $gte: sevenDaysAgo } }),
      ActivityLog.countDocuments({ ...filter, timestamp: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } })
    ]);

    console.log(`Stats DEBUG: Filter=${JSON.stringify(filter)} | TotalFound=${totalLogs}`);

    // Timeline stats (Adaptive logic: respects user date range, or defaults to 14 days)
    const { timestamp, ...filterWithoutTime } = filter;
    
    let windowStart = fourteenDaysAgo;
    let windowEnd = now;
    
    if (filter.timestamp) {
      if (filter.timestamp.$gte) windowStart = new Date(filter.timestamp.$gte);
      if (filter.timestamp.$lte) windowEnd = new Date(filter.timestamp.$lte);
    }

    const windowRangeDays = Math.max(1, Math.ceil((windowEnd - windowStart) / (1000 * 60 * 60 * 24)));

    const rawTimelineStats = await ActivityLog.aggregate([
      { $match: { ...filterWithoutTime, timestamp: { $gte: windowStart, $lte: windowEnd } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData'
        }
      },
      { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          total: { $sum: 1 },
          diabetic: { $sum: { $cond: [{ $eq: ['$userData.profile.isDiabetic', true] }, 1, 0] } },
          male: { $sum: { $cond: [{ $eq: ['$userData.profile.gender', 'male'] }, 1, 0] } },
          female: { $sum: { $cond: [{ $eq: ['$userData.profile.gender', 'female'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing days in the specific range
    const timelineStats = [];
    for (let i = 0; i <= windowRangeDays; i++) {
       const date = new Date(windowStart);
       date.setDate(date.getDate() + i);
       const dateStr = date.toISOString().split('T')[0];
       if (date > windowEnd) break;
       
       const found = rawTimelineStats.find(s => s._id === dateStr);
       timelineStats.push({
         _id: dateStr,
         total: found ? found.total : 0,
         diabetic: found ? found.diabetic : 0,
         male: found ? found.male : 0,
         female: found ? found.female : 0
       });
    }
    console.log(`Timeline DEBUG: Returned ${timelineStats.length} days | ActivePoints=${rawTimelineStats.length}`);

    // Hourly Visit Time Analytics (Peak Hours)
    const hourlyStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing hours (0-23)
    const completeHourlyStats = [];
    for (let hour = 0; hour < 24; hour++) {
      const found = hourlyStats.find(h => h._id === hour);
      completeHourlyStats.push({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count: found ? found.count : 0,
        hourNum: hour
      });
    }

    res.json({
      success: true,
      stats: {
        totalLogs,
        liveActiveUsersCount,  // Currently active (last 5 minutes) - matches Clarity
        activeUsersCount,      // Active in last 24 hours
        genderStats: genderStats || [],
        diabeticStats: diabeticStats || [],
        categoryStats: categoryStats || [],
        timelineStats: timelineStats || [],
        hourlyStats: completeHourlyStats || [],  // Peak visit hours
        thisWeekCount,
        lastWeekCount,
        trend: lastWeekCount <= 0 ? 100 : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export all activity logs as CSV (Admin only)
// @route   GET /api/activity/export
exports.exportActivityLogs = async (req, res) => {
  try {
    const { 
      category, 
      action, 
      userId, 
      search,
      startDate,
      endDate,
      hour
    } = req.query;

    console.log('📥 Export Request:', { category, action, userId, search, startDate, endDate, hour });

    const query = {};

    if (category) query.category = category;
    if (action) query.action = action;
    if (userId) query.user = userId;

    if (startDate || endDate || hour) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
      
      // If hour is specified, filter by that specific hour
      if (hour !== undefined && hour !== null && hour !== '') {
        const hourNum = parseInt(hour);
        if (!isNaN(hourNum) && hourNum >= 0 && hourNum < 24) {
          const baseDate = startDate ? new Date(startDate) : new Date();
          
          const startOfHour = new Date(baseDate);
          startOfHour.setHours(hourNum, 0, 0, 0);
          
          const endOfHour = new Date(baseDate);
          endOfHour.setHours(hourNum, 59, 59, 999);
          
          query.timestamp = {
            $gte: startOfHour,
            $lte: endOfHour
          };
        }
      }
    }

    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.gender': { $regex: `^${search}`, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      query.$or = [
        { user: { $in: userIds } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch ALL logs without pagination
    const logs = await ActivityLog.find(query)
      .populate('user', 'name email profile.avatar profile.gender profile.isDiabetic')
      .sort({ timestamp: -1 })
      .lean();

    console.log(`📊 Export: Found ${logs.length} records`);

    // Convert to CSV format
    const csvHeaders = ['User Name', 'Email', 'Gender', 'Diabetic', 'Category', 'Action', 'Timestamp', 'IP Address'];
    const csvRows = logs.map(log => [
      log.user?.name || 'Guest User',
      log.user?.email || 'N/A',
      log.user?.profile?.gender || 'N/A',
      log.user?.profile?.isDiabetic === 'yes' ? 'Yes' : 'No',
      log.category || 'N/A',
      log.action?.replace(/_/g, ' ') || 'N/A',
      new Date(log.timestamp).toLocaleString(),
      log.metadata?.ip || 'N/A'
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting activity logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
