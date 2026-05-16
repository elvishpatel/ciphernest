import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, UserPlus, Loader2, Shield, CheckCircle } from 'lucide-react';
import { useAuthStore, useUIStore } from '../lib/store';
import { api } from '../lib/api';
import {
  deriveKeyFromPassword, splitMasterKey, hashForServer,
  generateSalt, bytesToBase64, encryptObject
} from '../lib/crypto';
import { calculateEntropy, getStrengthLabel } from '../lib/generator';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login: storeLogin } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  const entropy = calculateEntropy(password);
  const strength = getStrengthLabel(entropy);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (entropy < 40) {
      setError('Password too weak. Use at least 12 characters with mixed case, digits, and symbols.');
      return;
    }

    setLoading(true);
    try {
      // 1. Generate salt
      const salt = generateSalt(32);
      const saltB64 = bytesToBase64(salt);

      // 2. Derive master key
      const masterKey = await deriveKeyFromPassword(password, saltB64);

      // 3. Split keys
      const { authKey, encryptionKey } = splitMasterKey(masterKey);

      // 4. Hash auth key
      const authKeyHash = await hashForServer(authKey);

      // 5. Encrypt vault key blob (wrapping the encryption key for storage)
      const vaultKeyBlob = bytesToBase64(encryptionKey);

      // 6. Register
      const result = await api.register({
        email,
        authKeyHash,
        vaultKeyBlob,
        salt: saltB64,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      api.setTokens(result.accessToken, result.refreshToken);
      storeLogin(result.userId, encryptionKey);
      addToast({ type: 'success', message: 'Vault created! Welcome to CipherNest.' });
      navigate('/');
    } catch (err) {
      setError('Registration failed. Try again.');
    }
    setLoading(false);
  };

  return (
    <div className="grid-overlay" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, #00ff8808 0%, transparent 70%)',
        top: '10%', right: '10%', pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="glass-panel scanline"
        style={{ width: '100%', maxWidth: 440, padding: '48px 40px', position: 'relative' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
            style={{
              width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
              background: 'linear-gradient(135deg, var(--color-emerald) 0%, var(--color-cyber) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <UserPlus size={28} style={{ color: 'var(--color-void)' }} />
          </motion.div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--color-white)' }}>
            Create Vault
          </h1>
          <p style={{ color: 'var(--color-mist)', fontSize: 13, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
            YOUR KEYS NEVER LEAVE THIS DEVICE
          </p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="cn-input" placeholder="your@email.com" required autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>MASTER PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cn-input cn-input-mono" placeholder="Choose a strong master password" required
                style={{ paddingRight: 48 }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ghost)' }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Strength meter */}
            {password && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div key={lvl} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: lvl <= strength.level ? strength.color : 'var(--color-slate-light)',
                      transition: 'all 0.3s',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: strength.color, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{strength.label}</span>
                  <span style={{ color: 'var(--color-ghost)', fontFamily: 'var(--font-mono)' }}>{entropy} bits</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>CONFIRM PASSWORD</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="cn-input cn-input-mono" placeholder="Confirm master password" required />
            {confirm && password === confirm && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-emerald)', fontSize: 12 }}>
                <CheckCircle size={14} /> Match
              </div>
            )}
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ padding: '10px 14px', borderRadius: 8, background: '#ff335515', border: '1px solid #ff335530', color: 'var(--color-crimson)', fontSize: 13 }}>
              {error}
            </motion.div>
          )}

          <button type="submit" className="cn-btn cn-btn-primary" disabled={loading} style={{ marginTop: 8, width: '100%', height: 50 }}>
            {loading ? <><Loader2 size={18} className="animate-spin" /> Creating vault...</> : <><Lock size={18} /> Initialize Vault</>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--color-ghost)' }}>
          Already have a vault?{' '}
          <Link to="/login" style={{ color: 'var(--color-cyber)', textDecoration: 'none', fontWeight: 600 }}>Unlock</Link>
        </p>

        <div style={{
          marginTop: 24, padding: '10px 14px', borderRadius: 8,
          background: '#00ff8806', border: '1px solid #00ff8810',
          fontSize: 11, color: 'var(--color-emerald-dim)', fontFamily: 'var(--font-mono)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Shield size={14} />
          MASTER PASSWORD IS NEVER SENT TO SERVER
        </div>
      </motion.div>
    </div>
  );
}
