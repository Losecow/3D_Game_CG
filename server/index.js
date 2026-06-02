require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/scores'));
app.get('/api/health', (_, res) => res.json({ ok: true }));

// 프론트엔드 정적 파일 서빙 (빌드된 dist/)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));

initDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
