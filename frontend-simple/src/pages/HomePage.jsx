// src/pages/HomePage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Search, Heart, MapPin, Users, Calendar, Sparkles, 
  Trees, ShieldCheck, Coffee, ArrowRight, Star, SlidersHorizontal,
  Compass, Award, ChevronRight
} from 'lucide-react'
import Header from '../components/Header'
import { toast } from 'react-hot-toast'

import { API_BASE_URL, getFullImageUrl } from '../utils/apiConfig'

const API_URL = `${API_BASE_URL}/homestays`
const FAVORITES_API_URL = `${API_BASE_URL}/auth/me/favorites`
const FAVORITE_TOGGLE_API_URL = `${API_BASE_URL}/homestays`
const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400/eee/ccc?text=Homestay'

// Curated destinations with representative images and subtitles
const TOP_DESTINATIONS = [
  { name: 'Đà Lạt', title: 'Thành phố sương mù & hoa', count: 4, image: getFullImageUrl('uploads/hs_04_01_exterior.jpg') },
  { name: 'Sa Pa', title: 'Núi rừng & mây ngàn', count: 3, image: getFullImageUrl('uploads/hs_08_04_view.jpg') },
  { name: 'Hà Nội', title: 'Thủ đô nghìn năm hoài cổ', count: 3, image: getFullImageUrl('uploads/hs_02_01_exterior.jpg') },
  { name: 'Ninh Bình', title: 'Non nước Tràng An hữu tình', count: 3, image: getFullImageUrl('uploads/hs_11_04_view.jpg') },
  { name: 'Phú Quốc', title: 'Đảo ngọc biển xanh hoàng hôn', count: 3, image: getFullImageUrl('uploads/hs_22_01_exterior.jpg') },
  { name: 'Đà Nẵng', title: 'Thành phố biển đáng sống', count: 3, image: getFullImageUrl('uploads/hs_14_04_view.jpg') },
  { name: 'Hội An', title: 'Phố đèn lồng hoài niệm', count: 3, image: getFullImageUrl('uploads/hs_17_04_view.jpg') },
  { name: 'Nha Trang', title: 'Vịnh biển san hô ngọc bích', count: 2, image: getFullImageUrl('uploads/hs_20_04_view.jpg') },
];

const priceOptions = [
  { label: 'Tất cả mức giá', value: '' },
  { label: 'Dưới 800.000 đ', value: '0-800000' },
  { label: '800.000 - 1.500.000 đ', value: '800000-1500000' },
  { label: '1.500.000 - 2.500.000 đ', value: '1500000-2500000' },
  { label: 'Trên 2.500.000 đ', value: '2500000-Infinity' },
]

