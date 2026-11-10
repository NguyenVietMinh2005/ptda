// src/pages/OwnerHomestaysPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import OwnerLayout from '../components/OwnerLayout';
import { toast } from 'react-hot-toast';
import EditHomestayModal from '../components/EditHomestayModal';
import CreateHomestayModal from '../components/CreateHomestayModal';
import { PlusCircle, Upload, Edit, Trash2, Eye, Calendar, RefreshCw } from 'lucide-react';
import '../App.css';

import { API_BASE_URL, getFullImageUrl } from '../utils/apiConfig';

const API_URL = `${API_BASE_URL}/owner/me/homestays`;
const UPLOAD_API_URL = `${API_BASE_URL}/homestays`;

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80';
  if (imagePath.startsWith('http')) return imagePath;
  return getFullImageUrl(imagePath, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80');
};

export default function OwnerHomestaysPage() {
  const [myHomestays, setMyHomestays] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('ownerAuthToken');

  const [editingHomestay, setEditingHomestay] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchMyHomestays = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyHomestays(response.data.data || []);
    } catch (err) {
      toast.error('Không thể tải danh sách homestay của bạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      toast.error('Bạn cần đăng nhập kênh Chủ nhà.');
      navigate('/owner/login');
      return;
    }
    fetchMyHomestays();
  }, [token, navigate]);

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
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Tải ảnh lên thành công!');
      fetchMyHomestays();
    } catch (err) {
      toast.error('Tải ảnh thất bại.');
    }
  };

  const handleDeleteHomestay = async (homestayId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa homestay này? Hành động này sẽ chuyển trạng thái lưu trữ an toàn.')) {
      try {
        await axios.delete(
          `${UPLOAD_API_URL}/${homestayId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Đã xóa homestay thành công.');
        setMyHomestays((current) => current.filter((h) => h.MaHomestay !== homestayId));
      } catch (err) {
        toast.error('Xóa homestay thất bại.');
      }
    }
  };

  const handleHomestayUpdated = (updatedHomestay) => {
    setMyHomestays((current) =>
      current.map((h) => (h.MaHomestay === updatedHomestay.MaHomestay ? updatedHomestay : h))
    );
  };

  const handleHomestayCreated = () => {
    toast.success('Đăng tải homestay thành công!');
    setIsCreateModalOpen(false);
    fetchMyHomestays();
  };

  return (
    <OwnerLayout
      title="Homestay Của Tôi"
      subtitle="Quản lý chi tiết danh mục phòng, hình ảnh thực tế và giá niêm yết"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="button-primary"
            onClick={() => setIsCreateModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusCircle size={16} /> Thêm Homestay Mới
          </button>
          <button onClick={fetchMyHomestays} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#5C6861' }}>
          Đang tải danh sách homestay...
        </div>
      ) : myHomestays.length === 0 ? (
        <div className="data-table-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <h3 style={{ color: '#1C3B2B', marginBottom: '0.5rem' }}>Bạn chưa có homestay nào</h3>
          <p style={{ color: '#5C6861', marginBottom: '1.5rem' }}>
            Hãy đăng tải homestay đầu tiên để bắt đầu đón khách và gia tăng thu nhập!
          </p>
          <button
            className="button-primary"
            onClick={() => setIsCreateModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusCircle size={16} /> Đăng Homestay Ngay
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {myHomestays.map((homestay) => {
            const statusDuyet = homestay.TrangThaiDuyet || 'ChoDuyet';

            return (
              <div
                key={homestay.MaHomestay}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E8E2D7',
                  padding: '1.75rem',
                  boxShadow: '0 2px 10px rgba(28, 59, 43, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1C3B2B', margin: 0 }}>
                        {homestay.TenHomestay}
                      </h3>
                      <span className={`status-pill ${
                        statusDuyet === 'DaDuyet' ? 'success' :
                        statusDuyet === 'TuChoi' ? 'danger' : 'warning'
                      }`}>
                        {statusDuyet === 'DaDuyet' ? 'Đã duyệt' : statusDuyet === 'TuChoi' ? 'Từ chối' : 'Chờ duyệt'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#5C6861', marginTop: '0.35rem' }}>
                      📍 {homestay.DiaDiem} &bull; Sức chứa: <strong>{homestay.SoKhachToiDa} khách</strong> &bull; Giá: <strong style={{ color: '#15803D' }}>{parseFloat(homestay.Gia).toLocaleString('vi-VN')} đ/đêm</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Link
                      to={`/homestays/${homestay.MaHomestay}`}
                      target="_blank"
                      rel="noreferrer"
                      className="button-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', textDecoration: 'none' }}
                    >
                      <Eye size={14} /> Xem trên Web
                    </Link>
                    <button
                      className="button-primary"
                      onClick={() => setEditingHomestay(homestay)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                    >
                      <Edit size={14} /> Sửa
                    </button>
                    <button
                      className="button-danger"
                      onClick={() => handleDeleteHomestay(homestay.MaHomestay)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                    >
                      <Trash2 size={14} /> Xóa
                    </button>
                  </div>
                </div>

                {/* Photo Gallery & Upload Section */}
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F0ECE4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1C3B2B' }}>
                      Bộ sưu tập hình ảnh ({homestay.HINH_ANH?.length || 0} ảnh)
                    </span>

                    <label
                      htmlFor={`upload-${homestay.MaHomestay}`}
                      style={{
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#C9653B',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: '#FDF3EE'
                      }}
                    >
                      <Upload size={14} /> Tải thêm ảnh
                    </label>
                    <input
                      type="file"
                      id={`upload-${homestay.MaHomestay}`}
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageUpload(e, homestay.MaHomestay)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {homestay.HINH_ANH && homestay.HINH_ANH.length > 0 ? (
                      homestay.HINH_ANH.map((img, idx) => (
                        <img
                          key={idx}
                          src={getImageUrl(img.HinhAnh)}
                          alt={`Homestay ${idx}`}
                          style={{
                            width: '120px',
                            height: '85px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #E8E2D7',
                            flexShrink: 0
                          }}
                        />
                      ))
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: '#8F9D95', fontStyle: 'italic' }}>
                        Chưa có ảnh nào được tải lên.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingHomestay && (
        <EditHomestayModal
          homestay={editingHomestay}
          onClose={() => setEditingHomestay(null)}
          onHomestayUpdated={handleHomestayUpdated}
        />
      )}

      {/* Create Modal */}
      <CreateHomestayModal
        show={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onHomestayCreated={handleHomestayCreated}
      />
    </OwnerLayout>
  );
}