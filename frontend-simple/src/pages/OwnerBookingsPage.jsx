// src/pages/OwnerBookingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../components/OwnerLayout';
import { Search, RefreshCw, CheckCircle2, Clock, XCircle, Home, UserCheck, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../App.css';

import { API_BASE_URL } from '../utils/apiConfig';

const API_URL = `${API_BASE_URL}/owner/me/bookings`;
const BOOKING_API_URL = `${API_BASE_URL}/bookings`;

export default function OwnerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashLoadingId, setCashLoadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const navigate = useNavigate();
  const token = localStorage.getItem('ownerAuthToken');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data.data || []);
    } catch {
      toast.error('Không thể tải danh sách đơn đặt.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      toast.error('Bạn cần đăng nhập với tư cách Chủ Homestay.');
      navigate('/owner/login');
      return;
    }
    fetchBookings();
  }, [token, navigate, fetchBookings]);

  const handleUpdateStatus = async (bookingId, newStatus) => {
    let actionText = 'Xác nhận';
    if (newStatus === 'DaXacNhan') actionText = 'Xác nhận đơn';
    else if (newStatus === 'DangLuuTru') actionText = 'Khách nhận phòng (Check-in)';
    else if (newStatus === 'DaHoanThanh') actionText = 'Khách trả phòng (Hoàn thành)';
    else if (newStatus === 'DaHuy') actionText = 'Hủy đơn';

    if (!window.confirm(`Bạn có chắc muốn thực hiện "${actionText}" cho đơn #${bookingId}?`)) {
      return;
    }

    try {
      await axios.put(
        `${BOOKING_API_URL}/${bookingId}/status`,
        { trangThai: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${actionText} thành công!`);
      setBookings((current) =>
        current.map((b) => (b.MaDatPhong === bookingId ? { ...b, TrangThai: newStatus } : b))
      );
    } catch (err) {
      const message = err.response?.data?.message || `${actionText} thất bại.`;
      toast.error(message);
    }
  };

  const handleConfirmCashPayment = async (bookingId) => {
    if (!window.confirm('Bạn có chắc chắn đã nhận đủ tiền mặt từ khách hàng cho đơn này?')) {
      return;
    }

    try {
      setCashLoadingId(bookingId);
      await axios.post(
        `${BOOKING_API_URL}/${bookingId}/payment/confirm-cash`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Xác nhận đã thu tiền mặt thành công!');
      setBookings((current) =>
        current.map((b) =>
          b.MaDatPhong === bookingId
            ? {
                ...b,
                TrangThaiThanhToan: 'DaThanhToan',
                PhuongThucThanhToan: 'TIEN_MAT_KHI_NHAN_PHONG',
                NgayThanhToan: new Date().toISOString()
              }
            : b
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi xác nhận thu tiền mặt');
    } finally {
      setCashLoadingId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const filteredBookings = bookings.filter((b) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      b.MaDatPhong?.toString().includes(term) ||
      b.NGUOI_DUNG?.HoTen?.toLowerCase().includes(term) ||
      b.NGUOI_DUNG?.SoDienThoai?.includes(term) ||
      b.CHI_TIET_DAT_PHONG?.[0]?.HOMESTAY?.TenHomestay?.toLowerCase().includes(term);

    const matchStatus = statusFilter === 'ALL' || b.TrangThai === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <OwnerLayout
      title="Quản Lý Đơn Đặt Phòng"
      subtitle="Theo dõi tiến độ, đón tiếp khách và thu tiền đặt phòng trực tiếp"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E8E2D7',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ChoXacNhan">⏳ Chờ duyệt mới</option>
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
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#5C6861' }}>
          Đang tải danh sách đơn đặt phòng...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="data-table-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <h3 style={{ color: '#1C3B2B', marginBottom: '0.5rem' }}>Không tìm thấy đơn đặt nào</h3>
          <p style={{ color: '#5C6861' }}>Khi có khách đặt homestay của bạn, thông tin sẽ xuất hiện ngay tại đây.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredBookings.map((b) => {
            const detail = b.CHI_TIET_DAT_PHONG?.[0];
            const customer = b.NGUOI_DUNG;
            const isPaid = b.TrangThaiThanhToan === 'DaThanhToan';

            return (
              <div
                key={b.MaDatPhong}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E8E2D7',
                  padding: '1.5rem',
                  boxShadow: '0 2px 10px rgba(28, 59, 43, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1C3B2B' }}>
                        {detail?.HOMESTAY?.TenHomestay || `Đơn #${b.MaDatPhong}`}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#5C6861' }}>
                        (#{b.MaDatPhong})
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', color: '#5C6861', marginTop: '0.35rem' }}>
                      Khách: <strong>{customer?.HoTen || 'N/A'}</strong> &bull; SĐT: <strong>{customer?.SoDienThoai || 'Chưa cung cấp'}</strong> &bull; Email: {customer?.Email}
                    </div>

                    <div style={{ fontSize: '0.88rem', color: '#1C231F', marginTop: '0.35rem' }}>
                      📅 Thời gian lưu trú: <strong>{formatDate(b.NgayNhan)}</strong> đến <strong>{formatDate(b.NgayTra)}</strong> ({b.SoLuong} khách)
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803D' }}>
                      {parseFloat(b.Gia).toLocaleString('vi-VN')} đ
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
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

                      <span className={`status-pill ${isPaid ? 'success' : 'warning'}`}>
                        {isPaid ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #F0ECE4'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: '#8F9D95' }}>
                    {b.PhuongThucThanhToan && (
                      <span>
                        Phương thức: {b.PhuongThucThanhToan === 'QR_DEMO' ? '📱 QR Code Demo' : '💵 Tiền mặt khi nhận phòng'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Status actions */}
                    {b.TrangThai === 'ChoXacNhan' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(b.MaDatPhong, 'DaXacNhan')}
                          className="button-primary"
                          style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                        >
                          ✓ Xác nhận đơn
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(b.MaDatPhong, 'DaHuy')}
                          className="button-danger"
                          style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
                        >
                          ✕ Từ chối
                        </button>
                      </>
                    )}

                    {b.TrangThai === 'DaXacNhan' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(b.MaDatPhong, 'DangLuuTru')}
                          style={{
                            backgroundColor: '#0284c7',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.45rem 1rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          🏨 Khách nhận phòng (Check-in)
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(b.MaDatPhong, 'DaHuy')}
                          className="button-danger"
                          style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
                        >
                          ✕ Hủy đơn
                        </button>
                      </>
                    )}

                    {b.TrangThai === 'DangLuuTru' && (
                      <button
                        onClick={() => handleUpdateStatus(b.MaDatPhong, 'DaHoanThanh')}
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.45rem 1rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        ✓ Khách trả phòng (Hoàn thành)
                      </button>
                    )}

                    {/* Cash collection confirmation button */}
                    {!isPaid && b.TrangThai !== 'DaHuy' && (
                      <button
                        disabled={cashLoadingId === b.MaDatPhong}
                        onClick={() => handleConfirmCashPayment(b.MaDatPhong)}
                        style={{
                          backgroundColor: '#F59E0B',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.45rem 1rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        💵 {cashLoadingId === b.MaDatPhong ? 'Đang xác nhận...' : 'Xác nhận đã thu tiền mặt'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OwnerLayout>
  );
}