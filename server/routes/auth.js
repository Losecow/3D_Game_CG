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

    const [user] = await sql`
      INSERT INTO users (google_id, email, name, picture)
      VALUES (${googleId}, ${email}, ${name}, ${picture})
      ON CONFLICT (google_id) DO UPDATE
        SET name = EXCLUDED.name, picture = EXCLUDED.picture
      RETURNING id, name, picture, email
    `;

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { name: user.name, picture: user.picture, email: user.email } });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ error: 'Invalid credential' });
  }
});

module.exports = router;
