// src/pages/AdminComplaintsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { AlertTriangle, CheckCircle2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { API_BASE_URL } from '../utils/apiConfig';

const ADMIN_API_URL = `${API_BASE_URL}/admin`;

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resolutionMessages, setResolutionMessages] = useState({});
  const token = localStorage.getItem('ownerAuthToken');

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${ADMIN_API_URL}/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComplaints(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách khiếu nại.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleResolveComplaint = async (complaintId) => {
    const ketQua = resolutionMessages[complaintId];
    if (!ketQua || ketQua.trim() === '') {
      toast.error('Vui lòng nhập nội dung phương án giải quyết.');
      return;
    }

    try {
      await axios.post(
        `${ADMIN_API_URL}/complaints/${complaintId}/resolve`,
        { ketQua },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Đã giải quyết khiếu nại thành công!');
      setResolutionMessages((prev) => ({ ...prev, [complaintId]: '' }));
      fetchComplaints();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Xử lý khiếu nại thất bại.');
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter === 'ALL') return true;
    return c.TrangThai === statusFilter;
  });

  return (
    <AdminLayout
      title="Quản Lý Khiếu Nại"
      subtitle="Tiếp nhận, phản hồi và giải quyết tranh chấp giữa khách hàng và đối tác"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">Tất cả khiếu nại</option>
            <option value="ChuaXuLy">⚠️ Chưa xử lý</option>
            <option value="DaXuLy">✅ Đã xử lý</option>
          </select>

          <button onClick={fetchComplaints} className="button-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
            Đang tải dữ liệu khiếu nại...
          </div>
        ) : filteredComplaints.length > 0 ? (
          filteredComplaints.map((c) => (
            <div
              key={c.MaKhieuNai}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                      Khiếu nại #{c.MaKhieuNai}
                    </span>
                    <span style={{ fontSize: '0.88rem', color: '#64748B' }}>
                      (Đơn đặt: #{c.MaDatPhong})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.2rem' }}>
                    Người gửi: <strong>{c.NGUOI_DUNG?.HoTen}</strong> ({c.NGUOI_DUNG?.Email}) &bull;{' '}
                    {new Date(c.NgayTao).toLocaleString('vi-VN')}
                  </div>
                </div>

                <span className={`status-pill ${c.TrangThai === 'DaXuLy' ? 'success' : 'danger'}`}>
                  {c.TrangThai === 'DaXuLy' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {c.TrangThai === 'DaXuLy' ? 'Đã giải quyết' : 'Chưa xử lý'}
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  marginBottom: '1rem',
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  color: '#1E293B'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#64748B', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Nội dung khiếu nại:
                </div>
                {c.NoiDung}
              </div>

              {/* Resolution history if resolved */}
              {c.XU_LY_KHIEU_NAI && c.XU_LY_KHIEU_NAI.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #BBF7D0',
                    marginBottom: '1rem'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#166534', marginBottom: '0.3rem' }}>
                    Phương án giải quyết từ Quản trị viên:
                  </div>
                  {c.XU_LY_KHIEU_NAI.map((xl) => (
                    <div key={xl.MaXuLy} style={{ fontSize: '0.9rem', color: '#14532D' }}>
                      {xl.KetQua} &bull; <small style={{ color: '#166534' }}>{new Date(xl.NgayXuLy).toLocaleString('vi-VN')}</small>
                    </div>
                  ))}
                </div>
              )}

              {/* Form to resolve if not yet resolved */}
              {c.TrangThai !== 'DaXuLy' && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                    Phản hồi giải quyết từ Admin:
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Nhập hướng xử lý (ví dụ: Đã liên hệ hai bên, hoàn 100% tiền cọc...)"
                      value={resolutionMessages[c.MaKhieuNai] || ''}
                      onChange={(e) =>
                        setResolutionMessages((prev) => ({
                          ...prev,
                          [c.MaKhieuNai]: e.target.value
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.88rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => handleResolveComplaint(c.MaKhieuNai)}
                      className="button-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.88rem',
                        fontWeight: 600
                      }}
                    >
                      <Send size={15} /> Gửi giải quyết
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="data-table-card" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
            Không có khiếu nại nào trong danh mục này.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}