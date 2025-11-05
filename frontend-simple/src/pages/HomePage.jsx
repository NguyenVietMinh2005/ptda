// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom' // 1. Import đã gộp lại
import { Search, Heart } from 'lucide-react'
import Header from '../components/Header' // Đảm bảo bạn đã import Header

// URL API
const API_URL = 'http://localhost:3000/api/homestays'
// 2. Thêm các URL bị thiếu
const FAVORITES_API_URL = 'http://localhost:3000/api/auth/me/favorites'
const FAVORITE_TOGGLE_API_URL = 'http://localhost:3000/api/homestays'

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400/eee/ccc?text=Homestay'

const priceOptions = [
  { label: 'Tất cả mức giá', value: '' },
  { label: 'Dưới 500.000', value: '0-500000' },
  { label: '500.000 - 1.000.000', value: '500000-1000000' },
  { label: '1.000.000 - 2.000.000', value: '1000000-2000000' },
  { label: '2.000.000 - 5.000.000', value: '2000000-5000000' },
  { label: 'Trên 5.000.000', value: '5000000-Infinity' },
]

function HomePage() {
  
  // --- STATE (Trạng thái) ---
  const [homestays, setHomestays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // State tìm kiếm
  const [searchQuery, setSearchQuery] = useState(''); 
  const [soKhach, setSoKhach] = useState(1);
  const [priceRange, setPriceRange] = useState(''); 
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  
  const navigate = useNavigate()

  // 3. Thêm định nghĩa 'token' bị thiếu
  const token = localStorage.getItem('authToken')

  // Xóa 'handleLogout' và 'user' vì Header.jsx đã xử lý
  // (Code của bạn có cả hai, gây thừa)

  // --- GỌI API (Lấy dữ liệu) ---
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const homestayRes = await axios.get(API_URL);
        setHomestays(homestayRes.data.data);

        // Nếu người dùng đã đăng nhập (dùng 'token' đã định nghĩa)
        if (token) {
          const favoritesRes = await axios.get(FAVORITES_API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const ids = favoritesRes.data.data.map(fav => fav.MaHomestay);
          setFavoriteIds(new Set(ids));
        }

      } catch (err) {
        setError('Không thể tải dữ liệu.');
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, [token]); // Phụ thuộc vào 'token'

  // Hàm TÌM KIẾM (Giữ nguyên)
  const handleSearch = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('searchQuery', searchQuery); 
      if (soKhach > 0) params.append('soKhachToiDa', soKhach);
      if (priceRange) {
        const [min, max] = priceRange.split('-');
        if (min) params.append('giaMin', min);
        if (max && max !== 'Infinity') params.append('giaMax', max);
      }
      const response = await axios.get(API_URL, { params: params });
      setHomestays(response.data.data);
      if (response.data.data.length === 0) {
        alert('Không tìm thấy homestay nào phù hợp.');
      }
    } catch (err) {
      setError('Lỗi khi tìm kiếm.');
    } finally {
      setLoading(false);
    }
  }

  // Hàm lấy URL ảnh (Giữ nguyên)
  const getImageUrl = (imagePath) => {
    if (!imagePath) return PLACEHOLDER_IMAGE;
    if (imagePath.startsWith('http')) return imagePath;
    return `http://localhost:3000/${imagePath}`;
  }

  // Hàm THÍCH / BỎ THÍCH
  const handleToggleFavorite = async (e, homestayId, isFavorite) => {
    e.preventDefault(); 
    e.stopPropagation(); 

    if (!token) {
      alert('Bạn cần đăng nhập để sử dụng chức năng này.');
      navigate('/login');
      return;
    }

    try {
      if (isFavorite) {
        // --- Bỏ thích (DELETE) ---
        await axios.delete(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        setFavoriteIds(prevIds => {
          const newIds = new Set(prevIds);
          newIds.delete(homestayId);
          return newIds;
        });
      } else {
        // --- Thích (POST) ---
        await axios.post(
          `${FAVORITE_TOGGLE_API_URL}/${homestayId}/favorite`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        setFavoriteIds(prevIds => {
          const newIds = new Set(prevIds);
          newIds.add(homestayId);
          return newIds;
        });
      }
    } catch (err) {
      alert('Đã xảy ra lỗi. Vui lòng thử lại.');
    }
  }

  // --- GIAO DIỆN (Render) ---
  return (
    <div className="page-container">
      <Header />

      <main>
        {/* Thanh tìm kiếm */}
        <div className="search-bar-container">
          <form className="search-bar" onSubmit={handleSearch}>
            <div className="search-input">
              <label>Địa điểm hoặc Tên</label>
              <input 
                type="text" 
                placeholder="Tìm kiếm điểm đến" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="search-input">
              <label>Mức giá</label>
              <select 
                value={priceRange} 
                onChange={(e) => setPriceRange(e.target.value)}
              >
                {priceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="search-input">
              <label>Khách</label>
              <input 
                type="number" 
                placeholder="Thêm khách" 
                value={soKhach} 
                onChange={(e) => setSoKhach(e.target.value)}
                min="1"
              />
            </div>
            <button type="submit" className="search-button">
              <Search size={18} />
            </button>
          </form>
        </div>

        {/* Hiển thị kết quả */}
        <h2>Nơi lưu trú</h2>
        {loading && <p>Đang tải dữ liệu...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        {/* 4. Sửa lại vòng lặp để NHÓM THEO THÀNH PHỐ */}
        {Object.entries(
          homestays.reduce((acc, homestay) => {
            const city = homestay.DiaDiem || 'Khác';
            if (!acc[city]) acc[city] = [];
            acc[city].push(homestay);
            return acc;
          }, {})
        ).map(([city, cityHomestays]) => (
          <section key={city} className="city-section">
            <h2>Nơi lưu trú tại {city}</h2>
            <div className="homestay-list-new">
              {cityHomestays.map((homestay) => {
                
                const imageUrl = getImageUrl(homestay.HINH_ANH?.[0]?.HinhAnh);
                const isFavorite = favoriteIds.has(homestay.MaHomestay);

                return (
                  <Link 
                    to={`/homestays/${homestay.MaHomestay}`} 
                    key={homestay.MaHomestay} 
                    className="homestay-card-new-link"
                  >
                    <div className="homestay-card-new">
                      
                      {/* 5. Sửa lại ICON TRÁI TIM (đã sửa ở bước trước) */}
                      <button 
                        className="heart-button"
                        onClick={(e) => handleToggleFavorite(e, homestay.MaHomestay, isFavorite)}
                      >
                        <Heart 
                          size={24} 
                          fill={isFavorite ? 'red' : 'none'} 
                          color={isFavorite ? 'red' : 'white'}
                        />
                      </button>
                      
                      <img src={imageUrl} alt={homestay.TenHomestay} className="homestay-image" />
                      <div className="homestay-info">
                        <h3>{homestay.TenHomestay}</h3>
                        <p>{homestay.DiaDiem}</p>
                        <p><strong>{homestay.Gia} VNĐ</strong> / đêm</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </main>

      {/* --- FOOTER MỚI --- */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-column">
            <h4>Hỗ trợ</h4>
            <ul>
              <li>Trung tâm trợ giúp</li>
              <li>AirCover</li>
              <li>Chống phân biệt đối xử</li>
              <li>Yêu cầu trợ giúp về an toàn</li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Đón tiếp khách</h4>
            <ul>
              <li>Cho thuê nhà trên Airbnb</li>
              <li>AirCover cho Host</li>
              <li>Tài nguyên về đón tiếp khách</li>
              <li>Diễn đàn cộng đồng</li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Airbnb</h4>
            <ul>
              <li>Trang tin tức</li>
              <li>Cơ hội nghề nghiệp</li>
              <li>Nhà đầu tư</li>
              <li>Chỗ ở khẩn cấp</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2025 Airbnb, Inc.</p>
        </div>
      </footer>
    </div>
  )
}

export default HomePage