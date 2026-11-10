// src/pages/LoginPage.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './Form.css';
import { toast } from 'react-hot-toast';
import { LogIn, Shield, Building2, User } from 'lucide-react';

import { API_BASE_URL } from '../utils/apiConfig';

const API_URL = `${API_BASE_URL}/auth/login`;

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Tự động điều hướng nếu đã đăng nhập từ trước
  useEffect(() => {
    const role = localStorage.getItem('authRole');
    const ownerToken = localStorage.getItem('ownerAuthToken');
    const authToken = localStorage.getItem('authToken');

    if (role === 'admin' && ownerToken) {
      navigate('/admin/dashboard', { replace: true });
    } else if (role === 'chu_homestay' && ownerToken) {
      navigate('/owner/dashboard', { replace: true });
    } else if (authToken) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Gọi API đăng nhập một cổng chung
      const response = await axios.post(API_URL, {
        email: email.trim(),
        password: password,
      });

      // 2. Lấy dữ liệu trả về từ backend (tự động nhận diện vai trò)
      const { token, user, role } = response.data.data;

      // 3. Xóa sạch phiên đăng nhập cũ để tránh xung đột vai trò
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('ownerAuthToken');
      localStorage.removeItem('ownerAuthUser');
      localStorage.removeItem('authRole');

      // 4. Lưu thông tin phiên và tự động điều hướng theo vai trò thực tế
      if (role === 'admin') {
        localStorage.setItem('ownerAuthToken', token);
        localStorage.setItem('ownerAuthUser', JSON.stringify(user));
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify(user));
        localStorage.setItem('authRole', 'admin');

        toast.success(`Chào mừng Quản trị viên ${user.HoTen || ''}!`);
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 350);

      } else if (role === 'chu_homestay') {
        localStorage.setItem('ownerAuthToken', token);
        localStorage.setItem('ownerAuthUser', JSON.stringify(user));
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify(user));
        localStorage.setItem('authRole', 'chu_homestay');

        toast.success(`Chào mừng Đối tác ${user.HoTen || ''}!`);
        setTimeout(() => {
          window.location.href = '/owner/dashboard';
        }, 350);

      } else {
        // Customer / Khách hàng
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify(user));
        localStorage.setItem('authRole', 'customer');

        toast.success(`Đăng nhập thành công! Chào mừng ${user.HoTen || ''}`);
        setTimeout(() => {
          window.location.href = '/';
        }, 350);
      }

    } catch (err) {
      const message = err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      toast.error(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.4rem' }}>Đăng Nhập Hệ Thống</h2>
          <p style={{ fontSize: '0.88rem', color: '#5C6861', margin: 0 }}>
            Một cổng đăng nhập duy nhất cho Khách hàng, Chủ Homestay và Quản trị viên
          </p>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="form-group">
          <label htmlFor="email">Email tài khoản:</label>
          <input
            id="email"
            type="email"
            placeholder="nhập email của bạn (ví dụ: user@test.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Mật khẩu:</label>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="form-group-checkbox">
          <input
            id="show-password"
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
          />
          <label htmlFor="show-password">Hiện mật khẩu</label>
        </div>

        <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <LogIn size={18} />
          <span>{loading ? 'Đang xác thực...' : 'Đăng Nhập'}</span>
        </button>

        <div className="form-links">
          <Link to="/register">Chưa có tài khoản? Đăng ký ngay</Link>
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
