const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authLimiter } = require('../middleware/security');
require('dotenv').config();

const router = express.Router();

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, tokenId: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

// ─── REGISTER ────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, authKeyHash, vaultKeyBlob, salt } = req.body;

    if (!email || !authKeyHash || !vaultKeyBlob || !salt) {
      return res.status(400).json({ error: 'All fields required.' });
    }

    // Check existing user
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Account already exists.' });
    }

    // Hash the auth key server-side for storage
    const serverHash = await bcrypt.hash(authKeyHash, 12);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        auth_key_hash: serverHash,
        vault_key_blob: vaultKeyBlob,
        salt: salt
      })
      .select('id')
      .single();

    if (error) throw error;

    // Create default vault
    const { error: vaultError } = await supabase
      .from('vaults')
      .insert({
        user_id: user.id,
        encrypted_vault_key: vaultKeyBlob,
        vault_name_encrypted: 'default',
        vault_type: 'personal',
        visibility_mode: 'normal',
        sort_order: 0
      });

    if (vaultError) throw vaultError;

    const tokens = generateTokens(user.id);

    // Log security event
    await supabase.from('security_events').insert({
      user_id: user.id,
      event_type: 'ACCOUNT_CREATED',
      risk_score: 0
    });

    res.status(201).json({
      message: 'Account created.',
      userId: user.id,
      ...tokens
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// ─── LOGIN ───────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, authKeyHash } = req.body;

    if (!email || !authKeyHash) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      // Timing-safe: still run bcrypt to prevent timing attacks
      await bcrypt.hash('dummy', 12);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Verify auth key
    const valid = await bcrypt.compare(authKeyHash, user.auth_key_hash);
    if (!valid) {
      // Log failed attempt
      await supabase.from('security_events').insert({
        user_id: user.id,
        event_type: 'LOGIN_FAILED',
        risk_score: 30
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const tokens = generateTokens(user.id);

    // Log success
    await supabase.from('security_events').insert({
      user_id: user.id,
      event_type: 'LOGIN_SUCCESS',
      risk_score: 0
    });

    res.json({
      ...tokens,
      userId: user.id,
      salt: user.salt,
      vaultKeyBlob: user.vault_key_blob
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ─── REFRESH TOKEN ───────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens = generateTokens(decoded.userId);

    res.json(tokens);
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token.' });
  }
});

// ─── GET SALT (for login key derivation) ─────────────────────
router.post('/salt', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const { data: user } = await supabase
      .from('users')
      .select('salt')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      // Return fake salt to prevent user enumeration
      return res.json({ salt: require('crypto').randomBytes(32).toString('base64') });
    }

    res.json({ salt: user.salt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve salt.' });
  }
});

const { verifyToken } = require('../middleware/auth');

// ─── RESET ACCOUNT (forgot password) ─────────────────────────
router.post('/reset-account', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      return res.json({ message: 'If account exists, it has been reset.' });
    }

    await supabase.from('security_events').delete().eq('user_id', user.id);
    await supabase.from('vaults').delete().eq('user_id', user.id);
    await supabase.from('users').delete().eq('id', user.id);

    res.json({ message: 'Account reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed.' });
  }
});

// ─── SETUP RECOVERY ──────────────────────────────────────────
router.post('/setup-recovery', verifyToken, async (req, res) => {
  try {
    const { recoveryAuthHash, recoveryKeyBlob } = req.body;
    if (!recoveryAuthHash || !recoveryKeyBlob) return res.status(400).json({ error: 'Missing parameters.' });

    const serverHash = await bcrypt.hash(recoveryAuthHash, 12);
    const { error } = await supabase
      .from('users')
      .update({ recovery_auth_hash: serverHash, recovery_key_blob: recoveryKeyBlob })
      .eq('id', req.user.userId);

    if (error) throw error;
    res.json({ message: 'Recovery kit setup successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to setup recovery.' });
  }
});

// ─── RECOVER ACCOUNT ─────────────────────────────────────────
router.post('/recover-account', authLimiter, async (req, res) => {
  try {
    const { email, recoveryAuthHash } = req.body;
    if (!email || !recoveryAuthHash) return res.status(400).json({ error: 'Missing credentials.' });

    const { data: user } = await supabase
      .from('users')
      .select('id, recovery_auth_hash, recovery_key_blob, salt')
      .eq('email', email.toLowerCase())
      .single();

    if (!user || !user.recovery_auth_hash) {
      await bcrypt.hash('dummy', 12);
      return res.status(401).json({ error: 'Invalid recovery credentials.' });
    }

    const valid = await bcrypt.compare(recoveryAuthHash, user.recovery_auth_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid recovery credentials.' });

    res.json({ 
      recoveryKeyBlob: user.recovery_key_blob,
      salt: user.salt
    });
  } catch (err) {
    res.status(500).json({ error: 'Recovery failed.' });
  }
});

// ─── COMPLETE RECOVERY ───────────────────────────────────────
router.post('/complete-recovery', authLimiter, async (req, res) => {
  try {
    const { email, recoveryAuthHash, newAuthKeyHash, newVaultKeyBlob } = req.body;
    
    const { data: user } = await supabase
      .from('users')
      .select('id, recovery_auth_hash')
      .eq('email', email.toLowerCase())
      .single();

    if (!user || !user.recovery_auth_hash) {
      return res.status(401).json({ error: 'Invalid request.' });
    }

    const valid = await bcrypt.compare(recoveryAuthHash, user.recovery_auth_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid request.' });

    const serverHash = await bcrypt.hash(newAuthKeyHash, 12);
    
    const { error } = await supabase
      .from('users')
      .update({ 
        auth_key_hash: serverHash, 
        vault_key_blob: newVaultKeyBlob,
        // Optionally, we could wipe the recovery kit here to force them to make a new one,
        // but it's safer to leave it active so it doesn't break if they forget again.
      })
      .eq('id', user.id);

    if (error) throw error;
    
    // Auto-login the user after recovery
    const tokens = generateTokens(user.id);
    res.json({ message: 'Recovery complete.', userId: user.id, ...tokens });
  } catch (err) {
    res.status(500).json({ error: 'Recovery completion failed.' });
  }
});

module.exports = router;
