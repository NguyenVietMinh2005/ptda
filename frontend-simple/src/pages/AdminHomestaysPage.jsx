// src/pages/AdminHomestaysPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { Search, Check, X, Trash2, ExternalLink, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL, getFullImageUrl } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80';

const getImageUrl = (imagePath) => {
  if (!imagePath) return PLACEHOLDER_IMAGE;
  if (imagePath.startsWith('http')) return imagePath;
  return getFullImageUrl(imagePath, PLACEHOLDER_IMAGE);
};

export default function AdminHomestaysPage() {
  const [homestays, setHomestays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const token = localStorage.getItem('ownerAuthToken');

  const fetchHomestays = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/homestays`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHomestays(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách Homestay.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomestays();
  }, [token]);

  const handleApprovalChange = async (homestayId, newStatus) => {
    const statusText = newStatus === 'DaDuyet' ? 'DUYỆT' : newStatus === 'TuChoi' ? 'TỪ CHỐI' : 'CHỜ DUYỆT';
    if (!window.confirm(`Xác nhận chuyển trạng thái duyệt Homestay #${homestayId} sang '${statusText}'?`)) {
      return;
    }

    try {
      await axios.put(
        `${ADMIN_API_URL}/homestays/${homestayId}/approval`,
        { trangThaiDuyet: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Đã cập nhật trạng thái duyệt thành công!`);
      setHomestays((prev) =>
        prev.map((h) => (h.MaHomestay === homestayId ? { ...h, TrangThaiDuyet: newStatus } : h))
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Cập nhật trạng thái duyệt thất bại.');
    }
  };

  const handleDeleteHomestay = async (homestayId) => {
    if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn Homestay #${homestayId}? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await axios.delete(`${ADMIN_API_URL}/homestays/${homestayId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Đã xóa homestay thành công.');
      setHomestays((prev) => prev.filter((h) => h.MaHomestay !== homestayId));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Xóa homestay thất bại.');
    }
  };

  const filteredHomestays = homestays.filter((h) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      h.TenHomestay?.toLowerCase().includes(term) ||
      h.DiaDiem?.toLowerCase().includes(term) ||
      h.CHU_HOMESTAY?.HoTen?.toLowerCase().includes(term);

    const matchFilter =
      filterStatus === 'ALL' || (h.TrangThaiDuyet || 'ChoDuyet') === filterStatus;

    return matchSearch && matchFilter;
  });

  return (
    <AdminLayout
      title="Duyệt & Quản Lý Homestay"
      subtitle="Kiểm duyệt thông tin, hình ảnh và quản lý toàn bộ homestay trên nền tảng"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">Tất cả trạng thái duyệt</option>
            <option value="ChoDuyet">⏳ Chờ duyệt</option>
            <option value="DaDuyet">✅ Đã duyệt</option>
            <option value="TuChoi">❌ Từ chối</option>
          </select>

          <div className="search-input-box">
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Tìm tên, địa điểm, chủ nhà..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button onClick={fetchHomestays} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      <div className="data-table-card">
        <div className="data-table-header">
          <h3 className="data-table-title">Hiển thị {filteredHomestays.length} / {homestays.length} homestay</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Tên Homestay</th>
                <th>Địa điểm</th>
                <th>Giá / đêm</th>
                <th>Sức chứa</th>
                <th>Chủ nhà</th>
                <th>Trạng thái duyệt</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Đang tải danh sách homestay...
                  </td>
                </tr>
              ) : filteredHomestays.length > 0 ? (
                filteredHomestays.map((h) => {
                  const status = h.TrangThaiDuyet || 'ChoDuyet';
                  const mainImage = h.HINH_ANH?.[0]?.HinhAnh;

                  return (
                    <tr key={h.MaHomestay}>
                      <td>
                        <img
                          src={getImageUrl(mainImage)}
                          alt={h.TenHomestay}
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            border: '1px solid #E2E8F0'
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{h.TenHomestay}</div>
                        <Link
                          to={`/homestays/${h.MaHomestay}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.78rem', color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}
                        >
                          <Eye size={12} /> Xem trang công khai
                        </Link>
                      </td>
                      <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.DiaDiem}
                      </td>
                      <td style={{ fontWeight: 700, color: '#15803D' }}>
                        {parseFloat(h.Gia).toLocaleString('vi-VN')} đ
                      </td>
                      <td>{h.SoKhachToiDa} khách</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{h.CHU_HOMESTAY?.HoTen || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{h.CHU_HOMESTAY?.Email}</div>
                      </td>
                      <td>
                        <span className={`status-pill ${
                          status === 'DaDuyet' ? 'success' :
                          status === 'TuChoi' ? 'danger' : 'warning'
                        }`}>
                          {status === 'DaDuyet' ? 'Đã duyệt' : status === 'TuChoi' ? 'Từ chối' : 'Chờ duyệt'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {status !== 'DaDuyet' && (
                            <button
                              onClick={() => handleApprovalChange(h.MaHomestay, 'DaDuyet')}
                              className="status-pill success"
                              style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.6rem' }}
                              title="Duyệt cho phép hoạt động"
                            >
                              <Check size={12} /> Duyệt
                            </button>
                          )}

                          {status !== 'TuChoi' && (
                            <button
                              onClick={() => handleApprovalChange(h.MaHomestay, 'TuChoi')}
                              className="status-pill warning"
                              style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.6rem' }}
                              title="Từ chối đăng"
                            >
                              <X size={12} /> Từ chối
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteHomestay(h.MaHomestay)}
                            className="status-pill danger"
                            style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.6rem' }}
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Không có homestay nào phù hợp với bộ lọc.
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