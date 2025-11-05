// src/pages/AdminDashboardPage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader'
import { toast } from 'react-hot-toast'
import '../App.css'

const ADMIN_API_URL = 'http://localhost:3000/api/admin'

function AdminDashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('ownerAuthToken');
  const ownerString = localStorage.getItem('ownerAuthUser');
  const adminUser = useMemo(() => {
    return ownerString ? JSON.parse(ownerString) : null;
  }, [ownerString]);

  // State mới để lưu trữ các con số thống kê
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kiểm tra quyền Admin và Tải dữ liệu thống kê
  useEffect(() => {
    if (!token || !adminUser || adminUser.Quyen !== 'admin') {
      toast.error('Bạn không có quyền truy cập trang này.');
      navigate('/owner/login');
      return;
    }

    const fetchAllStats = async () => {
      setLoading(true);
      try {
        // 1. Gọi tất cả API cần thiết
        const [
          usersRes,
          ownersRes,
          homestaysRes,
          bookingsRes,
          complaintsRes
        ] = await Promise.all([
          axios.get(`${ADMIN_API_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${ADMIN_API_URL}/owners`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${ADMIN_API_URL}/homestays`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${ADMIN_API_URL}/bookings`, { headers: { 'Authorization': `Bearer ${token}` } }),
          axios.get(`${ADMIN_API_URL}/complaints`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        // 2. Tính toán các con số
        const users = usersRes.data.data;
        const owners = ownersRes.data.data;
        const homestays = homestaysRes.data.data;
        const bookings = bookingsRes.data.data;
        const complaints = complaintsRes.data.data;

        const totalRevenue = bookings
          .filter(b => b.TrangThai === 'DaXacNhan')
          .reduce((sum, b) => sum + parseFloat(b.Gia), 0);
          
        const confirmedBookings = bookings.filter(b => b.TrangThai === 'DaXacNhan').length;
        const pendingBookings = bookings.filter(b => b.TrangThai === 'ChoXacNhan').length;
        const pendingComplaints = complaints.filter(c => c.TrangThai === 'ChuaXuLy').length;

        // 3. Cập nhật State
        setStats({
          totalUsers: users.length,
          totalOwners: owners.length,
          totalHomestays: homestays.length,
          totalRevenue: totalRevenue,
          confirmedBookings: confirmedBookings,
          pendingBookings: pendingBookings,
          pendingComplaints: pendingComplaints,
        });

      } catch (err) {
        toast.error('Không thể tải dữ liệu thống kê.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllStats();
  }, [token, navigate, adminUser]);

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Admin Panel</h2>
        
        {/* --- BỐ CỤC 2 CỘT MỚI --- */}
        <div className="admin-dashboard-layout">
          
          {/* Cột 1: Menu (Giống code cũ) */}
          <nav className="admin-menu-sidebar">
            <Link to="/admin/users" className="admin-menu-button">
              Quản lý Người Dùng (Khách hàng)
            </Link>
            <Link to="/admin/owners" className="admin-menu-button">
              Quản lý Chủ Homestay
            </Link>
            <Link to="/admin/homestays" className="admin-menu-button">
              Quản lý Homestay (Toàn hệ thống)
            </Link>
            <Link to="/admin/bookings" className="admin-menu-button">
              Quản lý Đơn Đặt (Toàn hệ thống)
            </Link>
            <Link to="/admin/complaints" className="admin-menu-button">
              Quản lý Khiếu Nại (Toàn hệ thống)
            </Link>
          </nav>

          {/* Cột 2: Thống kê */}
          <div className="admin-stats-container">
            <h3>Thống Kê (Toàn hệ thống)</h3>
            
            {loading && <p>Đang tải thống kê...</p>}
            
            {stats && (
              <div className="stats-grid-admin">
                {/* 2 Thẻ mới bạn yêu cầu */}
                <div className="stat-card-admin">
                  <h4>Tổng số Người Dùng</h4>
                  <p>{stats.totalUsers}</p>
                </div>
                <div className="stat-card-admin">
                  <h4>Tổng số Chủ Homestay</h4>
                  <p>{stats.totalOwners}</p>
                </div>
                
                {/* Các thẻ cũ (nhưng dữ liệu là của Admin) */}
                <div className="stat-card-admin">
                  <h4>Tổng Doanh thu (Đã xác nhận)</h4>
                  <p>{stats.totalRevenue.toLocaleString('vi-VN')} VNĐ</p>
                </div>
                <div className="stat-card-admin">
                  <h4>Tổng số Homestay</h4>
                  <p>{stats.totalHomestays}</p>
                </div>
                <div className="stat-card-admin">
                  <h4>Đơn đặt đã xác nhận</h4>
                  <p>{stats.confirmedBookings}</p>
                </div>
                <div className="stat-card-admin">
                  <h4>Đơn đặt chờ xử lý</h4>
                  <p>{stats.pendingBookings}</p>
                </div>
                <div className="stat-card-admin">
                  <h4>Khiếu nại chờ xử lý</h4>
                  <p>{stats.pendingComplaints}</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default AdminDashboardPage;