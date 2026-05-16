import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Copy, Eye, EyeOff, Trash2, Edit3, Globe,
  User, Lock, KeyRound, Folder, X, Loader2, Shield
} from 'lucide-react';
import { useAuthStore, useVaultStore, useUIStore } from '../lib/store';
import { api } from '../lib/api';
import { encryptObject, decryptObject, deriveVaultKey, generateHMAC } from '../lib/crypto';
import { copyToClipboard } from '../components/AutoLock';
import { calculateSecurityScore } from '../lib/generator';

const VAULT_ICONS = {
  personal: User, work: Globe, banking: Shield, social: Globe, family: Folder, hidden: Lock,
};
const VAULT_TYPES = ['personal', 'work', 'banking', 'social', 'family'];

export default function VaultPage() {
  const { vaultId } = useParams();
  const navigate = useNavigate();
  const { encryptionKey } = useAuthStore();
  const { vaults, setVaults, activeVaultId, setActiveVault, entries, setEntries, searchQuery, setSearchQuery } = useVaultStore();
  const { openModal, closeModal, modalOpen, editingEntry, addToast } = useUIStore();
  const [decryptedEntries, setDecryptedEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [formData, setFormData] = useState({ platform: '', username: '', password: '', url: '', notes: '', tags: '' });
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultType, setNewVaultType] = useState('personal');

  // Load vaults
  useEffect(() => {
    api.getVaults().then((r) => setVaults(r.vaults || [])).catch(() => {});
  }, []);

  const loadEntries = async (vid) => {
    if (!vid || !encryptionKey) return;
    setLoading(true);
    try {
      const r = await api.getVaultEntries(vid);
      setEntries(r.entries || []);
      const vaultKey = await deriveVaultKey(encryptionKey, vid);
      const decrypted = await Promise.all(
        (r.entries || []).map(async (entry) => {
          try {
            const data = await decryptObject(entry.encrypted_blob, vaultKey);
            return { ...entry, decrypted: data };
          } catch { return { ...entry, decrypted: null }; }
        })
      );
      setDecryptedEntries(decrypted);
    } catch { setDecryptedEntries([]); }
    setLoading(false);
  };

  useEffect(() => {
    const vid = vaultId || activeVaultId || (vaults.length > 0 ? vaults[0]?.vault_id : null);
    if (vid && vid !== activeVaultId) setActiveVault(vid);
    if (vid) loadEntries(vid);
  }, [vaultId, vaults, activeVaultId, encryptionKey]);

  const filtered = useMemo(() => {
    if (!searchQuery) return decryptedEntries;
    const q = searchQuery.toLowerCase();
    return decryptedEntries.filter((e) =>
      e.decrypted && (
        e.decrypted.platform?.toLowerCase().includes(q) ||
        e.decrypted.username?.toLowerCase().includes(q) ||
        e.decrypted.tags?.toLowerCase().includes(q)
      )
    );
  }, [decryptedEntries, searchQuery]);

  const toggleReveal = (id) => setRevealedPasswords((p) => ({ ...p, [id]: !p[id] }));
  const handleCopy = (text, label) => {
    copyToClipboard(text, () => addToast({ type: 'success', message: `${label} copied. Auto-clears in 30s.` }));
  };

  const handleSaveEntry = async () => {
    if (!activeVaultId || !encryptionKey) return;
    setLoading(true);
    try {
      const vaultKey = await deriveVaultKey(encryptionKey, activeVaultId);
      const entryData = { ...formData, createdAt: new Date().toISOString() };
      const encryptedBlob = await encryptObject(entryData, vaultKey);
      const hmac = await generateHMAC(encryptedBlob, vaultKey);
      const score = calculateSecurityScore(formData.password);

      if (editingEntry) {
        await api.updateEntry(editingEntry.entry_id, { encryptedBlob, hmac, securityScore: score });
        addToast({ type: 'success', message: 'Credential updated.' });
      } else {
        await api.createEntry({ vaultId: activeVaultId, encryptedBlob, hmac, securityScore: score });
        addToast({ type: 'success', message: 'Credential saved.' });
      }
      closeModal();
      setFormData({ platform: '', username: '', password: '', url: '', notes: '', tags: '' });
      await loadEntries(activeVaultId);
    } catch {
      addToast({ type: 'error', message: 'Failed to save credential.' });
    }
    setLoading(false);
  };

  const handleCreateVault = async () => {
    if (!newVaultName.trim() || !encryptionKey) return;
    setLoading(true);
    try {
      await api.createVault({
        encryptedVaultKey: 'vault-key-placeholder',
        vaultNameEncrypted: newVaultName.trim(),
        vaultType: newVaultType,
        visibilityMode: 'normal',
      });
      addToast({ type: 'success', message: `Vault "${newVaultName}" created.` });
      closeModal();
      setNewVaultName('');
      const r = await api.getVaults();
      setVaults(r.vaults || []);
    } catch {
      addToast({ type: 'error', message: 'Failed to create vault.' });
    }
    setLoading(false);
  };

  const handleDelete = async (entryId) => {
    if (!confirm('Delete this credential permanently?')) return;
    try {
      await api.deleteEntry(entryId);
      setDecryptedEntries((prev) => prev.filter((e) => e.entry_id !== entryId));
      addToast({ type: 'success', message: 'Credential deleted.' });
    } catch {
      addToast({ type: 'error', message: 'Delete failed.' });
    }
  };

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--color-white)' }}>Vault Explorer</h1>
          <p style={{ color: 'var(--color-mist)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{filtered.length} ENCRYPTED CREDENTIALS</p>
        </div>
        <button className="cn-btn cn-btn-primary" onClick={() => { setFormData({ platform: '', username: '', password: '', url: '', notes: '', tags: '' }); openModal('addEntry'); }}>
          <Plus size={18} /> Add Credential
        </button>
      </motion.div>

      {/* Vault tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
        {vaults.filter((v) => v.visibility_mode !== 'decoy').map((vault) => {
          const Icon = VAULT_ICONS[vault.vault_type] || Folder;
          const isActive = vault.vault_id === activeVaultId;
          return (
            <button key={vault.vault_id}
              onClick={() => { setActiveVault(vault.vault_id); navigate(`/vault/${vault.vault_id}`); }}
              style={{
                padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: isActive ? '#00f0ff12' : '#ffffff08',
                color: isActive ? 'var(--color-cyber)' : 'var(--color-cloud)',
                borderBottom: isActive ? '2px solid var(--color-cyber)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} /> {vault.vault_name_encrypted || vault.vault_type}
            </button>
          );
        })}
        <button onClick={() => openModal('createVault')}
          style={{
            padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
            border: '1px dashed var(--color-ghost)',
            background: '#00f0ff08', color: 'var(--color-cyber)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
          <Plus size={14} /> New Vault
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ghost)' }} />
        <input className="cn-input" placeholder="Search credentials..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: 44 }} />
      </div>

      {/* Entries List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-mist)' }}><Loader2 size={24} className="animate-spin" /></div>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-ghost)' }}>
              <Lock size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>No credentials found</p>
            </div>
          )}
          {filtered.map((entry, i) => {
            const d = entry.decrypted;
            if (!d) return null;
            const revealed = revealedPasswords[entry.entry_id];
            return (
              <motion.div key={entry.entry_id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.03 }}
                className="glass-panel glass-panel-hover"
                style={{ padding: '16px 20px' }}
              >
                {/* Top row: platform + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${entry.security_score >= 70 ? 'var(--color-emerald)' : entry.security_score >= 40 ? 'var(--color-amber)' : 'var(--color-crimson)'}20, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: 'var(--color-white)',
                  }}>
                    {d.platform?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-white)', fontSize: 15 }}>{d.platform}</div>
                    <div style={{ color: 'var(--color-mist)', fontSize: 12, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.username}</div>
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0,
                    background: entry.security_score >= 70 ? '#00ff8815' : entry.security_score >= 40 ? '#ffaa0015' : '#ff335515',
                    color: entry.security_score >= 70 ? 'var(--color-emerald)' : entry.security_score >= 40 ? 'var(--color-amber)' : 'var(--color-crimson)',
                  }}>
                    {entry.security_score}%
                  </div>
                </div>

                {/* Password row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: '#ffffff04', borderRadius: 8,
                }}>
                  <div style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, color: revealed ? 'var(--color-white)' : 'var(--color-ghost)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    userSelect: revealed ? 'text' : 'none',
                  }}>
                    {revealed ? d.password : '••••••••••••'}
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => toggleReveal(entry.entry_id)} title={revealed ? 'Hide' : 'Reveal'}
                      style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-mist)', display: 'flex' }}>
                      {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={() => handleCopy(d.password, 'Password')} title="Copy"
                      style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-cyber)', display: 'flex' }}>
                      <Copy size={16} />
                    </button>
                    <button onClick={() => { setFormData(d); openModal('addEntry', entry); }} title="Edit"
                      style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-mist)', display: 'flex' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(entry.entry_id)} title="Delete"
                      style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-crimson)', display: 'flex' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add/Edit Entry Modal */}
      <AnimatePresence>
        {modalOpen === 'addEntry' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-panel" style={{ width: '100%', maxWidth: 460, padding: '28px 24px', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-white)' }}>
                  {editingEntry ? 'Edit Credential' : 'Add Credential'}
                </h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ghost)', padding: 4 }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'platform', label: 'PLATFORM / APP', placeholder: 'e.g., GitHub, Netflix' },
                  { key: 'username', label: 'USERNAME / EMAIL', placeholder: 'your@email.com' },
                  { key: 'password', label: 'PASSWORD', placeholder: 'Enter or generate password', mono: true },
                  { key: 'url', label: 'URL', placeholder: 'https://...' },
                  { key: 'tags', label: 'TAGS', placeholder: 'social, dev, finance' },
                ].map(({ key, label, placeholder, mono }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: 'var(--color-ghost)', marginBottom: 4, display: 'block', fontWeight: 600 }}>{label}</label>
                    <input className={`cn-input ${mono ? 'cn-input-mono' : ''}`} value={formData[key] || ''}
                      onChange={(e) => setFormData((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: 'var(--color-ghost)', marginBottom: 4, display: 'block', fontWeight: 600 }}>NOTES</label>
                  <textarea className="cn-input" value={formData.notes || ''}
                    onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Secure notes..." rows={3} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button className="cn-btn cn-btn-ghost" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
                <button className="cn-btn cn-btn-primary" onClick={handleSaveEntry} disabled={loading} style={{ flex: 1 }}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <><KeyRound size={18} /> {editingEntry ? 'Update' : 'Save'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Vault Modal */}
      <AnimatePresence>
        {modalOpen === 'createVault' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-panel" style={{ width: '100%', maxWidth: 400, padding: '28px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-white)' }}>Create New Vault</h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ghost)' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--color-ghost)', marginBottom: 4, display: 'block', fontWeight: 600 }}>VAULT NAME</label>
                  <input className="cn-input" value={newVaultName} onChange={(e) => setNewVaultName(e.target.value)} placeholder="e.g., Work, Family, Banking" autoFocus />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--color-ghost)', marginBottom: 4, display: 'block', fontWeight: 600 }}>TYPE</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {VAULT_TYPES.map((t) => (
                      <button key={t} onClick={() => setNewVaultType(t)}
                        style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: newVaultType === t ? '#00f0ff15' : '#ffffff06',
                          color: newVaultType === t ? 'var(--color-cyber)' : 'var(--color-mist)',
                          fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
                        }}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button className="cn-btn cn-btn-ghost" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
                <button className="cn-btn cn-btn-primary" onClick={handleCreateVault} disabled={!newVaultName.trim() || loading} style={{ flex: 1 }}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <><Folder size={18} /> Create Vault</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
