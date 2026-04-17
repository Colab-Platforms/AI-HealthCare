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
      search 
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (action) query.action = action;
    if (userId) query.user = userId;

    if (search) {
      // Find users matching search term to filter logs
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
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
      count: logs.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: logs
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
    const totalLogs = await ActivityLog.countDocuments();
    
    // Group by category
    const categoryStats = await ActivityLog.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Group by action
    const actionStats = await ActivityLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Activity over last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const timelineStats = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalLogs,
        categoryStats,
        actionStats,
        timelineStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
