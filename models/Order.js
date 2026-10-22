const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  painting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Painting',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['placed', 'cancelled'],
    default: 'placed'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);
