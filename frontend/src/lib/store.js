import { create } from 'zustand';
import { secureWipe } from './crypto';

export const useAuthStore = create((set, get) => {
  const hasToken = !!localStorage.getItem('cn_access_token');
  return {
    isAuthenticated: hasToken,
    userId: localStorage.getItem('cn_user_id'),
    encryptionKey: null, // Uint8Array — NEVER persisted
    // If we have a token but just loaded the app, the key isn't in memory yet, so it's locked.
    isLocked: hasToken,

    login(userId, encryptionKey) {
      localStorage.setItem('cn_user_id', userId);
      set({ isAuthenticated: true, userId, encryptionKey, isLocked: false });
    },

  lock() {
    const { encryptionKey } = get();
    if (encryptionKey) secureWipe(encryptionKey);
    set({ encryptionKey: null, isLocked: true });
  },

  unlock(encryptionKey) {
    set({ encryptionKey, isLocked: false });
  },

  logout() {
    const { encryptionKey } = get();
    if (encryptionKey) secureWipe(encryptionKey);
    localStorage.removeItem('cn_access_token');
    localStorage.removeItem('cn_refresh_token');
    localStorage.removeItem('cn_user_id');
    set({ isAuthenticated: false, userId: null, encryptionKey: null, isLocked: false });
  },
  };
});

export const useVaultStore = create((set) => ({
  vaults: [],
  activeVaultId: null,
  entries: [],
  searchQuery: '',

  setVaults: (vaults) => set({ vaults }),
  setActiveVault: (id) => set({ activeVaultId: id, entries: [] }),
  setEntries: (entries) => set({ entries }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
  updateEntry: (id, data) => set((s) => ({
    entries: s.entries.map((e) => (e.entry_id === id ? { ...e, ...data } : e)),
  })),
  removeEntry: (id) => set((s) => ({
    entries: s.entries.filter((e) => e.entry_id !== id),
  })),
}));

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  modalOpen: null, // 'addEntry' | 'editEntry' | 'generator' | 'createVault' | null
  editingEntry: null,
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal: (name, data) => set({ modalOpen: name, editingEntry: data || null }),
  closeModal: () => set({ modalOpen: null, editingEntry: null }),
  addToast: (toast) => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
}));
