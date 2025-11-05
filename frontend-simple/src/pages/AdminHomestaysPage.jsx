// src/pages/AdminHomestaysPage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader'
import { toast } from 'react-hot-toast'
import '../App.css'

const ADMIN_API_URL = 'http://localhost:3000/api/admin'
const PLACEHOLDER_IMAGE = 'https://placehold.co/60x60/eee/ccc?text=N/A'

// Hàm trợ giúp lấy URL ảnh
const getImageUrl = (imagePath) => {
  if (!imagePath) return PLACEHOLDER_IMAGE;
  if (imagePath.startsWith('http')) return imagePath; 
  return `http://localhost:3000/${imagePath}`;
}

function AdminHomestaysPage() {
  const [homestays, setHomestays] = useState([]);
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
        const homestaysRes = await axios.get(`${ADMIN_API_URL}/homestays`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setHomestays(homestaysRes.data.data);
      } catch (err) {
        toast.error('Không thể tải danh sách Homestay.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, adminUser]);

  // Hàm Xóa Homestay
  const handleDeleteHomestay = async (homestayId) => {
    if (window.confirm('Bạn có chắc chắn muốn XÓA VĨNH VIỄN homestay này?')) {
      try {
        await axios.delete(
          `${ADMIN_API_URL}/homestays/${homestayId}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        toast.success('Đã xóa homestay thành công.');
        setHomestays(currentHomestays => 
          currentHomestays.filter(h => h.MaHomestay !== homestayId)
        );
      } catch (err) {
        toast.error('Xóa thất bại.');
      }
    }
  };
  
  if (loading) return <div className="page-container"><OwnerHeader /><p>Đang tải...</p></div>;

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Quản lý Homestay (Toàn hệ thống)</h2>
        <div className="admin-section">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ảnh</th>
                <th>Tên Homestay</th>
                <th>Địa điểm</th>
                <th>Chủ sở hữu</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {homestays.map(homestay => (
                <tr key={homestay.MaHomestay}>
                  <td>{homestay.MaHomestay}</td>
                  <td>
                    <img 
                      src={getImageUrl(homestay.HINH_ANH?.[0]?.HinhAnh)}
                      alt={homestay.TenHomestay}
                      className="admin-table-image" 
                    />
                  </td>
                  <td>{homestay.TenHomestay}</td>
                  <td>{homestay.DiaDiem}</td>
                  <td>
                    {homestay.CHU_HOMESTAY.HoTen} 
                    <small> ({homestay.CHU_HOMESTAY.Email})</small>
                  </td>
                  <td>
                    <button 
                      className="button-danger" 
                      onClick={() => handleDeleteHomestay(homestay.MaHomestay)}
                    >
                      Xóa (Vĩnh viễn)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminHomestaysPage;