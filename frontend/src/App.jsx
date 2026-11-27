import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import MenuManagement from './pages/MenuManagement';
import Categories from './pages/Categories';
import Modifiers from './pages/Modifiers';
import Promos from './pages/Promos';
import Banners from './pages/Banners';
import { homePathForRole } from './utils/roles';
import Transactions from './pages/Transactions';
import TransactionDetail from './pages/TransactionDetail';
import Settings from './pages/Settings';
import Users from './pages/Users';
import ShiftHistory from './pages/ShiftHistory';
import SelfOrder from './pages/SelfOrder';
import SelfOrderStatus from './pages/SelfOrderStatus';
import KitchenDisplay from './pages/KitchenDisplay';
import ErrorBoundary from './components/common/ErrorBoundary';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading" style={{ height: '100vh' }}><div className="spinner" /></div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePathForRole(user.role)} replace /> : <Login />} />

      <Route path="/" element={
        <ProtectedRoute><Layout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to={homePathForRole(user?.role)} replace />} />
        <Route path="dashboard" element={
          <ProtectedRoute allowedRoles={['owner']}><Dashboard /></ProtectedRoute>
        } />
        <Route path="menu" element={
          <ProtectedRoute allowedRoles={['owner']}><MenuManagement /></ProtectedRoute>
        } />
        <Route path="categories" element={
          <ProtectedRoute allowedRoles={['owner']}><Categories /></ProtectedRoute>
        } />
        <Route path="modifiers" element={
          <ProtectedRoute allowedRoles={['owner']}><Modifiers /></ProtectedRoute>
        } />
        <Route path="promos" element={
          <ProtectedRoute allowedRoles={['owner', 'promo']}><Promos /></ProtectedRoute>
        } />
        <Route path="banners" element={
          <ProtectedRoute allowedRoles={['owner', 'promo']}><Banners /></ProtectedRoute>
        } />
        <Route path="transactions" element={
          <ProtectedRoute allowedRoles={['owner', 'cashier']}><Transactions /></ProtectedRoute>
        } />
        <Route path="transactions/:id" element={
          <ProtectedRoute allowedRoles={['owner', 'cashier']}><TransactionDetail /></ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute allowedRoles={['owner']}><Settings /></ProtectedRoute>
        } />
        <Route path="users" element={
          <ProtectedRoute allowedRoles={['owner']}><Users /></ProtectedRoute>
        } />
        <Route path="shifts" element={
          <ProtectedRoute allowedRoles={['owner']}><ShiftHistory /></ProtectedRoute>
        } />
      </Route>

      {/* POS gets full screen (no sidebar) */}
      <Route path="/pos" element={
        <ProtectedRoute allowedRoles={['owner', 'cashier']}><POS /></ProtectedRoute>
      } />

      {/* Kitchen Display System (Full Screen) */}
      <Route path="/kitchen" element={
        <ProtectedRoute allowedRoles={['owner', 'kitchen']}><KitchenDisplay /></ProtectedRoute>
      } />

      {/* Public Self-Order Routes */}
      <Route path="/order" element={<SelfOrder />} />
      <Route path="/order/status/:id" element={<SelfOrderStatus />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}




export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-center" reverseOrder={false} />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
