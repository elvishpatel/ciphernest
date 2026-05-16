import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPage from './pages/ResetPage';
import DashboardPage from './pages/DashboardPage';
import VaultPage from './pages/VaultPage';
import GeneratorPage from './pages/GeneratorPage';
import SecurityPage from './pages/SecurityPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';
import AutoLock from './components/AutoLock';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLocked } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (isLocked) return <Navigate to="/login?locked=true" />;
  return children;
}

export default function App() {
  return (
    <>
      <AutoLock />
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="vault/:vaultId" element={<VaultPage />} />
          <Route path="generator" element={<GeneratorPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
