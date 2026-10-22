const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const StudioConfig = require('../models/StudioConfig');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Helper to format date as YYYY-MM-DD
const formatDateString = (date) => {
  return date.toISOString().split('T')[0];
};

// GET /bookings - View list of bookings
// Customer sees only what they own; Studio sees all bookings
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'customer') {
      query.customer = req.user._id || req.user.userId;
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name email')
      .sort({ date: 1 });

    const now = new Date();

    // Attach cancellation eligibility flag (≥ 3 days before scheduled date)
    const formattedBookings = bookings.map(b => {
      const diffTime = new Date(b.date).getTime() - now.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return {
        ...b.toObject(),
        canCancel: diffDays >= 3 && ['requested', 'confirmed'].includes(b.status)
      };
    });

    res.render('bookings/index', {
      title: req.user.role === 'studio' ? 'All Wall Mural Bookings' : 'My Wall Mural Bookings',
      bookings: formattedBookings
    });
  } catch (error) {
    console.error('[Bookings List Error]:', error);
    res.status(500).render('error', {
      title: 'Bookings Unavailable',
      statusCode: 500,
      message: 'Failed to retrieve bookings list.'
    });
  }
});

// GET /bookings/new - Form to book a wall painting date (Customer only)
router.get('/new', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    const config = await StudioConfig.findOne();
    const ratePerSqFt = config?.muralRatePerSqFt || 150;

    // Calculate 7 days from now and 90 days from now
    const now = new Date();
    const minDateObj = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const maxDateObj = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const minDate = formatDateString(minDateObj);
    const maxDate = formatDateString(maxDateObj);

    res.render('bookings/new', {
      title: 'Book a Wall Mural Painting',
      ratePerSqFt,
      minDate,
      maxDate,
      errors: [],
      formData: {}
    });
  } catch (error) {
    console.error('[Bookings New Error]:', error);
    res.status(500).render('error', {
      title: 'Booking Form Error',
      statusCode: 500,
      message: 'Unable to load mural booking options.'
    });
  }
});

