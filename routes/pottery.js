const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const PotteryRequest = require('../models/PotteryRequest');
const StudioConfig = require('../models/StudioConfig');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Helper to format date as YYYY-MM-DD
const formatDateString = (date) => {
  return date.toISOString().split('T')[0];
};

// GET /pottery - View pottery requests
// Customer sees only what they own; Studio sees all requests
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'customer') {
      query.customer = req.user._id || req.user.userId;
    }

    const requests = await PotteryRequest.find(query)
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });

    res.render('pottery/index', {
      title: req.user.role === 'studio' ? 'All Pottery Requests' : 'My Pottery Requests',
      requests
    });
  } catch (error) {
    console.error('[Pottery List Error]:', error);
    res.status(500).render('error', {
      title: 'Requests Unavailable',
      statusCode: 500,
      message: 'Failed to retrieve custom pottery requests.'
    });
  }
});

// GET /pottery/new - Form to create a pottery request (Customer only)
router.get('/new', verifyToken, requireRole('customer'), async (req, res) => {
  try {
    const config = await StudioConfig.findOne();
    const potteryItems = config?.potteryItems || [];
    const glazes = config?.glazes || [];

    // Needed-by date must be at least 14 days away
    const now = new Date();
    const minDateObj = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const minDate = formatDateString(minDateObj);

    res.render('pottery/new', {
      title: 'Request Custom Pottery',
      potteryItems,
      glazes,
      minDate,
      errors: [],
      formData: {}
    });
  } catch (error) {
    console.error('[Pottery New Error]:', error);
    res.status(500).render('error', {
      title: 'Form Error',
      statusCode: 500,
      message: 'Failed to load pottery customization catalog.'
    });
  }
});

