const mongoose = require('mongoose');

const studioConfigSchema = new mongoose.Schema({
  currency: {
    type: String,
    default: 'INR'
  },
  muralRatePerSqFt: {
    type: Number,
    default: 150
  },
  potteryItems: [
    {
      id: String,
      name: String
    }
  ],
  glazes: [
    {
      id: String,
      name: String
    }
  ]
});

module.exports = mongoose.model('StudioConfig', studioConfigSchema);
