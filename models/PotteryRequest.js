const mongoose = require('mongoose');

const potteryRequestSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  item: {
    type: String,
    required: [true, 'Pottery item is required']
  },
  itemId: {
    type: String
  },
  glaze: {
    type: String,
    required: [true, 'Glaze is required']
  },
  glazeId: {
    type: String
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [12, 'Quantity cannot exceed 12']
  },
  neededBy: {
    type: Date,
    required: [true, 'Needed-by date is required']
  },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'declined', 'cancelled'],
    default: 'requested'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PotteryRequest', potteryRequestSchema);
