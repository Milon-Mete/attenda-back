/**
 * Geoutility functions for validating coordinates and calculating distances.
 */

/**
 * Validates GPS coordinate pair
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} Whether coordinates are valid
 */
const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0) // Reject (0,0) — usually a default/error value
  );
};

/**
 * Converts degrees to radians
 */
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Calculates the Haversine distance between two GPS points in meters
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in meters
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Builds a GeoJSON Point object from lat/lng
 * GeoJSON uses [longitude, latitude] order
 * @param {number} lat
 * @param {number} lng
 * @returns {Object} GeoJSON Point
 */
const buildGeoPoint = (lat, lng) => ({
  type: 'Point',
  coordinates: [lng, lat],
});

module.exports = {
  isValidCoordinate,
  haversineDistance,
  buildGeoPoint,
};
