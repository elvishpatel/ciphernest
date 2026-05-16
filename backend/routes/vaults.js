const express = require('express');
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const router = express.Router();
router.use(verifyToken);
router.use(apiLimiter);

// ─── LIST VAULTS ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vaults')
      .select('vault_id, encrypted_vault_key, vault_name_encrypted, vault_type, visibility_mode, icon_encrypted, sort_order, created_at')
      .eq('user_id', req.user.userId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ vaults: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vaults.' });
  }
});

// ─── CREATE VAULT ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { encryptedVaultKey, vaultNameEncrypted, vaultType, visibilityMode, iconEncrypted } = req.body;

    if (!encryptedVaultKey || !vaultNameEncrypted) {
      return res.status(400).json({ error: 'Vault key and name required.' });
    }

    const { data, error } = await supabase
      .from('vaults')
      .insert({
        user_id: req.user.userId,
        encrypted_vault_key: encryptedVaultKey,
        vault_name_encrypted: vaultNameEncrypted,
        vault_type: vaultType || 'personal',
        visibility_mode: visibilityMode || 'normal',
        icon_encrypted: iconEncrypted || null
      })
      .select('vault_id')
      .single();

    if (error) throw error;
    res.status(201).json({ vaultId: data.vault_id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create vault.' });
  }
});

// ─── DELETE VAULT ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // Verify ownership
    const { data: vault } = await supabase
      .from('vaults')
      .select('vault_id')
      .eq('vault_id', req.params.id)
      .eq('user_id', req.user.userId)
      .single();

    if (!vault) return res.status(404).json({ error: 'Vault not found.' });

    const { error } = await supabase
      .from('vaults')
      .delete()
      .eq('vault_id', req.params.id)
      .eq('user_id', req.user.userId);

    if (error) throw error;
    res.json({ message: 'Vault deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vault.' });
  }
});

// ─── GET VAULT ENTRIES ───────────────────────────────────────
router.get('/:id/entries', async (req, res) => {
  try {
    // Verify vault ownership
    const { data: vault } = await supabase
      .from('vaults')
      .select('vault_id')
      .eq('vault_id', req.params.id)
      .eq('user_id', req.user.userId)
      .single();

    if (!vault) return res.status(404).json({ error: 'Vault not found.' });

    const { data, error } = await supabase
      .from('vault_entries')
      .select('*')
      .eq('vault_id', req.params.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json({ entries: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
});

module.exports = router;
