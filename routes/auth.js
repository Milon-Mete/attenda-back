const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (admin only)
 * @access  Private/Admin
 */
router.post('/register', authenticate, authorize('admin'), register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, getProfile);

module.exports = router;
