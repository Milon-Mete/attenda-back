const Log = require('../models/Log');
const User = require('../models/User');

/**
 * GET /api/logs
 * Get all logs with filtering, pagination, and search — admin only
 * Query params: page, limit, status (inside/outside), userId, startDate, endDate
 */
const getAllLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    if (req.query.status === 'inside') filter.isWithinGeofence = true;
    if (req.query.status === 'outside') filter.isWithinGeofence = false;
    if (req.query.userId) filter.userId = req.query.userId;

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }

    // Search by employee name (lookup user IDs first)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      const matchingUsers = await User.find({ name: searchRegex }).select('_id');
      if (matchingUsers.length > 0) {
        filter.userId = { $in: matchingUsers.map((u) => u._id) };
      } else {
        // No matching users, return empty
        return res.json({
          success: true,
          data: { logs: [], pagination: { page, limit, total: 0, pages: 0 } },
        });
      }
    }

    const [logs, total] = await Promise.all([
      Log.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('matchedGeofence', 'siteName'),
      Log.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance logs.',
    });
  }
};

/**
 * GET /api/logs/stats
 * Get aggregate statistics for the dashboard
 */
const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, insideCount, outsideCount, activeEmployees] =
      await Promise.all([
        Log.countDocuments(),
        Log.countDocuments({ timestamp: { $gte: today } }),
        Log.countDocuments({ isWithinGeofence: true }),
        Log.countDocuments({ isWithinGeofence: false }),
        User.countDocuments({ role: 'employee', isActive: true }),
      ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalLogs,
          todayLogs,
          insideCount,
          outsideCount,
          activeEmployees,
          anomalyRate: totalLogs > 0 ? ((outsideCount / totalLogs) * 100).toFixed(1) : 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats.',
    });
  }
};

/**
 * GET /api/logs/:id
 * Get a single log by ID with full details
 */
const getLogById = async (req, res) => {
  try {
    const log = await Log.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('matchedGeofence', 'siteName areaCoordinates centerLat centerLng radius');
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log not found.',
      });
    }
    res.json({
      success: true,
      data: { log },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid log ID format.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to fetch log details.',
    });
  }
};

module.exports = { getAllLogs, getStats, getLogById };
