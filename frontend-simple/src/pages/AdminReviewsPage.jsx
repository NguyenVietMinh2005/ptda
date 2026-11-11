// src/pages/AdminReviewsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { Search, Star, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [starFilter, setStarFilter] = useState('ALL');
  const token = localStorage.getItem('ownerAuthToken');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/reviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReviews(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách đánh giá.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ bỏ đánh giá #${reviewId}?`)) {
      return;
    }

    try {
      await axios.delete(`${ADMIN_API_URL}/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Đã gỡ bỏ đánh giá thành công.');
      setReviews((prev) => prev.filter((r) => r.MaDanhGia !== reviewId));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gỡ đánh giá thất bại.');
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      r.NGUOI_DUNG?.HoTen?.toLowerCase().includes(term) ||
      r.HOMESTAY?.TenHomestay?.toLowerCase().includes(term) ||
      r.BinhLuan?.toLowerCase().includes(term);

    const matchStar = starFilter === 'ALL' || r.SoSao === parseInt(starFilter);
    return matchSearch && matchStar;
  });

  return (
    <AdminLayout
      title="Quản Lý Đánh Giá Khách Hàng"
      subtitle="Kiểm duyệt bình luận, đánh giá sao của khách hàng nhằm bảo vệ chất lượng nội dung"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={starFilter}
            onChange={(e) => setStarFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">Tất cả số sao</option>
            <option value="5">⭐⭐⭐⭐⭐ (5 sao)</option>
            <option value="4">⭐⭐⭐⭐ (4 sao)</option>
            <option value="3">⭐⭐⭐ (3 sao)</option>
            <option value="2">⭐⭐ (2 sao)</option>
            <option value="1">⭐ (1 sao)</option>
          </select>

          <div className="search-input-box">
            <Search size={16} color="#94A3B8" />
            <input
              type="text"
              placeholder="Tìm theo khách, homestay, bình luận..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button onClick={fetchReviews} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      <div className="data-table-card">
        <div className="data-table-header">
          <h3 className="data-table-title">Tổng số: {filteredReviews.length} đánh giá</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Khách hàng</th>
                <th>Homestay</th>
                <th>Đánh giá sao</th>
                <th>Nội dung bình luận</th>
                <th>Thời gian</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Đang tải danh sách đánh giá...
                  </td>
                </tr>
              ) : filteredReviews.length > 0 ? (
                filteredReviews.map((r) => (
                  <tr key={r.MaDanhGia}>
                    <td style={{ fontWeight: 700 }}>#{r.MaDanhGia}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.NGUOI_DUNG?.HoTen || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{r.NGUOI_DUNG?.Email}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#1C3B2B' }}>
                      {r.HOMESTAY?.TenHomestay || 'Homestay'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#F59E0B' }}>
                        {[...Array(r.SoSao || 5)].map((_, i) => (
                          <Star key={i} size={14} fill="#F59E0B" />
                        ))}
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, marginLeft: '0.3rem', color: '#1E293B' }}>
                          {r.SoSao}/5
                        </span>
                      </div>
                    </td>
                    <td style={{ maxWidth: '280px', lineHeight: '1.5' }}>
                      {r.BinhLuan || <em style={{ color: '#94A3B8' }}>Không có nhận xét viết</em>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748B' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : 'Mới'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteReview(r.MaDanhGia)}
                        className="status-pill danger"
                        style={{ border: 'none', cursor: 'pointer', padding: '0.35rem 0.65rem' }}
                        title="Xóa đánh giá không phù hợp"
                      >
                        <Trash2 size={12} />
                        <span>Xóa</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Không tìm thấy đánh giá nào.
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

