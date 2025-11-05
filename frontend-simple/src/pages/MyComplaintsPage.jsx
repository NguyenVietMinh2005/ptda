// src/pages/MyComplaintsPage.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header' // Dùng Header component
import '../App.css' // Dùng chung CSS

const API_URL = 'http://localhost:3000/api/auth/me/complaints'

function MyComplaintsPage() {
  const [complaints, setComplaints] = useState([])
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

    const fetchComplaints = async () => {
      try {
        const response = await axios.get(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setComplaints(response.data.data)
      } catch (err) {
        setError('Không thể tải lịch sử khiếu nại.')
      } finally {
        setLoading(false)
      }
    }

    fetchComplaints()
  }, [token, navigate])

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN')
  }

  if (loading) return (
    <div className="page-container"><Header /><p>Đang tải...</p></div>
  )
  if (error) return (
    <div className="page-container"><Header /><p>{error}</p></div>
  )

  return (
    <div className="page-container">
      <Header />
      <main>
        <h2>Lịch sử Khiếu nại của bạn</h2>

        <div className="complaint-list">
          {complaints.length === 0 && !loading && (
            <p>Bạn chưa có khiếu nại nào.</p>
          )}

          {complaints.map((complaint) => (
            <div key={complaint.MaKhieuNai} className="complaint-card">
              <p><strong>Ngày gửi:</strong> {formatDate(complaint.NgayTao)}</p>
              <p><strong>Nội dung:</strong> {complaint.NoiDung}</p>
              <p><strong>Trạng thái:</strong>
                <span className={`status ${complaint.TrangThai}`}>
                  {complaint.TrangThai}
                </span>
              </p>
              
              {/* Hiển thị phản hồi của chủ/admin (nếu có) */}
              {complaint.XU_LY_KHIEU_NAI && complaint.XU_LY_KHIEU_NAI.length > 0 && (
                <div className="complaint-response">
                  <strong>Phản hồi từ Chủ Homestay:</strong>
                  <p>{complaint.XU_LY_KHIEU_NAI[0].KetQua}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default MyComplaintsPage