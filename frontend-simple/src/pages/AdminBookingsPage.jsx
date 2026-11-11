// src/pages/AdminBookingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { Search, Calendar, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const token = localStorage.getItem('ownerAuthToken');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách đơn đặt.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      const response = await axios.put(
        `${ADMIN_API_URL}/bookings/${bookingId}/status`,
        { trangThai: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Đã cập nhật đơn #${bookingId} thành '${newStatus}'!`);
      setBookings((prev) =>
        prev.map((b) => (b.MaDatPhong === bookingId ? response.data.data : b))
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Cập nhật trạng thái thất bại.');
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      b.MaDatPhong?.toString().includes(term) ||
      b.NGUOI_DUNG?.HoTen?.toLowerCase().includes(term) ||
      b.CHI_TIET_DAT_PHONG?.[0]?.HOMESTAY?.TenHomestay?.toLowerCase().includes(term);

    const matchStatus = statusFilter === 'ALL' || b.TrangThai === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout
      title="Quản Lý Đơn Đặt Phòng"
      subtitle="Theo dõi và điều chỉnh toàn bộ vòng đời đặt phòng của khách hàng trên hệ thống"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ChoXacNhan">⏳ Chờ xác nhận</option>
            <option value="DaXacNhan">✅ Đã xác nhận</option>
            <option value="DangLuuTru">🏨 Đang lưu trú</option>
            <option value="DaHoanThanh">🎉 Đã hoàn thành</option>
            <option value="DaHuy">❌ Đã hủy</option>
          </select>

          <div className="search-input-box">
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Tìm mã đơn, tên khách, homestay..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button onClick={fetchBookings} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      <div className="data-table-card">
        <div className="data-table-header">
          <h3 className="data-table-title">Tổng số: {filteredBookings.length} đơn đặt</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Khách hàng</th>
                <th>Homestay</th>
                <th>Thời gian lưu trú</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái đơn</th>
                <th>Thay đổi trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Đang tải danh sách đơn đặt...
                  </td>
                </tr>
              ) : filteredBookings.length > 0 ? (
                filteredBookings.map((b) => (
                  <tr key={b.MaDatPhong}>
                    <td style={{ fontWeight: 700 }}>#{b.MaDatPhong}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.NGUOI_DUNG?.HoTen || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{b.NGUOI_DUNG?.Email}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#1C3B2B' }}>
                      {b.CHI_TIET_DAT_PHONG?.[0]?.HOMESTAY?.TenHomestay || 'Homestay'}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {new Date(b.NgayNhan).toLocaleDateString('vi-VN')} → {new Date(b.NgayTra).toLocaleDateString('vi-VN')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{b.SoLuong} khách</div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#15803D' }}>
                      {parseFloat(b.Gia).toLocaleString('vi-VN')} đ
                    </td>
                    <td>
                      <div>
                        <span className={`status-pill ${b.TrangThaiThanhToan === 'DaThanhToan' ? 'success' : 'warning'}`}>
                          {b.TrangThaiThanhToan === 'DaThanhToan' ? 'Đã TT' : 'Chưa TT'}
                        </span>
                      </div>
                      {b.PhuongThucThanhToan && (
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.2rem' }}>
                          {b.PhuongThucThanhToan === 'QR_DEMO' ? 'QR Code' : 'Tiền mặt'}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${
                        b.TrangThai === 'DaHoanThanh' ? 'success' :
                        b.TrangThai === 'DaXacNhan' ? 'info' :
                        b.TrangThai === 'DangLuuTru' ? 'info' :
                        b.TrangThai === 'ChoXacNhan' ? 'warning' : 'danger'
                      }`}>
                        {b.TrangThai === 'ChoXacNhan' ? 'Chờ xác nhận' :
                         b.TrangThai === 'DaXacNhan' ? 'Đã xác nhận' :
                         b.TrangThai === 'DangLuuTru' ? 'Đang lưu trú' :
                         b.TrangThai === 'DaHoanThanh' ? 'Đã hoàn thành' : 'Đã hủy'}
                      </span>
                    </td>
                    <td>
                      <select
                        value={b.TrangThai}
                        onChange={(e) => handleUpdateBookingStatus(b.MaDatPhong, e.target.value)}
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="ChoXacNhan">Chờ xác nhận</option>
                        <option value="DaXacNhan">Đã xác nhận</option>
                        <option value="DangLuuTru">Đang lưu trú</option>
                        <option value="DaHoanThanh">Đã hoàn thành</option>
                        <option value="DaHuy">Đã hủy</option>
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Không có đơn đặt nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}