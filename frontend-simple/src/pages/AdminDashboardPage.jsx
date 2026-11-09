// src/pages/AdminDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  Users,
  Building2,
  Home,
  CalendarCheck,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('ownerAuthToken');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải dữ liệu thống kê quản trị.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  return (
    <AdminLayout
      title="Bảng Điều Khiển Quản Trị"
      subtitle="Theo dõi sức khỏe hệ thống, doanh thu và các hoạt động đặt phòng trên toàn nền tảng"
      actions={
        <button onClick={fetchStats} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={15} />
          <span>Làm mới</span>
        </button>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#64748B' }}>
          Đang tổng hợp dữ liệu toàn hệ thống...
        </div>
      ) : stats ? (
        <>
          {/* Key Stat Cards Grid */}
          <div className="stats-cards-grid">
            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <TrendingUp size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Tổng doanh thu hệ thống</span>
                <span className="stat-widget-value" style={{ color: '#15803D' }}>
                  {stats.totalRevenue ? stats.totalRevenue.toLocaleString('vi-VN') : 0} đ
                </span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon blue">
                <Users size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Khách hàng đăng ký</span>
                <span className="stat-widget-value">{stats.totalUsers || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon amber">
                <Building2 size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Chủ homestay đối tác</span>
                <span className="stat-widget-value">{stats.totalOwners || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon purple">
                <Home size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Tổng số Homestay</span>
                <span className="stat-widget-value">{stats.totalHomestays || 0}</span>
              </div>
            </div>
          </div>

          {/* Operational Secondary Stat Cards */}
          <div className="stats-cards-grid" style={{ marginBottom: '2.5rem' }}>
            <div className="stat-widget">
              <div className="stat-widget-icon blue">
                <CalendarCheck size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Tổng đơn đặt phòng</span>
                <span className="stat-widget-value">{stats.totalBookings || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon amber">
                <Clock size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Homestay chờ duyệt</span>
                <span className="stat-widget-value" style={{ color: stats.pendingHomestays > 0 ? '#B45309' : '#0F172A' }}>
                  {stats.pendingHomestays || 0}
                </span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <CreditCard size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Giao dịch thành công</span>
                <span className="stat-widget-value">{stats.successfulTransactions || 0} / {stats.totalTransactions || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon rose">
                <AlertTriangle size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Khiếu nại chờ xử lý</span>
                <span className="stat-widget-value" style={{ color: stats.pendingComplaints > 0 ? '#BE123C' : '#0F172A' }}>
                  {stats.pendingComplaints || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Tables Preview Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.75rem' }}>
            {/* Recent Bookings */}
            <div className="data-table-card">
              <div className="data-table-header">
                <h3 className="data-table-title">Đơn đặt phòng gần nhất</h3>
                <Link to="/admin/bookings" style={{ fontSize: '0.85rem', color: '#2563EB', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  Xem tất cả <ArrowUpRight size={14} />
                </Link>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Khách hàng</th>
                      <th>Homestay</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentBookings && stats.recentBookings.length > 0 ? (
                      stats.recentBookings.map((b) => (
                        <tr key={b.MaDatPhong}>
                          <td style={{ fontWeight: 700 }}>#{b.MaDatPhong}</td>
                          <td>{b.NGUOI_DUNG?.HoTen || 'N/A'}</td>
                          <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.CHI_TIET_DAT_PHONG?.[0]?.HOMESTAY?.TenHomestay || 'Homestay'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{parseFloat(b.Gia).toLocaleString('vi-VN')} đ</td>
                          <td>
                            <span className={`status-pill ${
                              b.TrangThai === 'DaHoanThanh' ? 'success' :
                              b.TrangThai === 'DaXacNhan' ? 'info' :
                              b.TrangThai === 'DangLuuTru' ? 'info' :
                              b.TrangThai === 'ChoXacNhan' ? 'warning' : 'danger'
                            }`}>
                              {b.TrangThai}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có đơn đặt nào</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="data-table-card">
              <div className="data-table-header">
                <h3 className="data-table-title">Giao dịch mới nhất</h3>
                <Link to="/admin/transactions" style={{ fontSize: '0.85rem', color: '#2563EB', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  Xem tất cả <ArrowUpRight size={14} />
                </Link>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Mã GD</th>
                      <th>Đơn #</th>
                      <th>Phương thức</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentTransactions && stats.recentTransactions.length > 0 ? (
                      stats.recentTransactions.map((t) => (
                        <tr key={t.MaGiaoDich}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700 }}>
                            {t.MaGiaoDich.slice(0, 10)}...
                          </td>
                          <td style={{ fontWeight: 600 }}>#{t.DAT_PHONG?.MaDatPhong}</td>
                          <td>{t.PhuongThuc === 'QR_DEMO' ? 'QR Code' : 'Tiền mặt'}</td>
                          <td style={{ fontWeight: 600, color: '#15803D' }}>
                            {parseFloat(t.SoTien).toLocaleString('vi-VN')} đ
                          </td>
                          <td>
                            <span className={`status-pill ${t.TrangThai === 'ThanhCong' ? 'success' : 'danger'}`}>
                              {t.TrangThai === 'ThanhCong' ? 'Thành công' : 'Thất bại'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94A3B8' }}>Chưa có giao dịch nào</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}