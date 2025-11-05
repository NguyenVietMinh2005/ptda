// src/pages/OwnerComplaintsPage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader' // Dùng Header của Chủ nhà
import { toast } from 'react-hot-toast'
import '../App.css'

const API_URL = 'http://localhost:3000/api/owner/me/complaints'
const RESOLVE_API_URL = 'http://localhost:3000/api/complaints' // API để Giải quyết

function OwnerComplaintsPage() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const token = localStorage.getItem('ownerAuthToken')

  // State để lưu nội dung phản hồi (cho từng khiếu nại)
  const [resolutionMessages, setResolutionMessages] = useState({});

  useEffect(() => {
    if (!token) {
      toast.error('Bạn cần đăng nhập với tư cách Chủ Homestay.');
      navigate('/owner/login');
      return;
    }

    const fetchComplaints = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setComplaints(response.data.data);
      } catch (err) {
        toast.error('Không thể tải danh sách khiếu nại.');
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, [token, navigate]);
  
  // Xử lý khi gõ vào ô phản hồi
  const handleMessageChange = (complaintId, text) => {
    setResolutionMessages(prev => ({
      ...prev,
      [complaintId]: text
    }));
  };

  // Hàm xử lý Gửi Phản Hồi
  const handleResolve = async (complaintId) => {
    const ketQua = resolutionMessages[complaintId]; // Lấy nội dung phản hồi

    if (!ketQua || ketQua.trim() === '') {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }

    try {
      const response = await axios.post(
        `${RESOLVE_API_URL}/${complaintId}/resolve`,
        { ketQua: ketQua }, // Body gửi lên
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Gửi phản hồi thành công!');
      
      // Cập nhật UI ngay lập tức
      // (Tìm khiếu nại và cập nhật trạng thái + thêm phản hồi)
      setComplaints(currentComplaints =>
        currentComplaints.map(c => {
          if (c.MaKhieuNai === complaintId) {
            // Cập nhật trạng thái
            c.TrangThai = 'DaXuLy';
            // Thêm phản hồi mới vào (XU_LY_KHIEU_NAI)
            c.XU_LY_KHIEU_NAI = [response.data.data]; 
          }
          return c;
        })
      );
      // Xóa nội dung đã gõ
      handleMessageChange(complaintId, ''); 

    } catch (err) {
      const message = err.response?.data?.message || 'Gửi phản hồi thất bại.';
      toast.error(message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  if (loading) return (
    <div className="page-container"><OwnerHeader /><p>Đang tải khiếu nại...</p></div>
  );

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Quản lý Khiếu nại</h2>
        
        <div className="complaint-list"> {/* Tái sử dụng CSS từ MyComplaintsPage */}
          {complaints.length === 0 && !loading && (
            <p>Bạn không có khiếu nại nào.</p>
          )}

          {complaints.map((complaint) => (
            <div key={complaint.MaKhieuNai} className="complaint-card">
              <p><strong>Người gửi:</strong> {complaint.NGUOI_DUNG.HoTen} ({complaint.NGUOI_DUNG.Email})</p>
              <p><strong>Ngày gửi:</strong> {formatDate(complaint.NgayTao)}</p>
              <p><strong>Nội dung khiếu nại:</strong> {complaint.NoiDung}</p>
              <p><strong>Trạng thái:</strong>
                <span className={`status ${complaint.TrangThai}`}>
                  {complaint.TrangThai}
                </span>
              </p>
              
              {/* Hiển thị Phản hồi (nếu có) */}
              {complaint.TrangThai === 'DaXuLy' && complaint.XU_LY_KHIEU_NAI[0] ? (
                <div className="complaint-response">
                  <strong>Bạn đã phản hồi:</strong>
                  <p>{complaint.XU_LY_KHIEU_NAI[0].KetQua}</p>
                </div>
              ) : (
                // Form gửi Phản hồi
                <form className="resolve-form" onSubmit={(e) => { e.preventDefault(); handleResolve(complaint.MaKhieuNai); }}>
                  <label htmlFor={`resolve-${complaint.MaKhieuNai}`}>Nội dung phản hồi:</label>
                  <textarea
                    id={`resolve-${complaint.MaKhieuNai}`}
                    rows="3"
                    value={resolutionMessages[complaint.MaKhieuNai] || ''}
                    onChange={(e) => handleMessageChange(complaint.MaKhieuNai, e.target.value)}
                    placeholder="Nhập phản hồi của bạn..."
                  ></textarea>
                  <button type="submit" className="button-primary">Gửi Phản Hồi</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default OwnerComplaintsPage;