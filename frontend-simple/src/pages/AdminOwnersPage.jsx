// src/pages/AdminOwnersPage.jsx
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../components/OwnerHeader'
import { toast } from 'react-hot-toast'
import '../App.css'

const ADMIN_API_URL = 'http://localhost:3000/api/admin'

function AdminOwnersPage() {
  const [owners, setOwners] = useState([]);
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
        const ownersRes = await axios.get(`${ADMIN_API_URL}/owners`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setOwners(ownersRes.data.data);
      } catch (err) {
        toast.error('Không thể tải danh sách Chủ nhà.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, adminUser]);

  // Hàm Khóa/Mở Owner
  const handleToggleOwnerStatus = async (ownerId, newStatus) => {
    if (adminUser.MaChu === ownerId) {
      toast.error('Bạn không thể tự khóa tài khoản của mình.');
      return;
    }
    try {
      await axios.put(
        `${ADMIN_API_URL}/owners/${ownerId}/status`,
        { isActive: newStatus },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Cập nhật trạng thái chủ nhà thành công!');
      setOwners(currentOwners => 
        currentOwners.map(o => 
          o.MaChu === ownerId ? { ...o, isActive: newStatus } : o
        )
      );
    } catch (err) {
      toast.error('Cập nhật thất bại.');
    }
  };

  // Hàm Đổi Quyền
  const handleRoleChange = async (ownerId, newRole) => {
    if (adminUser.MaChu === ownerId) {
      toast.error('Bạn không thể tự thay đổi quyền của mình.');
      return;
    }
    try {
      await axios.put(
        `${ADMIN_API_URL}/owners/${ownerId}/role`,
        { role: newRole },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Cập nhật quyền thành công!');
      setOwners(currentOwners => currentOwners.map(o => 
        o.MaChu === ownerId ? { ...o, Quyen: newRole } : o
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật quyền thất bại.');
    }
  };
  
  if (loading) return <div className="page-container"><OwnerHeader /><p>Đang tải...</p></div>;

  return (
    <div className="page-container">
      <OwnerHeader />
      <main>
        <h2>Quản lý Chủ Homestay</h2>
        <div className="admin-section">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Họ Tên</th>
                <th>Email</th>
                <th>Quyền</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {owners.map(owner => (
                <tr key={owner.MaChu}>
                  <td>{owner.MaChu}</td>
                  <td>{owner.HoTen}</td>
                  <td>{owner.Email}</td>
                  <td>
                    {adminUser.MaChu === owner.MaChu ? (
                      <span className="status-admin">{owner.Quyen}</span>
                    ) : (
                      <select 
                        className="role-select" 
                        value={owner.Quyen}
                        onChange={(e) => handleRoleChange(owner.MaChu, e.target.value)}
                      >
                        <option value="chu_homestay">Chủ nhà</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <span className={`status ${owner.isActive ? 'DaXacNhan' : 'DaHuy'}`}>
                      {owner.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    {adminUser.MaChu === owner.MaChu ? (
                      <span>(Đây là bạn)</span>
                    ) : owner.isActive ? (
                      <button 
                        className="button-danger" 
                        onClick={() => handleToggleOwnerStatus(owner.MaChu, false)}
                      >
                        Khóa
                      </button>
                    ) : (
                      <button 
                        className="button-approve" 
                        onClick={() => handleToggleOwnerStatus(owner.MaChu, true)}
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

export default AdminOwnersPage;