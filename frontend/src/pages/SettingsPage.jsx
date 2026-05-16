import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogOut, Lock, Trash2, Clock, Shield, Clipboard, Keyboard, Fingerprint, LifeBuoy } from 'lucide-react';
import { useAuthStore, useUIStore } from '../lib/store';
import { api } from '../lib/api';
import { setupBiometricAuth, generateRecoveryKey, hashRecoveryKey, encryptWithRecoveryKey, parseRecoveryKey } from '../lib/crypto';

export default function SettingsPage() {
  const { logout, encryptionKey } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const [hasBiometric, setHasBiometric] = useState(false);
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState('');
  const [isGeneratingRecovery, setIsGeneratingRecovery] = useState(false);

  useEffect(() => {
    setHasBiometric(!!localStorage.getItem('cn_bio_id'));
  }, []);

  const handleLogout = () => {
    logout();
    api.clearTokens();
    navigate('/login');
  };

  const handleClearCache = () => {
    if (window.indexedDB) {
      window.indexedDB.deleteDatabase('ciphernest-cache');
      addToast({ type: 'success', message: 'Local cache cleared.' });
    }
  };

  const handleToggleBiometric = async () => {
    if (hasBiometric) {
      localStorage.removeItem('cn_bio_id');
      localStorage.removeItem('cn_bio_key');
      setHasBiometric(false);
      addToast({ type: 'success', message: 'Biometric unlock disabled.' });
    } else {
      try {
        const success = await setupBiometricAuth(encryptionKey);
        if (success) {
          setHasBiometric(true);
          addToast({ type: 'success', message: 'Biometric unlock enabled.' });
        }
      } catch (err) {
        addToast({ type: 'error', message: err.message || 'Failed to setup biometric auth.' });
      }
    }
  };

  const handleGenerateRecoveryKit = async () => {
    if (!encryptionKey) {
      addToast({ type: 'error', message: 'Vault is locked. Cannot generate recovery kit.' });
      return;
    }
    if (!confirm('This will invalidate any previously generated recovery kits. Continue?')) return;
    
    setIsGeneratingRecovery(true);
    try {
      const keyStr = generateRecoveryKey();
      const recoveryBytes = parseRecoveryKey(keyStr);
      const recoveryAuthHash = await hashRecoveryKey(recoveryBytes);
      const recoveryKeyBlob = await encryptWithRecoveryKey(encryptionKey, recoveryBytes);
      
      const res = await api.setupRecovery({ recoveryAuthHash, recoveryKeyBlob });
      if (res.error) throw new Error(res.error);
      
      setGeneratedRecoveryKey(keyStr);
      addToast({ type: 'success', message: 'Recovery kit generated successfully.' });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to generate recovery kit.' });
    }
    setIsGeneratingRecovery(false);
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--color-white)', marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ color: 'var(--color-mist)', fontSize: 14 }}>Manage your vault preferences</p>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Security Settings */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-white)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} style={{ color: 'var(--color-cyber)' }} /> Security
          </h3>
          {[
            { icon: Clock, label: 'Auto-lock', desc: 'Vault locks after 5 minutes of inactivity' },
            { icon: Clipboard, label: 'Clipboard auto-clear', desc: 'Copied passwords are cleared after 30 seconds' },
            { icon: Keyboard, label: 'Panic shortcut', desc: 'Press Ctrl+Shift+L to instantly lock your vault' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 0', borderBottom: '1px solid #ffffff06',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: '#00f0ff0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <item.icon size={16} style={{ color: 'var(--color-cyber)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, color: 'var(--color-white)', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-mist)', marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 0', borderBottom: '1px solid #ffffff06',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: hasBiometric ? '#00ff8815' : '#00f0ff0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Fingerprint size={16} style={{ color: hasBiometric ? 'var(--color-emerald)' : 'var(--color-cyber)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, color: 'var(--color-white)', fontWeight: 500 }}>Biometric Unlock</div>
                <div style={{ fontSize: 12, color: 'var(--color-mist)', marginTop: 2 }}>Use TouchID/FaceID to unlock this device</div>
              </div>
            </div>
            <button onClick={handleToggleBiometric} className={`cn-btn ${hasBiometric ? 'cn-btn-ghost' : 'cn-btn-primary'}`} style={{ padding: '8px 16px', fontSize: 13 }}>
              {hasBiometric ? 'Disable' : 'Enable'}
            </button>
          </div>
          
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: '#ffaa0015',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LifeBuoy size={16} style={{ color: 'var(--color-amber)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, color: 'var(--color-white)', fontWeight: 500 }}>Emergency Recovery Kit</div>
                <div style={{ fontSize: 12, color: 'var(--color-mist)', marginTop: 2 }}>Generate a key to recover a forgotten password</div>
              </div>
            </div>
            <button onClick={handleGenerateRecoveryKit} disabled={isGeneratingRecovery} className="cn-btn cn-btn-ghost" style={{ padding: '8px 16px', fontSize: 13, color: 'var(--color-amber)', borderColor: 'var(--color-amber-glow)' }}>
              {isGeneratingRecovery ? 'Generating...' : 'Generate'}
            </button>
          </div>
          
          {generatedRecoveryKey && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: 16 }}>
              <div style={{ padding: '16px', borderRadius: 12, background: '#ffaa000a', border: '1px solid #ffaa0030' }}>
                <p style={{ color: 'var(--color-amber)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  ⚠️ Save this Recovery Key securely! It will never be shown again.
                </p>
                <div style={{
                  padding: '12px', background: 'var(--color-void)', borderRadius: 8,
                  fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--color-white)',
                  letterSpacing: '0.05em', textAlign: 'center', border: '1px solid #ffffff10',
                  userSelect: 'all'
                }}>
                  {generatedRecoveryKey}
                </div>
              </div>
            </motion.div>
          )}

        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-white)', marginBottom: 16 }}>Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="cn-btn cn-btn-ghost" onClick={handleClearCache} style={{ justifyContent: 'flex-start' }}>
              <Trash2 size={16} /> Clear local cache
            </button>
            <button className="cn-btn cn-btn-ghost" onClick={() => { useAuthStore.getState().lock(); navigate('/login?locked=true'); }}
              style={{ justifyContent: 'flex-start', color: 'var(--color-amber)' }}>
              <Lock size={16} /> Lock vault now
            </button>
            <button className="cn-btn cn-btn-danger" onClick={handleLogout} style={{ justifyContent: 'flex-start' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
