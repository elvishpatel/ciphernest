import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Shield, Loader2, Fingerprint } from 'lucide-react';
import { useAuthStore, useUIStore } from '../lib/store';
import { api } from '../lib/api';
import { deriveKeyFromPassword, splitMasterKey, hashForServer, unlockWithBiometric } from '../lib/crypto';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasBiometric, setHasBiometric] = useState(false);
  
  const { login: storeLogin, unlock: storeUnlock, isLocked, userId } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const locked = params.get('locked') === 'true' || isLocked;

  useEffect(() => {
    // If we are locked (user session exists but memory key is wiped), or just opening the app
    if (localStorage.getItem('cn_bio_id')) {
      setHasBiometric(true);
    }
    // If locked, we already know the email/userId, we just need to get the encryption key back into memory
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (locked && userId) {
        // Just derive the key to unlock if we already have a session
        // Note: For a true unlock we still need salt. 
        // A better approach for full local unlock is to verify the derived key against something, 
        // but for simplicity we'll just login against the server to verify.
      }
      
      const targetEmail = email || localStorage.getItem('cn_user_email') || '';
      if (!targetEmail) throw new Error('Email required.');

      const { salt } = await api.getSalt(targetEmail);
      const masterKey = await deriveKeyFromPassword(password, salt);
      const { authKey, encryptionKey } = splitMasterKey(masterKey);
      const authKeyHash = await hashForServer(authKey);
      
      const result = await api.login({ email: targetEmail, authKeyHash });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      api.setTokens(result.accessToken, result.refreshToken);
      localStorage.setItem('cn_user_email', targetEmail);
      storeLogin(result.userId, encryptionKey);
      addToast({ type: 'success', message: 'Vault unlocked successfully.' });
      navigate('/');
    } catch {
      setError('Authentication failed. Check your credentials.');
    }
    setLoading(false);
  };

  const handleBiometricUnlock = async () => {
    setBioLoading(true);
    setError('');
    try {
      const encryptionKey = await unlockWithBiometric();
      // If we are fully logged out, biometric unlock won't give us server auth tokens.
      // In this architecture, biometric only unlocks a *locked* session (where refresh token is still valid).
      // If the user is fully logged out (no refresh token), we can't fetch from server.
      // Let's assume this is mostly for "Unlock" state.
      
      if (locked) {
        storeUnlock(encryptionKey);
        addToast({ type: 'success', message: 'Biometric unlock successful.' });
        navigate('/');
      } else {
        // If not locked, we need server tokens. We can't generate them without auth key.
        // For MVP, we'll just set the key and hope the refresh token is valid.
        const uid = localStorage.getItem('cn_user_id');
        if (uid) {
          storeLogin(uid, encryptionKey);
          addToast({ type: 'success', message: 'Biometric login successful.' });
          navigate('/');
        } else {
          setError('Session expired. Please log in with password first.');
        }
      }
    } catch (err) {
      setError('Biometric authentication failed or cancelled.');
    }
    setBioLoading(false);
  };

  return (
    <div className="grid-overlay" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, #00f0ff06 0%, transparent 70%)',
        top: '10%', left: '10%', pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="glass-panel"
        style={{ width: '100%', maxWidth: 420, padding: '40px 32px', position: 'relative' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
            className="animate-lock-pulse"
            style={{
              width: 60, height: 60, borderRadius: 16, margin: '0 auto 14px',
              background: 'linear-gradient(135deg, var(--color-cyber) 0%, var(--color-emerald) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Lock size={26} style={{ color: 'var(--color-void)' }} />
          </motion.div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--color-white)', marginBottom: 4 }}>
            {locked ? 'Vault Locked' : 'CipherNest'}
          </h1>
          <p style={{ color: 'var(--color-mist)', fontSize: 13 }}>
            {locked ? 'Enter master password or use biometrics to unlock' : 'Your secure password vault'}
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!locked && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>EMAIL</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="cn-input" placeholder="your@email.com" required autoFocus />
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--color-ghost)', display: 'block', fontWeight: 600 }}>MASTER PASSWORD</label>
              {locked && (
                <Link to="/reset" style={{ color: 'var(--color-crimson)', textDecoration: 'none', fontSize: 11, fontWeight: 500 }}>
                  Forgot?
                </Link>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cn-input cn-input-mono"
                placeholder="••••••••••••••••" required autoFocus={locked}
                style={{ paddingRight: 48 }} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ghost)', padding: 4, display: 'flex' }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ padding: '10px 14px', borderRadius: 8, background: '#ff335515', border: '1px solid #ff335530', color: 'var(--color-crimson)', fontSize: 13 }}>
              {error}
            </motion.div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" className="cn-btn cn-btn-primary" disabled={loading || bioLoading} style={{ flex: 1, height: 48 }}>
              {loading ? <><Loader2 size={18} className="animate-spin" /> Unlocking...</> : <><Shield size={18} /> {locked ? 'Unlock' : 'Sign In'}</>}
            </button>

            {hasBiometric && (
              <button type="button" onClick={handleBiometricUnlock} disabled={bioLoading || loading} 
                className="cn-btn cn-btn-ghost" style={{ width: 48, height: 48, padding: 0, flexShrink: 0 }}
                title="Unlock with Biometrics">
                {bioLoading ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={20} />}
              </button>
            )}
          </div>
        </form>

        {/* Links */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
          <Link to="/reset" style={{ color: 'var(--color-crimson)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
            Forgot password? Reset account
          </Link>
          {!locked && (
            <p style={{ fontSize: 13, color: 'var(--color-ghost)' }}>
              No account?{' '}
              <Link to="/register" style={{ color: 'var(--color-cyber)', textDecoration: 'none', fontWeight: 600 }}>Create Vault</Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
