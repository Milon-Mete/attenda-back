const { cloudinary } = require('../config/cloudinary');
const Geofence = require('../models/Geofence');
const Log = require('../models/Log');
const { isValidCoordinate, buildGeoPoint } = require('../utils/geoUtils');

/**
 * POST /api/attendance/checkin
 * Process a check-in: upload selfie, validate geofence, save log.
 * Expects multipart/form-data with:
 *   - selfie: image file
 *   - latitude: number
 *   - longitude: number
 */
const checkIn = async (req, res) => {
  try {
    // Validate selfie upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Selfie image is required. Please capture a photo.',
      });
    }

    // Extract coordinates from request body — handle string & number types
    const rawLat = req.body.latitude;
    const rawLng = req.body.longitude;
    
    if (rawLat === undefined || rawLat === null || rawLng === undefined || rawLng === null) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates are missing. Please enable location services and try again.',
      });
    }

    const latitude = typeof rawLat === 'string' ? parseFloat(rawLat.trim()) : parseFloat(rawLat);
    const longitude = typeof rawLng === 'string' ? parseFloat(rawLng.trim()) : parseFloat(rawLng);

    if (isNaN(latitude) || isNaN(longitude) || !isValidCoordinate(latitude, longitude)) {
      // Clean up the uploaded file from Cloudinary
      if (req.file && req.file.public_id) {
        try {
          await cloudinary.uploader.destroy(req.file.public_id);
        } catch (cleanupErr) {
          console.error('Failed to clean up Cloudinary upload:', cleanupErr.message);
        }
      }
      return res.status(400).json({
        success: false,
        message:
          'Valid GPS coordinates are required. Please enable location services.',
      });
    }

    // Build GeoJSON Point from provided coordinates
    const geoPoint = buildGeoPoint(latitude, longitude);

    // Query geofences using $geoIntersects — efficient spatial query
    const matchedGeofence = await Geofence.findOne({
      isActive: true,
      areaCoordinates: {
        $geoIntersects: {
          $geometry: geoPoint,
        },
      },
    });

    const isWithinGeofence = !!matchedGeofence;

    // Save the attendance log
    const log = await Log.create({
      userId: req.user._id,
      timestamp: new Date(),
      location: geoPoint,
      selfieUrl: req.file.path, // Cloudinary URL
      selfiePublicId: req.file.filename || req.file.public_id,
      isWithinGeofence,
      matchedGeofence: matchedGeofence ? matchedGeofence._id : null,
      deviceInfo: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
    });

    // Populate user info for response
    await log.populate('userId', 'name email');

    res.status(201).json({
      success: true,
      message: isWithinGeofence
        ? '✅ Check-in successful. You are within the geofence.'
        : '⚠️ Check-in recorded, but you are outside the designated geofence area.',
      data: {
        log: {
          _id: log._id,
          timestamp: log.timestamp,
          location: log.location,
          selfieUrl: log.selfieUrl,
          isWithinGeofence: log.isWithinGeofence,
          matchedGeofence: matchedGeofence
            ? {
                _id: matchedGeofence._id,
                siteName: matchedGeofence.siteName,
              }
            : null,
        },
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Check-in failed due to a server error. Please try again.',
    });
  }
};

/**
 * GET /api/attendance/history
 * Get check-in history for the authenticated employee
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance history.',
    });
  }
};

module.exports = { checkIn, getMyHistory };
