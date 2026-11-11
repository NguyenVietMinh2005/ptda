// src/pages/AdminOwnersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { Search, Lock, Unlock, Shield, ShieldAlert, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;

export default function AdminOwnersPage() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const token = localStorage.getItem('ownerAuthToken');
  const ownerString = localStorage.getItem('ownerAuthUser');
  let currentAdmin = null;
  try {
    currentAdmin = ownerString ? JSON.parse(ownerString) : null;
  } catch {
    currentAdmin = null;
  }

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/owners`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOwners(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách chủ nhà.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  const handleToggleOwnerStatus = async (ownerId, currentStatus) => {
    if (currentAdmin?.MaChu === ownerId) {
      toast.error('Bạn không thể tự khóa tài khoản của chính mình.');
      return;
    }

    const newStatus = !currentStatus;
    const actionText = newStatus ? 'mở khóa' : 'khóa';
    if (!window.confirm(`Bạn có chắc muốn ${actionText} đối tác chủ homestay #${ownerId}?`)) {
      return;
    }

    try {
      await axios.put(
        `${ADMIN_API_URL}/owners/${ownerId}/status`,
        { isActive: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Đã ${actionText} tài khoản chủ nhà thành công!`);
      setOwners((prev) =>
        prev.map((o) => (o.MaChu === ownerId ? { ...o, isActive: newStatus } : o))
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Cập nhật trạng thái thất bại.');
    }
  };

  const handleToggleRole = async (ownerId, currentRole) => {
    if (currentAdmin?.MaChu === ownerId) {
      toast.error('Bạn không thể tự thay đổi quyền hạn của mình.');
      return;
    }

    const newRole = currentRole === 'admin' ? 'chu_homestay' : 'admin';
    const confirmMsg = newRole === 'admin' 
      ? `Thăng cấp tài khoản #${ownerId} thành Quản trị viên (Admin)?`
      : `Hạ quyền tài khoản #${ownerId} về Chủ homestay thông thường?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.put(
        `${ADMIN_API_URL}/owners/${ownerId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Đã cập nhật quyền thành '${newRole}'!`);
      setOwners((prev) =>
        prev.map((o) => (o.MaChu === ownerId ? { ...o, Quyen: newRole } : o))
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Thay đổi quyền thất bại.');
    }
  };

  const filteredOwners = owners.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.HoTen?.toLowerCase().includes(term) ||
      o.Email?.toLowerCase().includes(term) ||
      o.SoDienThoai?.includes(term) ||
      o.SoCCCD?.includes(term)
    );
  });

  return (
    <AdminLayout
      title="Quản Lý Chủ Homestay"
      subtitle="Danh sách các đối tác cho thuê homestay và phân quyền quản trị hệ thống"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="search-input-box">
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Tìm tên, email, CCCD, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={fetchOwners} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      <div className="data-table-card">
        <div className="data-table-header">
          <h3 className="data-table-title">Tổng số: {filteredOwners.length} chủ nhà</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Số CCCD</th>
                <th>Quyền hạn</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredOwners.length > 0 ? (
                filteredOwners.map((owner) => (
                  <tr key={owner.MaChu}>
                    <td style={{ fontWeight: 700 }}>#{owner.MaChu}</td>
                    <td style={{ fontWeight: 600 }}>{owner.HoTen}</td>
                    <td>{owner.Email}</td>
                    <td>{owner.SoDienThoai || 'N/A'}</td>
                    <td>{owner.SoCCCD || 'N/A'}</td>
                    <td>
                      <span className={`status-pill ${owner.Quyen === 'admin' ? 'info' : 'neutral'}`}>
                        {owner.Quyen === 'admin' ? <Shield size={13} /> : null}
                        {owner.Quyen === 'admin' ? 'Admin' : 'Chủ Homestay'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${owner.isActive ? 'success' : 'danger'}`}>
                        {owner.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          onClick={() => handleToggleOwnerStatus(owner.MaChu, owner.isActive)}
                          className={`status-pill ${owner.isActive ? 'danger' : 'success'}`}
                          style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.65rem' }}
                          title={owner.isActive ? 'Khóa chủ nhà' : 'Mở khóa'}
                        >
                          {owner.isActive ? <Lock size={12} /> : <Unlock size={12} />}
                          <span>{owner.isActive ? 'Khóa' : 'Mở'}</span>
                        </button>

                        <button
                          onClick={() => handleToggleRole(owner.MaChu, owner.Quyen)}
                          className="status-pill info"
                          style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.65rem' }}
                          title="Đổi quyền hạn"
                        >
                          <Shield size={12} />
                          <span>{owner.Quyen === 'admin' ? 'Gỡ Admin' : 'Lên Admin'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Không tìm thấy chủ homestay nào.
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