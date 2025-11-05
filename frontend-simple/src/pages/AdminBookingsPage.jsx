// src/pages/AdminBookingsPage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader'
import { toast } from 'react-hot-toast'
import '../App.css'

const ADMIN_API_URL = 'http://localhost:3000/api/admin'

function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('ownerAuthToken');
  const ownerString = localStorage.getItem('ownerAuthUser');
  const adminUser = useMemo(() => {
    return ownerString ? JSON.parse(ownerString) : null;
  }, [ownerString]);

  // Tải dữ liệu
  useEffect(() => {
    if (!token || !adminUser || adminUser.Quyen !== 'admin') {
      toast.error('Bạn không có quyền truy cập trang này.');
      navigate('/owner/login');
      return;
    }
    const fetchData = async () => {
      try {
        const bookingsRes = await axios.get(`${ADMIN_API_URL}/bookings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setBookings(bookingsRes.data.data);
      } catch (err) {
        toast.error('Không thể tải danh sách Đơn đặt.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, adminUser]);

  // Hàm Cập nhật Trạng thái
  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      const response = await axios.put(
        `${ADMIN_API_URL}/bookings/${bookingId}/status`,
        { trangThai: newStatus },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Cập nhật trạng thái đơn thành công!');
      setBookings(currentBookings =>
        currentBookings.map(b =>
          b.MaDatPhong === bookingId ? response.data.data : b
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật thất bại.');
    }
  };

  if (loading) return <div className="page-container"><OwnerHeader /><p>Đang tải...</p></div>;

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Quản lý Đơn Đặt (Toàn hệ thống)</h2>
        <div className="admin-section">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID Đơn</th>
                <th>Người đặt</th>
                <th>Homestay</th>
                <th>Ngày nhận</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(booking => {
                const homestayName = booking.CHI_TIET_DAT_PHONG[0]?.HOMESTAY?.TenHomestay || 'N/A';
                
                return (
                  <tr key={booking.MaDatPhong}>
                    <td>{booking.MaDatPhong}</td>
                    <td>{booking.NGUOI_DUNG.HoTen}</td>
                    <td>{homestayName}</td>
                    <td>{new Date(booking.NgayNhan).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <span className={`status ${booking.TrangThai}`}>
                        {booking.TrangThai}
                      </span>
                    </td>
                    <td>
                      <select 
                        className="role-select" 
                        value={booking.TrangThai}
                        onChange={(e) => handleUpdateBookingStatus(booking.MaDatPhong, e.target.value)}
                      >
                        <option value="ChoXacNhan">Chờ Xác Nhận</option>
                        <option value="DaXacNhan">Đã Xác Nhận</option>
                        <option value="DaHuy">Đã Hủy</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminBookingsPage;