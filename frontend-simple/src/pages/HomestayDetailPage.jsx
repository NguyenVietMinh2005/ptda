// src/pages/HomestayDetailPage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StarRating from '../components/StarRating'
import { toast } from 'react-hot-toast';
import '../App.css' 

// --- API URLs ---
const FAVORITES_API_URL = 'http://localhost:3000/api/auth/me/favorites'
const FAVORITE_TOGGLE_API_URL = 'http://localhost:3000/api/homestays'
const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400/eee/ccc?text=Homestay'
// -----------------

function HomestayDetailPage() {
  const { id } = useParams() 
  const navigate = useNavigate()
  
  // URL API động
  const DETAIL_API_URL = `http://localhost:3000/api/homestays/${id}`
  const BOOKING_API_URL = `http://localhost:3000/api/homestays/${id}/book`
  const REVIEW_API_URL = `http://localhost:3000/api/homestays/${id}/reviews`

  // --- STATE ---
  const [homestay, setHomestay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // 1. Sửa state ngày thành datetime-local
  const [ngayNhan, setNgayNhan] = useState('')
  const [ngayTra, setNgayTra] = useState('') // Tự động tính
  const [soNgay, setSoNgay] = useState(1)    // Thêm state số ngày
  
  const [soLuongKhach, setSoLuongKhach] = useState(1)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [hasExistingReview, setHasExistingReview] = useState(false);

  // --- XÁC THỰC ---
  const token = localStorage.getItem('authToken')
  const userString = localStorage.getItem('authUser');
  
  const user = useMemo(() => {
    return userString ? JSON.parse(userString) : null;
  }, [userString]); 
  // ---------------------------------

  // --- LOGIC ---

  // 1. Tự động tính NGÀY TRẢ khi NGÀY NHẬN hoặc SỐ NGÀY thay đổi
  useEffect(() => {
    if (ngayNhan && soNgay > 0) {
      const dateNhan = new Date(ngayNhan);
      const dateTra = new Date(dateNhan);
      
      // Cộng thêm số ngày vào (giữ nguyên giờ phút)
      dateTra.setDate(dateTra.getDate() + parseInt(soNgay));

      // Xử lý múi giờ để hiển thị đúng trên input datetime-local
      const tzOffset = dateTra.getTimezoneOffset() * 60000;
      const localISOTime = new Date(dateTra.getTime() - tzOffset).toISOString().slice(0, 16);

      setNgayTra(localISOTime);
    }
  }, [ngayNhan, soNgay]);

  // 2. useEffect tải dữ liệu
  useEffect(() => {
    const fetchHomestayDetail = async () => {
      try {
        setLoading(true);
        const homestayRes = await axios.get(DETAIL_API_URL)
        const loadedHomestay = homestayRes.data.data;
        setHomestay(loadedHomestay); 
        
        if (user && loadedHomestay.DANH_GIA) {
          const existingReview = loadedHomestay.DANH_GIA.find(
            review => review.MaNguoiDung === user.MaNguoiDung
          );
          if (existingReview) {
            setHasExistingReview(true);
            setReviewRating(existingReview.SoSao || 0);
            setReviewComment(existingReview.BinhLuan || '');
          }
        }
      } catch (err) {
        setError('Không thể tải chi tiết homestay.');
      } finally {
        setLoading(false); 
      }
    }
    
    const fetchFavorites = async () => {
      if (token) {
        try {
          const favoritesRes = await axios.get(FAVORITES_API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const ids = favoritesRes.data.data.map(fav => fav.MaHomestay);
          setFavoriteIds(new Set(ids));
        } catch (err) {
          console.warn("Không thể tải Yêu thích:", err);
        }
      }
    }
    fetchHomestayDetail();
    fetchFavorites();
    
  }, [id, token, user, DETAIL_API_URL])

  // 3. Hàm xử lý Thích/Bỏ thích
  const handleToggleFavorite = async (e, homestayId, isFavorite) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    if (!token) {
      toast.success('Bạn cần đăng nhập để sử dụng chức năng này.');
      navigate('/login');
      return;
    }
    try {
      if (isFavorite) {
        await axios.delete(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        setFavoriteIds(prevIds => {
          const newIds = new Set(prevIds); newIds.delete(homestayId); return newIds;
        });
      } else {
        await axios.post(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        setFavoriteIds(prevIds => {
          const newIds = new Set(prevIds); newIds.add(homestayId); return newIds;
        });
      }
    } catch (err) {
      toast.success('Đã xảy ra lỗi. Vui lòng thử lại.');
    }
  }

  // 4. Hàm xử lý Đặt phòng
  const handleBooking = async (e) => {
    e.preventDefault() 
    setBookingLoading(true)
    setBookingError(null)

    if (!user || !token) {
      toast.success('Bạn cần đăng nhập để đặt phòng!')
      navigate('/login')
      return
    }

    const soKhachInt = parseInt(soLuongKhach)
    if (soKhachInt > homestay.SoKhachToiDa || soKhachInt < 1) {
      setBookingError(`Số khách phải từ 1 đến ${homestay.SoKhachToiDa}.`)
      setBookingLoading(false)
      return
    }

    if (!ngayNhan || !ngayTra) {
      setBookingError('Vui lòng chọn ngày giờ nhận và nhập số ngày.')
      setBookingLoading(false)
      return
    }
    
    // Check ngày quá khứ
    const ngayNhanDate = new Date(ngayNhan)
    const now = new Date()
    // Cho phép sai số nhỏ hoặc so sánh timestamp nếu cần chính xác tuyệt đối
    if (ngayNhanDate < now) {
      setBookingError('Thời gian nhận phòng phải từ thời điểm hiện tại trở đi.')
      setBookingLoading(false)
      return
    }

    try {
      await axios.post(
        BOOKING_API_URL, 
        { ngayNhan, ngayTra, soLuongKhach: soKhachInt },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      toast.success('Đặt phòng thành công! (Trạng thái: Chờ xác nhận)')
      setNgayNhan('')
      setNgayTra('')
      setSoNgay(1)
    } catch (err) {
      const message = err.response?.data?.message || 'Đặt phòng thất bại.'
      setBookingError(message)
    } finally {
      setBookingLoading(false)
    }
  }

  // 5. Hàm xử lý Gửi Đánh giá
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewLoading(true);
    setReviewError(null);
    try {
      await axios.post(
        REVIEW_API_URL,
        { 
          soSao: reviewRating, 
          binhLuan: reviewComment 
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success(hasExistingReview ? 'Cập nhật đánh giá thành công!' : 'Gửi đánh giá thành công!');
      window.location.reload(); 

    } catch (err) {
      setReviewError(err.response?.data?.message || 'Gửi đánh giá thất bại.');
    } finally {
      setReviewLoading(false);
    }
  }

  const getImageUrl = (imagePath) => {
    if (!imagePath) return PLACEHOLDER_IMAGE;
    if (imagePath.startsWith('http')) return imagePath; 
    return `http://localhost:3000/${imagePath}`;
  }
  
  if (loading) return (
    <div className="page-container"><Header /><p>Đang tải chi tiết...</p></div>
  )
  if (error) return (
    <div className="page-container"><Header /><p style={{ color: 'red' }}>{error}</p></div>
  )
  if (!homestay) return (
    <div className="page-container"><Header /><p>Không tìm thấy homestay.</p></div>
  )

  const isFavorite = favoriteIds.has(homestay.MaHomestay);
  
  const allReviews = homestay.DANH_GIA || [];
  const totalReviews = allReviews.length; 
  const reviewsWithComments = allReviews.filter(
    review => review.BinhLuan && review.BinhLuan.trim() !== ''
  );
  const totalComments = reviewsWithComments.length;

  let averageRating = "5.0"; 
  if (totalReviews > 0) {
    const sum = allReviews.reduce((acc, review) => acc + (review.SoSao || 0), 0);
    averageRating = (sum / totalReviews).toFixed(1);
  }

  // --- RENDER ---
  return (
    <div className="page-container">
      <Header />
      
      <main className="homestay-detail">
        <div className="detail-header-container">
          <h2>{homestay.TenHomestay}</h2>
        </div>
        
        <div className="detail-subtitle">
          <span className="avg-rating">★ {averageRating} ({totalComments} bình luận)</span>
          <span className="detail-location-dot">·</span>
          <p className="detail-location">{homestay.DiaDiem}</p>
        </div>

        <div className="image-gallery">
          {homestay.HINH_ANH && homestay.HINH_ANH.length > 0 ? (
            homestay.HINH_ANH.map((image, index) => (
              <img 
                key={index} 
                src={getImageUrl(image.HinhAnh)}
                alt={`Ảnh ${index + 1}`} 
              />
            ))
          ) : (
            <img src={getImageUrl(null)} alt="Ảnh tạm" />
          )}
        </div>

        <div className="detail-info">
          <p><strong>Giá:</strong> {homestay.Gia} VNĐ/ngày</p>
          <p><strong>Số khách tối đa:</strong> {homestay.SoKhachToiDa}</p>
          <p><strong>Mô tả:</strong> {homestay.MoTa || 'Không có mô tả'}</p>
          <p><strong>Tiện ích:</strong> {homestay.TienIch || 'Không có thông tin'}</p>
        </div>

        <form className="booking-form" onSubmit={handleBooking}>
          <h3>Đặt chỗ</h3>
          <div className="booking-inputs">
            
            {/* 1. Chọn ngày giờ nhận */}
            <div className="form-group">
              <label htmlFor="ngayNhan">Ngày giờ nhận phòng:</label>
              <input 
                type="datetime-local" 
                id="ngayNhan"
                value={ngayNhan}
                onChange={(e) => setNgayNhan(e.target.value)}
              />
            </div>

            {/* 2. Nhập số ngày */}
            <div className="form-group">
              <label htmlFor="soNgay">Số ngày lưu trú:</label>
              <input 
                type="number" 
                id="soNgay"
                value={soNgay}
                onChange={(e) => setSoNgay(Number(e.target.value))}
                min="1"
                max="30"
              />
            </div>

            {/* 3. Hiển thị ngày trả tự động */}
            <div className="form-group">
              <label htmlFor="ngayTra">Ngày giờ trả (Tự động):</label>
              <input 
                type="datetime-local" 
                id="ngayTra"
                value={ngayTra}
                readOnly
                style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="soLuongKhach">Số khách:</label>
              <input 
                type="number" 
                id="soLuongKhach"
                value={soLuongKhach}
                onChange={(e) => setSoLuongKhach(e.target.value)}
                min="1"
                max={homestay.SoKhachToiDa} 
              />
            </div>
          </div>
          {bookingError && <p className="error-message">{bookingError}</p>}
          
          <div className="booking-form-actions">
            <button type="submit" className="book-button" disabled={bookingLoading}>
              {bookingLoading ? 'Đang xử lý...' : 'Đặt Phòng Ngay'}
            </button>
            <button 
              type="button" 
              className={isFavorite ? 'favorite-button favorited' : 'favorite-button'}
              onClick={(e) => handleToggleFavorite(e, homestay.MaHomestay, isFavorite)}
            >
              {isFavorite ? '❤️ Đã yêu thích' : '♡ Thêm vào Yêu thích'}
            </button>
          </div>
        </form>

        <div className="reviews-section">
          <h3>
            ★ {averageRating} · {totalComments} bình luận
          </h3>
          
          {reviewsWithComments.length > 0 ? (
            reviewsWithComments.map((review) => (
              <div key={review.MaDanhGia} className="review-card">
                <strong>{review.NGUOI_DUNG.HoTen}</strong>
                <p>{review.BinhLuan}</p>
              </div>
            ))
          ) : (
            <p>Chưa có bình luận nào.</p>
          )}

          {user && ( 
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <h4>{hasExistingReview ? 'Chỉnh sửa đánh giá của bạn' : 'Viết đánh giá của bạn'}</h4>
              {reviewError && <p className="error-message">{reviewError}</p>}
              <div className="form-group">
                <label htmlFor="rating">Số sao:</label>
                <StarRating 
                  rating={reviewRating}
                  onRatingChange={setReviewRating} 
                />
              </div>
              <div className="form-group">
                <label htmlFor="comment">Bình luận: (Không bắt buộc)</label>
                <textarea
                  id="comment"
                  rows="4"
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                ></textarea>
              </div>
              <button type="submit" className="button-primary" disabled={reviewLoading}>
                {reviewLoading 
                  ? 'Đang gửi...' 
                  : (hasExistingReview ? 'Cập Nhật Đánh Giá' : 'Gửi Đánh Giá')}
              </button>
            </form>
          )}
          
        </div>
      </main>
    </div>
  )
}

export default HomestayDetailPage