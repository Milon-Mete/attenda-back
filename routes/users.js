const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

/**
 * @route   GET /api/users
 * @desc    List all employees
 * @access  Private/Admin
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: { users } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (toggle active status, change role)
 * @access  Private/Admin
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, role, isActive } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, message: 'User updated.', data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

module.exports = router;
