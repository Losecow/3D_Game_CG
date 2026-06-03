const express = require('express');
const router  = express.Router();
const { sql } = require('../db');
const auth    = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  const content = (req.body.content ?? '').trim();
  if (!content)          return res.status(400).json({ error: 'empty' });
  if (content.length > 500) return res.status(400).json({ error: 'too long' });

  await sql`INSERT INTO feedback (user_id, content) VALUES (${req.user.id}, ${content})`;
  res.json({ ok: true });
});

module.exports = router;
