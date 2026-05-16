import { useUIStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: 'var(--color-emerald)',
  warning: 'var(--color-amber)',
  error: 'var(--color-crimson)',
  info: 'var(--color-cyber)',
};

export default function ToastContainer() {
  const { toasts } = useUIStore();

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info;
          const color = colors[toast.type] || colors.info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="glass-panel"
              style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minWidth: 300,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <Icon size={18} style={{ color, flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--color-pearl)' }}>{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
