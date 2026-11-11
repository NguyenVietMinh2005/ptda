// src/components/Header.jsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, X, Trees, User, Calendar, MessageSquareWarning, 
  Heart, LogOut, Compass, Sparkles, Building2, ChevronDown 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  const userString = localStorage.getItem('authUser');
  const user = userString ? JSON.parse(userString) : null;
  const authRole = localStorage.getItem('authRole') || user?.Quyen || 'customer';

  // Track scroll for sticky glass effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('ownerAuthToken');
    localStorage.removeItem('ownerAuthUser');
    localStorage.removeItem('authRole');
    toast.success('Đã đăng xuất thành công.');
    setTimeout(() => {
      window.location.href = '/login';
    }, 300);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className={`modern-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        
        {/* Brand Logo */}
        <Link to="/" className="header-brand">
          <div className="brand-icon-box">
            <Trees size={22} className="brand-icon" />
          </div>
          <div className="brand-text-group">
            <span className="brand-title">PTDA <span className="brand-accent">HOMESTAY</span></span>
            <span className="brand-tagline">Nghỉ dưỡng thiên nhiên</span>
          </div>
        </Link>

        {/* Center Desktop Navigation */}
        <nav className="header-nav-desktop">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Trang chủ
          </Link>
          <a href="/#destinations" className="nav-link">
            <Compass size={16} />
            <span>Khám phá</span>
          </a>
          <a href="/#featured" className="nav-link">
            <Sparkles size={16} />
            <span>Homestay nổi bật</span>
          </a>
          {user && (
            <Link 
              to="/my-favorites" 
              className={`nav-link ${location.pathname === '/my-favorites' ? 'active' : ''}`}
            >
              <Heart size={16} />
              <span>Yêu thích</span>
            </Link>
          )}
        </nav>

        {/* Right Actions */}
        <div className="header-actions">
          {/* Quick link to Management Portals if logged in as Admin or Host */}
          {user && authRole === 'admin' && (
            <Link to="/admin/dashboard" className="owner-portal-btn" title="Kênh Quản Trị Viên">
              <Building2 size={16} />
              <span>Quản Trị Viên</span>
            </Link>
          )}

          {user && authRole === 'chu_homestay' && (
            <Link to="/owner/dashboard" className="owner-portal-btn" title="Kênh Chủ Homestay">
              <Building2 size={16} />
              <span>Kênh Chủ Nhà</span>
            </Link>
          )}

          {user ? (
            /* Logged in User Menu */
            <div className="user-profile-wrapper">
              <button 
                className="user-pill-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-expanded={isMenuOpen}
                aria-label="Tài khoản cá nhân"
              >
                <div className="avatar-circle">
                  {getInitials(user.HoTen)}
                </div>
                <span className="user-display-name">{user.HoTen}</span>
                <ChevronDown size={15} className={`chevron-icon ${isMenuOpen ? 'open' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <>
                  <div className="dropdown-backdrop" onClick={() => setIsMenuOpen(false)} />
                  <div className="user-dropdown-menu">
                    <div className="dropdown-user-header">
                      <div className="header-avatar-lg">
                        {getInitials(user.HoTen)}
                      </div>
                      <div className="header-user-meta">
                        <strong>{user.HoTen}</strong>
                        <span className="user-email-text">{user.Email}</span>
                      </div>
                    </div>

                    <div className="dropdown-divider" />

                    {authRole === 'admin' ? (
                      <Link to="/admin/dashboard" className="dropdown-link" onClick={() => setIsMenuOpen(false)}>
                        <Building2 size={18} />
                        <span>Trang quản trị (Admin)</span>
                      </Link>
                    ) : authRole === 'chu_homestay' ? (
                      <Link to="/owner/dashboard" className="dropdown-link" onClick={() => setIsMenuOpen(false)}>
                        <Building2 size={18} />
                        <span>Kênh quản lý Homestay</span>
                      </Link>
                    ) : (
                      <>
                        <Link to="/profile" className="dropdown-link" onClick={() => setIsMenuOpen(false)}>
                          <User size={18} />
                          <span>Thông tin tài khoản</span>
                        </Link>
                        <Link to="/my-bookings" className="dropdown-link" onClick={() => setIsMenuOpen(false)}>
                          <Calendar size={18} />
                          <span>Lịch sử đặt phòng</span>
                        </Link>
                        <Link to="/my-favorites" className="dropdown-link" onClick={() => setIsMenuOpen(false)}>
                          <Heart size={18} />
                          <span>Danh sách yêu thích</span>
                        </Link>
                        <Link to="/my-complaints" className="dropdown-link" onClick={() => setIsMenuOpen(false)}>
                          <MessageSquareWarning size={18} />
                          <span>Lịch sử khiếu nại</span>
                        </Link>
                      </>
                    )}

                    <div className="dropdown-divider" />

                    <button onClick={handleLogout} className="dropdown-link logout-btn">
                      <LogOut size={18} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Guest Auth Buttons */
            <div className="guest-auth-group">
              <Link to="/login" className="btn-login-ghost">
                Đăng nhập
              </Link>
              <Link to="/register" className="btn-register-solid">
                Đăng ký
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button 
            className="mobile-hamburger-btn"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            aria-label="Toggle Navigation"
          >
            {isMobileNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileNavOpen && (
        <div className="mobile-nav-drawer">
          <div className="mobile-nav-links">
            <Link to="/" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
              Trang chủ
            </Link>
            <a href="/#destinations" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
              Khám phá điểm đến
            </a>
            <a href="/#featured" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
              Homestay nổi bật
            </a>
            
            {user && authRole === 'admin' && (
              <Link to="/admin/dashboard" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
                Quản Trị Viên
              </Link>
            )}

            {user && authRole === 'chu_homestay' && (
              <Link to="/owner/dashboard" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
                Kênh Chủ Nhà
              </Link>
            )}

            {user ? (
              <div className="mobile-user-section">
                <div className="mobile-user-info">
                  <div className="avatar-circle">{getInitials(user.HoTen)}</div>
                  <div>
                    <strong>{user.HoTen}</strong>
                    <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>{user.Email}</div>
                  </div>
                </div>
                {authRole === 'admin' ? (
                  <Link to="/admin/dashboard" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
                    Trang Quản Trị Viên
                  </Link>
                ) : authRole === 'chu_homestay' ? (
                  <Link to="/owner/dashboard" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
                    Dashboard Chủ Homestay
                  </Link>
                ) : (
                  <>
                    <Link to="/profile" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
                      Thông tin cá nhân
                    </Link>
                    <Link to="/my-bookings" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
                      Lịch sử đặt phòng
                    </Link>
                    <Link to="/my-favorites" className="mobile-link" onClick={() => setIsMobileNavOpen(false)}>
                      Danh sách yêu thích
                    </Link>
                  </>
                )}
                <button 
                  onClick={handleLogout} 
                  className="mobile-link" 
                  style={{ color: '#DC2626', background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', padding: '0.75rem 1rem' }}
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="mobile-guest-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <Link to="/login" className="btn-login-ghost" onClick={() => setIsMobileNavOpen(false)} style={{ textAlign: 'center' }}>
                  Đăng nhập
                </Link>
                <Link to="/register" className="btn-register-solid" onClick={() => setIsMobileNavOpen(false)} style={{ textAlign: 'center' }}>
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
