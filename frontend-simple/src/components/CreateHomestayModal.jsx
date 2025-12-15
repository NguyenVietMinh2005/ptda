// src/components/CreateHomestayModal.jsx
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Endpoint API (từ homestay.controller.js)
const HOMESTAY_API_URL = 'http://localhost:3000/api/homestays';

function CreateHomestayModal({ show, onClose, onHomestayCreated }) {
  const [formData, setFormData] = useState({
    tenHomestay: '',
    diaDiem: '',
    gia: '',
    soKhachToiDa: '',
    tienIch: '',
    moTa: '',
  });
  const [images, setImages] = useState([]); // State cho file ảnh
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('ownerAuthToken');

  if (!show) {
    return null; // Không hiển thị gì nếu show = false
  }

  // Xử lý thay đổi input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Xử lý chọn file
  const handleImageChange = (e) => {
    setImages(e.target.files); // Lưu danh sách file
  };

  // Xử lý reset form khi đóng
  const handleClose = () => {
    setFormData({
      tenHomestay: '', diaDiem: '', gia: '',
      soKhachToiDa: '', tienIch: '', moTa: '',
    });
    setImages([]);
    setLoading(false);
    onClose(); // Gọi hàm onClose từ props
  };

  // Xử lý submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      
      const homestayResponse = await axios.post(
        HOMESTAY_API_URL, 
        {
          ...formData,
          gia: parseFloat(formData.gia),
          soKhachToiDa: parseInt(formData.soKhachToiDa),
        },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      const newHomestayId = homestayResponse.data.data.MaHomestay;
      toast.success('Tạo thông tin thành công! Đang tải ảnh...');

      
      if (images.length > 0) {
        const imageFormData = new FormData();
        for (let i = 0; i < images.length; i++) {
          imageFormData.append('images', images[i]);
        }
        
        await axios.post(
          `${HOMESTAY_API_URL}/${newHomestayId}/images`,
          imageFormData,
          { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
        );
      }
      
      
      onHomestayCreated(); // Hàm này sẽ tải lại danh sách
      handleClose(); // Reset form và đóng modal

    } catch (err) {
      setLoading(false);
      toast.error(err.response?.data?.message || 'Đã xảy ra lỗi.');
    }
  };

  return (
    // Sử dụng class CSS chúng ta sẽ thêm vào App.css
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Đăng tải Homestay mới</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid"> 
            <div className="form-group full-span">
              <label htmlFor="tenHomestay">Tên Homestay</label>
              <input type="text" id="tenHomestay" name="tenHomestay" value={formData.tenHomestay} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="diaDiem">Địa điểm</label>
              <input type="text" id="diaDiem" name="diaDiem" value={formData.diaDiem} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="gia">Giá (VNĐ / đêm)</label>
              <input type="number" id="gia" name="gia" value={formData.gia} onChange={handleChange} required min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="soKhachToiDa">Số khách tối đa</label>
              <input type="number" id="soKhachToiDa" name="soKhachToiDa" value={formData.soKhachToiDa} onChange={handleChange} required min="1" />
            </div>
            <div className="form-group">
              <label htmlFor="tienIch">Tiện ích (phân cách bởi ,)</label>
              <input type="text" id="tienIch" name="tienIch" placeholder="Ví dụ: Wifi, Bể bơi" value={formData.tienIch} onChange={handleChange} />
            </div>
            <div className="form-group full-span">
              <label htmlFor="moTa">Mô tả chi tiết</label>
              <textarea id="moTa" name="moTa" value={formData.moTa} onChange={handleChange} rows="4"></textarea>
            </div>
            <div className="form-group full-span">
              <label htmlFor="images">Hình ảnh (chọn nhiều ảnh)</label>
              <input type="file" id="images" name="images" onChange={handleImageChange} multiple accept="image/png, image/jpeg" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={handleClose} disabled={loading}>
              Hủy
            </button>
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Tạo Homestay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateHomestayModal;