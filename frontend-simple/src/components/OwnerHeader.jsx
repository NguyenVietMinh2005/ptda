// src/components/OwnerHeader.jsx
import { useState } from 'react'; // <-- 1. Import useState
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react'; // <-- 2. Import icons
import { toast } from 'react-hot-toast';
import '../App.css'; // Dùng CSS chung

function OwnerHeader() {
  const navigate = useNavigate();
  const ownerString = localStorage.getItem('ownerAuthUser');
  const owner = ownerString ? JSON.parse(ownerString) : null;

  // 3. Thêm state để quản lý menu (giống Header.jsx)
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('ownerAuthToken');
    localStorage.removeItem('ownerAuthUser');
    toast.success('Đăng xuất thành công!');
    navigate('/owner/login');
  };

  return (
    <header className="owner-header"> {/* Giữ class này để có nền xanh */}
      <h1 className="owner-logo">
        <Link to="/owner/dashboard">Kênh Chủ Nhà</Link>
      </h1>
      
      {/* 4. THAY THẾ TOÀN BỘ <nav> CŨ BẰNG LOGIC MỚI NÀY */}
      <nav>
        {owner ? (
          // --- Menu 3 sọc khi đã đăng nhập (Giống Header.jsx) ---
          <div className="profile-menu">
            <button 
              className="menu-icon-button" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>

            {isMenuOpen && (
              <div className="menu-dropdown">
                {/* Chào mừng */}
                <span className="menu-item-greeting">Chào, {owner.HoTen}!</span>
                
                {/* Các link của Chủ nhà */}
                <Link to="/owner/dashboard" className="menu-item" onClick={() => setIsMenuOpen(false)}>
                  Thống kê
                </Link>
                <Link to="/owner/homestays" className="menu-item" onClick={() => setIsMenuOpen(false)}>
                  Quản lý Homestay
                </Link>
                <Link to="/owner/bookings" className="menu-item" onClick={() => setIsMenuOpen(false)}>
                  Quản lý Đơn đặt
                </Link>
                <Link to="/owner/complaints" className="menu-item" onClick={() => setIsMenuOpen(false)}>
                  Quản lý Khiếu nại
                </Link>
                
                {/* --- LINK ADMIN ĐÃ ĐƯỢC DI CHUYỂN VÀO ĐÂY --- */}
                {owner && owner.Quyen === 'admin' && (
                  <Link 
                    to="/admin/dashboard" 
                    className="menu-item admin-link" // Dùng class mới
                    onClick={() => setIsMenuOpen(false)}
                  >
                    ⭐ Bảng điều khiển Admin
                  </Link>
                )}
                
                {/* Nút Đăng xuất */}
                <button onClick={handleLogout} className="menu-item logout">
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          // --- Khi chưa đăng nhập ---
          <div className="auth-links">
            <Link to="/owner/login">Đăng nhập</Link>
            <Link to="/owner/register">Đăng ký</Link>
          </div>
        )}
      </nav>
      {/* ------------------ KẾT THÚC THAY THẾ ------------------ */}
      
    </header>
  );
}

export default OwnerHeader;