// src/pages/HomestayDetailPage.jsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  MapPin, Users, Calendar, Heart, Share2, Star, 
  ShieldCheck, Check, Trees, Clock, AlertCircle, Sparkles,
  Wifi, UtensilsCrossed, Tv, Wind, Waves, Coffee, Car, Flame,
  CheckCircle2, ArrowLeft, Award, User
} from 'lucide-react'
import Header from '../components/Header'
import StarRating from '../components/StarRating'
import PaymentModal from '../components/PaymentModal'
import { toast } from 'react-hot-toast'

// --- API URLs ---
import { API_BASE_URL, getFullImageUrl } from '../utils/apiConfig'

const FAVORITES_API_URL = `${API_BASE_URL}/auth/me/favorites`
const FAVORITE_TOGGLE_API_URL = `${API_BASE_URL}/homestays`
const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400/eee/ccc?text=Homestay'

function HomestayDetailPage() {
  const { id } = useParams() 
  const navigate = useNavigate()
  
  const DETAIL_API_URL = `${API_BASE_URL}/homestays/${id}`
  const BOOKING_API_URL = `${API_BASE_URL}/homestays/${id}/book`
  const REVIEW_API_URL = `${API_BASE_URL}/homestays/${id}/reviews`

  // --- STATE ---
  const [homestay, setHomestay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Date & booking state
  const [ngayNhan, setNgayNhan] = useState('')
  const [ngayTra, setNgayTra] = useState('') 
  const [soNgay, setSoNgay] = useState(1)    
  const [soLuongKhach, setSoLuongKhach] = useState(1)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [bookedRanges, setBookedRanges] = useState([])
  
  // Payment Modal state
  const [payingBookingId, setPayingBookingId] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  
  // Review state
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [hasExistingReview, setHasExistingReview] = useState(false)
  const [canReview, setCanReview] = useState(false)
  const [canReviewReason, setCanReviewReason] = useState('')

  // Overlap checking
  const isDateOverlapping = useMemo(() => {
    if (!ngayNhan || !ngayTra || !bookedRanges.length) return false;
    const reqStart = new Date(ngayNhan);
    const reqEnd = new Date(ngayTra);
    for (const r of bookedRanges) {
      const bStart = new Date(r.startDate);
      const bEnd = new Date(r.endDate);
      if (reqStart < bEnd && reqEnd > bStart) {
        return true;
      }
    }
    return false;
  }, [ngayNhan, ngayTra, bookedRanges]);


  // Auth state
  const token = localStorage.getItem('authToken')
  const userString = localStorage.getItem('authUser')
  
  const user = useMemo(() => {
    return userString ? JSON.parse(userString) : null
  }, [userString])

  // Auto calculate ngayTra based on ngayNhan + soNgay
  useEffect(() => {
    if (ngayNhan && soNgay > 0) {
      const dateNhan = new Date(ngayNhan)
      const dateTra = new Date(dateNhan)
      dateTra.setDate(dateTra.getDate() + parseInt(soNgay))

      const tzOffset = dateTra.getTimezoneOffset() * 60000
      const localISOTime = new Date(dateTra.getTime() - tzOffset).toISOString().slice(0, 16)
      setNgayTra(localISOTime)
    }
  }, [ngayNhan, soNgay])

  // Fetch homestay detail, user favorites, and review eligibility
  useEffect(() => {
    const fetchHomestayDetail = async () => {
      try {
        setLoading(true)
        const homestayRes = await axios.get(DETAIL_API_URL)
        const loadedHomestay = homestayRes.data.data
        setHomestay(loadedHomestay) 
        
        if (user && loadedHomestay.DANH_GIA) {
          const existingReview = loadedHomestay.DANH_GIA.find(
            review => review.MaNguoiDung === user.MaNguoiDung
          )
          if (existingReview) {
            setHasExistingReview(true)
            setReviewRating(existingReview.SoSao || 5)
            setReviewComment(existingReview.BinhLuan || '')
          }
        }
      } catch {
        setError('Không thể tải chi tiết homestay.')
      } finally {
        setLoading(false) 
      }
    }
    
    const fetchFavorites = async () => {
      if (token) {
        try {
          const favoritesRes = await axios.get(FAVORITES_API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          const ids = favoritesRes.data.data.map(fav => fav.MaHomestay)
          setFavoriteIds(new Set(ids))
        } catch (err) {
          console.warn('Không thể tải Yêu thích:', err)
        }
      }
    }

    const checkReviewEligibility = async () => {
      if (token && id) {
        try {
          const canRes = await axios.get(`${API_BASE_URL}/homestays/${id}/can-review`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          setCanReview(canRes.data.canReview)
          setCanReviewReason(canRes.data.reason || '')
        } catch {
          setCanReview(false)
        }
      }
    }

    fetchHomestayDetail()
    fetchFavorites()
    checkReviewEligibility()
  }, [id, token, user, DETAIL_API_URL])

  const fetchAvailability = useCallback(async () => {
    if (id) {
      try {
        const availRes = await axios.get(`${API_BASE_URL}/homestays/${id}/availability`);
        setBookedRanges(availRes.data?.bookedRanges || []);
      } catch (err) {
        console.warn('Không thể tải thông tin phòng trống:', err);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);


  // Favorite handler
  const handleToggleFavorite = async (e, homestayId, isFavorite) => {
    e.preventDefault() 
    e.stopPropagation() 
    if (!token) {
      toast.error('Bạn cần đăng nhập để sử dụng chức năng này.')
      navigate('/login')
      return
    }
    try {
      if (isFavorite) {
        await axios.delete(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        setFavoriteIds(prevIds => {
          const newIds = new Set(prevIds)
          newIds.delete(homestayId)
          return newIds
        })
        toast.success('Đã bỏ khỏi danh sách yêu thích.')
      } else {
        await axios.post(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        setFavoriteIds(prevIds => {
          const newIds = new Set(prevIds)
          newIds.add(homestayId)
          return newIds
        })
        toast.success('Đã thêm vào danh sách yêu thích!')
      }
    } catch {
      toast.error('Đã xảy ra lỗi khi cập nhật yêu thích.')
    }
  }

  // Booking submission
  const handleBooking = async (e) => {
    e.preventDefault() 
    setBookingLoading(true)
    setBookingError(null)

    if (!user || !token) {
      toast.error('Bạn cần đăng nhập để đặt phòng!')
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
    
    const ngayNhanDate = new Date(ngayNhan)
    const now = new Date()
    if (ngayNhanDate < now) {
      setBookingError('Thời gian nhận phòng phải từ thời điểm hiện tại trở đi.')
      setBookingLoading(false)
      return
    }

    if (isDateOverlapping) {
      setBookingError('Khoảng thời gian này đã có khách đặt trước! Vui lòng chọn ngày khác.')
      setBookingLoading(false)
      return
    }

    try {
      const response = await axios.post(
        BOOKING_API_URL, 
        { ngayNhan, ngayTra, soLuongKhach: soKhachInt },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      const newBooking = response.data?.data
      const newBookingId = newBooking?.MaDatPhong

      toast.success('Đặt phòng thành công! Đang chuyển đến bước thanh toán...')
      setNgayNhan('')
      setNgayTra('')
      setSoNgay(1)
      setBookingError(null)

      if (newBookingId) {
        setPayingBookingId(newBookingId)
        setShowPaymentModal(true)
      }
      fetchAvailability()
    } catch (err) {
      const message = err.response?.data?.message || 'Đặt phòng thất bại.'
      setBookingError(message)
      toast.error(message)
    } finally {
      setBookingLoading(false)
    }
  }

  // Review submission
  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    setReviewLoading(true)
    setReviewError(null)
    try {
      await axios.post(
        REVIEW_API_URL,
        { 
          soSao: reviewRating, 
          binhLuan: reviewComment 
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      
      toast.success(hasExistingReview ? 'Cập nhật đánh giá thành công!' : 'Gửi đánh giá thành công!')
      window.location.reload() 
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Gửi đánh giá thất bại.')
    } finally {
      setReviewLoading(false)
    }
  }

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href)
    toast.success('Đã sao chép liên kết vào bộ nhớ tạm!')
  }

  const getImageUrl = (imagePath) => getFullImageUrl(imagePath, PLACEHOLDER_IMAGE)
  
  if (loading) return (
    <div className="site-wrapper">
      <Header />
      <div className="detail-loading-box">
        <div className="spinner" />
        <p>Đang nạp thông tin chi tiết homestay...</p>
      </div>
    </div>
  )

  if (error || !homestay) return (
    <div className="site-wrapper">
      <Header />
      <div className="detail-error-box">
        <AlertCircle size={40} className="error-icon" />
        <h3>{error || 'Không tìm thấy homestay này'}</h3>
        <Link to="/" className="btn-back-home">Quay lại trang chủ</Link>
      </div>
    </div>
  )

  const isFavorite = favoriteIds.has(homestay.MaHomestay)
  const allReviews = homestay.DANH_GIA || []
  const totalReviews = allReviews.length
  const reviewsWithComments = allReviews.filter(
    review => review.BinhLuan && review.BinhLuan.trim() !== ''
  )

  let averageRating = "5.0"
  if (totalReviews > 0) {
    const sum = allReviews.reduce((acc, r) => acc + (r.SoSao || 0), 0)
    averageRating = (sum / totalReviews).toFixed(1)
  }

  // Calculate pricing breakdown
  const dailyPrice = Number(homestay.Gia)
  const calculatedTotal = dailyPrice * soNgay
  const formattedDaily = dailyPrice.toLocaleString('vi-VN')
  const formattedTotal = calculatedTotal.toLocaleString('vi-VN')

  // Parse amenities to tags
  const amenitiesList = homestay.TienIch 
    ? homestay.TienIch.split(',').map(item => item.trim()).filter(Boolean)
    : ['Wifi miễn phí', 'Điều hòa 2 chiều', 'Bếp tiện nghi', 'Khóa thông minh', 'Sân vườn']

  // Gallery photos
  const photos = homestay.HINH_ANH && homestay.HINH_ANH.length > 0
    ? homestay.HINH_ANH.map(p => getImageUrl(p.HinhAnh))
    : [PLACEHOLDER_IMAGE]

  return (
    <div className="site-wrapper">
      <Header />
      
      <main className="detail-main-container">
        
        {/* Breadcrumbs & Back Link */}
        <div className="detail-top-nav">
          <Link to="/" className="detail-back-btn">
            <ArrowLeft size={18} />
            <span>Quay lại danh sách</span>
          </Link>
          <div className="detail-breadcrumbs">
            <Link to="/">Trang chủ</Link>
            <span>/</span>
            <span>Homestay</span>
            <span>/</span>
            <span className="current">{homestay.TenHomestay}</span>
          </div>
        </div>

        {/* Title & Actions Bar */}
        <div className="detail-header-row">
          <div>
            <h1 className="detail-title">{homestay.TenHomestay}</h1>
            <div className="detail-meta-line">
              <span className="detail-rating-pill">
                <Star size={16} className="star-fill" />
                <strong>{averageRating}</strong>
                <span>({totalReviews} đánh giá)</span>
              </span>
              <span className="meta-separator">·</span>
              <span className="detail-location-text">
                <MapPin size={16} />
                {homestay.DiaDiem}
              </span>
            </div>
          </div>

          <div className="detail-top-actions">
            <button onClick={handleShare} className="btn-action-outline" title="Chia sẻ">
              <Share2 size={18} />
              <span>Chia sẻ</span>
            </button>
            <button 
              onClick={(e) => handleToggleFavorite(e, homestay.MaHomestay, isFavorite)} 
              className={`btn-action-outline ${isFavorite ? 'active-fav' : ''}`}
              title={isFavorite ? 'Bỏ yêu thích' : 'Lưu'}
            >
              <Heart size={18} fill={isFavorite ? '#DC2626' : 'none'} color={isFavorite ? '#DC2626' : 'currentColor'} />
              <span>{isFavorite ? 'Đã lưu' : 'Lưu'}</span>
            </button>
          </div>
        </div>

        {/* --- LUXE PHOTO GALLERY (5-Photo Grid) --- */}
        <div className="detail-gallery-grid">
          <div className="gallery-main-slot">
            <img 
              src={photos[0]} 
              alt={homestay.TenHomestay} 
              className="gallery-main-img" 
            />
          </div>
          <div className="gallery-side-col">
            {photos.slice(1, 4).map((photoUrl, idx) => (
              <div key={idx} className="gallery-sub-slot">
                <img 
                  src={photoUrl} 
                  alt={`${homestay.TenHomestay} ${idx + 2}`} 
                  className="gallery-sub-img" 
                />
              </div>
            ))}
            {photos.length < 4 && (
              <div className="gallery-sub-slot">
                <img 
                  src={photos[0]} 
                  alt="Ảnh phòng" 
                  className="gallery-sub-img" 
                />
              </div>
            )}
          </div>
        </div>

        {/* --- TWO COLUMN CONTENT & BOOKING LAYOUT --- */}
        <div className="detail-body-layout">
          
          {/* LEFT COLUMN: Overview, Host, Amenities, Policies, Reviews */}
          <div className="detail-content-col">
            
            {/* Host Card */}
            <div className="host-profile-card">
              <div className="host-avatar-box">
                <User size={28} />
              </div>
              <div className="host-meta-box">
                <h3>Chủ nhà: {homestay.CHU_HOMESTAY?.HoTen || 'Chủ Homestay Xác Minh'}</h3>
                <p className="host-sub">
                  <ShieldCheck size={16} className="verified-icon" />
                  Đã xác minh danh tính · Chủ nhà phản hồi nhanh trong 1 giờ
                </p>
              </div>
            </div>

            {/* Quick Highlights */}
            <div className="highlights-list">
              <div className="highlight-item">
                <div className="highlight-icon"><Trees size={22} /></div>
                <div>
                  <h4>Gần gũi thiên nhiên</h4>
                  <p>Không gian trong lành, cây xanh bao quanh và tầm nhìn thư thái.</p>
                </div>
              </div>
              <div className="highlight-item">
                <div className="highlight-icon"><Clock size={22} /></div>
                <div>
                  <h4>Tự check-in tiện lợi</h4>
                  <p>Chủ nhà hỗ trợ hướng dẫn chi tiết và linh hoạt khung giờ nhận phòng.</p>
                </div>
              </div>
              <div className="highlight-item">
                <div className="highlight-icon"><Sparkles size={22} /></div>
                <div>
                  <h4>Vệ sinh tiêu chuẩn</h4>
                  <p>Phòng ốc được khử khuẩn và vệ sinh kỹ lưỡng trước mỗi lượt khách.</p>
                </div>
              </div>
            </div>

            <div className="section-divider" />

            {/* Overview / Description */}
            <section className="detail-section">
              <h2 className="section-subtitle">Về không gian này</h2>
              <div className="detail-desc-text">
                {homestay.MoTa ? (
                  <p>{homestay.MoTa}</p>
                ) : (
                  <p>Homestay cao cấp được thiết kế tinh tế, đầy đủ tiện nghi sinh hoạt và nghỉ dưỡng, mang đến kỳ nghỉ hoàn hảo cho bạn và người thân.</p>
                )}
              </div>
            </section>

            <div className="section-divider" />

            {/* Amenities Grid */}
            <section className="detail-section">
              <h2 className="section-subtitle">Tiện nghi có sẵn</h2>
              <div className="amenities-pills-grid">
                {amenitiesList.map((amenity, index) => (
                  <div key={index} className="amenity-pill-item">
                    <CheckCircle2 size={18} className="amenity-check-icon" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="section-divider" />

            {/* Policies */}
            <section className="detail-section">
              <h2 className="section-subtitle">Chính sách lưu trú</h2>
              <div className="policies-grid">
                <div className="policy-card">
                  <h4>Thời gian nhận/trả phòng</h4>
                  <p>Nhận phòng: Từ <strong>14:00</strong></p>
                  <p>Trả phòng: Trước <strong>12:00</strong></p>
                </div>
                <div className="policy-card">
                  <h4>Quy định khách</h4>
                  <p>Sức chứa tối đa: <strong>{homestay.SoKhachToiDa} khách</strong></p>
                  <p>Phù hợp cho gia đình, cặp đôi và nhóm bạn</p>
                </div>
                <div className="policy-card">
                  <h4>Chính sách hủy</h4>
                  <p>Miễn phí hủy trong vòng 48h sau khi đặt nếu thời gian nhận phòng còn cách ít nhất 7 ngày.</p>
                </div>
              </div>
            </section>

            <div className="section-divider" />

            {/* Reviews Section */}
            <section className="detail-section">
              <div className="reviews-header-block">
                <div className="reviews-score-badge">
                  <Star size={24} className="star-fill" />
                  <span className="big-score">{averageRating}</span>
                </div>
                <div>
                  <h2 className="section-subtitle" style={{ marginBottom: 4 }}>
                    Đánh giá từ du khách
                  </h2>
                  <p className="reviews-meta-desc">
                    Dựa trên {totalReviews} lượt đánh giá thực tế từ khách đã hoàn thành kỳ lưu trú
                  </p>
                </div>
              </div>

              {/* Review List */}
              <div className="reviews-cards-list">
                {reviewsWithComments.length > 0 ? (
                  reviewsWithComments.map((review) => (
                    <div key={review.MaDanhGia} className="user-review-card">
                      <div className="review-user-row">
                        <div className="review-avatar">
                          {review.NGUOI_DUNG?.HoTen ? review.NGUOI_DUNG.HoTen.charAt(0).toUpperCase() : 'K'}
                        </div>
                        <div>
                          <strong>{review.NGUOI_DUNG?.HoTen || 'Khách lưu trú'}</strong>
                          <div className="review-stars-row">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={14} 
                                className={i < (review.SoSao || 5) ? 'star-fill' : 'star-empty'} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="review-comment-text">{review.BinhLuan}</p>
                    </div>
                  ))
                ) : (
                  <p className="no-reviews-note">Chưa có bình luận văn bản nào. Hãy là người đầu tiên chia sẻ cảm nhận!</p>
                )}
              </div>

              {/* Add / Edit Review Form for Logged in Users */}
              {user && (
                canReview ? (
                  <div className="review-submission-box">
                    <h3 className="review-box-title">
                      {hasExistingReview ? 'Chỉnh sửa đánh giá của bạn' : 'Viết đánh giá của bạn'}
                    </h3>
                    
                    {reviewError && <p className="error-badge-msg">{reviewError}</p>}

                    <form onSubmit={handleReviewSubmit}>
                      <div className="review-stars-input-group">
                        <label>Đánh giá số sao:</label>
                        <StarRating 
                          rating={reviewRating} 
                          onRatingChange={setReviewRating} 
                        />
                      </div>

                      <div className="review-textarea-group">
                        <label htmlFor="review-comment-input">Cảm nhận của bạn về homestay:</label>
                        <textarea
                          id="review-comment-input"
                          rows="3"
                          placeholder="Chia sẻ trải nghiệm về phòng ốc, tiện nghi, không gian và thái độ phục vụ..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                        />
                      </div>

                      <button type="submit" className="btn-submit-review" disabled={reviewLoading}>
                        {reviewLoading ? 'Đang gửi...' : (hasExistingReview ? 'Cập Nhật Đánh Giá' : 'Gửi Đánh Giá')}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginTop: '20px',
                    color: '#475569',
                    fontSize: '0.9rem',
                    lineHeight: '1.5'
                  }}>
                    <strong style={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      🔒 Đánh giá được bảo vệ & xác thực
                    </strong>
                    <span>{canReviewReason || 'Chỉ những khách hàng đã thực sự đặt phòng và hoàn thành kỳ nghỉ (trạng thái Đã hoàn thành) tại homestay này mới có thể viết đánh giá.'}</span>
                  </div>
                )
              )}
            </section>

          </div>

          {/* RIGHT COLUMN: Sticky Booking Card */}
          <div className="detail-sidebar-col">
            <div className="sticky-booking-card">
              
              {/* Card Header Price */}
              <div className="booking-card-header">
                <div>
                  <span className="booking-price-amount">{formattedDaily} VNĐ</span>
                  <span className="booking-price-unit"> / đêm</span>
                </div>
                <div className="booking-rating-mini">
                  <Star size={15} className="star-fill" />
                  <strong>{averageRating}</strong>
                  <span>({totalReviews})</span>
                </div>
              </div>

              {/* Booking Form */}
              <form onSubmit={handleBooking} className="booking-card-form">
                
                <div className="booking-inputs-table">
                  
                  {/* Check-in */}
                  <div className="booking-cell">
                    <label htmlFor="ngayNhan">NHẬN PHÒNG</label>
                    <input 
                      type="datetime-local" 
                      id="ngayNhan"
                      value={ngayNhan}
                      onChange={(e) => setNgayNhan(e.target.value)}
                      required
                    />
                  </div>

                  {/* Stay Duration */}
                  <div className="booking-cell">
                    <label htmlFor="soNgay">SỐ ĐÊM LƯU TRÚ</label>
                    <input 
                      type="number" 
                      id="soNgay"
                      value={soNgay}
                      onChange={(e) => setSoNgay(Math.max(1, Number(e.target.value)))}
                      min="1"
                      max="30"
                      required
                    />
                  </div>

                  {/* Auto calculated check-out */}
                  <div className="booking-cell full-span">
                    <label htmlFor="ngayTra">TRẢ PHÒNG (TỰ ĐỘNG)</label>
                    <input 
                      type="datetime-local" 
                      id="ngayTra"
                      value={ngayTra}
                      readOnly
                      className="readonly-date-input"
                    />
                  </div>

                  {/* Guests */}
                  <div className="booking-cell full-span">
                    <label htmlFor="soLuongKhach">SỐ LƯỢNG KHÁCH</label>
                    <input 
                      type="number" 
                      id="soLuongKhach"
                      value={soLuongKhach}
                      onChange={(e) => setSoLuongKhach(Number(e.target.value))}
                      min="1"
                      max={homestay.SoKhachToiDa}
                      required
                    />
                    <small className="guest-limit-hint">Tối đa {homestay.SoKhachToiDa} khách</small>
                  </div>

                </div>

                {/* Availability info & Booked dates */}
                {bookedRanges.length > 0 && (
                  <div
                    style={{
                      backgroundColor: '#FEF3C7',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.8rem',
                      color: '#92400E',
                      marginTop: '0.75rem'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={13} /> Ngày đã kín phòng (không thể đặt):
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: '1.4' }}>
                      {bookedRanges.slice(0, 4).map((r, idx) => (
                        <li key={idx}>
                          {new Date(r.startDate).toLocaleDateString('vi-VN')} đến {new Date(r.endDate).toLocaleDateString('vi-VN')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isDateOverlapping && (
                  <div
                    className="booking-error-alert"
                    style={{
                      backgroundColor: '#FEE2E2',
                      borderColor: '#FCA5A5',
                      color: '#B91C1C',
                      fontWeight: 600,
                      marginTop: '0.75rem'
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>Khoảng thời gian này đã có khách đặt trước! Vui lòng chọn ngày khác.</span>
                  </div>
                )}

                {bookingError && !isDateOverlapping && (
                  <div className="booking-error-alert" style={{ marginTop: '0.75rem' }}>
                    <AlertCircle size={16} />
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="price-calc-box">
                  <div className="calc-row">
                    <span>{formattedDaily} VNĐ x {soNgay} đêm</span>
                    <span>{formattedTotal} VNĐ</span>
                  </div>
                  <div className="calc-row">
                    <span>Phí dịch vụ & tiện ích</span>
                    <span className="free-tag">Miễn phí</span>
                  </div>
                  <div className="calc-divider" />
                  <div className="calc-total-row">
                    <strong>Tổng tạm tính</strong>
                    <strong className="total-number">{formattedTotal} VNĐ</strong>
                  </div>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  className="btn-book-now"
                  disabled={bookingLoading || isDateOverlapping}
                  style={isDateOverlapping ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#94A3B8' } : {}}
                >
                  {bookingLoading ? 'Đang xử lý đơn đặt...' : isDateOverlapping ? 'Đã Kín Lịch Ngày Này' : 'Đặt Phòng Ngay'}
                </button>


                <p className="booking-trust-note">
                  <ShieldCheck size={16} />
                  Sau khi bấm Đặt Phòng Ngay, hệ thống sẽ mở ngay cửa sổ chọn phương thức thanh toán (QR Demo / Tiền mặt).
                </p>
              </form>

            </div>
          </div>

        </div>

      </main>

      {/* Cửa sổ thanh toán xuất hiện ngay sau khi tạo booking */}
      {showPaymentModal && payingBookingId && (
        <PaymentModal
          bookingId={payingBookingId}
          onClose={() => {
            setShowPaymentModal(false);
            setPayingBookingId(null);
            fetchAvailability();
          }}
          onPaymentSuccess={() => {
            fetchAvailability();
          }}
        />
      )}
    </div>
  )
}

export default HomestayDetailPage