// src/pages/OwnerDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import OwnerLayout from '../components/OwnerLayout';
import {
  TrendingUp,
  Home,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  PlusCircle,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const API_URL = `${API_BASE_URL}/owner/me/dashboard-stats`;

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('ownerAuthToken');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải dữ liệu thống kê kênh chủ nhà.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  return (
    <OwnerLayout
      title="Bảng Điều Khiển Chủ Homestay"
      subtitle="Theo dõi hiệu quả kinh doanh, đơn đặt phòng và tình trạng phòng trống"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link
            to="/owner/homestays"
            className="button-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
          >
            <PlusCircle size={16} /> Thêm Homestay
          </Link>
          <button onClick={fetchStats} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#5C6861' }}>
          Đang tính toán số liệu thống kê...
        </div>
      ) : stats ? (
        <>
          {/* Main Key Metrics */}
          <div className="stats-cards-grid">
            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <TrendingUp size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Doanh thu tích lũy</span>
                <span className="stat-widget-value" style={{ color: '#15803D' }}>
                  {stats.totalRevenue ? stats.totalRevenue.toLocaleString('vi-VN') : 0} đ
                </span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon amber">
                <Home size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Homestay sở hữu</span>
                <span className="stat-widget-value">{stats.totalHomestays || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon blue">
                <CalendarCheck size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Tổng đơn đã nhận</span>
                <span className="stat-widget-value">{stats.totalBookings || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon purple">
                <Clock size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Đơn cần xác nhận</span>
                <span className="stat-widget-value" style={{ color: stats.pendingBookings > 0 ? '#C9653B' : '#1C231F' }}>
                  {stats.pendingBookings || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Booking States Breakdown */}
          <div className="stats-cards-grid" style={{ marginBottom: '2rem' }}>
            <div className="stat-widget">
              <div className="stat-widget-icon blue">
                <CalendarCheck size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Đã xác nhận đón khách</span>
                <span className="stat-widget-value">{stats.confirmedBookings || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon amber">
                <Home size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Khách đang lưu trú</span>
                <span className="stat-widget-value">{stats.stayingBookings || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon green">
                <CheckCircle2 size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Kỳ nghỉ đã hoàn thành</span>
                <span className="stat-widget-value">{stats.completedBookings || 0}</span>
              </div>
            </div>

            <div className="stat-widget">
              <div className="stat-widget-icon rose">
                <AlertTriangle size={24} />
              </div>
              <div className="stat-widget-content">
                <span className="stat-widget-label">Khiếu nại chưa xử lý</span>
                <span className="stat-widget-value" style={{ color: stats.pendingComplaints > 0 ? '#BE123C' : '#1C231F' }}>
                  {stats.pendingComplaints || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Access Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                padding: '1.75rem',
                border: '1px solid #E8E2D7',
                boxShadow: '0 2px 8px rgba(28, 59, 43, 0.04)'
              }}
            >
              <h3 style={{ fontSize: '1.15rem', color: '#1C3B2B', marginBottom: '0.5rem', fontWeight: 800 }}>
                📅 Quản Lý Lịch Phòng Trống
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#5C6861', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                Xem sơ đồ trực quan các ngày đã có khách đặt và các ngày còn trống để chủ động tối ưu công suất phòng.
              </p>
              <Link
                to="/owner/calendar"
                className="button-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
              >
                Mở Lịch Phòng <ArrowUpRight size={15} />
              </Link>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                padding: '1.75rem',
                border: '1px solid #E8E2D7',
                boxShadow: '0 2px 8px rgba(28, 59, 43, 0.04)'
              }}
            >
              <h3 style={{ fontSize: '1.15rem', color: '#1C3B2B', marginBottom: '0.5rem', fontWeight: 800 }}>
                📑 Xử Lý Đơn Đặt Phòng
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#5C6861', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                Xác nhận đơn mới của khách, hỗ trợ nhận phòng, trả phòng và xác nhận thanh toán tiền mặt.
              </p>
              <Link
                to="/owner/bookings"
                className="button-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
              >
                Quản Lý Đơn Đặt <ArrowUpRight size={15} />
              </Link>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                padding: '1.75rem',
                border: '1px solid #E8E2D7',
                boxShadow: '0 2px 8px rgba(28, 59, 43, 0.04)'
              }}
            >
              <h3 style={{ fontSize: '1.15rem', color: '#1C3B2B', marginBottom: '0.5rem', fontWeight: 800 }}>
                💳 Lịch Sử Giao Dịch
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#5C6861', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                Kiểm tra biên lai thanh toán QR code demo và dòng tiền thu tiền mặt của khách khi nhận phòng.
              </p>
              <Link
                to="/owner/transactions"
                className="button-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
              >
                Xem Giao Dịch <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </OwnerLayout>
  );
}