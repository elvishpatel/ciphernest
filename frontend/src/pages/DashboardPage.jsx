import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Vault, KeyRound, AlertTriangle, Activity, Lock, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="glass-panel glass-panel-hover"
    style={{ padding: 24, position: 'relative', overflow: 'hidden' }}
  >
    <div style={{
      position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%',
      background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
    }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} style={{ color }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--color-mist)', fontWeight: 500 }}>{label}</span>
    </div>
    <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
      {value}
    </div>
  </motion.div>
);

export default function DashboardPage() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.getSecurityReport().then(setReport).catch(() => {});
  }, []);

  const securityScore = report ? Math.min(100, Math.max(0,
    100 - (report.failedLoginAttempts * 5)
  )) : 85;

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 36 }}
      >
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--color-white)', marginBottom: 4 }}>
          Command Center
        </h1>
        <p style={{ color: 'var(--color-mist)', fontSize: 14, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
          VAULT STATUS: <span style={{ color: 'var(--color-emerald)' }}>OPERATIONAL</span>
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon={Vault} label="Total Vaults" value={report?.totalVaults || 0} color="var(--color-cyber)" delay={0.1} />
        <StatCard icon={KeyRound} label="Credentials" value={report?.totalEntries || 0} color="var(--color-emerald)" delay={0.2} />
        <StatCard icon={AlertTriangle} label="Failed Logins" value={report?.failedLoginAttempts || 0} color="var(--color-crimson)" delay={0.3} />
        <StatCard icon={Shield} label="Security Score" value={`${securityScore}%`} color="var(--color-violet)" delay={0.4} />
      </div>

      {/* Security Score Ring */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-panel"
          style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-white)', marginBottom: 24 }}>Vault Health</h3>
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="var(--color-slate-light)" strokeWidth="8" />
              <motion.circle
                cx="80" cy="80" r="70" fill="none" strokeWidth="8" strokeLinecap="round"
                stroke={securityScore >= 80 ? 'var(--color-emerald)' : securityScore >= 50 ? 'var(--color-amber)' : 'var(--color-crimson)'}
                strokeDasharray={`${2 * Math.PI * 70}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - securityScore / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.8 }}
                transform="rotate(-90 80 80)"
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--color-white)' }}>
                {securityScore}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-mist)', fontFamily: 'var(--font-mono)' }}>SCORE</span>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-panel"
          style={{ padding: 24 }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-white)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} style={{ color: 'var(--color-cyber)' }} />
            Recent Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(report?.recentEvents || []).slice(0, 6).map((event, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8, background: '#ffffff03',
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: event.risk_score > 20 ? 'var(--color-crimson)' : 'var(--color-emerald)',
                  }} />
                  <span style={{ color: 'var(--color-cloud)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {event.event_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <span style={{ color: 'var(--color-ghost)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {(!report?.recentEvents || report.recentEvents.length === 0) && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-ghost)', fontSize: 13 }}>
                No activity recorded yet
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Encryption status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        style={{
          marginTop: 24, padding: '12px 20px', borderRadius: 10,
          background: '#00f0ff05', border: '1px solid #00f0ff10',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-cyber-dim)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={14} />
          ENCRYPTION: AES-256-GCM
        </div>
        <div>KDF: ARGON2ID (3 ITER, 64MB)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-emerald)' }} />
          ALL SYSTEMS NOMINAL
        </div>
      </motion.div>
    </div>
  );
}
