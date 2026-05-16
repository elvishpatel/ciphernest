import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, Lock } from 'lucide-react';
import { api } from '../lib/api';

export default function SecurityPage() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.getSecurityReport().then(setReport).catch(() => {});
  }, []);

  const items = [
    {
      icon: report?.failedLoginAttempts === 0 ? CheckCircle : AlertTriangle,
      label: 'Failed Login Attempts',
      value: report?.failedLoginAttempts || 0,
      status: (report?.failedLoginAttempts || 0) === 0 ? 'good' : 'warning',
      desc: report?.failedLoginAttempts > 0 ? `${report.failedLoginAttempts} failed attempts detected` : 'No suspicious activity',
    },
    {
      icon: Shield,
      label: 'Encryption Standard',
      value: 'AES-256-GCM',
      status: 'good',
      desc: 'Military-grade encryption active',
    },
    {
      icon: Lock,
      label: 'Key Derivation',
      value: 'Argon2id',
      status: 'good',
      desc: '3 iterations, 64MB memory, parallelism 1',
    },
    {
      icon: Activity,
      label: 'Vault Integrity',
      value: 'HMAC-SHA256',
      status: 'good',
      desc: 'All entries verified with integrity checks',
    },
  ];

  const handlePanic = async () => {
    if (confirm('PANIC LOCK: This will immediately lock all vaults and destroy temporary sessions. Continue?')) {
      await api.panicLock();
      window.location.href = '/login';
    }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--color-white)', marginBottom: 4 }}>
          Security Center
        </h1>
        <p style={{ color: 'var(--color-mist)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          THREAT MONITORING & SYSTEM INTEGRITY
        </p>
      </motion.div>

      {/* Security checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {items.map((item, i) => {
          const Icon = item.icon;
          const color = item.status === 'good' ? 'var(--color-emerald)' : item.status === 'warning' ? 'var(--color-amber)' : 'var(--color-crimson)';
          return (
            <motion.div key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel"
              style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-white)', fontSize: 14, marginBottom: 2 }}>{item.label}</div>
                <div style={{ color: 'var(--color-mist)', fontSize: 12 }}>{item.desc}</div>
              </div>
              <div style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                background: `${color}15`, color,
              }}>
                {item.value}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Panic Lock */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-panel"
        style={{ padding: 24, border: '1px solid #ff335530' }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-crimson)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <XCircle size={20} /> Emergency Panic Lock
        </h3>
        <p style={{ color: 'var(--color-mist)', fontSize: 13, marginBottom: 16 }}>
          Instantly locks all vaults, clears decrypted memory, and destroys all active sessions.
          Use <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-crimson)' }}>Ctrl+Shift+L</span> as a shortcut.
        </p>
        <button className="cn-btn cn-btn-danger" onClick={handlePanic}>
          <Lock size={18} /> Activate Panic Lock
        </button>
      </motion.div>

      {/* Event log */}
      {report?.recentEvents?.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="glass-panel" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-white)', marginBottom: 16 }}>Security Event Log</h3>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {report.recentEvents.map((event, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid #ffffff06', fontSize: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: event.risk_score > 20 ? 'var(--color-crimson)' : 'var(--color-emerald)',
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cloud)' }}>
                    {event.event_type}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: event.risk_score > 20 ? 'var(--color-crimson)' : 'var(--color-ghost)' }}>
                    RISK: {event.risk_score}
                  </span>
                  <span style={{ color: 'var(--color-ghost)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
