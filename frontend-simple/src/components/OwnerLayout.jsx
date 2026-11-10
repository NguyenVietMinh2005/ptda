// src/components/OwnerLayout.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Home,
  CalendarDays,
  ClipboardList,
  CreditCard,
  MessageSquareWarning,
  User,
  LogOut,
  Globe,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  PlusCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function OwnerLayout({ title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const ownerStr = localStorage.getItem('ownerAuthUser');
  let owner = null;
  try {
    owner = ownerStr ? JSON.parse(ownerStr) : null;
  } catch {
    owner = null;
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('ownerAuthToken');
    localStorage.removeItem('ownerAuthUser');
    localStorage.removeItem('authRole');
    toast.success('Đã đăng xuất khỏi Kênh Chủ nhà');
    navigate('/login');
  };

  const navItems = [
    { to: '/owner/dashboard', icon: LayoutDashboard, label: 'Bảng tổng quan' },
    { to: '/owner/homestays', icon: Home, label: 'Homestay của tôi' },
    { to: '/owner/calendar', icon: CalendarDays, label: 'Lịch phòng & Tình trạng' },
    { to: '/owner/bookings', icon: ClipboardList, label: 'Quản lý Đơn đặt' },
    { to: '/owner/transactions', icon: CreditCard, label: 'Lịch sử Giao dịch' },
    { to: '/owner/complaints', icon: MessageSquareWarning, label: 'Khiếu nại từ khách' },
    { to: '/owner/profile', icon: User, label: 'Hồ sơ tài khoản' },
  ];

  return (
    <div className="owner-portal-wrapper">
      {/* Topbar */}
      <header className="owner-portal-topbar">
        <div className="owner-topbar-left">
          <button 
            className="owner-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/owner/dashboard" className="owner-brand">
            <div className="owner-brand-icon">
              <Home size={22} />
            </div>
            <div className="owner-brand-text">
              <span className="owner-brand-title">KÊNH CHỦ NHÀ</span>
              <span className="owner-brand-badge">Quản lý Đón tiếp</span>
            </div>
          </Link>
        </div>

        <div className="owner-topbar-right">
          <Link to="/" className="owner-topbar-link" target="_blank" rel="noreferrer" title="Xem trang chủ khách">
            <Globe size={16} />
            <span>Xem Website Khách</span>
          </Link>

          <div className="owner-user-pill">
            <div className="owner-user-avatar">
              {owner?.HoTen ? owner.HoTen.charAt(0).toUpperCase() : 'H'}
            </div>
            <div className="owner-user-info">
              <span className="owner-user-name">{owner?.HoTen || 'Chủ Homestay'}</span>
              <span className="owner-user-role">Host Đối tác</span>
            </div>
          </div>

          <button onClick={handleLogout} className="owner-logout-btn" title="Đăng xuất">
            <LogOut size={16} />
            <span className="owner-logout-text">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="owner-body-layout">
        {/* Sidebar */}
        <aside className={`owner-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="owner-sidebar-section-title">QUẢN LÝ HOMESTAY</div>
          <nav className="owner-sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `owner-nav-item ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={19} className="owner-nav-icon" />
                  <span className="owner-nav-text">{item.label}</span>
                  <ChevronRight size={14} className="owner-nav-chevron" />
                </NavLink>
              );
            })}
          </nav>

          <div className="owner-sidebar-footer">
            <div className="owner-sidebar-hint">
              <strong>Hỗ trợ Đối tác 24/7</strong>
              <span>Hotline kỹ thuật: 1900 6868</span>
            </div>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div 
            className="owner-sidebar-overlay" 
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Viewport */}
        <main className="owner-main-viewport">
          {(title || actions) && (
            <div className="owner-page-header">
              <div>
                <h1 className="owner-page-title">{title}</h1>
                {subtitle && <p className="owner-page-subtitle">{subtitle}</p>}
              </div>
              {actions && <div className="owner-page-actions">{actions}</div>}
            </div>
          )}

          <div className="owner-page-content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

