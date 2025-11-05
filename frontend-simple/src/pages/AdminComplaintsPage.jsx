// src/pages/AdminComplaintsPage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader'
import { toast } from 'react-hot-toast'
import '../App.css'

const ADMIN_API_URL = 'http://localhost:3000/api/admin'

function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const token = localStorage.getItem('ownerAuthToken');
  
  // --- ĐÂY LÀ DÒNG CODE QUAN TRỌNG BỊ THIẾU ---
  const [resolutionMessages, setResolutionMessages] = useState({});
  // ------------------------------------------

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
        const complaintsRes = await axios.get(`${ADMIN_API_URL}/complaints`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setComplaints(complaintsRes.data.data);
      } catch (err) {
        toast.error('Không thể tải danh sách Khiếu nại.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, adminUser]);

  // Hàm Gửi Phản Hồi (với tư cách Admin)
  const handleResolveComplaint = async (complaintId) => {
    const ketQua = resolutionMessages[complaintId];
    if (!ketQua || ketQua.trim() === '') {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    try {
      const response = await axios.post(
        `${ADMIN_API_URL}/complaints/${complaintId}/resolve`,
        { ketQua },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Gửi phản hồi thành công!');
      // Cập nhật UI
      setComplaints(currentComplaints =>
        currentComplaints.map(c => {
          if (c.MaKhieuNai === complaintId) {
            return {
              ...c,
              TrangThai: 'DaXuLy',
              XU_LY_KHIEU_NAI: [response.data.data]
            };
          }
          return c;
        })
      );
      setResolutionMessages(prev => ({ ...prev, [complaintId]: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi phản hồi thất bại.');
    }
  };

  // Hàm xử lý khi gõ vào ô phản hồi
  const handleComplaintMessageChange = (complaintId, text) => {
    setResolutionMessages(prev => ({
      ...prev,
      [complaintId]: text
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  if (loading) return <div className="page-container"><OwnerHeader /><p>Đang tải...</p></div>;

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Quản lý Khiếu Nại (Toàn hệ thống)</h2>
        <div className="admin-section">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Người khiếu nại</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Phản hồi (Admin)</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map(complaint => (
                <tr key={complaint.MaKhieuNai}>
                  <td>{complaint.MaKhieuNai}</td>
                  <td>{complaint.NGUOI_DUNG.HoTen}</td>
                  <td>{complaint.NoiDung}</td>
                  <td>
                    <span className={`status ${complaint.TrangThai}`}>
                      {complaint.TrangThai}
                    </span>
                  </td>
                  <td>
                    {complaint.TrangThai === 'DaXuLy' && complaint.XU_LY_KHIEU_NAI[0] ? (
                      <div className="complaint-response">
                        <p>{complaint.XU_LY_KHIEU_NAI[0].KetQua}</p>
                        <small>(Bởi ID: {complaint.XU_LY_KHIEU_NAI[0].MaChu})</small>
                      </div>
                    ) : (
                      <form 
                        className="resolve-form-admin" 
                        onSubmit={(e) => { e.preventDefault(); handleResolveComplaint(complaint.MaKhieuNai); }}
                      >
                        <textarea
                          rows="3"
                          placeholder="Nhập phản hồi..."
                          value={resolutionMessages[complaint.MaKhieuNai] || ''}
                          onChange={(e) => handleComplaintMessageChange(complaint.MaKhieuNai, e.target.value)}
                        ></textarea>
                        <button type="submit" className="button-primary">Gửi</button>
                      </form>
                    )}
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

export default AdminComplaintsPage;