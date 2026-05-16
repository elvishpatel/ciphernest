const express = require('express');
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();
router.use(verifyToken);
router.use(apiLimiter);

// Helper: verify vault ownership
const verifyVaultOwnership = async (vaultId, userId) => {
  const { data } = await supabase
    .from('vaults')
    .select('vault_id')
    .eq('vault_id', vaultId)
    .eq('user_id', userId)
    .single();
  return !!data;
};

// ─── CREATE ENTRY ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { vaultId, encryptedBlob, hmac, securityScore } = req.body;

    if (!vaultId || !encryptedBlob || !hmac) {
      return res.status(400).json({ error: 'Vault ID, encrypted blob, and HMAC required.' });
    }

    if (!(await verifyVaultOwnership(vaultId, req.user.userId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { data, error } = await supabase
      .from('vault_entries')
      .insert({
        vault_id: vaultId,
        encrypted_blob: encryptedBlob,
        hmac,
        security_score: securityScore || 0
      })
      .select('entry_id, created_at')
      .single();

    if (error) throw error;
    res.status(201).json({ entryId: data.entry_id, createdAt: data.created_at });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create entry.' });
  }
});

// ─── UPDATE ENTRY ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { encryptedBlob, hmac, securityScore } = req.body;

    // Get entry and verify ownership chain
    const { data: entry } = await supabase
      .from('vault_entries')
      .select('vault_id, encrypted_blob')
      .eq('entry_id', req.params.id)
      .single();

    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    if (!(await verifyVaultOwnership(entry.vault_id, req.user.userId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Save old version to history
    await supabase.from('password_history').insert({
      entry_id: req.params.id,
      encrypted_old_blob: entry.encrypted_blob
    });

    // Update entry
    const { error } = await supabase
      .from('vault_entries')
      .update({
        encrypted_blob: encryptedBlob,
        hmac,
        security_score: securityScore || 0,
        updated_at: new Date().toISOString()
      })
      .eq('entry_id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Entry updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// ─── DELETE ENTRY ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { data: entry } = await supabase
      .from('vault_entries')
      .select('vault_id')
      .eq('entry_id', req.params.id)
      .single();

    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    if (!(await verifyVaultOwnership(entry.vault_id, req.user.userId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { error } = await supabase
      .from('vault_entries')
      .delete()
      .eq('entry_id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Entry deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

// ─── TOGGLE FAVORITE ─────────────────────────────────────────
router.patch('/:id/favorite', async (req, res) => {
  try {
    const { data: entry } = await supabase
      .from('vault_entries')
      .select('vault_id, favorite')
      .eq('entry_id', req.params.id)
      .single();

    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    if (!(await verifyVaultOwnership(entry.vault_id, req.user.userId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { error } = await supabase
      .from('vault_entries')
      .update({ favorite: !entry.favorite })
      .eq('entry_id', req.params.id);

    if (error) throw error;
    res.json({ favorite: !entry.favorite });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle favorite.' });
  }
});

// ─── GET PASSWORD HISTORY ────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  try {
    const { data: entry } = await supabase
      .from('vault_entries')
      .select('vault_id')
      .eq('entry_id', req.params.id)
      .single();

    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    if (!(await verifyVaultOwnership(entry.vault_id, req.user.userId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { data, error } = await supabase
      .from('password_history')
      .select('*')
      .eq('entry_id', req.params.id)
      .order('changed_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ history: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

module.exports = router;
