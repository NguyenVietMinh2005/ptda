// src/components/Header.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react'; // Icon 3 sọc và icon Dấu X

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const userString = localStorage.getItem('authUser');
  const user = userString ? JSON.parse(userString) : null;

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    alert('Bạn đã đăng xuất.');
    navigate('/'); // Về trang chủ
    window.location.reload();
  };

  return (
    <header>
      <h1><Link to="/" style={{color: 'white', textDecoration: 'none'}}>Homestay</Link></h1>
      <nav>
        {user ? (
          // --- Menu 3 sọc khi đã đăng nhập ---
          <div className="profile-menu">
            <button 
              className="menu-icon-button" 
              onClick={() => setIsMenuOpen(!isMenuOpen)} // Bật/tắt menu
            >
              {isMenuOpen ? <X /> : <Menu />} {/* Đổi icon khi mở/đóng */}
            </button>

            {/* Dropdown menu (chỉ hiện khi isMenuOpen là true) */}
            {isMenuOpen && (
              <div className="menu-dropdown">
                <Link to="/profile" className="menu-item" onClick={() => setIsMenuOpen(false)}>
                  Thông tin cá nhân
                </Link>
                <Link to="/my-bookings" className="menu-item" onClick={() => setIsMenuOpen(false)}>
                  Lịch sử Đặt phòng
                </Link>
                <Link to="/my-complaints" className="menu-item" onClick={() => setIsMenuOpen(false)}>
      Lịch sử Khiếu nại
    </Link>
                <Link to="/my-favorites" className="menu-item" onClick={() => setIsMenuOpen(false)}>
                    Danh sách Yêu thích {/* <-- THÊM DÒNG NÀY */}
                </Link>
                <button onClick={handleLogout} className="menu-item logout">
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          // --- Khi chưa đăng nhập ---
          <div className="auth-links">
            <Link to="/login">Đăng nhập</Link>
            <Link to="/register">Đăng ký</Link>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Header;