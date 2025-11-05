// src/pages/ForgotPasswordPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast';
import './Form.css' // Dùng chung file CSS

const API_URL = 'http://localhost:3000/api/auth/forgot-password'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Gọi API yêu cầu token
      const response = await axios.post(API_URL, { email })
      
      // 2. Lấy token (giả lập) từ backend
      const { resetToken } = response.data

      toast.success('Yêu cầu thành công! Đang chuyển bạn đến trang đặt lại mật khẩu.')
      
      // 3. Chuyển hướng đến trang Reset, GỬI KÈM token
      navigate(`/reset-password/${resetToken}`)

    } catch (err) {
      const message = err.response?.data?.message || 'Yêu cầu thất bại.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Quên Mật khẩu</h2>
        <p style={{textAlign: 'center', color: '#555', marginTop: 0}}>
          Nhập email của bạn để nhận token đặt lại mật khẩu.
        </p>
        {error && <p className="error-message">{error}</p>}
        
        <div className="form-group">
          <label htmlFor="email">Email:</label>
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
          <Link to="/login">Quay lại Đăng nhập</Link>
        </p>
      </form>
    </div>
  )
}

export default ForgotPasswordPage