function HomePage() {
  const [homestays, setHomestays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [soKhach, setSoKhach] = useState(1)
  const [priceRange, setPriceRange] = useState('')
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState('Tất cả')
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  
  const navigate = useNavigate()
  const token = localStorage.getItem('authToken')

  // Fetch all homestays and user favorites
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      try {
        const homestayRes = await axios.get(API_URL)
        setHomestays(homestayRes.data.data)

        if (token) {
          try {
            const favoritesRes = await axios.get(FAVORITES_API_URL, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            const ids = favoritesRes.data.data.map(fav => fav.MaHomestay)
            setFavoriteIds(new Set(ids))
          } catch (favErr) {
            console.warn('Lỗi tải yêu thích:', favErr)
          }
        }
      } catch {
        setError('Không thể tải danh sách homestay. Vui lòng thử lại sau.')
      } finally {
        setLoading(false)
      }
    }
    fetchAllData()
  }, [token])

  // Search submit
  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.append('searchQuery', searchQuery.trim())
      if (soKhach > 0) params.append('soKhachToiDa', soKhach)
      if (priceRange) {
        const [min, max] = priceRange.split('-')
        if (min) params.append('giaMin', min)
        if (max && max !== 'Infinity') params.append('giaMax', max)
      }
      const response = await axios.get(API_URL, { params })
      setHomestays(response.data.data)
      setSelectedDestinationFilter('Tất cả')

      // Scroll smoothly to homestays section
      const section = document.getElementById('homestay-catalog')
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' })
      }
    } catch {
      setError('Lỗi khi tìm kiếm homestay.')
    } finally {
      setLoading(false)
    }
  }

  // Filter directly by destination card click
  const handleSelectDestination = (destName) => {
    setSearchQuery(destName)
    setSelectedDestinationFilter(destName)
    
    // Trigger search for this destination
    axios.get(API_URL, { params: { searchQuery: destName } })
      .then(res => {
        setHomestays(res.data.data)
        const catalogEl = document.getElementById('homestay-catalog')
        if (catalogEl) {
          catalogEl.scrollIntoView({ behavior: 'smooth' })
        }
      })
      .catch(() => {
        toast.error('Không thể lọc theo điểm đến này.')
      })
  }

  // Reset to all
  const handleResetFilter = () => {
    setSearchQuery('')
    setSoKhach(1)
    setPriceRange('')
    setSelectedDestinationFilter('Tất cả')
    setLoading(true)
    axios.get(API_URL)
      .then(res => setHomestays(res.data.data))
      .catch(() => setError('Lỗi khi tải lại danh sách'))
      .finally(() => setLoading(false))
  }

  const getImageUrl = (imagePath) => getFullImageUrl(imagePath, PLACEHOLDER_IMAGE)

  // Favorite toggle
  const handleToggleFavorite = async (e, homestayId, isFavorite) => {
    e.preventDefault()
    e.stopPropagation()

    if (!token) {
      toast.error('Vui lòng đăng nhập để lưu homestay yêu thích.')
      navigate('/login')
      return
    }

    try {
      if (isFavorite) {
        await axios.delete(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        setFavoriteIds(prev => {
          const next = new Set(prev)
          next.delete(homestayId)
          return next
        })
        toast.success('Đã bỏ khỏi danh sách yêu thích.')
      } else {
        await axios.post(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        setFavoriteIds(prev => {
          const next = new Set(prev)
          next.add(homestayId)
          return next
        })
        toast.success('Đã thêm vào danh sách yêu thích!')
      }
    } catch {
      toast.error('Thao tác yêu thích thất bại.')
    }
  }

  // Group homestays by city/province
  const groupedHomestays = useMemo(() => {
    return homestays.reduce((acc, hs) => {
      const full = hs.DiaDiem || 'Khác'
      let prov = 'Khác'
      if (full !== 'Khác' && full.includes(',')) {
        prov = full.split(',').pop().trim()
      } else if (full !== 'Khác') {
        prov = full
      }
      if (!acc[prov]) acc[prov] = []
      acc[prov].push(hs)
      return acc
    }, {})
  }, [homestays])

  return (
    <div className="site-wrapper">
      <Header />

      {/* --- HERO SECTION --- */}
      <section className="hero-section" style={{ backgroundImage: `url('${getFullImageUrl('uploads/hs_04_01_exterior.jpg')}')` }}>
        <div className="hero-background-overlay" />
        <div className="hero-container">
          
          <div className="hero-badge">
            <Trees size={16} />
            <span>Nghỉ Dưỡng Sinh Thái & Thiên Nhiên</span>
          </div>

          <h1 className="hero-title">
            Tìm Nơi Nghỉ Dưỡng Lý Tưởng <br className="hero-break" />
            Cho Chuyến Đi Của Bạn
          </h1>

          <p className="hero-subtitle">
            Khám phá hơn 24+ homestay, villa biệt lập và khu nghỉ dưỡng sinh thái 
            được tuyển chọn kỹ lưỡng tại các điểm đến tuyệt đẹp khắp Việt Nam.
          </p>

          {/* Floating Search Bar */}
          <div className="hero-search-wrapper">
            <form className="hero-search-form" onSubmit={handleSearch}>
              
              {/* Field 1: Destination */}
              <div className="search-field">
                <div className="field-icon-box">
                  <MapPin size={20} className="field-icon" />
                </div>
                <div className="field-inputs">
                  <label htmlFor="search-dest">Điểm đến / Tên</label>
                  <input 
                    id="search-dest"
                    type="text" 
                    placeholder="Đà Lạt, Sa Pa, Phú Quốc..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="search-divider" />

              {/* Field 2: Price Range */}
              <div className="search-field">
                <div className="field-icon-box">
                  <SlidersHorizontal size={20} className="field-icon" />
                </div>
                <div className="field-inputs">
                  <label htmlFor="search-price">Ngân sách</label>
                  <select 
                    id="search-price"
                    value={priceRange} 
                    onChange={(e) => setPriceRange(e.target.value)}
                  >
                    {priceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="search-divider" />

              {/* Field 3: Guests */}
              <div className="search-field">
                <div className="field-icon-box">
                  <Users size={20} className="field-icon" />
                </div>
                <div className="field-inputs">
                  <label htmlFor="search-guests">Số lượng khách</label>
                  <input 
                    id="search-guests"
                    type="number" 
                    placeholder="Khách" 
                    value={soKhach} 
                    onChange={(e) => setSoKhach(Number(e.target.value))}
                    min="1"
                    max="30"
                  />
                </div>
              </div>

              {/* Search Submit Button */}
              <button type="submit" className="hero-search-btn">
                <Search size={20} />
                <span>Tìm Homestay</span>
              </button>
            </form>
          </div>

        </div>
      </section>

      {/* --- DESTINATIONS DISCOVERY SECTION --- */}
      <section id="destinations" className="section-destinations">
        <div className="section-container">
          
          <div className="section-header">
            <div>
              <span className="section-tag">Khám Phá Điểm Đến</span>
              <h2 className="section-title">Vùng Đất Bạn Muốn Tới</h2>
              <p className="section-desc">Từ cao nguyên sương mây đến biển ngọc hoang sơ, hãy chọn điểm dừng chân hoàn hảo.</p>
            </div>
            {selectedDestinationFilter !== 'Tất cả' && (
              <button onClick={handleResetFilter} className="btn-reset-filter">
                Xem tất cả điểm đến
              </button>
            )}
          </div>

          <div className="destinations-grid">
            {TOP_DESTINATIONS.map((dest) => {
              const isSelected = selectedDestinationFilter === dest.name
              return (
                <div 
                  key={dest.name} 
                  className={`dest-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectDestination(dest.name)}
                >
                  <img src={dest.image} alt={dest.name} className="dest-img" loading="lazy" />
                  <div className="dest-overlay" />
                  <div className="dest-content">
                    <span className="dest-count">{dest.count} Homestay</span>
                    <h3 className="dest-name">{dest.name}</h3>
                    <p className="dest-title-sub">{dest.title}</p>
                  </div>
                  <div className="dest-hover-arrow">
                    <ArrowRight size={18} />
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* --- WHY CHOOSE US (VALUES) --- */}
      <section className="section-features">
        <div className="section-container">
          <div className="features-grid">
            
            <div className="feature-card">
              <div className="feature-icon-box">
                <ShieldCheck size={28} />
              </div>
              <h4 className="feature-title">Đã Kiểm Định Thực Tế</h4>
              <p className="feature-desc">100% hình ảnh và tiện nghi được xác minh trực tiếp tại từng căn homestay, đảm bảo trải nghiệm đúng như cam kết.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box">
                <Trees size={28} />
              </div>
              <h4 className="feature-title">Không Gian Thiên Nhiên</h4>
              <p className="feature-desc">Ưu tiên các không gian lưu trú mở, hòa mình vào rừng thông, đồi chè, đầm sen hoặc bãi biển riêng yên bình.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box">
                <Sparkles size={28} />
              </div>
              <h4 className="feature-title">Tiện Nghi Đầy Đủ & Tự Do</h4>
              <p className="feature-desc">Trang bị bếp nấu, sân nướng BBQ, smart TV, wifi tốc độ cao và quy trình tự check-in khóa thông minh tiện lợi.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box">
                <Coffee size={28} />
              </div>
              <h4 className="feature-title">Đồng Hành Tận Tâm</h4>
              <p className="feature-desc">Đội ngũ hỗ trợ và chủ nhà bản địa thân thiện sẵn sàng tư vấn lịch trình và giải đáp mọi yêu cầu 24/7.</p>
            </div>

          </div>
        </div>
      </section>

      {/* --- MAIN HOMESTAY CATALOG --- */}
      <section id="homestay-catalog" className="section-catalog">
        <div className="section-container">
          
          <div className="catalog-header">
            <div>
              <span className="section-tag">Bộ Sưu Tập Lưu Trú</span>
              <h2 className="section-title">
                {selectedDestinationFilter === 'Tất cả' 
                  ? 'Tất Cả Homestay Nổi Bật' 
                  : `Homestay Tại ${selectedDestinationFilter}`}
              </h2>
            </div>
            
            <div className="catalog-status-info">
              <span>Đang hiển thị <strong>{homestays.length}</strong> không gian lưu trú</span>
              {selectedDestinationFilter !== 'Tất cả' && (
                <button onClick={handleResetFilter} className="btn-link-action">
                  Bỏ lọc
                </button>
              )}
            </div>
          </div>

          {loading && (
            <div className="loading-state-container">
              <div className="spinner" />
              <p>Đang tìm kiếm homestay phù hợp cho bạn...</p>
            </div>
          )}

          {error && (
            <div className="error-state-box">
              <p>{error}</p>
              <button onClick={handleResetFilter} className="btn-retry">Thử lại</button>
            </div>
          )}

          {!loading && !error && homestays.length === 0 && (
            <div className="empty-state-box">
              <Compass size={48} className="empty-icon" />
              <h3>Không tìm thấy homestay phù hợp</h3>
              <p>Hãy thử thay đổi từ khóa tìm kiếm, giảm bớt điều kiện lọc mức giá hoặc số lượng khách.</p>
              <button onClick={handleResetFilter} className="btn-reset-search">
                Xem toàn bộ Homestay
              </button>
            </div>
          )}

          {/* Render by City/Province groups */}
          {!loading && Object.entries(groupedHomestays).map(([province, cityHomestays]) => (
            <div key={province} className="city-group-block">
              
              <div className="city-group-header">
                <h3 className="city-group-title">
                  <MapPin size={22} className="city-pin" />
                  Nơi lưu trú tại {province}
                </h3>
                <span className="city-badge">{cityHomestays.length} lựa chọn</span>
              </div>

              <div className="homestay-grid">
                {cityHomestays.map((hs) => {
                  const imageUrl = getImageUrl(hs.HINH_ANH?.[0]?.HinhAnh)
                  const isFavorite = favoriteIds.has(hs.MaHomestay)
                  const priceFormatted = Number(hs.Gia).toLocaleString('vi-VN')

                  return (
                    <div key={hs.MaHomestay} className="homestay-card">
                      
                      {/* Card Image Box */}
                      <div className="card-img-wrapper">
                        <Link to={`/homestays/${hs.MaHomestay}`}>
                          <img 
                            src={imageUrl} 
                            alt={hs.TenHomestay} 
                            className="card-main-img" 
                            loading="lazy" 
                          />
                        </Link>

                        {/* Top destination badge */}
                        <div className="card-top-badge">
                          <span>{province}</span>
                        </div>

                        {/* Heart Favorite Button */}
                        <button 
                          className={`card-heart-btn ${isFavorite ? 'favorited' : ''}`}
                          onClick={(e) => handleToggleFavorite(e, hs.MaHomestay, isFavorite)}
                          title={isFavorite ? 'Bỏ yêu thích' : 'Lưu vào yêu thích'}
                          aria-label="Yêu thích"
                        >
                          <Heart 
                            size={18} 
                            fill={isFavorite ? '#DC2626' : 'rgba(0,0,0,0.3)'} 
                            color={isFavorite ? '#DC2626' : '#FFFFFF'}
                          />
                        </button>
                      </div>

                      {/* Card Body */}
                      <div className="card-body">
                        
                        <div className="card-meta-row">
                          <span className="card-capacity">
                            <Users size={14} />
                            Tối đa {hs.SoKhachToiDa} khách
                          </span>
                          <span className="card-rating">
                            <Star size={14} className="star-fill" />
                            5.0
                          </span>
                        </div>

                        <h3 className="card-title">
                          <Link to={`/homestays/${hs.MaHomestay}`}>
                            {hs.TenHomestay}
                          </Link>
                        </h3>

                        <p className="card-location">
                          <MapPin size={14} />
                          <span>{hs.DiaDiem}</span>
                        </p>

                        <div className="card-footer-row">
                          <div className="card-price-group">
                            <span className="price-val">{priceFormatted} VNĐ</span>
                            <span className="price-unit"> / đêm</span>
                          </div>

                          <Link to={`/homestays/${hs.MaHomestay}`} className="card-detail-btn">
                            <span>Chi tiết</span>
                            <ChevronRight size={16} />
                          </Link>
                        </div>

                      </div>

                    </div>
                  )
                })}
              </div>

            </div>
          ))}

        </div>
      </section>

      {/* --- TRAVEL STYLE SUGGESTIONS --- */}
      <section className="section-styles">
        <div className="section-container">
          
          <div className="section-header">
            <div>
              <span className="section-tag">Trải Nghiệm Độc Bản</span>
              <h2 className="section-title">Gợi Ý Theo Phong Cách Của Bạn</h2>
            </div>
          </div>

          <div className="styles-grid">
            
            <div 
              className="style-banner"
              style={{ backgroundImage: `url('${getFullImageUrl('uploads/hs_04_01_exterior.jpg')}')` }}
              onClick={() => handleSelectDestination('Đà Lạt')}
            >
              <div className="style-overlay" />
              <div className="style-content">
                <span className="style-badge">Trốn Khói Bụi</span>
                <h3>Nhà Gỗ Rừng Thông</h3>
                <p>Khí hậu se lạnh, bếp lửa hồng và view thung lũng mây thơ mộng.</p>
                <span className="style-cta">Khám phá Đà Lạt & Sa Pa <ArrowRight size={16} /></span>
              </div>
            </div>

            <div 
              className="style-banner"
              style={{ backgroundImage: `url('${getFullImageUrl('uploads/hs_22_01_exterior.jpg')}')` }}
              onClick={() => handleSelectDestination('Phú Quốc')}
            >
              <div className="style-overlay" />
              <div className="style-content">
                <span className="style-badge">Nắng Vàng & Biển Xanh</span>
                <h3>Villa Biển Riêng Tư</h3>
                <p>Hồ bơi vô cực, ngắm trọn hoàng hôn biển đảo và tiệc nướng hải sản.</p>
                <span className="style-cta">Khám phá Phú Quốc & Nha Trang <ArrowRight size={16} /></span>
              </div>
            </div>

            <div 
              className="style-banner"
              style={{ backgroundImage: `url('${getFullImageUrl('uploads/hs_02_01_exterior.jpg')}')` }}
              onClick={() => handleSelectDestination('Hà Nội')}
            >
              <div className="style-overlay" />
              <div className="style-content">
                <span className="style-badge">Hoài Cổ & Lịch Lãm</span>
                <h3>Kiến Trúc Indochine</h3>
                <p>Nằm ngay trung tâm phố cổ, đan xen nét văn hóa bản địa truyền thống.</p>
                <span className="style-cta">Khám phá Hà Nội & Hội An <ArrowRight size={16} /></span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* --- PROFESSIONAL SITE FOOTER --- */}
      <footer className="modern-footer">
        <div className="footer-top-container">
          
          {/* Brand Info */}
          <div className="footer-brand-col">
            <div className="footer-brand">
              <Trees size={26} className="brand-tree-icon" />
              <span className="brand-name">PTDA <span className="brand-accent">HOMESTAY</span></span>
            </div>
            <p className="footer-desc">
              Hệ thống kết nối và đặt phòng homestay, villa nghỉ dưỡng sinh thái hàng đầu 
              Việt Nam. Mang lại những kỳ nghỉ bình yên, gần gũi và trọn vẹn cảm xúc.
            </p>
            <div className="footer-contact-info">
              <p>📍 <strong>Trụ sở:</strong> Hà Nội & TP. Hồ Chí Minh</p>
              <p>📞 <strong>Hotline:</strong> 1900 8888 (24/7)</p>
              <p>✉️ <strong>Email:</strong> support@ptdahomestay.vn</p>
            </div>
          </div>

          {/* Destination Links */}
          <div className="footer-links-col">
            <h4>Điểm Đến Yêu Thích</h4>
            <ul>
              <li><button onClick={() => handleSelectDestination('Đà Lạt')}>Homestay Đà Lạt</button></li>
              <li><button onClick={() => handleSelectDestination('Sa Pa')}>Homestay Sa Pa</button></li>
              <li><button onClick={() => handleSelectDestination('Ninh Bình')}>Homestay Ninh Bình</button></li>
              <li><button onClick={() => handleSelectDestination('Phú Quốc')}>Homestay Phú Quốc</button></li>
              <li><button onClick={() => handleSelectDestination('Hà Nội')}>Homestay Hà Nội</button></li>
              <li><button onClick={() => handleSelectDestination('Hội An')}>Homestay Hội An</button></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="footer-links-col">
            <h4>Dành Cho Khách Hàng</h4>
            <ul>
              <li><Link to="/my-bookings">Tra cứu đơn đặt phòng</Link></li>
              <li><Link to="/my-favorites">Homestay đã lưu</Link></li>
              <li><Link to="/profile">Thông tin tài khoản</Link></li>
              <li><Link to="/my-complaints">Gửi phản hồi & Khiếu nại</Link></li>
              <li><a href="#destinations">Bản đồ điểm đến</a></li>
            </ul>
          </div>

          {/* Owner & Host Portal */}
          <div className="footer-links-col">
            <h4>Kênh Chủ Homestay</h4>
            <ul>
              <li><Link to="/owner/login">Đăng nhập Kênh Chủ Nhà</Link></li>
              <li><Link to="/owner/register">Đăng ký tham gia hệ thống</Link></li>
              <li><a href="#destinations">Quy chuẩn dịch vụ & Tiện nghi</a></li>
              <li><a href="#destinations">Cam kết an toàn & Bảo hiểm</a></li>
            </ul>
          </div>

        </div>

        <div className="footer-bottom-bar">
          <div className="footer-bottom-inner">
            <p>© 2026 PTDA Homestay. Nền tảng đặt phòng nghỉ dưỡng sinh thái Việt Nam.</p>
            <div className="footer-bottom-tags">
              <span>Chính sách bảo mật</span>
              <span>·</span>
              <span>Điều khoản sử dụng</span>
              <span>·</span>
              <span>Hỗ trợ sự cố</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}

export default HomePage