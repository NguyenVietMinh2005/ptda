// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Public & Customer Pages
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import HomestayDetailPage from './pages/HomestayDetailPage';
import MyBookingsPage from './pages/MyBookingsPage';
import ProfilePage from './pages/ProfilePage';
import MyFavoritesPage from './pages/MyFavoritesPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MyComplaintsPage from './pages/MyComplaintsPage';

// Owner Auth Pages
import OwnerLoginPage from './pages/OwnerLoginPage';
import OwnerRegisterPage from './pages/OwnerRegisterPage';
import OwnerForgotPasswordPage from './pages/OwnerForgotPasswordPage';
import OwnerResetPasswordPage from './pages/OwnerResetPasswordPage';

// Owner Protected Pages
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import OwnerHomestaysPage from './pages/OwnerHomestaysPage';
import OwnerBookingsPage from './pages/OwnerBookingsPage';
import OwnerCalendarPage from './pages/OwnerCalendarPage';
import OwnerTransactionsPage from './pages/OwnerTransactionsPage';
import OwnerComplaintsPage from './pages/OwnerComplaintsPage';
import OwnerProfilePage from './pages/OwnerProfilePage';

// Admin Protected Pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminOwnersPage from './pages/AdminOwnersPage';
import AdminHomestaysPage from './pages/AdminHomestaysPage';
import AdminBookingsPage from './pages/AdminBookingsPage';
import AdminTransactionsPage from './pages/AdminTransactionsPage';
import AdminReviewsPage from './pages/AdminReviewsPage';
import AdminComplaintsPage from './pages/AdminComplaintsPage';

// Route Protection
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <>
      <Routes>
        {/* --- Public & Guest Routes --- */}
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/homestays/:id" element={<HomestayDetailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* --- Customer Protected Routes --- */}
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute role="user">
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute role="user">
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-favorites"
          element={
            <ProtectedRoute role="user">
              <MyFavoritesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-complaints"
          element={
            <ProtectedRoute role="user">
              <MyComplaintsPage />
            </ProtectedRoute>
          }
        />

        {/* --- Owner Auth Routes (Chuyển hướng cổng đăng nhập cũ về /login) --- */}
        <Route path="/owner/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/owner/register" element={<OwnerRegisterPage />} />
        <Route path="/owner/forgot-password" element={<OwnerForgotPasswordPage />} />
        <Route path="/owner/reset-password/:token" element={<OwnerResetPasswordPage />} />

        {/* --- Owner Protected Routes --- */}
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedRoute role="owner">
              <OwnerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/homestays"
          element={
            <ProtectedRoute role="owner">
              <OwnerHomestaysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/calendar"
          element={
            <ProtectedRoute role="owner">
              <OwnerCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/bookings"
          element={
            <ProtectedRoute role="owner">
              <OwnerBookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/transactions"
          element={
            <ProtectedRoute role="owner">
              <OwnerTransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/complaints"
          element={
            <ProtectedRoute role="owner">
              <OwnerComplaintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/profile"
          element={
            <ProtectedRoute role="owner">
              <OwnerProfilePage />
            </ProtectedRoute>
          }
        />

        {/* --- Admin Protected Routes --- */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute role="admin">
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/owners"
          element={
            <ProtectedRoute role="admin">
              <AdminOwnersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/homestays"
          element={
            <ProtectedRoute role="admin">
              <AdminHomestaysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <ProtectedRoute role="admin">
              <AdminBookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <ProtectedRoute role="admin">
              <AdminTransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <ProtectedRoute role="admin">
              <AdminReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/complaints"
          element={
            <ProtectedRoute role="admin">
              <AdminComplaintsPage />
            </ProtectedRoute>
          }
        />
      </Routes>

      <Toaster position="top-right" />
    </>
  );
}

export default App;