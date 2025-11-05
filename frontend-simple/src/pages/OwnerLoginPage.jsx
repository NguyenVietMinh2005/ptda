// src/pages/OwnerLoginPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import './Form.css' // Dùng chung file CSS

// API Đăng nhập của CHỦ HOMESTAY
const API_URL = 'http://localhost:3000/api/owner/login'

function OwnerLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await axios.post(API_URL, { email, password })

      const { token, owner } = response.data.data

      // QUAN TRỌNG: Lưu token của Owner vào một key (khóa) riêng biệt
      // để không bị nhầm lẫn với token của Người Dùng
      localStorage.setItem('ownerAuthToken', token)
      localStorage.setItem('ownerAuthUser', JSON.stringify(owner))

      alert('Đăng nhập Chủ Homestay thành công!')
      navigate('/owner/dashboard') // Chuyển đến trang quản lý

    } catch (err) {
      const message = err.response?.data?.message || 'Đăng nhập thất bại.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Đăng Nhập Kênh Chủ Nhà</h2>
        {error && <p className="error-message">{error}</p>}

        <div className="form-group">
          <label htmlFor="email">Email (Chủ Homestay):</label>
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
        </button>

        <div className="form-links">
          <Link to="/owner/register">Tạo tài khoản Chủ nhà</Link>
          <Link to="/owner/forgot-password">Quên mật khẩu?</Link>
        </div>
      </form>
    </div>
  )
}

export default OwnerLoginPage