// src/pages/ResetPasswordPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast';
import './Form.css'

const API_URL = 'http://localhost:3000/api/auth/reset-password'

function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const navigate = useNavigate()
  const { token } = useParams() // Lấy token từ URL (ví dụ: /reset-password/abc123xyz)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp!')
      return
    }

    setLoading(true)
    try {
      // 1. Gọi API với token và mật khẩu mới
      await axios.post(API_URL, {
        token: token,
        newPassword: password
      })
      
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.')
      navigate('/login') // Về trang đăng nhập

    } catch (err) {
      const message = err.response?.data?.message || 'Đặt lại mật khẩu thất bại.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Đặt Lại Mật khẩu Mới</h2>
        {error && <p className="error-message">{error}</p>}
        
        <div className="form-group">
          <label htmlFor="password">Mật khẩu mới:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Xác nhận mật khẩu mới:</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Cập Nhật Mật khẩu'}
        </button>
      </form>
    </div>
  )
}

export default ResetPasswordPage
