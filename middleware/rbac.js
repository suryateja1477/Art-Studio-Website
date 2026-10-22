// Restrict access by user role (customer, studio)
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.status(401).redirect('/auth/login?error=' + encodeURIComponent('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
      }
      return res.status(403).render('error', {
        title: 'Access Denied (403)',
        statusCode: 403,
        message: 'Forbidden: You do not have permission to access this resource or perform this action.'
      });
    }

    next();
  };
};

module.exports = { requireRole };
