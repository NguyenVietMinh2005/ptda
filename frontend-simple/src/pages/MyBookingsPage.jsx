// src/pages/MyBookingsPage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import '../App.css' // Dùng chung CSS
import Header from '../components/Header' // Dùng Header
import { toast } from 'react-hot-toast';

// API để TẢI bookings
const API_URL = 'http://localhost:3000/api/auth/me/bookings'
// API để KHIẾU NẠI và HỦY (cùng 1 gốc)
const BOOKING_API_URL = 'http://localhost:3000/api/bookings' // <-- LỖI LÀ DO THIẾU DÒNG NÀY

// Hàm trợ giúp để lấy URL ảnh (giống HomePage)
const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/600x400/eee/ccc?text=Homestay';
  if (imagePath.startsWith('http')) return imagePath;
  return `http://localhost:3000/${imagePath}`;
}

function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // Lấy token và user
  const token = localStorage.getItem('authToken')
  const user = JSON.parse(localStorage.getItem('authUser'))

  useEffect(() => {
    // 1. Kiểm tra đăng nhập
    if (!token) {
      toast.success('Bạn cần đăng nhập để xem trang này.')
      navigate('/login') // Chuyển về trang đăng nhập
      return // Dừng thực thi
    }

    // 2. Gọi API để lấy lịch sử đặt phòng
    const fetchBookings = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        setBookings(response.data.data)
      } catch (err) {
        setError('Không thể tải lịch sử đặt phòng.')
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [token, navigate]) // Phụ thuộc vào token và navigate

  // (Đã xóa hàm handleLogout vì Header.jsx đã xử lý)

  // Định dạng ngày cho dễ đọc
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN')
  }

  // Hàm Khiếu nại
  const handleComplain = async (bookingId) => {
    const noiDung = window.prompt("Vui lòng nhập lý do khiếu nại của bạn:")
    if (noiDung) {
      try {
        await axios.post(
          `${BOOKING_API_URL}/${bookingId}/complain`, // <-- Dùng biến mới
          { noiDung: noiDung }, 
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        toast.success('Gửi khiếu nại thành công!')
      } catch (err) {
        const message = err.response?.data?.message || 'Gửi khiếu nại thất bại.'
        toast.error(`Lỗi: ${message}`)
      }
    }
  }

  // Ham huy don
  const handleCancel = async (bookingId) => {
    if (window.confirm('Bạn có chắc chắn muốn hủy đơn đặt phòng này?')) {
      try {
        const response = await axios.put(
          `${BOOKING_API_URL}/${bookingId}/cancel`, // <-- BIẾN NÀY GIỜ ĐÃ TỒN TẠI
          {}, 
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        toast.success('Hủy đơn thành công!')
        setBookings(currentBookings => 
          currentBookings.map(b => 
            b.MaDatPhong === bookingId ? response.data.data : b
          )
        )
      } catch (err) {
        // Bây giờ, nếu token hết hạn, bạn sẽ thấy lỗi "TokenExpiredError"
        const message = err.response?.data?.message || 'Hủy đơn thất bại.'
        toast.error(`Lỗi: ${message}`)
      }
    }
  }

  if (loading) return (
    <div className="page-container"><Header /><p>Đang tải...</p></div>
  )
  if (error) return (
    <div className="page-container"><Header /><p>{error}</p></div>
  )

  return (
    <div className="page-container">
      <Header />

      <main>
        <h2>Lịch sử Đặt phòng của bạn</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div className="bookings-list">
          {bookings.length === 0 && !loading && (
            <p>Bạn chưa có đơn đặt phòng nào.</p>
          )}

          {bookings.map((booking) => {
            const detail = booking.CHI_TIET_DAT_PHONG[0];
            if (!detail) return null; 

            const homestay = detail.HOMESTAY;
            const imageUrl = getImageUrl(homestay?.HINH_ANH?.[0]?.HinhAnh); // Thêm ?
            
            if (!homestay) return null; // Bỏ qua nếu homestay đã bị xóa

            return (
              <div key={booking.MaDatPhong} className="booking-card">
                <img src={imageUrl} alt={homestay.TenHomestay} className="booking-card-image" />
                <div className="booking-card-info">
                  <h3>{homestay.TenHomestay}</h3>
                  <p><strong>Ngày nhận:</strong> {formatDate(booking.NgayNhan)}</p>
                  <p><strong>Ngày trả:</strong> {formatDate(booking.NgayTra)}</p>
                  <p><strong>Số khách:</strong> {booking.SoLuong}</p>
                  <p><strong>Tổng tiền:</strong> {booking.Gia} VNĐ</p>
                  <p><strong>Trạng thái:</strong> 
                    <span className={`status ${booking.TrangThai}`}>
                      {booking.TrangThai}
                    </span>
                  </p>

                  <div className="booking-actions">
                    {booking.TrangThai === 'ChoXacNhan' && (
                      <button 
                        className="cancel-button"
                        onClick={() => handleCancel(booking.MaDatPhong)}
                      >
                        Hủy đơn
                      </button>
                    )}
                    {booking.TrangThai !== 'DaHuy' && (
                      <button 
                        className="complain-button"
                        onClick={() => handleComplain(booking.MaDatPhong)}
                      >
                        Khiếu nại
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export default MyBookingsPage
