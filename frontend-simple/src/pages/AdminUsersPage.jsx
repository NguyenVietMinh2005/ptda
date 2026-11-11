// src/pages/AdminUsersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { Search, Lock, Unlock, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const token = localStorage.getItem('ownerAuthToken');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'mở khóa' : 'khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản người dùng #${userId}?`)) {
      return;
    }

    try {
      await axios.put(
        `${ADMIN_API_URL}/users/${userId}/status`,
        { isActive: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Đã ${actionText} tài khoản thành công!`);
      setUsers((prev) =>
        prev.map((u) => (u.MaNguoiDung === userId ? { ...u, isActive: newStatus } : u))
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Cập nhật trạng thái thất bại.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.HoTen?.toLowerCase().includes(term) ||
      u.Email?.toLowerCase().includes(term) ||
      u.SoDienThoai?.includes(term)
    );
  });

  return (
    <AdminLayout
      title="Quản Lý Khách Hàng"
      subtitle="Danh sách tất cả khách hàng đã đăng ký sử dụng dịch vụ trên hệ thống"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="search-input-box">
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={fetchUsers} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      <div className="data-table-card">
        <div className="data-table-header">
          <h3 className="data-table-title">Tổng số: {filteredUsers.length} khách hàng</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Mã ID</th>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Địa chỉ</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.MaNguoiDung}>
                    <td style={{ fontWeight: 700 }}>#{user.MaNguoiDung}</td>
                    <td style={{ fontWeight: 600 }}>{user.HoTen}</td>
                    <td>{user.Email}</td>
                    <td>{user.SoDienThoai || 'Chưa cập nhật'}</td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.DiaChi || 'Chưa cập nhật'}
                    </td>
                    <td>
                      <span className={`status-pill ${user.isActive ? 'success' : 'danger'}`}>
                        {user.isActive ? <UserCheck size={13} /> : <UserX size={13} />}
                        {user.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleUserStatus(user.MaNguoiDung, user.isActive)}
                        className={`status-pill ${user.isActive ? 'danger' : 'success'}`}
                        style={{ border: 'none', cursor: 'pointer', padding: '0.4rem 0.8rem' }}
                        title={user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                      >
                        {user.isActive ? (
                          <>
                            <Lock size={13} /> Khóa
                          </>
                        ) : (
                          <>
                            <Unlock size={13} /> Mở khóa
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Không tìm thấy khách hàng nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}