// POST /bookings - Submit a wall painting booking (Customer only)
router.post(
  '/',
  verifyToken,
  requireRole('customer'),
  [
    body('date').notEmpty().withMessage('Date is required'),
    body('wallSizeSqFt').isInt({ min: 10, max: 500 }).withMessage('Wall size must be between 10 and 500 sq ft'),
    body('address').trim().notEmpty().withMessage('Installation address is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { date, wallSizeSqFt, address } = req.body;
    const customerId = req.user._id || req.user.userId;

    const config = await StudioConfig.findOne();
    const ratePerSqFt = config?.muralRatePerSqFt || 150;

    const now = new Date();
    const minDateObj = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const maxDateObj = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const minDate = formatDateString(minDateObj);
    const maxDate = formatDateString(maxDateObj);

    if (!errors.isEmpty()) {
      return res.status(400).render('bookings/new', {
        title: 'Book a Wall Mural Painting',
        ratePerSqFt,
        minDate,
        maxDate,
        errors: errors.array(),
        formData: req.body
      });
    }

    // Business Rule: date must be from 7 to 90 days away
    const selectedDate = new Date(date + 'T00:00:00Z');
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).render('bookings/new', {
        title: 'Book a Wall Mural Painting',
        ratePerSqFt,
        minDate,
        maxDate,
        errors: [{ msg: 'Invalid date provided' }],
        formData: req.body
      });
    }

    const startOfMin = new Date(minDate + 'T00:00:00Z');
    const endOfMax = new Date(maxDate + 'T23:59:59Z');

    if (selectedDate < startOfMin || selectedDate > endOfMax) {
      return res.status(400).render('bookings/new', {
        title: 'Book a Wall Mural Painting',
        ratePerSqFt,
        minDate,
        maxDate,
        errors: [{ msg: `Date must be between 7 days (${minDate}) and 90 days (${maxDate}) from today` }],
        formData: req.body
      });
    }

    const dateString = formatDateString(selectedDate);
    const size = parseInt(wallSizeSqFt, 10);
    const totalPrice = size * ratePerSqFt;

    try {
      // 💥 CONCURRENCY & UNIQUE DATE PROTECTION:
      // Check for any active booking on this date first
      const existingBooking = await Booking.findOne({
        dateString,
        status: { $in: ['requested', 'confirmed'] }
      });

      if (existingBooking) {
        return res.status(409).render('bookings/new', {
          title: 'Book a Wall Mural Painting',
          ratePerSqFt,
          minDate,
          maxDate,
          errors: [{ msg: `Refused: The date ${dateString} is already booked! Please select another date.` }],
          formData: req.body
        });
      }

      // Create booking document
      await Booking.create({
        customer: customerId,
        date: selectedDate,
        dateString,
        wallSizeSqFt: size,
        address,
        ratePerSqFt,
        totalPrice,
        status: 'requested'
      });

      res.redirect('/bookings?success=' + encodeURIComponent(`Wall mural requested for ${dateString}! Total estimated cost: ₹${totalPrice.toLocaleString('en-IN')}`));
    } catch (error) {
      // Catch MongoDB unique index collision error (code 11000)
      if (error.code === 11000) {
        return res.status(409).render('bookings/new', {
          title: 'Book a Wall Mural Painting',
          ratePerSqFt,
          minDate,
          maxDate,
          errors: [{ msg: `Refused: The date ${dateString} was just booked by another customer!` }],
          formData: req.body
        });
      }

      console.error('[Create Booking Error]:', error);
      res.status(500).render('bookings/new', {
        title: 'Book a Wall Mural Painting',
        ratePerSqFt,
        minDate,
        maxDate,
        errors: [{ msg: 'Failed to record booking. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// POST /bookings/:id/confirm - Studio confirms booking
router.post('/:id/confirm', verifyToken, requireRole('studio'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).render('error', {
        title: 'Booking Not Found',
        statusCode: 404,
        message: 'The requested booking does not exist.'
      });
    }

    booking.status = 'confirmed';
    await booking.save();

    res.redirect('/bookings?success=' + encodeURIComponent(`Booking for ${booking.dateString} has been confirmed.`));
  } catch (error) {
    console.error('[Confirm Booking Error]:', error);
    res.status(500).render('error', {
      title: 'Action Failed',
      statusCode: 500,
      message: 'Failed to confirm booking.'
    });
  }
});

// POST /bookings/:id/decline - Studio declines booking
router.post('/:id/decline', verifyToken, requireRole('studio'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).render('error', {
        title: 'Booking Not Found',
        statusCode: 404,
        message: 'The requested booking does not exist.'
      });
    }

    booking.status = 'declined';
    await booking.save();

    res.redirect('/bookings?success=' + encodeURIComponent(`Booking for ${booking.dateString} has been declined.`));
  } catch (error) {
    console.error('[Decline Booking Error]:', error);
    res.status(500).render('error', {
      title: 'Action Failed',
      statusCode: 500,
      message: 'Failed to decline booking.'
    });
  }
});

// POST /bookings/:id/cancel - Customer cancels booking (only until 3 days before date)
router.post('/:id/cancel', verifyToken, requireRole('customer'), async (req, res) => {
  const customerId = req.user._id || req.user.userId;

  try {
    const booking = await Booking.findById(req.params.id);

    // Rule: Customer asking for someone else's record gets 404 Not Found (not 403)
    if (!booking || booking.customer.toString() !== customerId.toString()) {
      return res.status(404).render('error', {
        title: 'Booking Not Found',
        statusCode: 404,
        message: 'The requested booking was not found in your account.'
      });
    }

    // Rule: Customer can cancel until 3 days before the date
    const now = new Date();
    const diffTime = new Date(booking.date).getTime() - now.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 3) {
      return res.redirect('/bookings?error=' + encodeURIComponent('Refused: Bookings can only be cancelled at least 3 days prior to the scheduled date.'));
    }

    booking.status = 'cancelled';
    await booking.save();

    res.redirect('/bookings?success=' + encodeURIComponent(`Booking for ${booking.dateString} cancelled successfully. The date is now open.`));
  } catch (error) {
    console.error('[Cancel Booking Error]:', error);
    res.status(404).render('error', {
      title: 'Booking Not Found',
      statusCode: 404,
      message: 'Invalid booking reference.'
    });
  }
});

module.exports = router;
