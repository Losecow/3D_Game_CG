const express = require('express');
const { sql } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
  try {
    const rows = await sql`
      SELECT name, picture, score, watermelons FROM (
        SELECT DISTINCT ON (u.id)
          COALESCE(u.nickname, u.name) AS name,
          u.picture,
          s.score,
          s.watermelons
        FROM scores s
        JOIN users u ON s.user_id = u.id
        ORDER BY u.id, s.score DESC
      ) best
      ORDER BY score DESC
      LIMIT 10
    `;
    res.json(rows);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/scores', authMiddleware, async (req, res) => {
  try {
    const { score, watermelons = 0 } = req.body;
    if (!Number.isInteger(score) || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    const wm = Number.isInteger(watermelons) && watermelons >= 0 ? watermelons : 0;
    await sql`INSERT INTO scores (user_id, score, watermelons) VALUES (${req.userId}, ${score}, ${wm})`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Score submit error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [user] = await sql`
      SELECT id, name, nickname, picture, email FROM users WHERE id = ${req.userId}
    `;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me/nickname', authMiddleware, async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
      return res.status(400).json({ error: 'Invalid nickname' });
    }
    const trimmed = nickname.trim().slice(0, 20);
    const [user] = await sql`
      UPDATE users SET nickname = ${trimmed}
      WHERE id = ${req.userId}
      RETURNING nickname
    `;
    res.json({ nickname: user.nickname });
  } catch (err) {
    console.error('Nickname error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
