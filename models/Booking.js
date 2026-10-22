const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Booking date is required']
  },
  dateString: {
    type: String,
    required: true
  },
  wallSizeSqFt: {
    type: Number,
    required: [true, 'Wall size in sq ft is required'],
    min: [10, 'Wall size must be at least 10 sq ft'],
    max: [500, 'Wall size cannot exceed 500 sq ft']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  ratePerSqFt: {
    type: Number,
    default: 150
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['requested', 'confirmed', 'declined', 'cancelled'],
    default: 'requested'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Partial unique index: Guarantees each calendar date can have at most ONE active (requested or confirmed) booking!
// Cancelled or declined dates automatically free up for others to book.
bookingSchema.index(
  { dateString: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['requested', 'confirmed'] } }
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
