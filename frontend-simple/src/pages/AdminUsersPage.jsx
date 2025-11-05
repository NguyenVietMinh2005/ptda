// src/pages/AdminUsersPage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader'
import { toast } from 'react-hot-toast'
import '../App.css'

const ADMIN_API_URL = 'http://localhost:3000/api/admin'

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('ownerAuthToken');
  const ownerString = localStorage.getItem('ownerAuthUser');
  const adminUser = useMemo(() => {
    return ownerString ? JSON.parse(ownerString) : null;
  }, [ownerString]);

  // Tải dữ liệu
  useEffect(() => {
    if (!token || !adminUser || adminUser.Quyen !== 'admin') {
      toast.error('Bạn không có quyền truy cập trang này.');
      navigate('/owner/login');
      return;
    }
    const fetchData = async () => {
      try {
        const usersRes = await axios.get(`${ADMIN_API_URL}/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setUsers(usersRes.data.data);
      } catch (err) {
        toast.error('Không thể tải danh sách Người dùng.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, adminUser]);

  // Hàm Khóa/Mở User
  const handleToggleUserStatus = async (userId, newStatus) => {
    try {
      await axios.put(
        `${ADMIN_API_URL}/users/${userId}/status`,
        { isActive: newStatus },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Cập nhật trạng thái thành công!');
      setUsers(currentUsers => 
        currentUsers.map(u => 
          u.MaNguoiDung === userId ? { ...u, isActive: newStatus } : u
        )
      );
    } catch (err) {
      toast.error('Cập nhật thất bại.');
    }
  };

  if (loading) return <div className="page-container"><OwnerHeader /><p>Đang tải...</p></div>;

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Quản lý Người Dùng (Khách hàng)</h2>
        <div className="admin-section">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Họ Tên</th>
                <th>Email</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.MaNguoiDung}>
                  <td>{user.MaNguoiDung}</td>
                  <td>{user.HoTen}</td>
                  <td>{user.Email}</td>
                  <td>
                    <span className={`status ${user.isActive ? 'DaXacNhan' : 'DaHuy'}`}>
                      {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    {user.isActive ? (
                      <button 
                        className="button-danger" 
                        onClick={() => handleToggleUserStatus(user.MaNguoiDung, false)}
                      >
                        Khóa
                      </button>
                    ) : (
                      <button 
                        className="button-approve" 
                        onClick={() => handleToggleUserStatus(user.MaNguoiDung, true)}
                      >
                        Mở khóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default AdminUsersPage;