const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || (!req.user.isAdmin && !req.user.isSuperUser)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function teacherOnly(req, res, next) {
  if (!req.user || (!req.user.isTeacher && !req.user.isAdmin && !req.user.isSuperUser)) {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
}

function superUserOnly(req, res, next) {
  if (!req.user || !req.user.isSuperUser) {
    return res.status(403).json({ error: 'Superuser access required' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, teacherOnly, superUserOnly };
