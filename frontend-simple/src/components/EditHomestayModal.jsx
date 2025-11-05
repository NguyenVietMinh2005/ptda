// src/components/EditHomestayModal.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import '../App.css'; // Dùng CSS chung

const UPDATE_API_URL = 'http://localhost:3000/api/homestays';

function EditHomestayModal({ homestay, onClose, onHomestayUpdated }) {
  // State để lưu trữ dữ liệu của form
  const [tenHomestay, setTenHomestay] = useState('');
  const [diaDiem, setDiaDiem] = useState('');
  const [gia, setGia] = useState(0);
  const [soKhachToiDa, setSoKhachToiDa] = useState(1);
  const [moTa, setMoTa] = useState('');
  const [tienIch, setTienIch] = useState('');
  
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('ownerAuthToken');

  // 1. Tự động điền form khi 'homestay' thay đổi
  useEffect(() => {
    if (homestay) {
      setTenHomestay(homestay.TenHomestay || '');
      setDiaDiem(homestay.DiaDiem || '');
      setGia(homestay.Gia || 0);
      setSoKhachToiDa(homestay.SoKhachToiDa || 1);
      setMoTa(homestay.MoTa || '');
      setTienIch(homestay.TienIch || '');
    }
  }, [homestay]); 

  // 2. Hàm xử lý Cập nhật
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.put(
        `${UPDATE_API_URL}/${homestay.MaHomestay}`,
        { 
          tenHomestay,
          diaDiem,
          gia: parseFloat(gia),
          soKhachToiDa: parseInt(soKhachToiDa),
          moTa,
          tienIch 
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Cập nhật homestay thành công!');
      onHomestayUpdated(response.data.data); // Trả homestay đã cập nhật về
      onClose(); // Đóng Modal
      
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật thất bại.');
    } finally {
      setLoading(false);
    }
  };

  if (!homestay) return null; // Không render gì nếu đang đóng

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Chỉnh sửa: {homestay.TenHomestay}</h2>
        <form onSubmit={handleSubmit}>
          
          <div className="form-group">
            <label htmlFor="edit-ten">Tên Homestay:</label>
            <input id="edit-ten" type="text" value={tenHomestay} onChange={(e) => setTenHomestay(e.target.value)} />
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-diadiem">Địa điểm:</label>
            <input id="edit-diadiem" type="text" value={diaDiem} onChange={(e) => setDiaDiem(e.target.value)} />
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-gia">Giá (VNĐ/đêm):</label>
            <input id="edit-gia" type="number" value={gia} onChange={(e) => setGia(e.target.value)} />
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-khach">Số khách tối đa:</label>
            <input id="edit-khach" type="number" value={soKhachToiDa} onChange={(e) => setSoKhachToiDa(e.target.value)} />
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-mota">Mô tả:</label>
            <textarea id="edit-mota" rows="3" value={moTa} onChange={(e) => setMoTa(e.target.value)}></textarea>
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-tienich">Tiện ích:</label>
            <input id="edit-tienich" type="text" value={tienIch} onChange={(e) => setTienIch(e.target.value)} />
          </div>

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu Thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditHomestayModal;