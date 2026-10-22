const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

// Helper to generate JWT and set secure cookie
const setTokenCookie = (res, user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    name: user.name
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });

  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
};

// GET /auth/register
router.get('/register', (req, res) => {
  if (res.locals.currentUser) {
    return res.redirect('/paintings');
  }
  res.render('auth/register', {
    title: 'Register as Customer',
    errors: [],
    formData: {}
  });
});

// POST /auth/register (Customer Registration)
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { name, email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register', {
        title: 'Register as Customer',
        errors: errors.array(),
        formData: { name, email }
      });
    }

    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).render('auth/register', {
          title: 'Register as Customer',
          errors: [{ msg: 'An account with this email already exists' }],
          formData: { name, email }
        });
      }

      // Hash password and save new customer
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        name,
        email,
        password: hashedPassword,
        role: 'customer' // All self-registered users are customers
      });

      setTokenCookie(res, newUser);
      return res.redirect('/paintings?success=' + encodeURIComponent('Welcome to Art Studio, ' + newUser.name + '!'));
    } catch (error) {
      console.error('[Auth Register Error]:', error);
      return res.status(500).render('auth/register', {
        title: 'Register as Customer',
        errors: [{ msg: 'Registration failed due to a server error. Please try again.' }],
        formData: { name, email }
      });
    }
  }
);

// GET /auth/login
router.get('/login', (req, res) => {
  if (res.locals.currentUser) {
    return res.redirect('/paintings');
  }
  res.render('auth/login', {
    title: 'Log In',
    errors: [],
    formData: {}
  });
});

// POST /auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(400).render('auth/login', {
        title: 'Log In',
        errors: errors.array(),
        formData: { email }
      });
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).render('auth/login', {
          title: 'Log In',
          errors: [{ msg: 'Invalid email or password' }],
          formData: { email }
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).render('auth/login', {
          title: 'Log In',
          errors: [{ msg: 'Invalid email or password' }],
          formData: { email }
        });
      }

      setTokenCookie(res, user);
      return res.redirect('/paintings?success=' + encodeURIComponent('Logged in successfully as ' + user.name));
    } catch (error) {
      console.error('[Auth Login Error]:', error);
      return res.status(500).render('auth/login', {
        title: 'Log In',
        errors: [{ msg: 'Login failed due to a server error' }],
        formData: { email }
      });
    }
  }
);

// GET /auth/logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/auth/login?success=' + encodeURIComponent('You have been logged out safely'));
});

module.exports = router;
