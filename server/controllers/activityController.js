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
      endDate
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (action) query.action = action;
    if (userId) query.user = userId;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

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
    
    // Calculate Active Users (Unique users with activity in last 24h)
    const activeUsersThreshold = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const activeUsersCount = await ActivityLog.distinct('user', { 
      timestamp: { $gte: activeUsersThreshold } 
    }).then(users => users.length);

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

    res.json({
      success: true,
      stats: {
        totalLogs,
        activeUsersCount,
        genderStats: genderStats || [],
        diabeticStats: diabeticStats || [],
        categoryStats: categoryStats || [],
        timelineStats: timelineStats || [],
        thisWeekCount,
        lastWeekCount,
        trend: lastWeekCount <= 0 ? 100 : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
