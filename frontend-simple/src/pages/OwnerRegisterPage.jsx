// src/pages/OwnerRegisterPage.jsx
import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import './Form.css' // Dùng chung file CSS

// API Đăng ký của CHỦ HOMESTAY
const API_URL = 'http://localhost:3000/api/owner/register'

function OwnerRegisterPage() {
  const [hoTen, setHoTen] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [soCCCD, setSoCCCD] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [diaChi, setDiaChi] = useState('')
  
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Kiểm tra mật khẩu khớp
    if (password !== confirmPassword) {
      toast.error('Mật khẩu và xác nhận mật khẩu không khớp!')
      return
    }

    setLoading(true)
    try {
      await axios.post(API_URL, {
        hoTen,
        email,
        password,
        soCCCD,
        soDienThoai,
        diaChi
      })
      
      toast.success('Đăng ký tài khoản chủ nhà thành công! Vui lòng đăng nhập.')
      navigate('/owner/login') // Chuyển đến trang đăng nhập CỦA CHỦ NHÀ
      
    } catch (err) {
      const message = err.response?.data?.message || 'Đăng ký thất bại.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Đăng Ký Kênh Chủ Nhà</h2>
        
        <div className="form-group">
          <label htmlFor="hoTen">Họ và Tên:</label>
          <input
            id="hoTen"
            type="text"
            value={hoTen}
            onChange={(e) => setHoTen(e.target.value)}
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
          <label htmlFor="soCCCD">Số CCCD:</label>
          <input
            id="soCCCD"
            type="text"
            value={soCCCD}
            onChange={(e) => setSoCCCD(e.target.value)}
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
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="diaChi">Địa chỉ:</label>
          <input
            id="diaChi"
            type="text"
            value={diaChi}
            onChange={(e) => setDiaChi(e.target.value)}
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
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Xác nhận mật khẩu:</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng Ký'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          Đã có tài khoản? <Link to="/owner/login">Đăng nhập</Link>
        </p>
      </form>
    </div>
  )
}

export default OwnerRegisterPage