// src/pages/OwnerForgotPasswordPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import './Form.css' // Dùng chung file CSS

const API_URL = 'http://localhost:3000/api/owner/forgot-password'

function OwnerForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await axios.post(API_URL, { email })
      const { resetToken } = response.data

      toast.success('Yêu cầu thành công! Kiểm tra token (mô phỏng).')
      
      // Chuyển hướng đến trang Reset, GỬI KÈM token
      navigate(`/owner/reset-password/${resetToken}`)

    } catch (err) {
      const message = err.response?.data?.message || 'Yêu cầu thất bại.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Quên Mật khẩu (Chủ nhà)</h2>
        <p style={{textAlign: 'center', color: '#555', marginTop: 0}}>
          Nhập email của bạn để nhận token đặt lại mật khẩu.
        </p>
        
        <div className="form-group">
          <label htmlFor="email">Email Chủ Homestay:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Gửi Yêu Cầu'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link to="/owner/login">Quay lại Đăng nhập</Link>
        </p>
      </form>
    </div>
  )
}

export default OwnerForgotPasswordPage