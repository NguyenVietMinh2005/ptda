// src/pages/HomestayDetailPage.jsx
import { useState, useEffect, useMemo } from 'react' // ĐÃ THÊM useMemo
import axios from 'axios'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StarRating from '../components/StarRating'
import { Heart } from 'lucide-react'
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
  const [ngayNhan, setNgayNhan] = useState('')
  const [ngayTra, setNgayTra] = useState('')
  const [soLuongKhach, setSoLuongKhach] = useState(1)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [hasExistingReview, setHasExistingReview] = useState(false);

  // --- XÁC THỰC (ĐÃ SỬA LỖI LOOP) ---
  const token = localStorage.getItem('authToken')
  const userString = localStorage.getItem('authUser');
  
  // Dùng useMemo để 'user' ổn định, tránh vòng lặp vô tận
  const user = useMemo(() => {
    return userString ? JSON.parse(userString) : null;
  }, [userString]); 
  // ---------------------------------

  // --- LOGIC ---

  // 1. useEffect (Tải dữ liệu chi tiết VÀ yêu thích)
  useEffect(() => {
    // API 1: Lấy chi tiết Homestay
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
    
    // API 2: Lấy Yêu thích
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
    
  }, [id, token, user, DETAIL_API_URL]) // Dependency đã sửa

  // 2. Hàm xử lý Thích/Bỏ thích
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

  // 3. Hàm xử lý Đặt phòng
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
      setBookingError('Vui lòng chọn ngày nhận và ngày trả phòng.')
      setBookingLoading(false)
      return
    }
    
    const ngayNhanDate = new Date(ngayNhan)
    const ngayTraDate = new Date(ngayTra)
    const homNay = new Date()
    homNay.setHours(0, 0, 0, 0) 

    if (ngayNhanDate < homNay) {
      setBookingError('Ngày nhận phòng không được là ngày trong quá khứ.')
      setBookingLoading(false)
      return
    }
    if (ngayTraDate <= ngayNhanDate) {
      setBookingError('Ngày trả phòng phải sau ngày nhận phòng.')
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
    } catch (err) {
      const message = err.response?.data?.message || 'Đặt phòng thất bại.'
      setBookingError(message)
    } finally {
      setBookingLoading(false)
    }
  }

  // 4. Hàm xử lý Gửi Đánh giá
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

  // 5. Hàm trợ giúp lấy URL ảnh
  const getImageUrl = (imagePath) => {
    if (!imagePath) return PLACEHOLDER_IMAGE;
    if (imagePath.startsWith('http')) return imagePath; 
    return `http://localhost:3000/${imagePath}`;
  }
  
  // --- XỬ LÝ TRẠNG THÁI LOADING / ERROR ---
  if (loading) return (
    <div className="page-container"><Header /><p>Đang tải chi tiết...</p></div>
  )
  if (error) return (
    <div className="page-container"><Header /><p style={{ color: 'red' }}>{error}</p></div>
  )
  if (!homestay) return (
    <div className="page-container"><Header /><p>Không tìm thấy homestay.</p></div>
  )

  // --- BIẾN PHỤ TRỢ CHO RENDER (ĐÃ SẮP XẾP LẠI) ---
  const isFavorite = favoriteIds.has(homestay.MaHomestay);
  const todayString = new Date().toISOString().split('T')[0];

  // 1. Lấy TẤT CẢ đánh giá (kể cả chỉ có sao)
  const allReviews = homestay.DANH_GIA || [];
  const totalReviews = allReviews.length; // Tổng số người đã chấm sao

  // 2. Lấy đánh giá CÓ BÌNH LUẬN (Phải được định nghĩa TRƯỚC khi dùng)
  const reviewsWithComments = allReviews.filter(
    review => review.BinhLuan && review.BinhLuan.trim() !== ''
  );
  const totalComments = reviewsWithComments.length; // Tổng số người đã bình luận

  // 3. Tính Sao trung bình
  let averageRating = "5.0"; 
  if (totalReviews > 0) {
    const sum = allReviews.reduce((acc, review) => acc + (review.SoSao || 0), 0);
    averageRating = (sum / totalReviews).toFixed(1);
  }
  // ---------------------------------------------

  // --- RENDER (GIAO DIỆN) ---
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
          <p><strong>Giá:</strong> {homestay.Gia} VNĐ/đêm</p>
          <p><strong>Số khách tối đa:</strong> {homestay.SoKhachToiDa}</p>
          <p><strong>Mô tả:</strong> {homestay.MoTa || 'Không có mô tả'}</p>
          <p><strong>Tiện ích:</strong> {homestay.TienIch || 'Không có thông tin'}</p>
        </div>

        <form className="booking-form" onSubmit={handleBooking}>
          <h3>Đặt chỗ</h3>
          <div className="booking-inputs">
            <div className="form-group">
              <label htmlFor="ngayNhan">Ngày nhận phòng:</label>
              <input 
                type="date" 
                id="ngayNhan"
                value={ngayNhan}
                onChange={(e) => setNgayNhan(e.target.value)}
                min={todayString}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ngayTra">Ngày trả phòng:</label>
              <input 
                type="date" 
                id="ngayTra"
                value={ngayTra}
                onChange={(e) => setNgayTra(e.target.value)}
                min={ngayNhan || todayString}
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