// POST /pottery - Submit a custom pottery request (Customer only)
router.post(
  '/',
  verifyToken,
  requireRole('customer'),
  [
    body('item').trim().notEmpty().withMessage('Item selection is required'),
    body('glaze').trim().notEmpty().withMessage('Glaze selection is required'),
    body('quantity').isInt({ min: 1, max: 12 }).withMessage('Quantity must be between 1 and 12 units'),
    body('neededBy').notEmpty().withMessage('Needed-by date is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { item, glaze, quantity, neededBy } = req.body;
    const customerId = req.user._id || req.user.userId;

    const config = await StudioConfig.findOne();
    const potteryItems = config?.potteryItems || [];
    const glazes = config?.glazes || [];

    const now = new Date();
    const minDateObj = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const minDate = formatDateString(minDateObj);

    if (!errors.isEmpty()) {
      return res.status(400).render('pottery/new', {
        title: 'Request Custom Pottery',
        potteryItems,
        glazes,
        minDate,
        errors: errors.array(),
        formData: req.body
      });
    }

    // Business Rule: Needed-by date must be at least 14 days away
    const neededDate = new Date(neededBy + 'T00:00:00Z');
    const minLeadDate = new Date(minDate + 'T00:00:00Z');

    if (isNaN(neededDate.getTime()) || neededDate < minLeadDate) {
      return res.status(400).render('pottery/new', {
        title: 'Request Custom Pottery',
        potteryItems,
        glazes,
        minDate,
        errors: [{ msg: `Needed-by date must be at least 14 days from today (${minDate} or later) for studio kiln firing.` }],
        formData: req.body
      });
    }

    try {
      // Find item and glaze names/ids
      const matchedItem = potteryItems.find(i => i.id === item || i.name === item);
      const matchedGlaze = glazes.find(g => g.id === glaze || g.name === glaze);

      await PotteryRequest.create({
        customer: customerId,
        item: matchedItem ? matchedItem.name : item,
        itemId: matchedItem ? matchedItem.id : '',
        glaze: matchedGlaze ? matchedGlaze.name : glaze,
        glazeId: matchedGlaze ? matchedGlaze.id : '',
        quantity: parseInt(quantity, 10),
        neededBy: neededDate,
        status: 'requested'
      });

      res.redirect('/pottery?success=' + encodeURIComponent(`Pottery request submitted! (${quantity}x ${matchedItem ? matchedItem.name : item})`));
    } catch (error) {
      console.error('[Create Pottery Request Error]:', error);
      res.status(500).render('pottery/new', {
        title: 'Request Custom Pottery',
        potteryItems,
        glazes,
        minDate,
        errors: [{ msg: 'Failed to submit pottery request. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// GET /pottery/:id/edit - Edit request form (Customer only, only while 'requested')
router.get('/:id/edit', verifyToken, requireRole('customer'), async (req, res) => {
  const customerId = req.user._id || req.user.userId;

  try {
    const potteryRequest = await PotteryRequest.findById(req.params.id);

    // Rule: Customer asking for someone else's record gets 404 (Not Found), not 403
    if (!potteryRequest || potteryRequest.customer.toString() !== customerId.toString()) {
      return res.status(404).render('error', {
        title: 'Request Not Found',
        statusCode: 404,
        message: 'The requested pottery order was not found in your account.'
      });
    }

    // Rule: Customer can edit only while still 'requested'
    if (potteryRequest.status !== 'requested') {
      return res.status(403).render('error', {
        title: 'Cannot Edit Request',
        statusCode: 403,
        message: `Refused: Pottery requests can only be edited while status is 'requested'. This request is already '${potteryRequest.status}'.`
      });
    }

    const config = await StudioConfig.findOne();
    const potteryItems = config?.potteryItems || [];
    const glazes = config?.glazes || [];

    const now = new Date();
    const minDateObj = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const minDate = formatDateString(minDateObj);

    res.render('pottery/edit', {
      title: 'Edit Pottery Request',
      potteryRequest,
      potteryItems,
      glazes,
      minDate,
      errors: []
    });
  } catch (error) {
    console.error('[Pottery Edit View Error]:', error);
    res.status(404).render('error', {
      title: 'Request Not Found',
      statusCode: 404,
      message: 'Invalid pottery request ID.'
    });
  }
});

// PUT /pottery/:id - Update request (Customer only, only while 'requested')
router.put(
  '/:id',
  verifyToken,
  requireRole('customer'),
  [
    body('item').trim().notEmpty().withMessage('Item selection is required'),
    body('glaze').trim().notEmpty().withMessage('Glaze selection is required'),
    body('quantity').isInt({ min: 1, max: 12 }).withMessage('Quantity must be between 1 and 12 units'),
    body('neededBy').notEmpty().withMessage('Needed-by date is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const customerId = req.user._id || req.user.userId;
    const { item, glaze, quantity, neededBy } = req.body;

    const config = await StudioConfig.findOne();
    const potteryItems = config?.potteryItems || [];
    const glazes = config?.glazes || [];

    const now = new Date();
    const minDateObj = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const minDate = formatDateString(minDateObj);

    if (!errors.isEmpty()) {
      return res.status(400).render('pottery/edit', {
        title: 'Edit Pottery Request',
        potteryRequest: { _id: req.params.id, ...req.body },
        potteryItems,
        glazes,
        minDate,
        errors: errors.array()
      });
    }

    const neededDate = new Date(neededBy + 'T00:00:00Z');
    const minLeadDate = new Date(minDate + 'T00:00:00Z');

    if (isNaN(neededDate.getTime()) || neededDate < minLeadDate) {
      return res.status(400).render('pottery/edit', {
        title: 'Edit Pottery Request',
        potteryRequest: { _id: req.params.id, ...req.body },
        potteryItems,
        glazes,
        minDate,
        errors: [{ msg: `Needed-by date must be at least 14 days from today (${minDate} or later).` }]
      });
    }

    try {
      const matchedItem = potteryItems.find(i => i.id === item || i.name === item);
      const matchedGlaze = glazes.find(g => g.id === glaze || g.name === glaze);

      // Atomic guard: Update ONLY IF still owned by this customer AND still in 'requested' status
      const updated = await PotteryRequest.findOneAndUpdate(
        {
          _id: req.params.id,
          customer: customerId,
          status: 'requested'
        },
        {
          item: matchedItem ? matchedItem.name : item,
          itemId: matchedItem ? matchedItem.id : '',
          glaze: matchedGlaze ? matchedGlaze.name : glaze,
          glazeId: matchedGlaze ? matchedGlaze.id : '',
          quantity: parseInt(quantity, 10),
          neededBy: neededDate
        },
        { returnDocument: 'after' }
      );

      if (!updated) {
        return res.status(403).render('error', {
          title: 'Cannot Edit Request',
          statusCode: 403,
          message: 'This request could not be updated because it does not exist, belongs to another user, or is no longer in requested status.'
        });
      }

      res.redirect('/pottery?success=' + encodeURIComponent('Pottery request updated successfully!'));
    } catch (error) {
      console.error('[Update Pottery Request Error]:', error);
      res.status(500).render('error', {
        title: 'Update Failed',
        statusCode: 500,
        message: 'An error occurred while updating your request.'
      });
    }
  }
);

// POST /pottery/:id/accept - Studio accepts request
router.post('/:id/accept', verifyToken, requireRole('studio'), async (req, res) => {
  try {
    const request = await PotteryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).render('error', {
        title: 'Request Not Found',
        statusCode: 404,
        message: 'The requested pottery order does not exist.'
      });
    }

    request.status = 'accepted';
    await request.save();

    res.redirect('/pottery?success=' + encodeURIComponent(`Pottery request for ${request.quantity}x ${request.item} accepted!`));
  } catch (error) {
    console.error('[Accept Pottery Error]:', error);
    res.status(500).render('error', {
      title: 'Action Failed',
      statusCode: 500,
      message: 'Failed to accept pottery request.'
    });
  }
});

// POST /pottery/:id/decline - Studio declines request
router.post('/:id/decline', verifyToken, requireRole('studio'), async (req, res) => {
  try {
    const request = await PotteryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).render('error', {
        title: 'Request Not Found',
        statusCode: 404,
        message: 'The requested pottery order does not exist.'
      });
    }

    request.status = 'declined';
    await request.save();

    res.redirect('/pottery?success=' + encodeURIComponent(`Pottery request for ${request.quantity}x ${request.item} declined.`));
  } catch (error) {
    console.error('[Decline Pottery Error]:', error);
    res.status(500).render('error', {
      title: 'Action Failed',
      statusCode: 500,
      message: 'Failed to decline pottery request.'
    });
  }
});

// POST /pottery/:id/cancel - Customer cancels request (only while 'requested')
router.post('/:id/cancel', verifyToken, requireRole('customer'), async (req, res) => {
  const customerId = req.user._id || req.user.userId;

  try {
    // Atomic check: only cancel if owned and still in 'requested' state
    const request = await PotteryRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        customer: customerId,
        status: 'requested'
      },
      { status: 'cancelled' },
      { returnDocument: 'after' }
    );

    if (!request) {
      // Check if it exists with another status or belongs to another user
      const existing = await PotteryRequest.findById(req.params.id);
      if (!existing || existing.customer.toString() !== customerId.toString()) {
        return res.status(404).render('error', {
          title: 'Request Not Found',
          statusCode: 404,
          message: 'The requested pottery order was not found in your account.'
        });
      }

      return res.redirect('/pottery?error=' + encodeURIComponent(`Cannot cancel: Request is already ${existing.status}. Cancellations are only allowed while in 'requested' status.`));
    }

    res.redirect('/pottery?success=' + encodeURIComponent('Pottery request has been cancelled.'));
  } catch (error) {
    console.error('[Cancel Pottery Error]:', error);
    res.status(404).render('error', {
      title: 'Action Failed',
      statusCode: 404,
      message: 'Invalid pottery request reference.'
    });
  }
});

module.exports = router;
