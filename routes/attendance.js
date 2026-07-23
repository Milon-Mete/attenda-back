const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getTodayStatus, getMyHistory } = require('../controllers/attendanceController');
const { authenticate } = require('../middleware/auth');
const { uploadSelfie } = require('../middleware/upload');

/**
 * @route   POST /api/attendance/checkin
 * @desc    Check in with selfie + GPS coordinates (starts a shift)
 * @access  Private
 * @body    multipart/form-data: selfie (file), latitude, longitude
 */
router.post('/checkin', authenticate, uploadSelfie, checkIn);

/**
 * @route   POST /api/attendance/checkout
 * @desc    Check out with selfie + GPS coordinates (ends a shift)
 * @access  Private
 * @body    multipart/form-data: selfie (file), latitude, longitude
 */
router.post('/checkout', authenticate, uploadSelfie, checkOut);

/**
 * @route   GET /api/attendance/today-status
 * @desc    Get today's shift status (checked in/out, hours)
 * @access  Private
 */
router.get('/today-status', authenticate, getTodayStatus);

/**
 * @route   GET /api/attendance/history
 * @desc    Get authenticated user's shift history with hours
 * @access  Private
 */
router.get('/history', authenticate, getMyHistory);

module.exports = router;
