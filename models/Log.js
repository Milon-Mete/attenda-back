const mongoose = require('mongoose');

/**
 * Log Schema
 * Records each attendance check-in event with geo-tagging and selfie evidence.
 * The location field uses GeoJSON Point format for $geoIntersects queries.
 */
const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    // Check-in fields
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude] — GeoJSON standard order
        required: true,
        validate: {
          validator: function (coords) {
            if (coords.length !== 2) return false;
            const [lng, lat] = coords;
            return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
          },
          message: 'Invalid coordinates. Must be [lng, lat] within valid ranges.',
        },
      },
    },
    selfieUrl: {
      type: String,
      required: [true, 'Selfie URL is required'],
    },
    selfiePublicId: {
      type: String,
      default: null, // Cloudinary public ID for deletion if needed
    },
    isWithinGeofence: {
      type: Boolean,
      required: true,
    },
    matchedGeofence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Geofence',
      default: null,
    },
    // Shift status: 'active' = checked in but not out, 'completed' = shift done
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    // Check-out fields (null until checked out)
    checkOutTimestamp: {
      type: Date,
      default: null,
    },
    checkOutSelfieUrl: {
      type: String,
      default: null,
    },
    checkOutSelfiePublicId: {
      type: String,
      default: null,
    },
    checkOutLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function (coords) {
            if (!coords) return true;
            if (coords.length !== 2) return false;
            const [lng, lat] = coords;
            return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
          },
          message: 'Invalid check-out coordinates.',
        },
      },
    },
    checkOutIsWithinGeofence: {
      type: Boolean,
      default: null,
    },
    checkOutMatchedGeofence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Geofence',
      default: null,
    },
    // Calculated hours worked for this shift
    hoursWorked: {
      type: Number,
      default: null, // In hours (e.g., 8.5 = 8h30m)
    },
    deviceInfo: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
logSchema.index({ userId: 1, timestamp: -1 });
logSchema.index({ timestamp: -1 });

// 2dsphere index is created in config/db.js on the collection directly
// to ensure it exists even if Mongoose doesn't manage it properly

module.exports = mongoose.model('Log', logSchema);
