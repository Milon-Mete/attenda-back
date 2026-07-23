const express = require('express');
const router = express.Router();
const {
  getAll,
  getById,
  create,
  update,
  remove,
} = require('../controllers/geofenceController');
const { authenticate, authorize } = require('../middleware/auth');

// All geofence routes require admin authentication
router.use(authenticate, authorize('admin'));

/**
 * @route   GET /api/geofences
 * @desc    List all geofences
 * @access  Private/Admin
 */
router.get('/', getAll);

/**
 * @route   GET /api/geofences/:id
 * @desc    Get single geofence
 * @access  Private/Admin
 */
router.get('/:id', getById);

/**
 * @route   POST /api/geofences
 * @desc    Create a new geofence
 * @access  Private/Admin
 */
router.post('/', create);

/**
 * @route   PUT /api/geofences/:id
 * @desc    Update a geofence
 * @access  Private/Admin
 */
router.put('/:id', update);

/**
 * @route   DELETE /api/geofences/:id
 * @desc    Delete a geofence
 * @access  Private/Admin
 */
router.delete('/:id', remove);

module.exports = router;
