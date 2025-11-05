// src/pages/OwnerBookingsPage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader' // Dùng Header của Chủ nhà
import { toast } from 'react-hot-toast'
import '../App.css'

const API_URL = 'http://localhost:3000/api/owner/me/bookings'
const UPDATE_API_URL = 'http://localhost:3000/api/bookings' // API để Xác nhận/Hủy

function OwnerBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const token = localStorage.getItem('ownerAuthToken')

  useEffect(() => {
    if (!token) {
      toast.error('Bạn cần đăng nhập với tư cách Chủ Homestay.');
      navigate('/owner/login');
      return;
    }

    const fetchBookings = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setBookings(response.data.data);
      } catch (err) {
        toast.error('Không thể tải danh sách đơn đặt.');
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [token, navigate]);

  // Hàm Xử lý Xác nhận / Hủy
  const handleUpdateStatus = async (bookingId, newStatus) => {
    const actionText = newStatus === 'DaXacNhan' ? 'Xác nhận' : 'Hủy';
    
    if (!window.confirm(`Bạn có chắc muốn ${actionText} đơn này?`)) {
      return;
    }

    try {
      const response = await axios.put(
        `${UPDATE_API_URL}/${bookingId}/status`,
        { trangThai: newStatus }, // Body gửi lên
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success(`${actionText} đơn thành công!`);
      
      // Cập nhật UI ngay lập tức
      setBookings(currentBookings =>
        currentBookings.map(b =>
          b.MaDatPhong === bookingId ? response.data.data : b
        )
      );
    } catch (err) {
      const message = err.response?.data?.message || `${actionText} đơn thất bại.`;
      toast.error(message);
    }
  };
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  if (loading) return (
    <div className="page-container"><OwnerHeader /><p>Đang tải đơn đặt...</p></div>
  );

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Quản lý Đơn đặt phòng</h2>
        
        <div className="bookings-list"> {/* Tái sử dụng CSS từ MyBookingsPage */}
          {bookings.length === 0 && !loading && (
            <p>Không có đơn đặt phòng nào.</p>
          )}

          {bookings.map((booking) => {
            const detail = booking.CHI_TIET_DAT_PHONG[0];
            const customer = booking.NGUOI_DUNG;
            if (!detail || !customer) return null;

            return (
              <div key={booking.MaDatPhong} className="booking-card booking-management-card">
                <div className="booking-card-info">
                  <h3>Đơn của: {customer.HoTen}</h3>
                  <p><strong>Email:</strong> {customer.Email}</p>
                  <p><strong>SĐT:</strong> {customer.SoDienThoai || 'Chưa cung cấp'}</p>
                  <p><strong>Ngày nhận:</strong> {formatDate(booking.NgayNhan)}</p>
                  <p><strong>Ngày trả:</strong> {formatDate(booking.NgayTra)}</p>
                  <p><strong>Trạng thái:</strong>
                    <span className={`status ${booking.TrangThai}`}>
                      {booking.TrangThai}
                    </span>
                  </p>

                  {/* Nút Hành động */}
                  {booking.TrangThai === 'ChoXacNhan' && (
                    <div className="booking-management-actions">
                      <button 
                        className="button-approve"
                        onClick={() => handleUpdateStatus(booking.MaDatPhong, 'DaXacNhan')}
                      >
                        Xác nhận
                      </button>
                      <button 
                        className="button-danger"
                        onClick={() => handleUpdateStatus(booking.MaDatPhong, 'DaHuy')}
                      >
                        Hủy đơn
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default OwnerBookingsPage;