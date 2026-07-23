const Geofence = require('../models/Geofence');

/**
 * GET /api/geofences
 * List all geofences with optional active filter
 */
const getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const geofences = await Geofence.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: geofences.length,
      data: { geofences },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch geofences.',
    });
  }
};

/**
 * GET /api/geofences/:id
 * Get a single geofence by ID
 */
const getById = async (req, res) => {
  try {
    const geofence = await Geofence.findById(req.params.id);
    if (!geofence) {
      return res.status(404).json({
        success: false,
        message: 'Geofence not found.',
      });
    }
    res.json({
      success: true,
      data: { geofence },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid geofence ID format.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to fetch geofence.',
    });
  }
};

/**
 * POST /api/geofences
 * Create a new geofence
 */
const create = async (req, res) => {
  try {
    const { siteName, coordinates, centerLat, centerLng, radius, description } = req.body;

    if (!siteName || !coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({
        success: false,
        message: 'Site name and coordinates array are required.',
      });
    }

    // Ensure polygon is closed (first = last)
    const polygonCoords = [...coordinates];
    const first = polygonCoords[0];
    const last = polygonCoords[polygonCoords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      polygonCoords.push([first[0], first[1]]);
    }

    const geofence = await Geofence.create({
      siteName,
      areaCoordinates: {
        type: 'Polygon',
        coordinates: [polygonCoords],
      },
      centerLat: centerLat || coordinates.reduce((s, c) => s + c[1], 0) / coordinates.length,
      centerLng: centerLng || coordinates.reduce((s, c) => s + c[0], 0) / coordinates.length,
      radius: radius || 100,
      description: description || '',
    });

    res.status(201).json({
      success: true,
      message: 'Geofence created successfully.',
      data: { geofence },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A geofence with this site name already exists.',
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create geofence.',
    });
  }
};

/**
 * PUT /api/geofences/:id
 * Update an existing geofence
 */
const update = async (req, res) => {
  try {
    const { siteName, coordinates, centerLat, centerLng, radius, isActive, description } = req.body;

    const updateData = {};
    if (siteName) updateData.siteName = siteName;
    if (coordinates) {
      const polygonCoords = [...coordinates];
      const first = polygonCoords[0];
      const last = polygonCoords[polygonCoords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        polygonCoords.push([first[0], first[1]]);
      }
      updateData.areaCoordinates = {
        type: 'Polygon',
        coordinates: [polygonCoords],
      };
    }
    if (centerLat !== undefined) updateData.centerLat = centerLat;
    if (centerLng !== undefined) updateData.centerLng = centerLng;
    if (radius !== undefined) updateData.radius = radius;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (description !== undefined) updateData.description = description;

    const geofence = await Geofence.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!geofence) {
      return res.status(404).json({
        success: false,
        message: 'Geofence not found.',
      });
    }

    res.json({
      success: true,
      message: 'Geofence updated successfully.',
      data: { geofence },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A geofence with this site name already exists.',
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update geofence.',
    });
  }
};

/**
 * DELETE /api/geofences/:id
 * Delete a geofence
 */
const remove = async (req, res) => {
  try {
    const geofence = await Geofence.findByIdAndDelete(req.params.id);
    if (!geofence) {
      return res.status(404).json({
        success: false,
        message: 'Geofence not found.',
      });
    }
    res.json({
      success: true,
      message: 'Geofence deleted successfully.',
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid geofence ID format.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete geofence.',
    });
  }
};

module.exports = { getAll, getById, create, update, remove };
