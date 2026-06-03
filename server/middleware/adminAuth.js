const jwt = require('jsonwebtoken');
const { sql } = require('../db');

const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);

module.exports = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    const [user] = await sql`SELECT email FROM users WHERE id = ${payload.userId}`;
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
