// src/App.jsx
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'; // Import Toaster
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import HomestayDetailPage from './pages/HomestayDetailPage'
import MyBookingsPage from './pages/MyBookingsPage'
import ProfilePage from './pages/ProfilePage'
import MyFavoritesPage from './pages/MyFavoritesPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MyComplaintsPage from './pages/MyComplaintsPage'
import OwnerLoginPage from './pages/OwnerLoginPage' // (Route của Chủ Homestay)
import OwnerDashboardPage from './pages/OwnerDashboardPage' // (Route của Chủ Homestay)
import OwnerRegisterPage from './pages/OwnerRegisterPage'
import OwnerForgotPasswordPage from './pages/OwnerForgotPasswordPage'
import OwnerResetPasswordPage from './pages/OwnerResetPasswordPage'
import OwnerHomestaysPage from './pages/OwnerHomestaysPage'
import OwnerBookingsPage from './pages/OwnerBookingsPage'
import OwnerComplaintsPage from './pages/OwnerComplaintsPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminOwnersPage from './pages/AdminOwnersPage'
import AdminComplaintsPage from './pages/AdminComplaintsPage'
import AdminHomestaysPage from './pages/AdminHomestaysPage'
import AdminBookingsPage from './pages/AdminBookingsPage'
import './App.css'

function App() {
  return (
    <> {/* <-- Thẻ bọc (Fragment) - KHÔNG CÓ DẤU {} */}
    
      <Routes>
        {/* Routes cho Người Dùng */}
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/homestays/:id" element={<HomestayDetailPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/my-favorites" element={<MyFavoritesPage />} />
        <Route path="/my-complaints" element={<MyComplaintsPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        
        {/* Routes cho Chủ Homestay */}
        <Route path="/owner/login" element={<OwnerLoginPage />} />
        <Route path="/owner/dashboard" element={<OwnerDashboardPage />} />
        <Route path="/owner/register" element={<OwnerRegisterPage />} />
        <Route path="/owner/forgot-password" element={<OwnerForgotPasswordPage />} />
        <Route path="/owner/reset-password/:token" element={<OwnerResetPasswordPage />} />
        <Route path="/owner/homestays" element={<OwnerHomestaysPage />} />
        <Route path="/owner/bookings" element={<OwnerBookingsPage />} />
        <Route path="/owner/complaints" element={<OwnerComplaintsPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/owners" element={<AdminOwnersPage />} />
        <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
        <Route path="/admin/homestays" element={<AdminHomestaysPage />} />
        <Route path="/admin/bookings" element={<AdminBookingsPage />} />

      </Routes>
      
      {/* Toaster nằm bên ngoài <Routes> */}
      <Toaster position="top-right" />
      
    </> 
  )
}

export default App