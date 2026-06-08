const express = require('express');
const { sql } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const ITEMS = [
  { id: 'shake',    name: '섞기',        cost: 1 },
  { id: 'delete',   name: '과일 삭제',   cost: 1 },
  { id: 'nickname', name: '닉네임 변경', cost: 1 },
];

router.get('/items', auth, async (req, res) => {
  try {
    const [user] = await sql`SELECT total_watermelons FROM users WHERE id = ${req.userId}`;
    res.json({ watermelons: user.total_watermelons, items: ITEMS });
  } catch (err) {
    console.error('Shop items error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/purchase', auth, async (req, res) => {
  try {
    const { item_id } = req.body;
    const item = ITEMS.find(i => i.id === item_id);
    if (!item) return res.status(400).json({ error: 'invalid_item' });

    const [user] = await sql`SELECT total_watermelons FROM users WHERE id = ${req.userId}`;
    if (user.total_watermelons < item.cost) {
      return res.status(400).json({ error: 'insufficient_funds' });
    }

    const [updated] = await sql`
      UPDATE users SET total_watermelons = total_watermelons - ${item.cost}
      WHERE id = ${req.userId}
      RETURNING total_watermelons
    `;
    await sql`INSERT INTO shop_purchases (user_id, item_id, cost) VALUES (${req.userId}, ${item_id}, ${item.cost})`;

    res.json({ ok: true, total_watermelons: updated.total_watermelons });
  } catch (err) {
    console.error('Shop purchase error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
