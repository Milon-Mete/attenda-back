require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Geofence = require('./models/Geofence');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding...');

    // Seed admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await User.create({
        name: 'System Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });
      console.log(`✅ Admin user created: ${adminEmail}`);
    } else {
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    }

    // Seed demo geofence (example office area in New York)
    const existingGeofence = await Geofence.findOne({ siteName: 'Head Office NYC' });
    if (!existingGeofence) {
      await Geofence.create({
        siteName: 'Head Office NYC',
        areaCoordinates: {
          type: 'Polygon',
          coordinates: [[
            [-73.985, 40.748],  // NE
            [-73.983, 40.748],  // NW
            [-73.983, 40.746],  // SW
            [-73.985, 40.746],  // SE
            [-73.985, 40.748],  // Close polygon
          ]],
        },
        centerLat: 40.747,
        centerLng: -73.984,
        radius: 150,
        description: 'Main office location - New York City',
        isActive: true,
      });
      console.log('✅ Demo geofence created: Head Office NYC');
    } else {
      console.log('ℹ️  Demo geofence already exists');
    }

    console.log('\n📋 Seed complete!');
    console.log(`   Admin login: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   (Change these in .env or production)\n`);

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seed();
