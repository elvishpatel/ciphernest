import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2, Trash2, ArrowLeft, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore, useUIStore } from '../lib/store';
import { parseRecoveryKey, hashRecoveryKey, decryptWithRecoveryKey, deriveKeyFromPassword, splitMasterKey, hashForServer } from '../lib/crypto';

export default function ResetPage() {
  const [mode, setMode] = useState('recover'); // 'recover' | 'destroy'
  const navigate = useNavigate();

  return (
    <div className="grid-overlay" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ width: '100%', maxWidth: 420, padding: '40px 32px' }}>

        <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-mist)', textDecoration: 'none', fontSize: 13, marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back to login
        </Link>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 8, background: '#0a0a12', padding: 4, borderRadius: 12, marginBottom: 24 }}>
          <button onClick={() => setMode('recover')} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: mode === 'recover' ? '#ffffff10' : 'transparent',
            color: mode === 'recover' ? 'var(--color-white)' : 'var(--color-mist)',
            transition: 'all 0.2s'
          }}>Recover Account</button>
          <button onClick={() => setMode('destroy')} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: mode === 'destroy' ? '#ff335515' : 'transparent',
            color: mode === 'destroy' ? 'var(--color-crimson)' : 'var(--color-mist)',
            transition: 'all 0.2s'
          }}>Destroy Account</button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'recover' ? (
            <motion.div key="recover" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <RecoverFlow />
            </motion.div>
          ) : (
            <motion.div key="destroy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <DestroyFlow />
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}

function RecoverFlow() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // State from Step 1
  const [recoveryData, setRecoveryData] = useState(null);
  
  const { login: storeLogin } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const parsedKey = parseRecoveryKey(recoveryKey);
      const recoveryAuthHash = await hashRecoveryKey(parsedKey);
      
      const res = await api.recoverAccount({ email, recoveryAuthHash });
      if (res.error) throw new Error(res.error);
      
      // We have the encrypted blob, let's test if we can decrypt it
      const encryptionKey = await decryptWithRecoveryKey(res.recoveryKeyBlob, parsedKey);
      
      // Success! Move to step 2
      setRecoveryData({ encryptionKey, parsedKey, recoveryAuthHash });
      setStep(2);
    } catch (err) {
      setError(err.message || 'Invalid recovery key or email.');
    }
    setLoading(false);
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    
    setLoading(true);
    try {
      // Re-derive a completely new master key system
      const { salt } = await api.getSalt(email);
      const masterKey = await deriveKeyFromPassword(newPassword, salt);
      const { authKey, encryptionKey: newWrapKey } = splitMasterKey(masterKey);
      
      const newAuthKeyHash = await hashForServer(authKey);
      
      // We re-encrypt the EXISTING inner encryptionKey using the NEW wrap key
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        newWrapKey,
        recoveryData.encryptionKey
      );
      
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      const newVaultKeyBlob = btoa(String.fromCharCode(...combined));

      const res = await api.completeRecovery({
        email,
        recoveryAuthHash: recoveryData.recoveryAuthHash,
        newAuthKeyHash,
        newVaultKeyBlob
      });

      if (res.error) throw new Error(res.error);

      // Auto login
      api.setTokens(res.accessToken, res.refreshToken);
      storeLogin(res.userId, recoveryData.encryptionKey);
      addToast({ type: 'success', message: 'Master password recovered successfully!' });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to update master password.');
    }
    setLoading(false);
  };

  if (step === 2) {
    return (
      <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <ShieldCheck size={40} style={{ color: 'var(--color-emerald)', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 20, color: 'var(--color-white)', fontWeight: 700 }}>Recovery Key Verified</h2>
          <p style={{ fontSize: 13, color: 'var(--color-mist)' }}>Set a new master password for your vault.</p>
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>NEW MASTER PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="cn-input cn-input-mono" placeholder="••••••••" required autoFocus style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: 12, top: 14, background: 'none', border: 'none', color: 'var(--color-ghost)', cursor: 'pointer' }}>
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && <div style={{ padding: 10, background: '#ff335515', color: 'var(--color-crimson)', borderRadius: 8, fontSize: 13 }}>{error}</div>}

        <button type="submit" className="cn-btn cn-btn-primary" disabled={loading} style={{ width: '100%', height: 48, marginTop: 8 }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Update Password & Login'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <KeyRound size={40} style={{ color: 'var(--color-cyber)', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 20, color: 'var(--color-white)', fontWeight: 700 }}>Account Recovery</h2>
        <p style={{ fontSize: 13, color: 'var(--color-mist)' }}>Enter your Emergency Recovery Kit key to decrypt and reset your vault.</p>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>ACCOUNT EMAIL</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="cn-input" placeholder="your@email.com" required autoFocus />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>RECOVERY KEY</label>
        <input type="text" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)}
          className="cn-input cn-input-mono" placeholder="CPHR-XXXX-XXXX-XXXX-XXXX" required />
      </div>

      {error && <div style={{ padding: 10, background: '#ff335515', color: 'var(--color-crimson)', borderRadius: 8, fontSize: 13 }}>{error}</div>}

      <button type="submit" className="cn-btn cn-btn-primary" disabled={loading} style={{ width: '100%', height: 48, marginTop: 8 }}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Verify Recovery Key'}
      </button>
    </form>
  );
}

function DestroyFlow() {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { addToast } = useUIStore();

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (email !== confirmEmail) return setError('Emails do not match.');
    if (!confirm('⚠️ This will PERMANENTLY DELETE all your vaults. Are you absolutely sure?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setSuccess(true);
        addToast({ type: 'success', message: 'Account destroyed.' });
      }
    } catch {
      setError('Destruction failed.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <Trash2 size={40} style={{ color: 'var(--color-emerald)', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 20, color: 'var(--color-white)', fontWeight: 700, marginBottom: 12 }}>Account Destroyed</h2>
        <p style={{ fontSize: 14, color: 'var(--color-mist)', marginBottom: 24 }}>All data has been permanently deleted.</p>
        <Link to="/register"><button className="cn-btn cn-btn-primary" style={{ width: '100%' }}>Create New Vault</button></Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <AlertTriangle size={40} style={{ color: 'var(--color-crimson)', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 20, color: 'var(--color-white)', fontWeight: 700 }}>Destroy Account</h2>
        <p style={{ fontSize: 13, color: 'var(--color-mist)' }}>Lost your master password and your recovery key? Wipe everything.</p>
      </div>

      <div style={{ padding: '14px', borderRadius: 10, marginBottom: 8, background: '#ff335512', border: '1px solid #ff335525' }}>
        <p style={{ color: 'var(--color-crimson)', fontSize: 13, fontWeight: 600 }}>⚠️ Irreversible Action</p>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>ACCOUNT EMAIL</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="cn-input" required />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--color-ghost)', marginBottom: 6, display: 'block', fontWeight: 600 }}>CONFIRM EMAIL</label>
        <input type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className="cn-input" required />
      </div>

      {error && <div style={{ padding: 10, background: '#ff335515', color: 'var(--color-crimson)', borderRadius: 8, fontSize: 13 }}>{error}</div>}

      <button type="submit" className="cn-btn cn-btn-danger" disabled={loading} style={{ width: '100%', height: 48, marginTop: 8 }}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Delete All Data'}
      </button>
    </form>
  );
}
