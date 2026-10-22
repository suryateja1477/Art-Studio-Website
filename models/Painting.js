const mongoose = require('mongoose');

const paintingSchema = new mongoose.Schema({
  seedId: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  artist: {
    type: String,
    required: [true, 'Artist name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price must be non-negative']
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  status: {
    type: String,
    enum: ['available', 'sold'],
    default: 'available'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Painting', paintingSchema);
