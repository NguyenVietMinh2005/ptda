// src/pages/OwnerHomestaysPage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader' // <-- Dùng Header mới
import { toast } from 'react-hot-toast'
import EditHomestayModal from '../components/EditHomestayModal';

import '../App.css'

// (Code này gần giống với code cũ trong OwnerDashboardPage.jsx)
const API_URL = 'http://localhost:3000/api/owner/me/homestays'
const UPLOAD_API_URL = 'http://localhost:3000/api/homestays'

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/600x400/eee/ccc?text=Homestay';
  if (imagePath.startsWith('http')) return imagePath; 
  return `http://localhost:3000/${imagePath}`;
}

function OwnerHomestaysPage() {
  const [myHomestays, setMyHomestays] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [editingHomestay, setEditingHomestay] = useState(null);
  const token = localStorage.getItem('ownerAuthToken')

  useEffect(() => {
    if (!token) {
      toast.error('Bạn cần đăng nhập.');
      navigate('/owner/login');
      return;
    }

    const fetchMyHomestays = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setMyHomestays(response.data.data)
      } catch (err) {
        toast.error('Không thể tải homestay của bạn.')
      } finally {
        setLoading(false)
      }
    }
    fetchMyHomestays()
  }, [token, navigate])

  const handleImageUpload = async (e, homestayId) => {
    e.preventDefault();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    try {
      await axios.post(
        `${UPLOAD_API_URL}/${homestayId}/images`,
        formData,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Tải ảnh lên thành công!');
      window.location.reload(); 
    } catch (err) {
      toast.error('Tải ảnh thất bại.');
    }
  };

  const handleDeleteHomestay = async (homestayId) => {
      if (window.confirm('Bạn có chắc chắn muốn XÓA homestay này? Ảnh và đánh giá cũng sẽ bị xóa.')) {
        try {
          await axios.delete(
            `${UPLOAD_API_URL}/${homestayId}`, // Dùng chung API gốc
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          toast.success('Đã xóa homestay thành công.');
          // Cập nhật UI: Lọc homestay đã xóa ra khỏi danh sách
          setMyHomestays(currentHomestays => 
            currentHomestays.filter(h => h.MaHomestay !== homestayId)
          );
        } catch (err) {
          toast.error('Xóa thất bại.');
        }
      }
    };
    
    // --- THÊM HÀM CẬP NHẬT UI SAU KHI SỬA ---
    const handleHomestayUpdated = (updatedHomestay) => {
      // Cập nhật lại danh sách homestay trong state
      setMyHomestays(currentHomestays => 
        currentHomestays.map(h => 
          h.MaHomestay === updatedHomestay.MaHomestay ? updatedHomestay : h
        )
      );
    };

  if (loading) return <div className="page-container"><OwnerHeader /><p>Đang tải...</p></div>

  return (
    <div className="page-container">
      <OwnerHeader />
      
      <main>
        <h2>Quản lý Homestay</h2>
        {/* (Sau này chúng ta sẽ thêm nút "Tạo Homestay mới" ở đây) */}
        <div className="owner-dashboard">
          {myHomestays.length === 0 && (
            <p>Bạn chưa có homestay nào.</p>
          )}

          {myHomestays.map((homestay) => (
            <div key={homestay.MaHomestay} className="owner-homestay-card">
              <h3>{homestay.TenHomestay}</h3>
              <p>{homestay.DiaDiem}</p>
              
              <form className="upload-form">
                <label htmlFor={`upload-${homestay.MaHomestay}`}>
                  Tải lên/Thay thế ảnh (chọn nhiều ảnh):
                </label>
                <input
                  type="file"
                  id={`upload-${homestay.MaHomestay}`}
                  multiple
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => handleImageUpload(e, homestay.MaHomestay)}
                />
              </form>

              <h4>Ảnh hiện tại:</h4>
              <div className="current-images">
                {homestay.HINH_ANH && homestay.HINH_ANH.length > 0 ? (
                  homestay.HINH_ANH.map((img, idx) => (
                    <img 
                      key={idx} 
                      src={getImageUrl(img.HinhAnh)}
                      alt="Ảnh homestay" 
                    />
                  ))
                ) : (
                  <p>(Chưa có ảnh)</p>
                )}
              </div>

              <div className="owner-actions">
                <button 
                  className="button-primary"
                  onClick={() => setEditingHomestay(homestay)} // Mở Modal
                >
                  Sửa
                </button>
                <button 
                  className="button-danger"
                  onClick={() => handleDeleteHomestay(homestay.MaHomestay)} // Gọi hàm Xóa
                >
                  Xóa
                </button>
              </div>
              {/* (Sau này chúng ta sẽ thêm nút Sửa/Xóa homestay ở đây) */}
            </div>
          ))}
        </div>

        
      </main>
    </div>
  )
}

export default OwnerHomestaysPage