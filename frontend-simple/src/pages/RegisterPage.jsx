// src/pages/RegisterPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import './Form.css' 
import { Toaster } from 'react-hot-toast';

const API_URL = 'http://localhost:3000/api/auth/register'

function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  
  // 1. Thêm state để theo dõi việc "hiện" hay "ẩn" mật khẩu
  const [showPassword, setShowPassword] = useState(false); // Mặc định là ẩn

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Mật khẩu và xác nhận mật khẩu không khớp!')
      return
    }
    setLoading(true)
    try {
      await axios.post(API_URL, {
        fullName: username,
        email: email,
        password: password,
        soDienThoai: soDienThoai,
      })
      toast.success('Đăng ký thành công! Đang chuyển đến trang đăng nhập.')
      navigate('/login')
    } catch (err) {
      const message = err.response?.data?.message || 'Đăng ký thất bại.'
      toast.error(message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Đăng Ký Tài Khoản</h2>
        {error && <p className="error-message">{error}</p>}
        
        <div className="form-group">
          <label htmlFor="username">Tên đăng nhập (Họ tên):</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

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

        <div className="form-group">
          <label htmlFor="soDienThoai">Số điện thoại:</label>
          <input
            id="soDienThoai"
            type="tel"
            value={soDienThoai}
            onChange={(e) => setSoDienThoai(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Mật khẩu:</label>
          <input
            id="password"
            // 2. Thay đổi 'type' dựa trên state 'showPassword'
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Xác nhận mật khẩu:</label>
          <input
            id="confirmPassword"
            // 2. Thay đổi 'type' dựa trên state 'showPassword'
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {/* 3. Thêm Checkbox để bật/tắt chức năng */}
        <div className="form-group-checkbox">
          <input
            id="show-password"
            type="checkbox"
            checked={showPassword} // Trạng thái của checkbox
            onChange={() => setShowPassword(!showPassword)} // Khi click, đảo ngược state
          />
          <label htmlFor="show-password">Hiện mật khẩu</label>
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng Ký'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </form>
    </div>
  )
}

export default RegisterPage