import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Copy, Zap, Key, Hash, Shield, Lock, Code } from 'lucide-react';
import { generatePassword, calculateEntropy, getStrengthLabel } from '../lib/generator';
import { copyToClipboard } from '../components/AutoLock';
import { useUIStore } from '../lib/store';

const modes = [
  { id: 'ultra', label: 'Ultra Strong', icon: Zap, desc: 'Maximum entropy' },
  { id: 'strong', label: 'Strong', icon: Shield, desc: 'All character types' },
  { id: 'memorable', label: 'Memorable', icon: Key, desc: 'Word-based + symbols' },
  { id: 'passphrase', label: 'Passphrase', icon: Lock, desc: 'Word chain' },
  { id: 'pin', label: 'PIN', icon: Hash, desc: 'Numeric only' },
  { id: 'api-key', label: 'API Key', icon: Code, desc: 'Segmented alphanum' },
];

export default function GeneratorPage() {
  const [mode, setMode] = useState('ultra');
  const [length, setLength] = useState(24);
  const [wordCount, setWordCount] = useState(4);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeDigits, setIncludeDigits] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [history, setHistory] = useState([]);
  const { addToast } = useUIStore();

  const generate = useCallback(() => {
    const pw = generatePassword({ mode, length, wordCount, includeUpper, includeLower, includeDigits, includeSymbols });
    setPassword(pw);
    setHistory((h) => [pw, ...h].slice(0, 10));
  }, [mode, length, wordCount, includeUpper, includeLower, includeDigits, includeSymbols]);

  const entropy = calculateEntropy(password);
  const strength = getStrengthLabel(entropy);

  if (!password && history.length === 0) generate();

  return (
    <div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--color-white)', marginBottom: 4 }}>
          Password Generator
        </h1>
        <p style={{ color: 'var(--color-mist)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          CRYPTOGRAPHICALLY SECURE GENERATION
        </p>
      </motion.div>

      {/* Generated Password Display */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel" style={{ padding: 28, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: 'var(--color-white)',
          wordBreak: 'break-all', letterSpacing: '0.05em', marginBottom: 16, lineHeight: 1.6,
          minHeight: 60, display: 'flex', alignItems: 'center',
        }}>
          {password || 'Click generate...'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div key={lvl} style={{
                  width: 32, height: 4, borderRadius: 2,
                  background: lvl <= strength.level ? strength.color : 'var(--color-slate-light)',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: strength.color }}>
              {strength.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ghost)' }}>
              {entropy} bits
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cn-btn cn-btn-ghost" onClick={generate} style={{ padding: '10px 18px' }}>
              <RefreshCw size={16} /> Regenerate
            </button>
            <button className="cn-btn cn-btn-primary" onClick={() => { copyToClipboard(password); addToast({ type: 'success', message: 'Copied! Auto-clears in 30s.' }); }}
              style={{ padding: '10px 18px' }}>
              <Copy size={16} /> Copy
            </button>
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Mode Selection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-white)', marginBottom: 16 }}>Generation Mode</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {modes.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button key={m.id} onClick={() => { setMode(m.id); setTimeout(generate, 50); }}
                  style={{
                    padding: '14px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: active ? '#00f0ff10' : '#ffffff04',
                    borderLeft: active ? '2px solid var(--color-cyber)' : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon size={16} style={{ color: active ? 'var(--color-cyber)' : 'var(--color-ghost)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--color-cyber)' : 'var(--color-cloud)' }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-ghost)' }}>{m.desc}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Options */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-white)', marginBottom: 16 }}>Options</h3>

          {(mode === 'strong' || mode === 'ultra') && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--color-cloud)' }}>Length</label>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber)', fontWeight: 600 }}>{length}</span>
                </div>
                <input type="range" min={8} max={64} value={length}
                  onChange={(e) => { setLength(+e.target.value); setTimeout(generate, 50); }}
                  style={{ width: '100%', accentColor: 'var(--color-cyber)' }} />
              </div>
              {[
                { label: 'Uppercase (A-Z)', checked: includeUpper, set: setIncludeUpper },
                { label: 'Lowercase (a-z)', checked: includeLower, set: setIncludeLower },
                { label: 'Digits (0-9)', checked: includeDigits, set: setIncludeDigits },
                { label: 'Symbols (!@#$)', checked: includeSymbols, set: setIncludeSymbols },
              ].map(({ label, checked, set }) => (
                <label key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid #ffffff06', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--color-cloud)' }}>{label}</span>
                  <input type="checkbox" checked={checked}
                    onChange={(e) => { set(e.target.checked); setTimeout(generate, 50); }}
                    style={{ accentColor: 'var(--color-cyber)', width: 18, height: 18 }} />
                </label>
              ))}
            </>
          )}

          {(mode === 'memorable' || mode === 'passphrase') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--color-cloud)' }}>Word Count</label>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber)' }}>{wordCount}</span>
              </div>
              <input type="range" min={3} max={8} value={wordCount}
                onChange={(e) => { setWordCount(+e.target.value); setTimeout(generate, 50); }}
                style={{ width: '100%', accentColor: 'var(--color-cyber)' }} />
            </div>
          )}

          {mode === 'pin' && (
            <p style={{ color: 'var(--color-mist)', fontSize: 13 }}>Generates a 6-digit secure PIN.</p>
          )}
          {mode === 'api-key' && (
            <p style={{ color: 'var(--color-mist)', fontSize: 13 }}>Generates a segmented API key (4×8 chars).</p>
          )}
        </motion.div>
      </div>

      {/* Generation History */}
      {history.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="glass-panel" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-white)', marginBottom: 12 }}>Recent Generations</h3>
          {history.slice(1).map((pw, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid #ffffff04', fontSize: 13,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ghost)' }}>{pw.slice(0, 30)}{pw.length > 30 ? '...' : ''}</span>
              <button onClick={() => { copyToClipboard(pw); addToast({ type: 'success', message: 'Copied!' }); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-cyber)', padding: 4 }}>
                <Copy size={14} />
              </button>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
