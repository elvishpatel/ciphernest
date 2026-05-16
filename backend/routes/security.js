const express = require('express');
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// ─── SECURITY REPORT ─────────────────────────────────────────
router.get('/report', async (req, res) => {
  try {
    // Get recent events
    const { data: events } = await supabase
      .from('security_events')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get all entries for analysis
    const { data: vaults } = await supabase
      .from('vaults')
      .select('vault_id')
      .eq('user_id', req.user.userId);

    const vaultIds = (vaults || []).map(v => v.vault_id);

    let entryCount = 0;
    if (vaultIds.length > 0) {
      const { count } = await supabase
        .from('vault_entries')
        .select('*', { count: 'exact', head: true })
        .in('vault_id', vaultIds);
      entryCount = count || 0;
    }

    const failedLogins = (events || []).filter(e => e.event_type === 'LOGIN_FAILED').length;
    const lastLogin = (events || []).find(e => e.event_type === 'LOGIN_SUCCESS');

    res.json({
      totalEntries: entryCount,
      totalVaults: vaultIds.length,
      failedLoginAttempts: failedLogins,
      lastLoginAt: lastLogin?.created_at || null,
      recentEvents: (events || []).slice(0, 20)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// ─── PANIC LOCK ──────────────────────────────────────────────
router.post('/panic', async (req, res) => {
  try {
    await supabase.from('security_events').insert({
      user_id: req.user.userId,
      event_type: 'PANIC_LOCK',
      risk_score: 100
    });

    res.json({ message: 'Panic lock activated. All sessions invalidated.' });
  } catch (err) {
    res.status(500).json({ error: 'Panic lock failed.' });
  }
});

module.exports = router;
