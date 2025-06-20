const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    req.user = {
      userId: 1,
      email: 'dev@objekt-pro.at',
      role: 'admin',
      name: 'Development User'
    };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access Token erforderlich' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token ungültig' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin-Berechtigung erforderlich' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };