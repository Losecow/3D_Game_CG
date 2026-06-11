const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { sql } = require('../db');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();
    const isAdmin = email === process.env.ADMIN_EMAIL;

    const [user] = await sql`
      INSERT INTO users (google_id, email, name, picture, is_admin)
      VALUES (${googleId}, ${email}, ${name}, ${picture}, ${isAdmin})
      ON CONFLICT (google_id) DO UPDATE
        SET name = EXCLUDED.name, picture = EXCLUDED.picture, is_admin = ${isAdmin}
      RETURNING id, name, nickname, picture, email, is_admin, total_watermelons
    `;

    // 어드민 계정 수박 자동 충전 (100 미만이면 9999로)
    if (isAdmin && user.total_watermelons < 100) {
      await sql`UPDATE users SET total_watermelons = 9999 WHERE id = ${user.id}`;
      user.total_watermelons = 9999;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { name: user.name, nickname: user.nickname, picture: user.picture, email: user.email, is_admin: user.is_admin, total_watermelons: user.total_watermelons } });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ error: 'Invalid credential' });
  }
});

module.exports = router;
