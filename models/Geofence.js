const mongoose = require('mongoose');

/**
 * Geofence Schema
 * Stores named geographical boundaries as GeoJSON Polygons.
 * The areaCoordinates field supports $geoIntersects queries for efficient lookup.
 */
const geofenceSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      required: [true, 'Site name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Site name must be at least 2 characters'],
      maxlength: [200, 'Site name cannot exceed 200 characters'],
    },
    areaCoordinates: {
      type: {
        type: String,
        enum: ['Polygon'],
        required: true,
      },
      coordinates: {
        type: [[[Number]]], // Array of rings, each ring is an array of [lng, lat] pairs
        required: true,
        validate: {
          validator: function (coords) {
            // Must have at least one ring with 4+ points (closed polygon)
            if (!coords || !coords[0] || coords[0].length < 4) return false;
            // First and last point must match to close the polygon
            const ring = coords[0];
            const first = ring[0];
            const last = ring[ring.length - 1];
            return first[0] === last[0] && first[1] === last[1];
          },
          message: 'Polygon must be closed (first and last coordinates must match)',
        },
      },
    },
    centerLat: {
      type: Number,
      required: [true, 'Center latitude is required for map display'],
      min: -90,
      max: 90,
    },
    centerLng: {
      type: Number,
      required: [true, 'Center longitude is required for map display'],
      min: -180,
      max: 180,
    },
    radius: {
      type: Number, // Approximate radius in meters (for display purposes)
      default: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Create 2dsphere index for geo queries
geofenceSchema.index({ areaCoordinates: '2dsphere' });

module.exports = mongoose.model('Geofence', geofenceSchema);
