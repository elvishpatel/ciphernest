const express = require('express');
const { securityMiddleware } = require('./middleware/security');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security ────────────────────────────────────────────────
securityMiddleware(app);

// ─── Body Parser ─────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vaults', require('./routes/vaults'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/security', require('./routes/security'));

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'operational', timestamp: Date.now() });
});

// ─── Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[CipherNest] Server running on port ${PORT}`);
});
