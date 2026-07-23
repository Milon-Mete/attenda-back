const express = require('express');
const router = express.Router();
const { getAllLogs, getStats, getLogById } = require('../controllers/logsController');
const { authenticate, authorize } = require('../middleware/auth');

// All logs routes require admin authentication
router.use(authenticate, authorize('admin'));

/**
 * @route   GET /api/logs
 * @desc    Get all attendance logs with filtering & pagination
 * @access  Private/Admin
 */
router.get('/', getAllLogs);

/**
 * @route   GET /api/logs/stats
 * @desc    Get dashboard statistics
 * @access  Private/Admin
 */
router.get('/stats', getStats);

/**
 * @route   GET /api/logs/:id
 * @desc    Get single log details
 * @access  Private/Admin
 */
router.get('/:id', getLogById);

module.exports = router;
