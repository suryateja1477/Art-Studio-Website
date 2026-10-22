const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Painting = require('../models/Painting');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Multer storage for image file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'images'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'painting-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) are allowed'));
    }
  }
});

// GET /paintings - Browse all paintings (Public: Customer, Studio, Guests)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    const { status } = req.query;
    if (status && ['available', 'sold'].includes(status)) {
      filter.status = status;
    }

    const paintings = await Painting.find(filter).sort({ createdAt: -1 });

    res.render('paintings/index', {
      title: 'Original Paintings Gallery',
      paintings,
      activeStatus: status || 'all'
    });
  } catch (error) {
    console.error('[Paintings List Error]:', error);
    res.status(500).render('error', {
      title: 'Gallery Unavailable',
      statusCode: 500,
      message: 'Failed to retrieve paintings. Please try again later.'
    });
  }
});

// GET /paintings/new - Admin form to add painting (Studio only)
router.get('/new', verifyToken, requireRole('studio'), (req, res) => {
  res.render('paintings/new', {
    title: 'Add New Painting',
    errors: [],
    formData: {}
  });
});

// POST /paintings - Add a new painting (Studio only)
// Supports BOTH file upload and direct image URL/path
router.post(
  '/',
  verifyToken,
  requireRole('studio'),
  upload.single('imageFile'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('artist').trim().notEmpty().withMessage('Artist name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('price').isFloat({ min: 1 }).withMessage('Price must be greater than zero')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { title, artist, description, price } = req.body;
    let imageUrl = req.body.imageUrl ? req.body.imageUrl.trim() : '';

    // If an image file was uploaded, use its saved path
    if (req.file) {
      imageUrl = `/images/${req.file.filename}`;
    }

    const errorList = errors.array();
    if (!imageUrl) {
      errorList.push({ msg: 'Please either upload an image file or provide an image URL / path' });
    }

    if (errorList.length > 0) {
      return res.status(400).render('paintings/new', {
        title: 'Add New Painting',
        errors: errorList,
        formData: req.body
      });
    }

    try {
      const newPainting = await Painting.create({
        title,
        artist,
        description,
        price: parseFloat(price),
        imageUrl: imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`,
        status: 'available'
      });

      res.redirect(`/paintings/${newPainting._id}?success=` + encodeURIComponent('Painting created successfully!'));
    } catch (error) {
      console.error('[Add Painting Error]:', error);
      res.status(500).render('paintings/new', {
        title: 'Add New Painting',
        errors: [{ msg: 'Failed to create painting' }],
        formData: req.body
      });
    }
  }
);

// GET /paintings/:id - View single painting
router.get('/:id', async (req, res) => {
  try {
    const painting = await Painting.findById(req.params.id);
    if (!painting) {
      return res.status(404).render('error', {
        title: 'Painting Not Found',
        statusCode: 404,
        message: 'The requested painting does not exist or has been removed.'
      });
    }

    res.render('paintings/show', {
      title: `${painting.title} | Art Studio`,
      painting
    });
  } catch (error) {
    return res.status(404).render('error', {
      title: 'Painting Not Found',
      statusCode: 404,
      message: 'Invalid painting ID or record not found.'
    });
  }
});

// GET /paintings/:id/edit - Edit form (Studio only, only while available)
router.get('/:id/edit', verifyToken, requireRole('studio'), async (req, res) => {
  try {
    const painting = await Painting.findById(req.params.id);
    if (!painting) {
      return res.status(404).render('error', {
        title: 'Painting Not Found',
        statusCode: 404,
        message: 'Painting not found.'
      });
    }

    if (painting.status !== 'available') {
      return res.status(403).render('error', {
        title: 'Edit Forbidden',
        statusCode: 403,
        message: 'This painting has already been sold and can no longer be edited.'
      });
    }

    res.render('paintings/edit', {
      title: `Edit ${painting.title}`,
      painting,
      errors: []
    });
  } catch (error) {
    return res.status(404).render('error', {
      title: 'Painting Not Found',
      statusCode: 404,
      message: 'Invalid painting ID.'
    });
  }
});

// PUT /paintings/:id - Update painting (Studio only, only while available)
// Supports uploading a new image file or retaining/changing URL
router.put(
  '/:id',
  verifyToken,
  requireRole('studio'),
  upload.single('imageFile'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('artist').trim().notEmpty().withMessage('Artist name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('price').isFloat({ min: 1 }).withMessage('Price must be greater than zero')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { title, artist, description, price } = req.body;
    let imageUrl = req.body.imageUrl ? req.body.imageUrl.trim() : '';

    if (req.file) {
      imageUrl = `/images/${req.file.filename}`;
    }

    const errorList = errors.array();
    if (!imageUrl) {
      errorList.push({ msg: 'Please provide an image URL or upload an image file' });
    }

    if (errorList.length > 0) {
      return res.status(400).render('paintings/edit', {
        title: 'Edit Painting',
        painting: { _id: req.params.id, ...req.body },
        errors: errorList
      });
    }

    try {
      const updatedPainting = await Painting.findOneAndUpdate(
        { _id: req.params.id, status: 'available' },
        {
          title,
          artist,
          description,
          price: parseFloat(price),
          imageUrl: imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
        },
        { returnDocument: 'after' }
      );

      if (!updatedPainting) {
        return res.status(403).render('error', {
          title: 'Cannot Edit Painting',
          statusCode: 403,
          message: 'This painting was either just sold or does not exist, so it can no longer be modified.'
        });
      }

      res.redirect(`/paintings/${updatedPainting._id}?success=` + encodeURIComponent('Painting updated successfully!'));
    } catch (error) {
      console.error('[Update Painting Error]:', error);
      res.status(500).render('paintings/edit', {
        title: 'Edit Painting',
        painting: { _id: req.params.id, ...req.body },
        errors: [{ msg: 'Failed to update painting' }]
      });
    }
  }
);

module.exports = router;
