// src/pages/OwnerDashboardPage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader' // <-- Dùng Header mới
import { toast } from 'react-hot-toast'
import '../App.css'

const API_URL = 'http://localhost:3000/api/owner/me/dashboard-stats'

function OwnerDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('ownerAuthToken');

  useEffect(() => {
    if (!token) {
      toast.error('Bạn cần đăng nhập với tư cách Chủ Homestay.');
      navigate('/owner/login');
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setStats(response.data.data);
      } catch (err) {
        toast.error('Không thể tải dữ liệu thống kê.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token, navigate]);

  if (loading) return (
    <div className="page-container"><OwnerHeader /><p>Đang tải thống kê...</p></div>
  );

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Bảng điều khiển</h2>
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Tổng Doanh thu (Đã xác nhận)</h4>
              <p>{stats.totalRevenue.toLocaleString('vi-VN')} VNĐ</p>
            </div>
            <div className="stat-card">
              <h4>Đơn đặt đã xác nhận</h4>
              <p>{stats.confirmedBookings}</p>
            </div>
            <div className="stat-card">
              <h4>Đơn đặt chờ xử lý</h4>
              <p>{stats.pendingBookings}</p>
            </div>
            <div className="stat-card">
              <h4>Tổng số Homestay</h4>
              <p>{stats.totalHomestays}</p>
            </div>
            <div className="stat-card">
              <h4>Khiếu nại chờ xử lý</h4>
              <p>{stats.pendingComplaints}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default OwnerDashboardPage;