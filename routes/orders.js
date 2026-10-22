const express = require('express');
const router = express.Router();
const Painting = require('../models/Painting');
const Order = require('../models/Order');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// GET /orders - List orders (Customer sees only own orders; Studio sees all orders)
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'customer') {
      // Customer sees only what they own
      query.customer = req.user._id || req.user.userId;
    }

    const orders = await Order.find(query)
      .populate('painting')
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });

    res.render('orders/index', {
      title: req.user.role === 'studio' ? 'All Painting Orders' : 'My Painting Orders',
      orders
    });
  } catch (error) {
    console.error('[Orders List Error]:', error);
    res.status(500).render('error', {
      title: 'Orders Unavailable',
      statusCode: 500,
      message: 'Failed to retrieve orders list.'
    });
  }
});

// POST /orders - Buy a painting (Customer only)
router.post('/', verifyToken, requireRole('customer'), async (req, res) => {
  const { paintingId } = req.body;
  const customerId = req.user._id || req.user.userId;

  if (!paintingId) {
    return res.status(400).redirect('/paintings?error=' + encodeURIComponent('Missing painting reference'));
  }

  try {
    // 💥 CRITICAL CONCURRENCY CONTROL:
    // Atomic Compare-And-Swap: updates status to 'sold' ONLY IF status is currently 'available'.
    const painting = await Painting.findOneAndUpdate(
      { _id: paintingId, status: 'available' },
      { status: 'sold' },
      { returnDocument: 'after' }
    );

    // If painting is null, either it does not exist or another customer just bought it!
    if (!painting) {
      return res.status(409).render('error', {
        title: 'Painting Unavailable',
        statusCode: 409,
        message: 'Refused: This one-of-a-kind painting was just sold to another customer!'
      });
    }

    // Create the order document
    const order = await Order.create({
      painting: painting._id,
      customer: customerId,
      totalPrice: painting.price,
      status: 'placed'
    });

    res.redirect('/orders?success=' + encodeURIComponent(`Order placed successfully for "${painting.title}"!`));
  } catch (error) {
    console.error('[Purchase Error]:', error);
    res.status(500).render('error', {
      title: 'Order Processing Failed',
      statusCode: 500,
      message: 'An error occurred while placing your order. Please try again.'
    });
  }
});

// POST /orders/:id/cancel - Cancel an order (Customer only, only what they own)
router.post('/:id/cancel', verifyToken, requireRole('customer'), async (req, res) => {
  const customerId = req.user._id || req.user.userId;

  try {
    const order = await Order.findById(req.params.id);

    // Rule: Customer asking for someone else's record gets 404 (Not Found), NOT 403
    if (!order || order.customer.toString() !== customerId.toString()) {
      return res.status(404).render('error', {
        title: 'Order Not Found',
        statusCode: 404,
        message: 'The requested order could not be found in your account.'
      });
    }

    if (order.status === 'cancelled') {
      return res.redirect('/orders?error=' + encodeURIComponent('This order is already cancelled'));
    }

    // Update order status to 'cancelled'
    order.status = 'cancelled';
    await order.save();

    // Rule: "A customer can cancel an order, and the painting becomes available again."
    await Painting.findByIdAndUpdate(order.painting, { status: 'available' });

    res.redirect('/orders?success=' + encodeURIComponent('Order cancelled successfully. The painting is now available in the gallery again.'));
  } catch (error) {
    console.error('[Order Cancel Error]:', error);
    res.status(404).render('error', {
      title: 'Order Not Found',
      statusCode: 404,
      message: 'Invalid order reference or record not found.'
    });
  }
});

module.exports = router;
