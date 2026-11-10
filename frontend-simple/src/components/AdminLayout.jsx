// src/components/AdminLayout.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Home,
  CalendarCheck,
  CreditCard,
  Star,
  AlertTriangle,
  LogOut,
  Globe,
  ShieldCheck,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminLayout({ title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const ownerStr = localStorage.getItem('ownerAuthUser');
  let adminUser = null;
  try {
    adminUser = ownerStr ? JSON.parse(ownerStr) : null;
  } catch {
    adminUser = null;
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('ownerAuthToken');
    localStorage.removeItem('ownerAuthUser');
    localStorage.removeItem('authRole');
    toast.success('Đã đăng xuất khỏi tài khoản Admin');
    navigate('/login');
  };

  const navItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Tổng quan hệ thống' },
    { to: '/admin/users', icon: Users, label: 'Quản lý Khách hàng' },
    { to: '/admin/owners', icon: Building2, label: 'Quản lý Chủ nhà' },
    { to: '/admin/homestays', icon: Home, label: 'Duyệt & Homestay' },
    { to: '/admin/bookings', icon: CalendarCheck, label: 'Đơn đặt phòng' },
    { to: '/admin/transactions', icon: CreditCard, label: 'Giao dịch thanh toán' },
    { to: '/admin/reviews', icon: Star, label: 'Đánh giá homestay' },
    { to: '/admin/complaints', icon: AlertTriangle, label: 'Xử lý khiếu nại' },
  ];

  return (
    <div className="admin-portal-wrapper">
      {/* Top Navigation Bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button 
            className="admin-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          
          <Link to="/admin/dashboard" className="admin-brand">
            <div className="admin-brand-icon">
              <ShieldCheck size={22} />
            </div>
            <div className="admin-brand-text">
              <span className="admin-brand-title">PTDA ADMIN</span>
              <span className="admin-brand-badge">Hệ thống Quản trị</span>
            </div>
          </Link>
        </div>

        <div className="admin-topbar-right">
          <Link to="/" className="admin-topbar-link" target="_blank" rel="noreferrer" title="Mở trang web khách">
            <Globe size={16} />
            <span>Xem Website</span>
          </Link>

          <div className="admin-user-pill">
            <div className="admin-user-avatar">
              {adminUser?.HoTen ? adminUser.HoTen.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="admin-user-info">
              <span className="admin-user-name">{adminUser?.HoTen || 'Quản trị viên'}</span>
              <span className="admin-user-role">Super Admin</span>
            </div>
          </div>

          <button onClick={handleLogout} className="admin-logout-btn" title="Đăng xuất">
            <LogOut size={16} />
            <span className="admin-logout-text">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="admin-body-layout">
        {/* Sidebar */}
        <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="admin-sidebar-section-title">CHỨC NĂNG HỆ THỐNG</div>
          <nav className="admin-sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `admin-nav-item ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={19} className="admin-nav-icon" />
                  <span className="admin-nav-text">{item.label}</span>
                  <ChevronRight size={14} className="admin-nav-chevron" />
                </NavLink>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="admin-sidebar-hint">
              <strong>Phiên bản 2.5 (PTDA)</strong>
              <span>Quản trị tập trung an toàn</span>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {mobileMenuOpen && (
          <div 
            className="admin-sidebar-overlay" 
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Content Body */}
        <main className="admin-main-viewport">
          {(title || actions) && (
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">{title}</h1>
                {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
              </div>
              {actions && <div className="admin-page-actions">{actions}</div>}
            </div>
          )}

          <div className="admin-page-content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

