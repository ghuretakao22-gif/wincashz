import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LiveDropTicker from './components/LiveDropTicker';
import PinGate from './components/PinGate';
import { api } from './services/api';

// Synchronous Core Public Pages (Instant Load)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Lazy-Loaded Member Pages
const EarnPage = lazy(() => import('./pages/EarnPage'));
const CashoutPage = lazy(() => import('./pages/CashoutPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Lazy-Loaded Admin Pages (Code-split so regular members never load admin code)
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminCompletedOffersPage = lazy(() => import('./pages/AdminCompletedOffersPage'));
const AdminChargebacksPage = lazy(() => import('./pages/AdminChargebacksPage'));
const AdminOfferwallsPage = lazy(() => import('./pages/AdminOfferwallsPage'));
const AdminFeaturedPage = lazy(() => import('./pages/AdminFeaturedPage'));
const AdminWithdrawalsPage = lazy(() => import('./pages/AdminWithdrawalsPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));
const AdminSitePinPage = lazy(() => import('./pages/AdminSitePinPage'));

// Lazy-Loaded Moderator Portal (Strictly Isolated & Read-Only)
const ModeratorLayout = lazy(() => import('./components/ModeratorLayout'));
const ModeratorUsersPage = lazy(() => import('./pages/ModeratorUsersPage'));

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#070a0e] flex items-center justify-center text-brand-400 font-bold font-mono text-sm animate-pulse">
      Loading Wincashz...
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <PageFallback />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#070a0e] pb-16 md:pb-0 overflow-x-hidden">
      <Navbar />
      <LiveDropTicker />
      <main className="flex-1 max-w-full">{children}</main>
      <Footer />
    </div>
  );
}

// Global Site Access PIN Gate Guard
function GlobalPinGate({ children }) {
  const { isAdmin, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [hasPin, setHasPin] = useState(false);
  const [checkingPin, setCheckingPin] = useState(true);
  const [pinVerified, setPinVerified] = useState(() => {
    try {
      return sessionStorage.getItem('wincashz_pin_verified') === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    let active = true;
    api.getSitePinStatus()
      .then((res) => {
        if (active) {
          setHasPin(!!res?.has_pin);
        }
      })
      .catch(() => {
        if (active) {
          setHasPin(false);
        }
      })
      .finally(() => {
        if (active) {
          setCheckingPin(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Exclude admin bypass routes and authenticated administrators
  const isAdminBypass =
    location.pathname === '/admin/login' ||
    location.pathname.startsWith('/admin/login') ||
    new URLSearchParams(location.search).get('admin') === '1' ||
    isAdmin;

  if (isAdminBypass) {
    return children;
  }

  if (checkingPin || authLoading) {
    return <PageFallback />;
  }

  // If server has no PIN configured, allow access directly
  if (!hasPin) {
    return children;
  }

  // If already verified in this session, allow access directly
  if (pinVerified) {
    return children;
  }

  // Context-aware purpose prompt
  const purpose = location.pathname.includes('register')
    ? 'Sign Up'
    : location.pathname.includes('login')
    ? 'Sign In'
    : 'Wincashz';

  return (
    <PinGate
      purpose={purpose}
      onVerified={() => {
        try {
          sessionStorage.setItem('wincashz_pin_verified', 'true');
        } catch (e) {}
        setPinVerified(true);
      }}
      onAdminBypass={() => {
        navigate('/admin/login');
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <GlobalPinGate>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public / Member Routes */}
              <Route
                path="/"
                element={
                  <MainLayout>
                    <LandingPage />
                  </MainLayout>
                }
              />
              <Route
                path="/home"
                element={
                  <MainLayout>
                    <LandingPage />
                  </MainLayout>
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/earn"
                element={
                  <MainLayout>
                    <EarnPage />
                  </MainLayout>
                }
              />
              <Route
                path="/cashout"
                element={
                  <MainLayout>
                    <CashoutPage />
                  </MainLayout>
                }
              />
              <Route
                path="/payment"
                element={<Navigate to="/cashout" replace />}
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <DashboardPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <ProfilePage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="completed-offers" element={<AdminCompletedOffersPage />} />
                <Route path="chargebacks" element={<AdminChargebacksPage />} />
                <Route path="offerwalls" element={<AdminOfferwallsPage />} />
                <Route path="featured" element={<AdminFeaturedPage />} />
                <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
                <Route path="pin" element={<AdminSitePinPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>

              {/* Moderator Routes (Strictly Isolated & Read-Only) */}
              <Route path="/moderator" element={<ModeratorLayout />}>
                <Route index element={<Navigate to="/moderator/users" replace />} />
                <Route path="users" element={<ModeratorUsersPage />} />
              </Route>

              {/* Catch-all Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </GlobalPinGate>
      </Router>
    </AuthProvider>
  );
}
