// src/components/OwnerHeader.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../App.css';

function OwnerHeader() {
  const navigate = useNavigate();
  const ownerString = localStorage.getItem('ownerAuthUser');
  const owner = ownerString ? JSON.parse(ownerString) : null;

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('ownerAuthToken');
    localStorage.removeItem('ownerAuthUser');
    localStorage.removeItem('authRole');
    toast.success('Đăng xuất thành công!');
    navigate('/login');
  };

  return (
    <header className="owner-header">
      <h1 className="owner-logo">
        <Link to="/owner/dashboard">Kênh Chủ Nhà</Link>
      </h1>
      
      <nav>
        {owner ? (
          <div className="profile-menu">
            <button 
              className="menu-icon-button" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>

            {isMenuOpen && (
              <div className="menu-dropdown">
                <span className="menu-item-greeting">Chào, {owner.HoTen}!</span>
                
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
                
                {owner && owner.Quyen === 'admin' && (
                  <Link 
                    to="/admin/dashboard" 
                    className="menu-item admin-link"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    ⭐ Bảng điều khiển Admin
                  </Link>
                )}
                
                <button onClick={handleLogout} className="menu-item logout">
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-links">
            <Link to="/login">Đăng nhập</Link>
            <Link to="/owner/register">Đăng ký</Link>
          </div>
        )}
      </nav>
    </header>
  );
}

export default OwnerHeader;
