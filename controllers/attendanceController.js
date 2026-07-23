const { cloudinary } = require('../config/cloudinary');
const Geofence = require('../models/Geofence');
const Log = require('../models/Log');
const { isValidCoordinate, buildGeoPoint } = require('../utils/geoUtils');

/**
 * Helper: resolve geofence match for a lat/lng coordinate pair
 */
const resolveGeofence = async (latitude, longitude) => {
  const geoPoint = buildGeoPoint(latitude, longitude);
  const matched = await Geofence.findOne({
    isActive: true,
    areaCoordinates: { $geoIntersects: { $geometry: geoPoint } },
  });
  return {
    geoPoint,
    matchedGeofence: matched,
    isWithinGeofence: !!matched,
  };
};

/**
 * Helper: format hours worked in human-readable string
 */
const formatHours = (hours) => {
  if (hours === null || hours === undefined) return null;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return { hours: h, minutes: m, label: `${h}h ${m}m` };
};

/**
 * POST /api/attendance/checkin
 * Process a check-in: close any active shift, then create a new one.
 * Expects multipart/form-data with:
 *   - selfie: image file
 *   - latitude: number
 *   - longitude: number
 */
const checkIn = async (req, res) => {
  try {
    // Validate selfie
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Selfie image is required. Please capture a photo.',
      });
    }

    // Parse coordinates
    const rawLat = req.body.latitude;
    const rawLng = req.body.longitude;
    if (rawLat == null || rawLng == null) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates are missing. Please enable location services.',
      });
    }
    const latitude = typeof rawLat === 'string' ? parseFloat(rawLat.trim()) : parseFloat(rawLat);
    const longitude = typeof rawLng === 'string' ? parseFloat(rawLng.trim()) : parseFloat(rawLng);
    if (isNaN(latitude) || isNaN(longitude) || !isValidCoordinate(latitude, longitude)) {
      if (req.file?.public_id) await cloudinary.uploader.destroy(req.file.public_id).catch(() => {});
      return res.status(400).json({ success: false, message: 'Valid GPS coordinates are required.' });
    }

    // 1) Close any previously active (unchecked-out) shift for this user
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await Log.updateMany(
      { userId: req.user._id, status: 'active', timestamp: { $gte: yesterday } },
      { $set: { status: 'completed', hoursWorked: 0 } }
    );

    // 2) Resolve geofence
    const { geoPoint, matchedGeofence, isWithinGeofence } = await resolveGeofence(latitude, longitude);

    // 3) Create new shift log
    const log = await Log.create({
      userId: req.user._id,
      timestamp: new Date(),
      location: geoPoint,
      selfieUrl: req.file.path,
      selfiePublicId: req.file.filename || req.file.public_id,
      isWithinGeofence,
      matchedGeofence: matchedGeofence ? matchedGeofence._id : null,
      status: 'active',
      deviceInfo: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
    });

    await log.populate('matchedGeofence', 'siteName');

    res.status(201).json({
      success: true,
      message: isWithinGeofence
        ? '✅ Check-in successful! You are within the geofence.'
        : '⚠️ Check-in recorded, but you are outside the designated area.',
      data: {
        shift: {
          _id: log._id,
          type: 'checkin',
          timestamp: log.timestamp,
          isWithinGeofence: log.isWithinGeofence,
          status: log.status,
          siteName: log.matchedGeofence?.siteName || null,
        },
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('Check-in error:', error);
    res.status(500).json({ success: false, message: 'Check-in failed. Please try again.' });
  }
};

/**
 * POST /api/attendance/checkout
 * Check out of an active shift with selfie + GPS.
 * Expects multipart/form-data with:
 *   - selfie: image file
 *   - latitude: number
 *   - longitude: number
 */
const checkOut = async (req, res) => {
  try {
    // Find the user's active shift
    const activeShift = await Log.findOne({ userId: req.user._id, status: 'active' }).sort({ timestamp: -1 });
    if (!activeShift) {
      return res.status(400).json({
        success: false,
        message: 'No active check-in found. Please check in first.',
      });
    }

    // Validate selfie
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Selfie image is required for check-out.',
      });
    }

    // Parse coordinates
    const rawLat = req.body.latitude;
    const rawLng = req.body.longitude;
    if (rawLat == null || rawLng == null) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates are missing for check-out.',
      });
    }
    const latitude = typeof rawLat === 'string' ? parseFloat(rawLat.trim()) : parseFloat(rawLat);
    const longitude = typeof rawLng === 'string' ? parseFloat(rawLng.trim()) : parseFloat(rawLng);
    if (isNaN(latitude) || isNaN(longitude) || !isValidCoordinate(latitude, longitude)) {
      if (req.file?.public_id) await cloudinary.uploader.destroy(req.file.public_id).catch(() => {});
      return res.status(400).json({ success: false, message: 'Valid GPS coordinates are required.' });
    }

    // Resolve geofence
    const { geoPoint, matchedGeofence, isWithinGeofence } = await resolveGeofence(latitude, longitude);

    // Calculate hours worked
    const checkInTime = new Date(activeShift.timestamp).getTime();
    const checkOutTime = Date.now();
    const hoursWorked = Math.round(((checkOutTime - checkInTime) / (1000 * 60 * 60)) * 100) / 100;

    // Update the active shift with check-out info
    activeShift.status = 'completed';
    activeShift.checkOutTimestamp = new Date();
    activeShift.checkOutSelfieUrl = req.file.path;
    activeShift.checkOutSelfiePublicId = req.file.filename || req.file.public_id;
    activeShift.checkOutLocation = geoPoint;
    activeShift.checkOutIsWithinGeofence = isWithinGeofence;
    activeShift.checkOutMatchedGeofence = matchedGeofence ? matchedGeofence._id : null;
    activeShift.hoursWorked = hoursWorked;
    await activeShift.save();

    await activeShift.populate('matchedGeofence', 'siteName');

    res.json({
      success: true,
      message: `✅ Check-out successful! You worked ${formatHours(hoursWorked).label}.`,
      data: {
        shift: {
          _id: activeShift._id,
          type: 'checkout',
          timestamp: activeShift.timestamp,
          checkOutTimestamp: activeShift.checkOutTimestamp,
          hoursWorked: formatHours(hoursWorked),
        },
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('Check-out error:', error);
    res.status(500).json({ success: false, message: 'Check-out failed. Please try again.' });
  }
};

/**
 * GET /api/attendance/today-status
 * Get today's shift status for the authenticated employee
 */
const getTodayStatus = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Find today's logs for this user, newest first
    const todayLogs = await Log.find({
      userId: req.user._id,
      timestamp: { $gte: todayStart },
    })
      .sort({ timestamp: -1 })
      .populate('matchedGeofence', 'siteName');

    // Find the active shift (if any)
    const activeShift = todayLogs.find((l) => l.status === 'active');

    // Find the latest completed shift today
    const completedShift = todayLogs.find((l) => l.status === 'completed');

    const status = activeShift ? 'active' : 'idle';

    res.json({
      success: true,
      data: {
        status, // 'active' | 'idle'
        inTime: activeShift?.timestamp || null,
        outTime: activeShift?.checkOutTimestamp || completedShift?.checkOutTimestamp || null,
        hoursWorked: activeShift
          ? formatHours((Date.now() - new Date(activeShift.timestamp).getTime()) / (1000 * 60 * 60))
          : completedShift
          ? formatHours(completedShift.hoursWorked)
          : null,
        siteName: activeShift?.matchedGeofence?.siteName || completedShift?.matchedGeofence?.siteName || null,
        shiftId: activeShift?._id || completedShift?._id || null,
      },
    });
  } catch (error) {
    console.error('Today status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch today\'s status.' });
  }
};

/**
 * GET /api/attendance/history
 * Get shift history for the authenticated employee with hours worked
 */
const getMyHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      Log.find({ userId: req.user._id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('matchedGeofence', 'siteName'),
      Log.countDocuments({ userId: req.user._id }),
    ]);

    // Map logs to shift format
    const shifts = logs.map((log) => ({
      _id: log._id,
      date: log.timestamp,
      inTime: log.timestamp,
      outTime: log.checkOutTimestamp,
      status: log.status,
      hoursWorked: log.hoursWorked ? formatHours(log.hoursWorked) : null,
      isWithinGeofence: log.isWithinGeofence,
      siteName: log.matchedGeofence?.siteName || null,
      selfieUrl: log.selfieUrl,
      checkOutSelfieUrl: log.checkOutSelfieUrl,
    }));

    res.json({
      success: true,
      data: {
        shifts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance history.',
    });
  }
};

module.exports = { checkIn, checkOut, getTodayStatus, getMyHistory };
