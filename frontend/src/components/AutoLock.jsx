import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../lib/store';

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
let timer = null;
let clipboardTimer = null;

export default function AutoLock() {
  const { isAuthenticated, isLocked, lock } = useAuthStore();

  const resetTimer = useCallback(() => {
    if (timer) clearTimeout(timer);
    if (isAuthenticated && !isLocked) {
      timer = setTimeout(() => lock(), LOCK_TIMEOUT);
    }
  }, [isAuthenticated, isLocked, lock]);

  useEffect(() => {
    if (!isAuthenticated || isLocked) return;

    const events = ['mousedown', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    // Lock on tab hidden
    const handleVisibility = () => {
      if (document.hidden) {
        timer = setTimeout(() => lock(), 60000); // 1 min when hidden
      } else {
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Panic shortcut: Ctrl+Shift+L
    const handlePanic = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        lock();
      }
    };
    window.addEventListener('keydown', handlePanic);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('keydown', handlePanic);
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, isLocked, lock, resetTimer]);

  return null;
}

// Clipboard auto-clear utility
export function copyToClipboard(text, onCopy) {
  navigator.clipboard.writeText(text);
  if (onCopy) onCopy();
  if (clipboardTimer) clearTimeout(clipboardTimer);
  clipboardTimer = setTimeout(() => {
    navigator.clipboard.writeText('').catch(() => {});
  }, 30000); // Clear after 30 seconds
}
