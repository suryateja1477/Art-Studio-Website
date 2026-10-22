const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect private routes
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    // If API request or expect JSON, return 401
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Unauthorized: Please log in' });
    }
    return res.status(401).redirect('/auth/login?error=' + encodeURIComponent('Please log in to continue'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('token');
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    return res.status(401).redirect('/auth/login?error=' + encodeURIComponent('Session expired, please log in again'));
  }
};

// Middleware to inject current user into all EJS views (runs on every request)
const checkUser = async (req, res, next) => {
  const token = req.cookies.token;
  res.locals.currentUser = null;
  res.locals.flash = {
    success: req.query.success || null,
    error: req.query.error || null
  };

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    if (user) {
      res.locals.currentUser = {
        _id: user._id,
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      };
      req.user = res.locals.currentUser;
    }
    next();
  } catch (err) {
    res.locals.currentUser = null;
    next();
  }
};

module.exports = { verifyToken, checkUser };
