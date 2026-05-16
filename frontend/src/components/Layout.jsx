import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore, useUIStore } from '../lib/store';
import {
  LayoutDashboard, Vault, KeyRound, Shield, Settings,
  LogOut, PanelLeftClose, PanelLeft, Lock
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vault', label: 'Vault', icon: Vault },
  { path: '/generator', label: 'Generator', icon: KeyRound },
  { path: '/security', label: 'Security', icon: Shield },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { logout, lock } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Desktop Sidebar */}
      <motion.aside
        className="hide-on-mobile"
        animate={{ width: sidebarOpen ? 260 : 72 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          background: 'var(--color-abyss)',
          borderRight: '1px solid #ffffff08',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--color-cyber) 0%, var(--color-emerald) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Lock size={20} style={{ color: 'var(--color-void)' }} />
          </div>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--color-white)' }}>
                CipherNest
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-ghost)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                ZERO KNOWLEDGE
              </div>
            </motion.div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                textDecoration: 'none',
                color: isActive ? 'var(--color-cyber)' : 'var(--color-mist)',
                background: isActive ? '#00f0ff0a' : 'transparent',
                borderLeft: isActive ? '2px solid var(--color-cyber)' : '2px solid transparent',
                transition: 'all 0.2s',
                fontSize: 14, fontWeight: 500,
              })}
            >
              <Icon size={20} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #ffffff08', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={toggleSidebar}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              background: 'transparent', border: 'none',
              color: 'var(--color-ghost)', cursor: 'pointer',
              fontSize: 14, width: '100%', textAlign: 'left',
            }}
          >
            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            {sidebarOpen && <span>Collapse</span>}
          </button>
          <button
            onClick={() => lock()}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              background: 'transparent', border: 'none',
              color: 'var(--color-amber)', cursor: 'pointer',
              fontSize: 14, width: '100%', textAlign: 'left',
            }}
          >
            <Lock size={20} />
            {sidebarOpen && <span>Lock Vault</span>}
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              background: 'transparent', border: 'none',
              color: 'var(--color-crimson)', cursor: 'pointer',
              fontSize: 14, width: '100%', textAlign: 'left',
            }}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Bottom Navigation */}
      <nav className="show-on-mobile" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0a0a12e6',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid #ffffff10',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 8px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
      }}>
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              textDecoration: 'none',
              color: isActive ? 'var(--color-cyber)' : 'var(--color-mist)',
              fontSize: 10, fontWeight: 500,
              padding: '4px 8px',
              borderRadius: 8,
              background: isActive ? '#00f0ff0a' : 'transparent',
            })}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="main-content" style={{
        flex: 1,
        marginLeft: sidebarOpen ? 260 : 72,
        transition: 'margin-left 0.3s ease',
        padding: '32px 40px',
        minHeight: '100vh',
      }}>
        {/* Mobile Header Bar (Visible only on mobile) */}
        <div className="show-on-mobile" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #ffffff08'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--color-cyber) 0%, var(--color-emerald) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={16} style={{ color: 'var(--color-void)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--color-white)' }}>
              CipherNest
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => lock()} style={{ background: 'none', border: 'none', color: 'var(--color-amber)', padding: 4 }}>
              <Lock size={20} />
            </button>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--color-crimson)', padding: 4 }}>
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
