// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header' // Import Header
import { toast } from 'react-hot-toast';
import './Form.css' // Dùng chung CSS

const API_URL = 'http://localhost:3000/api/auth/me'

function ProfilePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('authToken');

  // 1. Lấy thông tin user từ localStorage để điền vào form
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('authUser')));

  // 2. Tạo state riêng cho từng trường
  const [hoTen, setHoTen] = useState(user?.HoTen || '');
  const [soDienThoai, setSoDienThoai] = useState(user?.SoDienThoai || '');
  const [diaChi, setDiaChi] = useState(user?.DiaChi || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 3. Kiểm tra đăng nhập
  useEffect(() => {
    if (!token || !user) {
      toast.success('Bạn cần đăng nhập để xem trang này.');
      navigate('/login');
    }
  }, [token, user, navigate]);

  // 4. Hàm xử lý Cập nhật
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.put(
        API_URL,
        { HoTen: hoTen, SoDienThoai: soDienThoai, DiaChi: diaChi },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // Cập nhật lại localStorage với thông tin mới
      localStorage.setItem('authUser', JSON.stringify(response.data.user));

      toast.success('Cập nhật thông tin thành công!');
      window.location.reload(); // Tải lại trang để Header nhận tên mới

    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật thất bại.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null; // Nếu chưa đăng nhập, không hiển thị gì

  return (
    <div className="page-container">
      <Header /> {/* Dùng Header component */}

      <div className="form-container">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Thông Tin Cá Nhân</h2>
          {error && <p className="error-message">{error}</p>}

          <div className="form-group">
            <label htmlFor="email">Email (Không thể đổi)</label>
            <input
              id="email"
              type="email"
              value={user.Email}
              disabled // Không cho sửa email
            />
          </div>

          <div className="form-group">
            <label htmlFor="hoTen">Họ và Tên:</label>
            <input
              id="hoTen"
              type="text"
              value={hoTen}
              onChange={(e) => setHoTen(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="soDienThoai">Số điện thoại:</label>
            <input
              id="soDienThoai"
              type="tel"
              value={soDienThoai}
              onChange={(e) => setSoDienThoai(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="diaChi">Địa chỉ:</label>
            <input
              id="diaChi"
              type="text"
              value={diaChi}
              onChange={(e) => setDiaChi(e.target.value)}
            />
          </div>

          {/* Nút màu xanh dương (primary) */}
          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Cập Nhật'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfilePage;