require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const User = require('../models/User');
const Painting = require('../models/Painting');
const StudioConfig = require('../models/StudioConfig');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const PotteryRequest = require('../models/PotteryRequest');

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/art_studio';
    console.log(`[Seed] Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    // Read seed.json
    const seedPath = path.join(__dirname, '..', 'seedData', 'seed.json');
    const rawData = fs.readFileSync(seedPath, 'utf8');
    const seedData = JSON.parse(rawData);

    console.log('[Seed] Resetting database: clearing all users, orders, bookings, pottery requests, paintings, and studio config...');
    await User.deleteMany({});
    await Order.deleteMany({});
    await Booking.deleteMany({});
    await PotteryRequest.deleteMany({});
    await Painting.deleteMany({});
    await StudioConfig.deleteMany({});

    // 1. Seed studio admin account strictly from seed.json
    console.log(`[Seed] Creating studio admin account (${seedData.studioAccount.email})...`);
    const hashedPassword = await bcrypt.hash(seedData.studioAccount.password, 10);
    await User.create({
      name: 'Art Studio Admin',
      email: seedData.studioAccount.email.toLowerCase(),
      password: hashedPassword,
      role: seedData.studioAccount.role
    });

    // 2. Seed Paintings from seed.json
    console.log(`[Seed] Inserting ${seedData.paintings.length} paintings...`);
    const paintingsToInsert = seedData.paintings.map(p => ({
      seedId: p.id,
      title: p.title,
      artist: p.artist,
      description: p.description,
      price: p.price,
      imageUrl: p.imageUrl.startsWith('/') ? p.imageUrl : `/${p.imageUrl}`,
      status: p.status
    }));

    await Painting.insertMany(paintingsToInsert);

    // 3. Seed Studio Configuration from seed.json
    console.log('[Seed] Inserting pottery catalog and mural rates...');
    await StudioConfig.create({
      currency: seedData.currency || 'INR',
      muralRatePerSqFt: seedData.mural?.ratePerSqFt || 150,
      potteryItems: seedData.potteryItems || [],
      glazes: seedData.glazes || []
    });

    console.log('[Seed] Database successfully reset and seeded strictly from seed.json!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
}

seed();
