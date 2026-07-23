const express = require('express');
const router = express.Router();
const { checkIn, getMyHistory } = require('../controllers/attendanceController');
const { authenticate } = require('../middleware/auth');
const { uploadSelfie } = require('../middleware/upload');

/**
 * @route   POST /api/attendance/checkin
 * @desc    Check in with selfie + GPS coordinates
 * @access  Private (employee)
 * @body    multipart/form-data: selfie (file), latitude, longitude
 */
router.post('/checkin', authenticate, uploadSelfie, checkIn);

/**
 * @route   GET /api/attendance/history
 * @desc    Get authenticated user's check-in history
 * @access  Private
 */
router.get('/history', authenticate, getMyHistory);

module.exports = router;
