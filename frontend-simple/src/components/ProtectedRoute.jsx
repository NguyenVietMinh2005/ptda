// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export function ProtectedRoute({ children, role = 'user' }) {
  if (role === 'admin') {
    const token = localStorage.getItem('ownerAuthToken');
    const ownerStr = localStorage.getItem('ownerAuthUser');
    let owner = null;
    try {
      owner = ownerStr ? JSON.parse(ownerStr) : null;
    } catch {
      owner = null;
    }

    if (!token || !owner) {
      toast.error('Vui lòng đăng nhập với tài khoản Quản trị viên.');
      return <Navigate to="/login" replace />;
    }

    // Chỉ Admin mới được vào /admin/*
    if (owner.Quyen !== 'admin') {
      toast.error('Bạn không có quyền truy cập trang Quản trị viên (Admin).');
      return <Navigate to="/owner/dashboard" replace />;
    }
  } else if (role === 'owner') {
    const token = localStorage.getItem('ownerAuthToken');
    const ownerStr = localStorage.getItem('ownerAuthUser');
    let owner = null;
    try {
      owner = ownerStr ? JSON.parse(ownerStr) : null;
    } catch {
      owner = null;
    }

    if (!token || !owner) {
      toast.error('Vui lòng đăng nhập với tài khoản Chủ nhà để tiếp tục.');
      return <Navigate to="/login" replace />;
    }

    // Tách riêng biệt: Admin không vào Kênh Chủ nhà mà ở Dashboard Quản trị
    if (owner.Quyen === 'admin') {
      toast.error('Tài khoản Quản trị viên không thuộc phạm vi Kênh Chủ nhà.');
      return <Navigate to="/admin/dashboard" replace />;
    }

    // Chỉ tài khoản chu_homestay mới được vào /owner/*
    if (owner.Quyen !== 'chu_homestay') {
      toast.error('Tài khoản của bạn không có quyền quản lý Homestay.');
      return <Navigate to="/" replace />;
    }
  } else if (role === 'user') {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Vui lòng đăng nhập để tiếp tục.');
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
