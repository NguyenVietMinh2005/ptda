// src/pages/OwnerResetPasswordPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import './Form.css'

const API_URL = 'http://localhost:3000/api/owner/reset-password'

function OwnerResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  const navigate = useNavigate()
  const { token } = useParams() // Lấy token từ URL

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Mật khẩu không khớp!')
      return
    }

    setLoading(true)
    try {
      await axios.post(API_URL, {
        token: token,
        newPassword: password
      })
      
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.')
      navigate('/owner/login') // Về trang đăng nhập CỦA CHỦ NHÀ

    } catch (err) {
      const message = err.response?.data?.message || 'Đặt lại mật khẩu thất bại.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Đặt Lại Mật khẩu Mới (Chủ nhà)</h2>
        
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

export default OwnerResetPasswordPage