// src/pages/MyFavoritesPage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header' // Dùng Header
import '../App.css' // Dùng chung CSS

const API_URL = 'http://localhost:3000/api/auth/me/favorites'

// Hàm trợ giúp lấy URL ảnh
const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/600x400/eee/ccc?text=Homestay';
  if (imagePath.startsWith('http')) return imagePath;
  return `http://localhost:3000/${imagePath}`;
}

function MyFavoritesPage() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const token = localStorage.getItem('authToken')

  useEffect(() => {
    if (!token) {
      alert('Bạn cần đăng nhập để xem trang này.')
      navigate('/login')
      return 
    }

    const fetchFavorites = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        // API này trả về mảng YEU_THICH, mỗi mục có chứa HOMESTAY
        setFavorites(response.data.data)
      } catch (err) {
        setError('Không thể tải danh sách yêu thích.')
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [token, navigate])

  if (loading) return <div className="page-container"><Header /><p>Đang tải...</p></div>
  if (error) return <div className="page-container"><Header /><p>{error}</p></div>

  return (
    <div className="page-container">
      <Header />
      <main>
        <h2>Danh sách Yêu thích của bạn</h2>

        {favorites.length === 0 && !loading && (
            <p>Bạn chưa có homestay yêu thích nào.</p>
        )}

        {/* Dùng lại layout grid của trang chủ */}
        <div className="homestay-list-new">
          {favorites.map((fav) => {
            const homestay = fav.HOMESTAY; // Lấy thông tin homestay từ mục yêu thích
            if (!homestay) return null;

            const imageUrl = getImageUrl(homestay.HINH_ANH?.[0]?.HinhAnh);

            return (
              <Link 
                to={`/homestays/${homestay.MaHomestay}`} 
                key={fav.MaHomestay} // Key là MaHomestay trên mục yêu thích
                className="homestay-card-new-link"
              >
                <div className="homestay-card-new">
                  {/* (Sau này chúng ta sẽ làm nút này 'tô màu đỏ') */}
                  <div className="heart-icon-filled">♥</div>
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
      </main>
    </div>
  )
}

export default MyFavoritesPage
