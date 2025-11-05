// src/pages/LoginPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import './Form.css' // Dùng chung file CSS từ hôm qua
import { toast } from 'react-hot-toast';

const API_URL = 'http://localhost:3000/api/auth/login'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Gọi API đăng nhập
      const response = await axios.post(API_URL, {
        email: email,
        password: password,
      })

      // 2. Lấy token và user từ kết quả
      const { token, user } = response.data.data

      // 3. (QUAN TRỌNG) Lưu vào localStorage
      // localStorage là bộ nhớ của trình duyệt, nó sẽ
      // lưu lại kể cả khi bạn tắt tab
      localStorage.setItem('authToken', token)
      localStorage.setItem('authUser', JSON.stringify(user)) // Lưu user dưới dạng chuỗi JSON

      toast.success('Đăng nhập thành công!')

      // 4. Chuyển hướng về trang chủ
      navigate('/') 

      // Tải lại trang để header cập nhật
      window.location.reload()

    } catch (err) {
      const message = err.response?.data?.message || 'Đăng nhập thất bại.'
      toast.error(message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Đăng Nhập</h2>
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

        <div className="form-group">
          <label htmlFor="password">Mật khẩu:</label>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-group-checkbox">
          <input
            id="show-password"
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
          />
          <label htmlFor="show-password">Hiện mật khẩu</label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
        </button>

        <div className="form-links">
  <Link to="/register">Đăng ký ngay</Link>
  <Link to="/forgot-password">Quên mật khẩu?</Link>
</div>
      </form>
    </div>
  )
}

export default LoginPage