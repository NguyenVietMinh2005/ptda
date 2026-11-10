// src/pages/OwnerLoginPage.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Đường dẫn cũ dành riêng cho Host/Admin.
 * Tự động chuyển hướng ngay về cổng đăng nhập chung duy nhất (/login).
 */
export default function OwnerLoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#1C3B2B' }}>
      <p>Đang chuyển hướng đến cổng đăng nhập chung...</p>
    </div>
  );
}
