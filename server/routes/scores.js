const express = require('express');
const { sql } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
  try {
    const rows = await sql`
      SELECT name, picture, score, watermelons, total_watermelons FROM (
        SELECT DISTINCT ON (u.id)
          COALESCE(u.nickname, u.name) AS name,
          u.picture,
          s.score,
          s.watermelons,
          u.total_watermelons,
          s.created_at
        FROM scores s
        JOIN users u ON s.user_id = u.id
        WHERE u.is_admin IS NOT TRUE
        ORDER BY u.id, s.score DESC, s.created_at ASC
      ) best
      ORDER BY score DESC, watermelons DESC, created_at ASC
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

    const [{ is_admin, total_watermelons: currentWm }] = await sql`
      SELECT is_admin, total_watermelons FROM users WHERE id = ${req.userId}
    `;

    // 어드민은 점수 저장 및 수박 누적 스킵
    if (is_admin) {
      return res.json({ ok: true, total_watermelons: currentWm });
    }

    await sql`INSERT INTO scores (user_id, score, watermelons) VALUES (${req.userId}, ${score}, ${wm})`;
    const [{ total_watermelons }] = await sql`
      UPDATE users SET total_watermelons = total_watermelons + ${wm}
      WHERE id = ${req.userId}
      RETURNING total_watermelons
    `;
    res.json({ ok: true, total_watermelons });
  } catch (err) {
    console.error('Score submit error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [user] = await sql`
      SELECT id, name, nickname, picture, email, is_admin, total_watermelons FROM users WHERE id = ${req.userId}
    `;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.is_admin === true && user.total_watermelons < 100) {
      await sql`UPDATE users SET total_watermelons = 9999 WHERE id = ${user.id}`;
      user.total_watermelons = 9999;
    }

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
